"""
Quick check that /predict returns correct shape and sensible results.
Run with: python test_predict.py
Requires: Flask app running on PORT (default 5000), or set FLASK_API_URL.
"""
import os
import sys
import json
import urllib.request

# Synchronized with best performing XGBoost model features (8 features)
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

def main():
    base = os.environ.get("FLASK_API_URL", "http://127.0.0.1:5000")
    url = f"{base.rstrip('/')}/predict"

    low_risk = {
        "previous_delays_count": 0,
        "assignments_count": 5,
        "activity_count_in_enrolled_courses": 50,
        "courses_count": 2,
        "workload_level": 0.3,
        "non_submission_count": 0,
        "last7d_engagement": 15.0,
        "course_engagement": 25.0
    }

    high_risk = {
        "previous_delays_count": 4,
        "assignments_count": 12,
        "activity_count_in_enrolled_courses": 100,
        "courses_count": 5,
        "workload_level": 1.2,
        "non_submission_count": 3,
        "last7d_engagement": 2.5,
        "course_engagement": 5.0
    }

    print(f"Testing API at: {url}")
    print("Note: The first request may take a few seconds to load the model.\n")

    results = {}
    for name, payload in [("low_risk", low_risk), ("high_risk", high_risk)]:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, method="POST", headers={"Content-Type": "application/json"})
        try:
            # Increased timeout to 20s to allow for initial model loading on the server
            with urllib.request.urlopen(req, timeout=20) as r:
                out = json.loads(r.read().decode())
            level = out.get("level")
            pct = out.get("percentage")
            if level not in ("Low", "Medium", "High") or not isinstance(pct, (int, float)):
                print(f"FAIL {name}: invalid response {out}")
                sys.exit(1)
            print(f"OK {name}: level={level}, percentage={pct}%")
            results[name] = pct
        except urllib.error.URLError as e:
            print(f"FAIL {name}: cannot reach API ({e.reason})")
            sys.exit(1)
        except Exception as e:
            print(f"FAIL {name}: {type(e).__name__} - {e}")
            sys.exit(1)

    if "low_risk" in results and "high_risk" in results:
        print("-" * 30)
        if results["low_risk"] > results["high_risk"]:
            print("WARN: low_risk percentage > high_risk; model may need realignment.")
        else:
            print("SUCCESS: low_risk percentage <= high_risk (Sensible Prediction)")
    
    print("\nAPI Integration Check Completed.")

if __name__ == "__main__":
    main()
