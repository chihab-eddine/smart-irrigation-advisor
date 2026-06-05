"""
Disease Detection Service — TFLite inference for plant disease classification.

Supports pre-trained models from HuggingFace (EfficientNet) or custom-trained
MobileNetV2 on PlantVillage dataset (38 classes).

Preprocessing is controlled by the MODEL_PREPROCESS env var:
  - "raw"         : pass float32 pixels in [0, 255] unchanged. Use this for
                    modern Keras EfficientNet models that have a Rescaling/
                    Normalization layer baked in (the HuggingFace
                    Nefflymicn/PlantVillage model is one of these).
  - "efficientnet": pixels rescaled to [-1, 1]  (same as MobileNetV2 / Inception)
  - "mobilenet"   : pixels rescaled to [ 0,  1]
  - "imagenet"    : [0, 1] then ImageNet mean/std normalization

Inference quality improvements applied automatically:
  - Center-crop the largest square before resize (no aspect-ratio distortion)
  - Test-Time Augmentation: average prediction over original + horizontal flip
  - Softmax over raw outputs so confidence is always a valid probability
  - Entropy-based "uncertain" flag for out-of-distribution photos
  - Optional crop_type filter restricts predictions to that plant's classes
"""
import io
import json
import logging
import math
import os
from typing import Optional

import numpy as np
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

MODEL_PREPROCESS = os.getenv("MODEL_PREPROCESS", "raw").lower()

# Reject predictions whose top-1 probability is below this (after softmax + TTA).
# Calibrated empirically — PlantVillage models on field photos usually peak
# around 0.3–0.5 when the photo is out-of-distribution.
CONFIDENCE_THRESHOLD = float(os.getenv("DISEASE_CONFIDENCE_THRESHOLD", "0.55"))
# Reject when the normalized entropy of the prediction is above this (1.0 = uniform).
ENTROPY_THRESHOLD = float(os.getenv("DISEASE_ENTROPY_THRESHOLD", "0.75"))

# ============================================
# Bilingual disease info — 38 PlantVillage classes
# ============================================
_GENERIC_HEALTHY_FR = "Aucune anomalie détectée. Continuez les bonnes pratiques culturales."
_GENERIC_HEALTHY_AR = "لم يتم اكتشاف أي عرض. تابع الممارسات الزراعية الجيدة."

DISEASE_INFO = {
    # Apple
    "Apple___Apple_scab": {
        "name_fr": "Tavelure du pommier", "name_ar": "جرب التفاح", "crop_type": "Apple",
        "treatment_fr": "Appliquer un fongicide à base de captane ou mancozèbe. Éliminer les feuilles tombées et les fruits infectés.",
        "treatment_ar": "استخدم مبيداً فطرياً أساسه الكابتان أو المانكوزيب. أزل الأوراق المتساقطة والثمار المصابة.",
    },
    "Apple___Black_rot": {
        "name_fr": "Pourriture noire du pommier", "name_ar": "العفن الأسود للتفاح", "crop_type": "Apple",
        "treatment_fr": "Retirer les fruits momifiés et les branches mortes. Appliquer un fongicide à base de cuivre.",
        "treatment_ar": "أزل الثمار المتعفنة والأغصان الميتة. استخدم مبيداً فطرياً أساسه النحاس.",
    },
    "Apple___Cedar_apple_rust": {
        "name_fr": "Rouille du pommier", "name_ar": "صدأ التفاح", "crop_type": "Apple",
        "treatment_fr": "Pulvériser un fongicide préventif au printemps. Éloigner les genévriers (hôte alternatif).",
        "treatment_ar": "رش مبيد فطري وقائي في الربيع. أبعد أشجار العرعر (المضيف البديل).",
    },
    "Apple___healthy": {
        "name_fr": "Pommier sain", "name_ar": "تفاح سليم", "crop_type": "Apple",
        "treatment_fr": _GENERIC_HEALTHY_FR, "treatment_ar": _GENERIC_HEALTHY_AR,
    },
    # Blueberry
    "Blueberry___healthy": {
        "name_fr": "Myrtille saine", "name_ar": "توت أزرق سليم", "crop_type": "Blueberry",
        "treatment_fr": _GENERIC_HEALTHY_FR, "treatment_ar": _GENERIC_HEALTHY_AR,
    },
    # Cherry
    "Cherry_(including_sour)___Powdery_mildew": {
        "name_fr": "Oïdium du cerisier", "name_ar": "البياض الدقيقي للكرز", "crop_type": "Cherry",
        "treatment_fr": "Appliquer du soufre ou un fongicide systémique. Améliorer l'aération de la canopée par la taille.",
        "treatment_ar": "استخدم الكبريت أو مبيداً جهازياً. حسّن تهوية الشجرة بالتقليم.",
    },
    "Cherry_(including_sour)___healthy": {
        "name_fr": "Cerisier sain", "name_ar": "كرز سليم", "crop_type": "Cherry",
        "treatment_fr": _GENERIC_HEALTHY_FR, "treatment_ar": _GENERIC_HEALTHY_AR,
    },
    # Corn (maize)
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": {
        "name_fr": "Cercosporiose du maïs", "name_ar": "تبقع الذرة السركوسبوري", "crop_type": "Corn",
        "treatment_fr": "Appliquer un fongicide foliaire (azoxystrobine). Pratiquer la rotation et enfouir les résidus de récolte.",
        "treatment_ar": "استخدم مبيداً فطرياً ورقياً. اتبع دورة زراعية وادفن بقايا المحاصيل.",
    },
    "Corn_(maize)___Common_rust_": {
        "name_fr": "Rouille commune du maïs", "name_ar": "الصدأ الشائع للذرة", "crop_type": "Corn",
        "treatment_fr": "Utiliser des variétés résistantes. Fongicides foliaires en cas d'attaque sévère.",
        "treatment_ar": "استخدم أصنافاً مقاومة. مبيدات فطرية ورقية عند الإصابة الشديدة.",
    },
    "Corn_(maize)___Northern_Leaf_Blight": {
        "name_fr": "Helminthosporiose du maïs", "name_ar": "اللفحة الشمالية للذرة", "crop_type": "Corn",
        "treatment_fr": "Semer des hybrides résistants. Appliquer un fongicide (propiconazole) dès les premiers symptômes.",
        "treatment_ar": "ازرع أصنافاً هجينة مقاومة. استخدم مبيداً فطرياً عند ظهور الأعراض الأولى.",
    },
    "Corn_(maize)___healthy": {
        "name_fr": "Maïs sain", "name_ar": "ذرة سليمة", "crop_type": "Corn",
        "treatment_fr": _GENERIC_HEALTHY_FR, "treatment_ar": _GENERIC_HEALTHY_AR,
    },
    # Grape
    "Grape___Black_rot": {
        "name_fr": "Pourriture noire de la vigne", "name_ar": "العفن الأسود للعنب", "crop_type": "Grape",
        "treatment_fr": "Pulvériser du myclobutanil ou un fongicide cuprique. Tailler pour aérer les grappes.",
        "treatment_ar": "رش مبيد فطري. قلم لتهوية العناقيد.",
    },
    "Grape___Esca_(Black_Measles)": {
        "name_fr": "Esca (Maladie du bois)", "name_ar": "إسكا (مرض الخشب)", "crop_type": "Grape",
        "treatment_fr": "Pas de traitement curatif. Tailler les bois morts et désinfecter les outils de taille.",
        "treatment_ar": "لا يوجد علاج شافٍ. قلم الخشب الميت وعقّم أدوات التقليم.",
    },
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": {
        "name_fr": "Tache des feuilles (Isariopsis)", "name_ar": "تبقع أوراق العنب", "crop_type": "Grape",
        "treatment_fr": "Appliquer un fongicide cuprique. Éliminer les feuilles infectées.",
        "treatment_ar": "استخدم مبيداً نحاسياً. أزل الأوراق المصابة.",
    },
    "Grape___healthy": {
        "name_fr": "Vigne saine", "name_ar": "عنب سليم", "crop_type": "Grape",
        "treatment_fr": _GENERIC_HEALTHY_FR, "treatment_ar": _GENERIC_HEALTHY_AR,
    },
    # Orange
    "Orange___Haunglongbing_(Citrus_greening)": {
        "name_fr": "Maladie du dragon jaune (HLB)", "name_ar": "مرض التخضير الحمضي", "crop_type": "Orange",
        "treatment_fr": "Maladie incurable. Arracher les arbres infectés. Lutter contre le psylle vecteur (Diaphorina citri).",
        "treatment_ar": "مرض غير قابل للشفاء. اقلع الأشجار المصابة. كافح الحشرة الناقلة.",
    },
    # Peach
    "Peach___Bacterial_spot": {
        "name_fr": "Tache bactérienne du pêcher", "name_ar": "البقع البكتيرية للخوخ", "crop_type": "Peach",
        "treatment_fr": "Pulvériser un produit cuivré au repos végétatif. Utiliser des variétés résistantes.",
        "treatment_ar": "رش مادة نحاسية في فترة السكون. استخدم أصنافاً مقاومة.",
    },
    "Peach___healthy": {
        "name_fr": "Pêcher sain", "name_ar": "خوخ سليم", "crop_type": "Peach",
        "treatment_fr": _GENERIC_HEALTHY_FR, "treatment_ar": _GENERIC_HEALTHY_AR,
    },
    # Pepper (bell)
    "Pepper,_bell___Bacterial_spot": {
        "name_fr": "Tache bactérienne du poivron", "name_ar": "البقع البكتيرية للفلفل", "crop_type": "Pepper",
        "treatment_fr": "Utiliser des semences certifiées. Appliquer un traitement cuivré. Éviter l'irrigation par aspersion.",
        "treatment_ar": "استخدم بذوراً معتمدة. عالج بمنتج نحاسي. تجنب الري بالرش.",
    },
    "Pepper,_bell___healthy": {
        "name_fr": "Poivron sain", "name_ar": "فلفل سليم", "crop_type": "Pepper",
        "treatment_fr": _GENERIC_HEALTHY_FR, "treatment_ar": _GENERIC_HEALTHY_AR,
    },
    # Potato
    "Potato___Early_blight": {
        "name_fr": "Alternariose de la pomme de terre", "name_ar": "اللفحة المبكرة للبطاطس", "crop_type": "Potato",
        "treatment_fr": "Fongicides préventifs (chlorothalonil, mancozèbe). Rotation sur 3 ans minimum.",
        "treatment_ar": "مبيدات فطرية وقائية. دورة زراعية لا تقل عن 3 سنوات.",
    },
    "Potato___Late_blight": {
        "name_fr": "Mildiou de la pomme de terre", "name_ar": "اللفحة المتأخرة للبطاطس", "crop_type": "Potato",
        "treatment_fr": "Traitement urgent au mancozèbe ou métalaxyl. Détruire les plants infectés. Surveiller l'humidité.",
        "treatment_ar": "علاج عاجل بالمانكوزيب. أتلف النباتات المصابة. راقب الرطوبة.",
    },
    "Potato___healthy": {
        "name_fr": "Pomme de terre saine", "name_ar": "بطاطس سليمة", "crop_type": "Potato",
        "treatment_fr": _GENERIC_HEALTHY_FR, "treatment_ar": _GENERIC_HEALTHY_AR,
    },
    # Raspberry
    "Raspberry___healthy": {
        "name_fr": "Framboisier sain", "name_ar": "توت العليق سليم", "crop_type": "Raspberry",
        "treatment_fr": _GENERIC_HEALTHY_FR, "treatment_ar": _GENERIC_HEALTHY_AR,
    },
    # Soybean
    "Soybean___healthy": {
        "name_fr": "Soja sain", "name_ar": "فول الصويا سليم", "crop_type": "Soybean",
        "treatment_fr": _GENERIC_HEALTHY_FR, "treatment_ar": _GENERIC_HEALTHY_AR,
    },
    # Squash
    "Squash___Powdery_mildew": {
        "name_fr": "Oïdium des cucurbitacées", "name_ar": "البياض الدقيقي للقرعيات", "crop_type": "Squash",
        "treatment_fr": "Pulvériser du soufre ou du bicarbonate de potassium. Espacer les plants pour aérer.",
        "treatment_ar": "رش الكبريت أو بيكربونات البوتاسيوم. باعد بين النباتات للتهوية.",
    },
    # Strawberry
    "Strawberry___Leaf_scorch": {
        "name_fr": "Brûlure des feuilles du fraisier", "name_ar": "احتراق أوراق الفراولة", "crop_type": "Strawberry",
        "treatment_fr": "Éliminer les feuilles atteintes. Appliquer un fongicide systémique. Éviter l'eau stagnante.",
        "treatment_ar": "أزل الأوراق المصابة. استخدم مبيداً جهازياً. تجنب الماء الراكد.",
    },
    "Strawberry___healthy": {
        "name_fr": "Fraisier sain", "name_ar": "فراولة سليمة", "crop_type": "Strawberry",
        "treatment_fr": _GENERIC_HEALTHY_FR, "treatment_ar": _GENERIC_HEALTHY_AR,
    },
    # Tomato
    "Tomato___Bacterial_spot": {
        "name_fr": "Tache bactérienne de la tomate", "name_ar": "البقع البكتيرية للطماطم", "crop_type": "Tomato",
        "treatment_fr": "Traitements cuivrés répétés. Éviter l'arrosage des feuilles. Rotation des cultures.",
        "treatment_ar": "علاجات نحاسية متكررة. تجنب ري الأوراق. اتبع دورة زراعية.",
    },
    "Tomato___Early_blight": {
        "name_fr": "Alternariose de la tomate", "name_ar": "اللفحة المبكرة للطماطم", "crop_type": "Tomato",
        "treatment_fr": "Appliquer un fongicide (chlorothalonil ou mancozèbe). Pailler le sol et tuteurer les plants.",
        "treatment_ar": "استخدم مبيداً فطرياً. غطّ التربة وادعم النباتات.",
    },
    "Tomato___Late_blight": {
        "name_fr": "Mildiou de la tomate", "name_ar": "اللفحة المتأخرة للطماطم", "crop_type": "Tomato",
        "treatment_fr": "Traitement urgent au mancozèbe ou métalaxyl. Détruire les plants infectés.",
        "treatment_ar": "علاج عاجل بالمانكوزيب. أتلف النباتات المصابة.",
    },
    "Tomato___Leaf_Mold": {
        "name_fr": "Cladosporiose de la tomate", "name_ar": "عفن أوراق الطماطم", "crop_type": "Tomato",
        "treatment_fr": "Améliorer la ventilation de la serre. Appliquer un fongicide cuprique. Réduire l'humidité.",
        "treatment_ar": "حسّن تهوية الدفيئة. استخدم مبيداً نحاسياً. قلّل الرطوبة.",
    },
    "Tomato___Septoria_leaf_spot": {
        "name_fr": "Septoriose de la tomate", "name_ar": "السبتوريا في الطماطم", "crop_type": "Tomato",
        "treatment_fr": "Éliminer les feuilles inférieures atteintes. Fongicide cuprique ou chlorothalonil.",
        "treatment_ar": "أزل الأوراق السفلية المصابة. مبيد نحاسي.",
    },
    "Tomato___Spider_mites Two-spotted_spider_mite": {
        "name_fr": "Acariens (Tetranychus urticae)", "name_ar": "العنكبوت الأحمر", "crop_type": "Tomato",
        "treatment_fr": "Pulvériser de l'eau savonneuse ou un acaricide. Favoriser les prédateurs naturels (Phytoseiulus).",
        "treatment_ar": "رش ماء وصابون أو مبيداً للعناكب. شجّع الأعداء الطبيعيين.",
    },
    "Tomato___Target_Spot": {
        "name_fr": "Cladosporiose (Target spot)", "name_ar": "تبقع الهدف للطماطم", "crop_type": "Tomato",
        "treatment_fr": "Appliquer un fongicide (azoxystrobine). Éliminer les résidus de culture.",
        "treatment_ar": "استخدم مبيداً فطرياً. أزل بقايا المحصول.",
    },
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": {
        "name_fr": "Virus TYLCV (enroulement jaune)", "name_ar": "فيروس تجعد واصفرار أوراق الطماطم", "crop_type": "Tomato",
        "treatment_fr": "Maladie incurable. Arracher les plants infectés. Lutter contre l'aleurode (Bemisia tabaci).",
        "treatment_ar": "مرض غير قابل للشفاء. اقلع النباتات المصابة. كافح الذبابة البيضاء.",
    },
    "Tomato___Tomato_mosaic_virus": {
        "name_fr": "Virus de la mosaïque de la tomate", "name_ar": "فيروس موزاييك الطماطم", "crop_type": "Tomato",
        "treatment_fr": "Pas de traitement curatif. Désinfecter outils et mains. Utiliser des variétés résistantes.",
        "treatment_ar": "لا يوجد علاج. عقّم الأدوات والأيدي. استخدم أصنافاً مقاومة.",
    },
    "Tomato___healthy": {
        "name_fr": "Tomate saine", "name_ar": "طماطم سليمة", "crop_type": "Tomato",
        "treatment_fr": _GENERIC_HEALTHY_FR, "treatment_ar": _GENERIC_HEALTHY_AR,
    },
}


# ============================================
# Model loading
# ============================================
_model = None
_labels: Optional[list] = None
_load_error: Optional[str] = None

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "ml", "model.tflite")
LABELS_PATH = os.path.join(os.path.dirname(__file__), "..", "ml", "class_labels.json")


def _load_model():
    """Lazy-load the TFLite model. Returns (interpreter, labels). Either may be None."""
    global _model, _labels, _load_error

    if _model is not None or _load_error is not None:
        return _model, _labels

    if not os.path.exists(MODEL_PATH):
        _load_error = f"Model file not found at {MODEL_PATH}"
        logger.warning(_load_error)
        return None, None

    try:
        # ai-edge-litert exposes the same Interpreter API as tflite-runtime
        try:
            from ai_edge_litert.interpreter import Interpreter  # type: ignore
        except ImportError:
            from tflite_runtime.interpreter import Interpreter  # type: ignore

        _model = Interpreter(model_path=MODEL_PATH)
        _model.allocate_tensors()
    except Exception as e:
        _load_error = f"Failed to load TFLite interpreter: {e}"
        logger.exception("TFLite load failed")
        _model = None
        return None, None

    try:
        with open(LABELS_PATH, "r", encoding="utf-8") as f:
            _labels = json.load(f)
    except Exception:
        # Fall back to the keys of DISEASE_INFO if the labels file is missing —
        # this still allows the model to run if it was trained with the same ordering.
        _labels = list(DISEASE_INFO.keys())

    return _model, _labels


class ModelUnavailableError(RuntimeError):
    """Raised when the disease detection model cannot be loaded."""


def _preprocess(pil_img: Image.Image, target_size: int) -> np.ndarray:
    """Center-crop the largest square, resize, then normalize per MODEL_PREPROCESS."""
    img = ImageOps.exif_transpose(pil_img).convert("RGB")
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side))
    img = img.resize((target_size, target_size), Image.BILINEAR)
    arr = np.asarray(img, dtype=np.float32)

    if MODEL_PREPROCESS == "efficientnet":
        arr = arr / 127.5 - 1.0
    elif MODEL_PREPROCESS == "mobilenet":
        arr = arr / 255.0
    elif MODEL_PREPROCESS == "imagenet":
        arr = arr / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        arr = (arr - mean) / std
    # "raw" → keep [0, 255] (matches Keras EfficientNet with built-in Rescaling)

    return arr


def _softmax(x: np.ndarray) -> np.ndarray:
    """Numerically-stable softmax. No-op if x already sums to ~1."""
    s = float(x.sum())
    if 0.99 <= s <= 1.01 and (x >= 0).all():
        return x
    e = np.exp(x - x.max())
    return e / e.sum()


def _normalized_entropy(probs: np.ndarray) -> float:
    """Entropy normalized to [0, 1]. 0 = perfectly confident, 1 = uniform guess."""
    p = np.clip(probs, 1e-12, 1.0)
    h = -float((p * np.log(p)).sum())
    return h / math.log(len(p))


def _run_inference(interpreter, img_array: np.ndarray) -> np.ndarray:
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    interpreter.set_tensor(input_details[0]["index"], img_array)
    interpreter.invoke()
    return interpreter.get_tensor(output_details[0]["index"])[0]


def predict_disease(image_bytes: bytes, crop_type: Optional[str] = None) -> dict:
    """Run disease prediction on an image.

    Args:
        image_bytes: Raw image bytes (JPEG/PNG/etc.).
        crop_type:   Optional. If set (e.g. "Tomato"), predictions are restricted
                     to that plant's classes. Eliminates cross-crop confusion.

    Raises:
        ModelUnavailableError: if the TFLite model is missing or failed to load.
    """
    interpreter, labels = _load_model()

    if interpreter is None:
        raise ModelUnavailableError(_load_error or "Disease detection model is not available")

    pil_img = Image.open(io.BytesIO(image_bytes))

    input_details = interpreter.get_input_details()
    _, h, w, _ = input_details[0]["shape"]
    target = int(h) if int(h) > 0 else 224

    # Test-Time Augmentation: original + horizontal flip, then average.
    base = _preprocess(pil_img, target)
    flipped = base[:, ::-1, :].copy()

    pred1 = _softmax(_run_inference(interpreter, np.expand_dims(base, 0)))
    pred2 = _softmax(_run_inference(interpreter, np.expand_dims(flipped, 0)))
    predictions = (pred1 + pred2) / 2.0

    # Optional crop-type mask — restricts predictions to the plant the user picked.
    if crop_type:
        crop_norm = crop_type.strip().lower()
        mask = np.array(
            [DISEASE_INFO.get(k, {}).get("crop_type", "").lower() == crop_norm for k in labels],
            dtype=np.float32,
        )
        if mask.sum() > 0:
            predictions = predictions * mask
            s = predictions.sum()
            if s > 0:
                predictions = predictions / s

    predicted_idx = int(np.argmax(predictions))
    confidence = float(predictions[predicted_idx])
    entropy = _normalized_entropy(predictions)
    uncertain = confidence < CONFIDENCE_THRESHOLD or entropy > ENTROPY_THRESHOLD

    disease_key = labels[predicted_idx] if predicted_idx < len(labels) else "unknown"
    top_indices = np.argsort(predictions)[::-1][:5]

    info = DISEASE_INFO.get(disease_key, {
        "name_fr": disease_key.replace("___", " — ").replace("_", " "),
        "name_ar": disease_key.replace("___", " — ").replace("_", " "),
        "treatment_fr": "Consultez un expert agricole pour un diagnostic précis.",
        "treatment_ar": "استشر خبيراً زراعياً للحصول على تشخيص دقيق.",
        "crop_type": "",
    })

    top_predictions = []
    for idx in top_indices:
        key = labels[int(idx)] if int(idx) < len(labels) else "unknown"
        item_info = DISEASE_INFO.get(key, {
            "name_fr": key.replace("___", " — ").replace("_", " "),
            "name_ar": key.replace("___", " — ").replace("_", " "),
            "crop_type": "",
        })
        top_predictions.append({
            "disease_key": key,
            "name_fr": item_info["name_fr"],
            "name_ar": item_info["name_ar"],
            "crop_type": item_info.get("crop_type", ""),
            "confidence": round(float(predictions[int(idx)]), 4),
        })

    return {
        "disease_key": disease_key,
        "name_fr": info["name_fr"],
        "name_ar": info["name_ar"],
        "confidence": round(confidence, 4),
        "entropy": round(entropy, 4),
        "uncertain": bool(uncertain),
        "treatment_fr": info["treatment_fr"],
        "treatment_ar": info["treatment_ar"],
        "crop_type": info.get("crop_type", ""),
        "top_predictions": top_predictions,
    }


def get_disease_info() -> list:
    """Return all disease classes with bilingual info."""
    return [{"key": k, **v} for k, v in DISEASE_INFO.items()]


def model_status() -> dict:
    """Health check helper: tells callers whether the model is loadable."""
    interpreter, _ = _load_model()
    return {
        "available": interpreter is not None,
        "error": _load_error,
        "classes": len(DISEASE_INFO),
        "preprocess": MODEL_PREPROCESS,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "entropy_threshold": ENTROPY_THRESHOLD,
    }
