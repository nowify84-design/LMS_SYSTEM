"""
Nowify Flask API: POST /predict
Expects JSON body with 8-feature vector for XGBoost model.
Returns { "level": "Low"|"Medium"|"High", "percentage": number }.
"""
import os
import joblib
import pandas as pd
from flask import Flask, request, jsonify

app = Flask(__name__)

MODEL_PATH = os.environ.get("MODEL_PATH", os.path.join(os.path.dirname(__file__), "..", "model", "procrastination_model.joblib"))

# Synchronized with best performing XGBoost model features
FEATURE_ORDER = [
    "previous_delays_count",
    "assignments_count",
    "activity_count_in_enrolled_courses",
    "courses_count",
    "workload_level",
    "non_submission_count",
    "last7d_engagement",
    "course_engagement"
]

_model_cache = None

def load_model():
    global _model_cache
    if _model_cache is not None:
        return _model_cache
    if not os.path.isfile(MODEL_PATH):
        print(f"ERROR: Model file not found at {MODEL_PATH}")
        return None
    
    print(f"Loading model from {MODEL_PATH}...")
    try:
        _model_cache = joblib.load(MODEL_PATH)
        print("Model loaded successfully.")
    except Exception as e:
        print(f"ERROR loading model: {e}")
        return None
    return _model_cache

def get_feature_order():
    model_data = load_model()
    if model_data and isinstance(model_data, dict) and "feature_order" in model_data:
        return model_data["feature_order"]
    return FEATURE_ORDER

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model_loaded": _model_cache is not None})

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
        return jsonify({"error": f"Expected {len(feature_order)} features, got {len(vec)}"}), 400

    model_data = load_model()
    if model_data is None:
        return jsonify({"error": "Model not available"}), 503

    # Extract model and scaler from the saved dictionary
    model = model_data.get("model")
    scaler = model_data.get("scaler")
    
    if model is None:
        return jsonify({"error": "Internal Model Error"}), 500

    # Prepare features for prediction
    X = pd.DataFrame([vec], columns=feature_order)
    if scaler is not None:
        X = scaler.transform(X)
    
    # Perform prediction
    try:
        pred = model.predict(X)[0]
        # Percentage calculation based on probability if available
        if hasattr(model, "predict_proba"):
            proba = model.predict_proba(X)[0]
            percentage = float(proba[1] if len(proba) > 1 else proba[0]) * 100
        else:
            percentage = float(pred) * 100
    except Exception as e:
        print(f"Prediction error: {e}")
        return jsonify({"error": "Inference failed"}), 500
        
    percentage = round(min(100, max(0, percentage)), 1)

    # Risk level mapping
    if percentage >= 60:
        level = "High"
    elif percentage >= 30:
        level = "Medium"
    else:
        level = "Low"

    return jsonify({"level": level, "percentage": percentage})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    # Pre-load model on startup to avoid timeout on first request
    load_model()
    app.run(host="0.0.0.0", port=port)
