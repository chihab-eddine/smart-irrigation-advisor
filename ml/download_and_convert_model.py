"""
Download a pre-trained PlantVillage EfficientNet model from HuggingFace
and convert it to TensorFlow Lite format.

Usage (local or Google Colab):
    pip install tensorflow huggingface_hub
    python download_and_convert_model.py

The output files are written to  ../backend/app/ml/
    - model.tflite          (~37 MB float32, or ~10 MB int8 quantized)
    - class_labels.json     (already present — not overwritten)
"""

import json
import os
import sys

# ---------------------------------------------------------------------------
# Resolve output directory relative to this script
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ML_DIR = os.path.join(SCRIPT_DIR, "..", "backend", "app", "ml")
os.makedirs(ML_DIR, exist_ok=True)

OUTPUT_TFLITE = os.path.join(ML_DIR, "model.tflite")


def download_keras_model() -> str:
    """Download the .keras file from HuggingFace Hub. Returns local path."""
    from huggingface_hub import hf_hub_download

    print("⬇️  Downloading model from HuggingFace Hub …")
    local_path = hf_hub_download(
        repo_id="Nefflymicn/PlantVillage-plant-disease-detection",
        filename="plant_disease_efficientnet.keras",
    )
    print(f"✅ Downloaded to: {local_path}")
    return local_path


def convert_to_tflite(keras_path: str, quantise_int8: bool = False) -> None:
    """Load a Keras model and convert it to TFLite."""
    import tensorflow as tf

    print("📦 Loading Keras model …")
    model = tf.keras.models.load_model(keras_path)
    model.summary()

    print("🔄 Converting to TFLite …")
    converter = tf.lite.TFLiteConverter.from_keras_model(model)

    if quantise_int8:
        print("   → Applying dynamic-range INT8 quantisation (smaller file)")
        converter.optimizations = [tf.lite.Optimize.DEFAULT]

    tflite_model = converter.convert()

    with open(OUTPUT_TFLITE, "wb") as f:
        f.write(tflite_model)

    size_mb = os.path.getsize(OUTPUT_TFLITE) / (1024 * 1024)
    print(f"✅ Saved TFLite model to: {OUTPUT_TFLITE}  ({size_mb:.1f} MB)")


def verify_tflite() -> None:
    """Quick sanity check — load the model and print input/output shapes."""
    import numpy as np

    try:
        from ai_edge_litert.interpreter import Interpreter
    except ImportError:
        try:
            from tflite_runtime.interpreter import Interpreter
        except ImportError:
            import tensorflow as tf
            Interpreter = tf.lite.Interpreter

    print("\n🔍 Verifying TFLite model …")
    interp = Interpreter(model_path=OUTPUT_TFLITE)
    interp.allocate_tensors()

    inp = interp.get_input_details()[0]
    out = interp.get_output_details()[0]
    print(f"   Input:  name={inp['name']}  shape={inp['shape']}  dtype={inp['dtype']}")
    print(f"   Output: name={out['name']}  shape={out['shape']}  dtype={out['dtype']}")

    # Feed a dummy image (224×224×3, float32)
    dummy = np.random.rand(1, 224, 224, 3).astype(np.float32)
    interp.set_tensor(inp["index"], dummy)
    interp.invoke()
    probs = interp.get_tensor(out["index"])[0]
    print(f"   Output classes: {len(probs)}  (expected 38)")
    print(f"   Sum of probs:   {probs.sum():.4f}  (should be ~1.0)")

    labels_path = os.path.join(ML_DIR, "class_labels.json")
    if os.path.exists(labels_path):
        with open(labels_path) as f:
            labels = json.load(f)
        assert len(labels) == len(probs), (
            f"Label count mismatch: {len(labels)} labels vs {len(probs)} outputs"
        )
        print(f"   Labels file OK ({len(labels)} labels)")

    print("✅ Verification passed!\n")


def main():
    quantise = "--int8" in sys.argv
    keras_path = download_keras_model()
    convert_to_tflite(keras_path, quantise_int8=quantise)
    verify_tflite()

    print("=" * 60)
    print("🎉 Done!  Your model is ready at:")
    print(f"   {OUTPUT_TFLITE}")
    print()
    print("The backend will automatically pick it up on next start.")
    if not quantise:
        print("Tip: re-run with  --int8  to get a smaller (~10 MB) quantised model.")
    print("=" * 60)


if __name__ == "__main__":
    main()
