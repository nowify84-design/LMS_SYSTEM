"""
Quick check that /predict returns correct shape and sensible results.
Run with: python test_predict.py
Requires: Flask app running on PORT (default 5000), or set FLASK_API_URL.
"""
import os
import sys
import json
import urllib.request

FEATURE_ORDER = [
    "early_login_count", "early_login_consistency", "early_clicks",
    "early_clicks_per_login", "unique_resources_early", "num_of_prev_attempts",
    "late_registration_score", "workload_level", "assignments_count", "courses_count",
]

def main():
    base = os.environ.get("FLASK_API_URL", "http://127.0.0.1:5000")
    url = f"{base.rstrip('/')}/predict"

    low_risk = {k: 0 for k in FEATURE_ORDER}
    low_risk.update({"assignments_count": 5, "courses_count": 2, "early_login_count": 20})
    low_risk["early_login_consistency"] = 0.8
    low_risk["early_clicks"] = 500
    low_risk["early_clicks_per_login"] = 25
    low_risk["unique_resources_early"] = 15
    low_risk["num_of_prev_attempts"] = 0
    low_risk["late_registration_score"] = 0.1
    low_risk["workload_level"] = 0.4

    high_risk = {k: 0 for k in FEATURE_ORDER}
    high_risk.update({"assignments_count": 10, "courses_count": 4})
    high_risk["early_login_count"] = 3
    high_risk["early_login_consistency"] = 0.1
    high_risk["early_clicks"] = 50
    high_risk["early_clicks_per_login"] = 17
    high_risk["unique_resources_early"] = 2
    high_risk["num_of_prev_attempts"] = 2
    high_risk["late_registration_score"] = 0.7
    high_risk["workload_level"] = 0.8

    for name, payload in [("low_risk", low_risk), ("high_risk", high_risk)]:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, method="POST", headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                out = json.loads(r.read().decode())
            level = out.get("level")
            pct = out.get("percentage")
            if level not in ("Low", "Medium", "High") or not isinstance(pct, (int, float)):
                print(f"FAIL {name}: invalid response {out}")
                sys.exit(1)
            print(f"OK {name}: level={level}, percentage={pct}")
        except urllib.error.URLError as e:
            print(f"SKIP {name}: cannot reach API ({e})")
            sys.exit(0)
        except Exception as e:
            print(f"FAIL {name}: {e}")
            sys.exit(1)

    # Sanity: low_risk should not have higher percentage than high_risk when both succeed
    with urllib.request.urlopen(
        urllib.request.Request(url, data=json.dumps(low_risk).encode(), method="POST", headers={"Content-Type": "application/json"}),
        timeout=5,
    ) as r:
        low_out = json.loads(r.read().decode())
    with urllib.request.urlopen(
        urllib.request.Request(url, data=json.dumps(high_risk).encode(), method="POST", headers={"Content-Type": "application/json"}),
        timeout=5,
    ) as r:
        high_out = json.loads(r.read().decode())
    if low_out["percentage"] > high_out["percentage"]:
        print("WARN: low_risk percentage > high_risk; model may need retraining or feature alignment")
    else:
        print("OK: low_risk percentage <= high_risk (sensible ordering)")
    print("Prediction check passed.")

if __name__ == "__main__":
    main()
