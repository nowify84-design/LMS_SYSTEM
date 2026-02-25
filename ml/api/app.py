"""
Nowify Flask API: POST /predict
Expects JSON body with feature vector (same order as ml/features.txt).
Returns { "level": "Low"|"Medium"|"High", "percentage": number }.
"""
import os
import json
import joblib
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify

app = Flask(__name__)

MODEL_PATH = os.environ.get("MODEL_PATH", os.path.join(os.path.dirname(__file__), "..", "model", "procrastination_model.joblib"))
FEATURE_ORDER = [
    "early_login_count", "early_login_consistency", "early_clicks",
    "early_clicks_per_login", "unique_resources_early", "num_of_prev_attempts",
    "late_registration_score", "workload_level", "assignments_count", "courses_count",
]

_model_cache = None


def load_model():
    global _model_cache
    if _model_cache is not None:
        return _model_cache
    if not os.path.isfile(MODEL_PATH):
        return None
    _model_cache = joblib.load(MODEL_PATH)
    return _model_cache


def get_feature_order():
    """Use feature_order from model if available, else fallback."""
    model_data = load_model()
    if model_data and "feature_order" in model_data:
        return model_data["feature_order"]
    return FEATURE_ORDER


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/predict", methods=["POST"])
def predict():
    payload = request.get_json(silent=True)
    if payload is None:
        return jsonify({"error": "Invalid or missing JSON body"}), 400

    feature_order = get_feature_order()
    try:
        vec = [float(payload.get(k, 0)) for k in feature_order]
    except (TypeError, ValueError):
        return jsonify({"error": "Feature values must be numbers"}), 400

    if len(vec) != len(feature_order):
        return jsonify({"error": f"Expected {len(feature_order)} features"}), 400

    model_data = load_model()
    if model_data is None:
        return jsonify({"error": "Model not loaded"}), 503

    model = model_data.get("model")
    scaler = model_data.get("scaler")
    if model is None:
        return jsonify({"error": "Model not loaded"}), 503

    X = pd.DataFrame([vec], columns=feature_order)
    if scaler is not None:
        X = scaler.transform(X)
    pred = model.predict(X)[0]

    # Percentage = procrastination risk 0-100 (training: class 1 = at-risk)
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(X)[0]
        # Binary: proba[0]=P(Low risk), proba[1]=P(At risk)
        percentage = float(proba[1] if len(proba) > 1 else proba[0]) * 100
    else:
        # Fallback: pred 0 -> 0%, pred 1 -> 100%
        percentage = float(pred) * 100
    percentage = round(min(100, max(0, percentage)), 1)

    # Level derived from risk percentage (aligned with messageRules)
    if percentage >= 60:
        level = "High"
    elif percentage >= 30:
        level = "Medium"
    else:
        level = "Low"

    return jsonify({"level": level, "percentage": percentage})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG", "0") == "1")
