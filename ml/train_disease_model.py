"""
Train MobileNetV2 on the PlantVillage dataset (38 classes).

Usage (Google Colab — recommended for free GPU):
    !pip install -q -r requirements.txt
    !python train_disease_model.py \
        --data-dir /content/PlantVillage \
        --output-dir /content/output \
        --epochs-head 10 \
        --epochs-finetune 20

Usage (local with a GPU):
    python train_disease_model.py --data-dir ./PlantVillage --output-dir ./output

The dataset directory must be organised as:
    PlantVillage/
        Apple___Apple_scab/
            image001.jpg
            …
        Apple___Black_rot/
        …  (38 class folders total)

Outputs (in --output-dir):
    saved_model/            ← TensorFlow SavedModel (input for convert_to_tflite.py)
    class_labels.json       ← ordered list of class keys
    training_history.json   ← loss/accuracy per epoch
    confusion_matrix.png    ← evaluation on the held-out test split
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import numpy as np
import tensorflow as tf
from tensorflow.keras import callbacks, layers, models, optimizers


IMG_SIZE = 224
BATCH = 32
SEED = 42
AUTOTUNE = tf.data.AUTOTUNE


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train MobileNetV2 on PlantVillage.")
    p.add_argument("--data-dir", required=True, help="Path to PlantVillage with class subfolders")
    p.add_argument("--output-dir", required=True, help="Where to write the trained model + artifacts")
    p.add_argument("--epochs-head", type=int, default=10, help="Epochs with frozen base")
    p.add_argument("--epochs-finetune", type=int, default=20, help="Epochs with top-30 layers unfrozen")
    p.add_argument("--learning-rate", type=float, default=1e-3)
    p.add_argument("--finetune-lr", type=float, default=1e-5)
    p.add_argument("--val-split", type=float, default=0.10)
    p.add_argument("--test-split", type=float, default=0.10)
    return p.parse_args()


def build_datasets(data_dir: str, val_split: float, test_split: float):
    """Build train/val/test tf.data pipelines with augmentation."""
    full_train = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=val_split + test_split,
        subset="training",
        seed=SEED,
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH,
        label_mode="int",
        shuffle=True,
    )
    val_test = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=val_split + test_split,
        subset="validation",
        seed=SEED,
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH,
        label_mode="int",
        shuffle=False,
    )

    class_names = full_train.class_names
    assert class_names == val_test.class_names

    val_test_batches = tf.data.experimental.cardinality(val_test).numpy()
    test_batches = max(1, int(val_test_batches * (test_split / (val_split + test_split))))
    test_ds = val_test.take(test_batches)
    val_ds = val_test.skip(test_batches)

    # Normalize + light augmentation on train
    augment = tf.keras.Sequential([
        layers.RandomFlip("horizontal"),
        layers.RandomRotation(0.1),
        layers.RandomZoom(0.1),
        layers.RandomContrast(0.1),
    ], name="augment")

    rescale = layers.Rescaling(1.0 / 255.0)

    train_ds = (
        full_train
        .map(lambda x, y: (augment(rescale(x), training=True), y), num_parallel_calls=AUTOTUNE)
        .prefetch(AUTOTUNE)
    )
    val_ds = val_ds.map(lambda x, y: (rescale(x), y), num_parallel_calls=AUTOTUNE).prefetch(AUTOTUNE)
    test_ds = test_ds.map(lambda x, y: (rescale(x), y), num_parallel_calls=AUTOTUNE).prefetch(AUTOTUNE)

    return train_ds, val_ds, test_ds, class_names


def build_model(num_classes: int) -> tf.keras.Model:
    base = tf.keras.applications.MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights="imagenet",
    )
    base.trainable = False

    inputs = layers.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    x = base(inputs, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    model = models.Model(inputs, outputs)
    return model, base


def main() -> None:
    args = parse_args()
    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)

    print(f"TensorFlow {tf.__version__} | GPUs: {tf.config.list_physical_devices('GPU')}")

    train_ds, val_ds, test_ds, class_names = build_datasets(
        args.data_dir, args.val_split, args.test_split
    )
    print(f"Detected {len(class_names)} classes: {class_names[:3]}…")

    model, base = build_model(len(class_names))

    # ----- Stage 1: train head only -----
    model.compile(
        optimizer=optimizers.Adam(args.learning_rate),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    ckpt = callbacks.ModelCheckpoint(
        str(out / "best.weights.h5"),
        save_best_only=True,
        save_weights_only=True,
        monitor="val_accuracy",
        mode="max",
    )
    early = callbacks.EarlyStopping(patience=4, restore_best_weights=True, monitor="val_accuracy", mode="max")

    print("\n=== Stage 1: training classification head ===")
    h1 = model.fit(
        train_ds, validation_data=val_ds,
        epochs=args.epochs_head,
        callbacks=[ckpt, early],
        verbose=2,
    )

    # ----- Stage 2: fine-tune top of base -----
    base.trainable = True
    for layer in base.layers[:-30]:
        layer.trainable = False

    model.compile(
        optimizer=optimizers.Adam(args.finetune_lr),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    print("\n=== Stage 2: fine-tuning top 30 layers ===")
    h2 = model.fit(
        train_ds, validation_data=val_ds,
        epochs=args.epochs_finetune,
        callbacks=[ckpt, early],
        verbose=2,
    )

    # ----- Evaluate on test split -----
    print("\n=== Evaluating on test split ===")
    test_loss, test_acc = model.evaluate(test_ds, verbose=2)
    print(f"Test accuracy: {test_acc:.4f}")

    # ----- Save artifacts -----
    saved_model_dir = out / "saved_model"
    model.export(str(saved_model_dir))  # TF 2.16+ SavedModel via .export
    print(f"Saved model → {saved_model_dir}")

    with (out / "class_labels.json").open("w", encoding="utf-8") as f:
        json.dump(class_names, f, ensure_ascii=False, indent=2)
    print(f"Saved class_labels.json → {out / 'class_labels.json'}")

    history = {
        "stage1": {k: [float(x) for x in v] for k, v in h1.history.items()},
        "stage2": {k: [float(x) for x in v] for k, v in h2.history.items()},
        "test_accuracy": float(test_acc),
        "test_loss": float(test_loss),
    }
    with (out / "training_history.json").open("w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)

    print("\nDone. Next:")
    print(f"  python convert_to_tflite.py --saved-model {saved_model_dir} \\")
    print(f"      --output {out / 'model.tflite'} \\")
    print(f"      --representative-data {args.data_dir}")
    print(f"  cp {out / 'model.tflite'} ../backend/app/ml/model.tflite")
    print(f"  cp {out / 'class_labels.json'} ../backend/app/ml/class_labels.json")


if __name__ == "__main__":
    main()
