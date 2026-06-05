"""
Convert a trained Keras SavedModel into an INT8-quantized TFLite file.

Usage:
    python convert_to_tflite.py \
        --saved-model ./output/saved_model \
        --output      ./output/model.tflite \
        --representative-data ./PlantVillage

INT8 post-training quantization shrinks the model ~4× (15 MB → ~4 MB) and
runs faster on CPU-only hosts like DigitalOcean basic-xxs. The representative
dataset (a few hundred images sampled from the training set) is required so
the converter can calibrate activation ranges.
"""
from __future__ import annotations

import argparse
import random
from pathlib import Path

import numpy as np
import tensorflow as tf
from PIL import Image


IMG_SIZE = 224


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Convert SavedModel → INT8 TFLite")
    p.add_argument("--saved-model", required=True, help="Path to the SavedModel directory")
    p.add_argument("--output", required=True, help="Path to write model.tflite")
    p.add_argument("--representative-data", required=True,
                   help="Directory of class-labelled images (same shape as training set)")
    p.add_argument("--num-calibration-samples", type=int, default=200)
    p.add_argument("--no-quantize", action="store_true",
                   help="Skip INT8 quantization and emit a float32 .tflite (larger, slower).")
    return p.parse_args()


def collect_images(root: Path, n: int) -> list[Path]:
    """Pick n images at random across all class folders."""
    paths: list[Path] = []
    for ext in ("*.jpg", "*.jpeg", "*.png", "*.JPG"):
        paths.extend(root.rglob(ext))
    random.seed(42)
    random.shuffle(paths)
    return paths[:n]


def representative_dataset(images: list[Path]):
    def gen():
        for p in images:
            try:
                img = Image.open(p).convert("RGB").resize((IMG_SIZE, IMG_SIZE))
            except Exception:
                continue
            arr = (np.asarray(img, dtype=np.float32) / 255.0)[None, ...]
            yield [arr]
    return gen


def main() -> None:
    args = parse_args()

    converter = tf.lite.TFLiteConverter.from_saved_model(args.saved_model)

    if not args.no_quantize:
        sample_paths = collect_images(Path(args.representative_data), args.num_calibration_samples)
        if not sample_paths:
            raise SystemExit(f"No images found under {args.representative_data}")
        print(f"Calibrating with {len(sample_paths)} images")

        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        converter.representative_dataset = representative_dataset(sample_paths)
        # Float16 fallback for ops INT8 can't represent (keeps the model robust).
        converter.target_spec.supported_types = [tf.float16]
        # Keep input/output as float32 so we don't need to dequantize in Python.
        converter.inference_input_type = tf.float32
        converter.inference_output_type = tf.float32

    tflite_bytes = converter.convert()

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(tflite_bytes)
    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"Wrote {out_path} ({size_mb:.2f} MB)")

    print("\nNext: drop the model + labels into the backend:")
    print(f"  cp {out_path} ../backend/app/ml/model.tflite")
    print(f"  cp {Path(args.saved_model).parent / 'class_labels.json'} ../backend/app/ml/class_labels.json")


if __name__ == "__main__":
    main()
