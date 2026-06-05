# ML model directory

`disease_service.py` loads two files from this directory:

- `model.tflite` — TFLite model for plant disease classification (38 classes).
- `class_labels.json` — JSON array, ordered, of the 38 class keys. The keys must
  match the entries in `DISEASE_INFO` in `disease_service.py` so that bilingual
  treatment text resolves correctly.

## Using a Pre-Trained Model (Recommended)

Instead of training your own model, you can download and convert a pre-trained
EfficientNet model from HuggingFace:

```bash
# From the project root (Smart_Irrigation_Advisor/)
cd ml
pip install tensorflow huggingface_hub
python download_and_convert_model.py
```

This will:
1. Download the model from [Nefflymicn/PlantVillage-plant-disease-detection](https://huggingface.co/Nefflymicn/PlantVillage-plant-disease-detection)
2. Convert it to TFLite format
3. Save `model.tflite` to this directory
4. Verify the model works correctly

For a smaller model (~10 MB instead of ~37 MB), use INT8 quantisation:
```bash
python download_and_convert_model.py --int8
```

**Important:** Set `MODEL_PREPROCESS` to match how the model was trained.
Wrong preprocessing silently degrades accuracy by 30–60% — there is no error,
just bad predictions. Options:

| Value           | Behavior                          | Use for                                    |
|-----------------|-----------------------------------|--------------------------------------------|
| `raw` (default) | float32 in [0, 255], no scaling   | Modern Keras EfficientNet (built-in Rescaling layer) — e.g. the Nefflymicn HF model |
| `efficientnet`  | scale to [-1, 1]                  | MobileNetV2, Inception, older EfficientNet exports without baked normalization |
| `mobilenet`     | scale to [0, 1]                   | Custom-trained MobileNetV2 with `Rescaling(1/255)` |
| `imagenet`      | [0,1] then mean/std normalize     | PyTorch-exported models using ImageNet stats |

If predictions look random or stuck on one class, **the first thing to try
is switching `MODEL_PREPROCESS`** between these four values and comparing.

## Inference-time quality features (already applied)

The service automatically applies these every call — no config needed:

- **Center-crop** the largest square before resize → no aspect-ratio distortion
- **Test-Time Augmentation** → averaged prediction over original + horizontal flip
- **Softmax** → output is always a valid probability, even if the model emits logits
- **Entropy + confidence thresholds** → response has `uncertain: true` when the
  photo is likely out-of-distribution. Tune with env vars:
  `DISEASE_CONFIDENCE_THRESHOLD` (default 0.55), `DISEASE_ENTROPY_THRESHOLD` (default 0.75)
- **Optional `crop_type` form field** on `POST /api/disease/predict` → restricts
  predictions to that plant's classes. Eliminates most cross-crop confusion
  (e.g. tomato-early-blight vs potato-early-blight).

## Training Your Own Model

Training notebook lives at `../../ml/train_disease_model.ipynb` (repo root).
After training and INT8 quantization, drop `model.tflite` and
`class_labels.json` in this directory.

## Behaviour When Files Are Missing

If either file is missing, `POST /api/disease/predict` returns HTTP 503 with a
clear error message, and `GET /api/disease/status` reports `available: false`.
