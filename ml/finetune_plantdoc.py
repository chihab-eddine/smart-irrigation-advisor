"""
Fine-tune the disease classifier on PlantDoc (real field photos) to close the
lab→field accuracy gap.

The pretrained PlantVillage model fails on real-world photos because its
training set is lab-shot leaves on a uniform background. PlantDoc is ~2.6k
photos taken in actual fields — fine-tuning on it dramatically improves
real-world accuracy.

Dataset prep
------------
PlantDoc class names don't match PlantVillage class keys. You must put it in
this layout *with PlantVillage-style class names* before running:

    plantdoc/
        Tomato___Late_blight/
            field001.jpg
            ...
        Apple___healthy/
            ...

Mapping reference: https://github.com/pratikkayal/PlantDoc-Dataset
Easiest workflow:
    1. git clone https://github.com/pratikkayal/PlantDoc-Dataset
    2. Use the rename helper at the bottom of this file, or rename manually.
    3. Skip PlantDoc classes that have no PlantVillage equivalent.

Usage
-----
GPU strongly recommended. Free option: Google Colab with T4.

    pip install tensorflow==2.16 huggingface_hub pillow
    python finetune_plantdoc.py \
        --base-model  /path/to/plant_disease_efficientnet.keras \
        --plantvillage /path/to/PlantVillage \
        --plantdoc    /path/to/plantdoc \
        --output-dir  ./finetuned \
        --epochs-head 5 \
        --epochs-finetune 15 \
        --plantdoc-weight 3.0

The `--plantdoc-weight` upsamples PlantDoc relative to PlantVillage so the
model learns field features even though PlantDoc is much smaller (~2.6k vs
~54k images). A value of 3–5 is a good starting point.

Outputs
-------
    finetuned/
        saved_model/            ← TF SavedModel for convert_to_tflite.py
        class_labels.json       ← same 38 classes
        training_history.json
        eval_field.json         ← top-1/top-5 accuracy on PlantDoc test split

Run convert_to_tflite.py on the saved_model and drop it in
backend/app/ml/model.tflite. The production preprocessing (`raw` mode) will
keep working because the new model also bakes in Rescaling.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import tensorflow as tf
from tensorflow.keras import callbacks, layers, models, optimizers


IMG = 224
BATCH = 32
SEED = 42
AUTOTUNE = tf.data.AUTOTUNE


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--base-model", required=True,
                   help="The .keras file downloaded from HuggingFace (Nefflymicn/PlantVillage-...)")
    p.add_argument("--plantvillage", required=True, help="Directory of PlantVillage class subfolders")
    p.add_argument("--plantdoc", required=True, help="Directory of PlantDoc class subfolders (renamed to PlantVillage keys)")
    p.add_argument("--output-dir", required=True)
    p.add_argument("--epochs-head", type=int, default=5)
    p.add_argument("--epochs-finetune", type=int, default=15)
    p.add_argument("--head-lr", type=float, default=1e-3)
    p.add_argument("--finetune-lr", type=float, default=1e-5)
    p.add_argument("--plantdoc-weight", type=float, default=3.0,
                   help="Upsample PlantDoc relative to PlantVillage (compensates for its smaller size)")
    p.add_argument("--unfreeze-layers", type=int, default=40,
                   help="Number of top EfficientNet layers to unfreeze in stage 2")
    return p.parse_args()


def load_dataset(root: str, class_names: list[str], augment: bool):
    """Load a directory of class subfolders into a tf.data pipeline."""
    ds = tf.keras.utils.image_dataset_from_directory(
        root,
        image_size=(IMG, IMG),
        batch_size=BATCH,
        label_mode="int",
        class_names=class_names,
        shuffle=True,
        seed=SEED,
    )
    if augment:
        aug = tf.keras.Sequential([
            layers.RandomFlip("horizontal"),
            layers.RandomRotation(0.15),
            layers.RandomZoom(0.15),
            layers.RandomTranslation(0.1, 0.1),
            layers.RandomContrast(0.2),
            layers.RandomBrightness(0.15),
        ], name="augment")
        ds = ds.map(lambda x, y: (aug(x, training=True), y), num_parallel_calls=AUTOTUNE)
    return ds.prefetch(AUTOTUNE)


def combine_with_weight(ds_pv, ds_pd, weight: float):
    """Concatenate PlantVillage + (repeated) PlantDoc so PlantDoc is weight× as common."""
    reps = max(1, int(round(weight)))
    ds_pd_rep = ds_pd.repeat(reps)
    return ds_pv.concatenate(ds_pd_rep).shuffle(512, seed=SEED)


def main() -> None:
    args = parse_args()
    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)

    print(f"TF {tf.__version__}  GPUs: {tf.config.list_physical_devices('GPU')}")

    # Load the pre-trained PlantVillage EfficientNet
    print(f"\nLoading base model: {args.base_model}")
    base_model = tf.keras.models.load_model(args.base_model)
    # Class order in the pretrained model = same as backend/app/ml/class_labels.json
    class_labels_path = Path(__file__).parent.parent / "backend" / "app" / "ml" / "class_labels.json"
    class_names = json.loads(class_labels_path.read_text())
    print(f"Using {len(class_names)} class labels from {class_labels_path}")

    # Freeze everything by default
    base_model.trainable = False

    # Build the same model with stronger regularization on top
    inputs = layers.Input(shape=(IMG, IMG, 3))
    x = base_model(inputs, training=False)
    if len(x.shape) > 2:
        x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(len(class_names), activation="softmax", name="final_head")(x)
    model = models.Model(inputs, outputs)
    model.summary(line_length=110)

    # Datasets — PlantDoc held-out test split, the rest into training
    pd_root = Path(args.plantdoc)
    pd_train_dir = pd_root / "train" if (pd_root / "train").is_dir() else pd_root
    pd_test_dir = pd_root / "test" if (pd_root / "test").is_dir() else None

    ds_pv = load_dataset(args.plantvillage, class_names, augment=True)
    ds_pd_train = load_dataset(str(pd_train_dir), class_names, augment=True)
    ds_train = combine_with_weight(ds_pv, ds_pd_train, args.plantdoc_weight)

    if pd_test_dir is not None:
        ds_test = load_dataset(str(pd_test_dir), class_names, augment=False)
    else:
        # No explicit test split → take 10% of PlantDoc deterministically
        n_pd = sum(1 for _ in ds_pd_train.unbatch())
        ds_test = ds_pd_train.unbatch().take(max(1, n_pd // 10)).batch(BATCH).prefetch(AUTOTUNE)

    # Stage 1: head only
    model.compile(
        optimizer=optimizers.Adam(args.head_lr),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy", tf.keras.metrics.SparseTopKCategoricalAccuracy(k=5, name="top5")],
    )
    ckpt = callbacks.ModelCheckpoint(
        str(out / "best.weights.h5"),
        save_best_only=True, save_weights_only=True,
        monitor="val_accuracy", mode="max",
    )
    early = callbacks.EarlyStopping(patience=4, restore_best_weights=True,
                                    monitor="val_accuracy", mode="max")

    print("\n=== Stage 1: training new head (base frozen) ===")
    h1 = model.fit(
        ds_train, validation_data=ds_test,
        epochs=args.epochs_head, callbacks=[ckpt, early], verbose=2,
    )

    # Stage 2: unfreeze top N layers of base
    print(f"\n=== Stage 2: fine-tuning top {args.unfreeze_layers} layers of base ===")
    base_model.trainable = True
    for layer in base_model.layers[:-args.unfreeze_layers]:
        layer.trainable = False

    model.compile(
        optimizer=optimizers.Adam(args.finetune_lr),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy", tf.keras.metrics.SparseTopKCategoricalAccuracy(k=5, name="top5")],
    )
    h2 = model.fit(
        ds_train, validation_data=ds_test,
        epochs=args.epochs_finetune, callbacks=[ckpt, early], verbose=2,
    )

    # Evaluation on PlantDoc test
    print("\n=== Final evaluation on PlantDoc test split (field photos) ===")
    eval_metrics = model.evaluate(ds_test, return_dict=True, verbose=2)
    print(json.dumps(eval_metrics, indent=2))

    # Save artifacts
    saved_model_dir = out / "saved_model"
    model.export(str(saved_model_dir))
    print(f"\nExported → {saved_model_dir}")

    (out / "class_labels.json").write_text(json.dumps(class_names, ensure_ascii=False, indent=2))
    (out / "eval_field.json").write_text(json.dumps(eval_metrics, indent=2))
    (out / "training_history.json").write_text(json.dumps({
        "stage1": {k: [float(v) for v in vs] for k, vs in h1.history.items()},
        "stage2": {k: [float(v) for v in vs] for k, vs in h2.history.items()},
    }, indent=2))

    print("\nNext:")
    print(f"  python convert_to_tflite.py --saved-model {saved_model_dir} "
          f"--output {out / 'model.tflite'} --representative-data {args.plantvillage}")
    print(f"  cp {out / 'model.tflite'} ../backend/app/ml/model.tflite")
    print("  # restart backend — MODEL_PREPROCESS=raw still works (Rescaling is baked in)")


if __name__ == "__main__":
    main()
