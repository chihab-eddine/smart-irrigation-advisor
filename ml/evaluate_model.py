"""
Evaluate the disease TFLite model against a labeled image folder.

Expected layout (one subfolder per class, named exactly like class_labels.json):

    images-dir/
        Tomato___Late_blight/
            photo1.jpg
            photo2.jpg
        Tomato___healthy/
            ...

Usage:
    python evaluate_model.py \
        --model    ../backend/app/ml/model.tflite \
        --labels   ../backend/app/ml/class_labels.json \
        --images-dir ./field_photos \
        --preprocess raw            # one of: raw efficientnet mobilenet imagenet
        --tta                       # add horizontal-flip test-time augmentation
        --compare-preprocess        # benchmark all four modes and pick the best

The "--compare-preprocess" flag is the key tool for diagnosing whether you have
the right MODEL_PREPROCESS env var set. Run it once with ~30 labeled photos and
whichever mode wins is the one to put in backend/.env.
"""
from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

try:
    from ai_edge_litert.interpreter import Interpreter  # type: ignore
except ImportError:  # pragma: no cover
    from tflite_runtime.interpreter import Interpreter  # type: ignore


def preprocess(pil_img: Image.Image, size: int, mode: str) -> np.ndarray:
    """Match exactly the production preprocessing in disease_service.py."""
    img = ImageOps.exif_transpose(pil_img).convert("RGB")
    w, h = img.size
    side = min(w, h)
    img = img.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))
    img = img.resize((size, size), Image.BILINEAR)
    arr = np.asarray(img, dtype=np.float32)
    if mode == "efficientnet":
        arr = arr / 127.5 - 1.0
    elif mode == "mobilenet":
        arr = arr / 255.0
    elif mode == "imagenet":
        arr = arr / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        arr = (arr - mean) / std
    # "raw" → unchanged
    return arr


def softmax(x: np.ndarray) -> np.ndarray:
    s = float(x.sum())
    if 0.99 <= s <= 1.01 and (x >= 0).all():
        return x
    e = np.exp(x - x.max())
    return e / e.sum()


def predict(interp, in_idx: int, out_idx: int, arr: np.ndarray, tta: bool) -> np.ndarray:
    interp.set_tensor(in_idx, np.expand_dims(arr, 0))
    interp.invoke()
    probs = softmax(interp.get_tensor(out_idx)[0])
    if tta:
        flipped = arr[:, ::-1, :].copy()
        interp.set_tensor(in_idx, np.expand_dims(flipped, 0))
        interp.invoke()
        probs2 = softmax(interp.get_tensor(out_idx)[0])
        probs = (probs + probs2) / 2.0
    return probs


def run_eval(interp, labels, images, preprocess_mode, size, tta, verbose=False):
    in_d = interp.get_input_details()[0]
    out_d = interp.get_output_details()[0]
    top1 = top5 = total = 0
    per_class_correct = defaultdict(int)
    per_class_total = defaultdict(int)
    label_to_idx = {l: i for i, l in enumerate(labels)}

    for path, true_label in images:
        if true_label not in label_to_idx:
            continue
        try:
            arr = preprocess(Image.open(path), size, preprocess_mode)
        except Exception as e:
            print(f"  skip {path.name}: {e}")
            continue
        probs = predict(interp, in_d["index"], out_d["index"], arr, tta)
        top_idx = np.argsort(probs)[::-1]
        pred_label = labels[int(top_idx[0])]
        top5_labels = [labels[int(i)] for i in top_idx[:5]]

        total += 1
        per_class_total[true_label] += 1
        if pred_label == true_label:
            top1 += 1
            per_class_correct[true_label] += 1
        if true_label in top5_labels:
            top5 += 1
        if verbose:
            flag = "OK " if pred_label == true_label else "BAD"
            print(f"  [{flag}] {path.name:40s} true={true_label:35s} pred={pred_label:35s} conf={probs[top_idx[0]]:.2f}")

    return {
        "n": total,
        "top1": top1 / total if total else 0.0,
        "top5": top5 / total if total else 0.0,
        "per_class_correct": dict(per_class_correct),
        "per_class_total": dict(per_class_total),
    }


def collect_images(images_dir: Path, labels: list[str]):
    label_set = set(labels)
    items = []
    for sub in sorted(images_dir.iterdir()):
        if not sub.is_dir() or sub.name not in label_set:
            continue
        for ext in ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG"):
            for f in sub.glob(ext):
                items.append((f, sub.name))
    return items


def print_report(name: str, res: dict, per_class=False):
    print(f"\n=== {name} ===")
    print(f"  samples: {res['n']}")
    print(f"  top-1 accuracy: {res['top1']:.2%}")
    print(f"  top-5 accuracy: {res['top5']:.2%}")
    if per_class:
        print("  per-class:")
        for k in sorted(res["per_class_total"]):
            n = res["per_class_total"][k]
            c = res["per_class_correct"].get(k, 0)
            print(f"    {k:45s} {c}/{n} = {c/n if n else 0:.0%}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--model", required=True)
    p.add_argument("--labels", required=True)
    p.add_argument("--images-dir", required=True)
    p.add_argument("--preprocess", default="raw", choices=["raw", "efficientnet", "mobilenet", "imagenet"])
    p.add_argument("--tta", action="store_true", help="Use test-time augmentation (horizontal flip)")
    p.add_argument("--compare-preprocess", action="store_true",
                   help="Run all four preprocessing modes and print a ranked comparison")
    p.add_argument("--per-class", action="store_true", help="Print per-class accuracy")
    p.add_argument("--verbose", action="store_true", help="Print one line per image")
    args = p.parse_args()

    labels: list[str] = json.loads(Path(args.labels).read_text())
    interp = Interpreter(model_path=args.model)
    interp.allocate_tensors()
    in_shape = interp.get_input_details()[0]["shape"]
    size = int(in_shape[1]) if int(in_shape[1]) > 0 else 224
    print(f"Model: {args.model}  input={tuple(in_shape)}  size={size}")

    images = collect_images(Path(args.images_dir), labels)
    if not images:
        print(f"\nNo images found in {args.images_dir}.")
        print("Expected subfolders named like the class keys, e.g.")
        print("    field_photos/Tomato___Late_blight/IMG_001.jpg")
        return
    print(f"Found {len(images)} labeled images across "
          f"{len({lbl for _, lbl in images})} classes\n")

    if args.compare_preprocess:
        results = {}
        for mode in ("raw", "efficientnet", "mobilenet", "imagenet"):
            res = run_eval(interp, labels, images, mode, size, args.tta)
            results[mode] = res
            print_report(f"preprocess={mode} tta={args.tta}", res)
        ranked = sorted(results.items(), key=lambda kv: kv[1]["top1"], reverse=True)
        print("\n=== RANKING (by top-1) ===")
        for mode, res in ranked:
            print(f"  {mode:13s}  top1={res['top1']:.2%}  top5={res['top5']:.2%}")
        print(f"\nBEST: MODEL_PREPROCESS={ranked[0][0]}  → put this in backend/.env")
    else:
        res = run_eval(interp, labels, images, args.preprocess, size, args.tta, verbose=args.verbose)
        print_report(f"preprocess={args.preprocess} tta={args.tta}", res, per_class=args.per_class)


if __name__ == "__main__":
    main()
