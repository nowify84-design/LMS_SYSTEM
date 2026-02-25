"""
Nowify final training pipeline: load OULAD from ml/dataset, preprocess, train model.

Design (no data leakage):
- Label: from LateRatio (delay_score), LastMinuteRatio, AvgDelay (submission_deviation)
- Features: only early/non-delay signals — login patterns, click behavior, engagement,
  registration timing, workload, early semester behavior. NO direct delay indicators.
"""

import os
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
)
import joblib

# Non-leaking features only (no delay_score, previous_delays_count, submission_deviation, last_minute_ratio)
FEATURE_ORDER = [
    "early_login_count",        # login patterns – first 30 days
    "early_login_consistency",  # login patterns – early_login_count / 30
    "early_clicks",             # click behavior – first 30 days
    "early_clicks_per_login",   # engagement intensity (clicks per active day)
    "unique_resources_early",   # resource diversity – nunique(id_site) first 30 days
    "num_of_prev_attempts",     # prior attempts (risk indicator)
    "late_registration_score",  # registration timing
    "workload_level",           # workload
    "assignments_count",        # engagement
    "courses_count",            # engagement
]


def find_dataset_path():
    """Locate ml/dataset from cwd (project root or ml/notebooks)."""
    cwd = os.path.abspath(os.getcwd())
    for base in [cwd, os.path.join(cwd, ".."), os.path.join(cwd, "..", "..")]:
        candidate = os.path.join(os.path.abspath(base), "ml", "dataset")
        if os.path.isfile(os.path.join(candidate, "studentInfo.csv")):
            return candidate
    raise FileNotFoundError(
        "ml/dataset not found. Run from project root or ml/notebooks."
    )


def load_and_clean(ds):
    """Step 1: Load OULAD tables and basic cleaning."""
    student_info = pd.read_csv(os.path.join(ds, "studentInfo.csv"))
    student_reg = pd.read_csv(os.path.join(ds, "studentRegistration.csv"))
    assessments = pd.read_csv(os.path.join(ds, "assessments.csv"))
    student_ass = pd.read_csv(os.path.join(ds, "studentAssessment.csv"))
    student_vle = pd.read_csv(os.path.join(ds, "studentVle.csv"))  # full VLE data

    assessments["date"] = pd.to_numeric(assessments["date"], errors="coerce")
    student_ass["date_submitted"] = pd.to_numeric(
        student_ass["date_submitted"], errors="coerce"
    )
    student_ass["score"] = pd.to_numeric(student_ass["score"], errors="coerce")
    student_reg["date_registration"] = pd.to_numeric(
        student_reg["date_registration"], errors="coerce"
    )
    student_vle["date"] = pd.to_numeric(student_vle["date"], errors="coerce")
    student_vle["sum_click"] = pd.to_numeric(student_vle["sum_click"], errors="coerce")

    student_info = student_info.drop_duplicates()
    student_reg = student_reg.drop_duplicates()
    student_ass = student_ass.drop_duplicates()

    return student_info, student_reg, assessments, student_ass, student_vle


def build_agg_sub(student_ass, assessments):
    """Step 2: Merge submissions with deadlines, compute late count and submission_deviation."""
    sub_with_deadline = student_ass.merge(
        assessments[
            [
                "id_assessment",
                "code_module",
                "code_presentation",
                "date",
                "assessment_type",
            ]
        ],
        on="id_assessment",
        how="left",
    )
    sub_with_deadline["is_late"] = (
        sub_with_deadline["date_submitted"].notna()
        & sub_with_deadline["date"].notna()
        & (sub_with_deadline["date_submitted"] > sub_with_deadline["date"])
    )
    # Last-minute submission: submitted within 2 days of deadline (and on time) – "deadline action" pacing
    days_before = sub_with_deadline["date"] - sub_with_deadline["date_submitted"]
    sub_with_deadline["is_last_minute"] = (
        sub_with_deadline["date_submitted"].notna()
        & sub_with_deadline["date"].notna()
        & (days_before >= 0)
        & (days_before <= 2)
    )

    agg_sub = (
        sub_with_deadline.groupby(["id_student", "code_module", "code_presentation"])
        .agg(
            assignments_count=("id_assessment", "count"),
            previous_delays_count=("is_late", "sum"),
            submission_dates=("date_submitted", list),
            deadline_dates=("date", list),
            last_minute_ratio=("is_last_minute", "mean"),
        )
        .reset_index()
    )
    agg_sub["previous_delays_count"] = (
        agg_sub["previous_delays_count"].fillna(0).astype(int)
    )
    agg_sub["last_minute_ratio"] = agg_sub["last_minute_ratio"].fillna(0).clip(0, 1)

    def mean_late_deviation(row):
        sub_dates = (
            row["submission_dates"] if isinstance(row["submission_dates"], list) else []
        )
        dead_dates = (
            row["deadline_dates"] if isinstance(row["deadline_dates"], list) else []
        )
        if not sub_dates or not dead_dates or len(sub_dates) != len(dead_dates):
            return 0.0
        late_days = [
            max(0, float(s) - float(d))
            for s, d in zip(sub_dates, dead_dates)
            if pd.notna(s) and pd.notna(d)
        ]
        if not late_days:
            return 0.0
        return min(1.0, sum(late_days) / len(late_days) / 30.0)

    agg_sub["submission_deviation"] = agg_sub.apply(mean_late_deviation, axis=1)
    return agg_sub


def build_vle_per_student_module(student_vle):
    """Step 3: VLE aggregates per student per module (full semester)."""
    return (
        student_vle.groupby(["id_student", "code_module", "code_presentation"])
        .agg(total_clicks=("sum_click", "sum"), login_count=("date", "nunique"))
        .reset_index()
    )


EARLY_SEMESTER_DAYS = 30  # first 30 days = early semester behavior


def build_vle_early(student_vle):
    """Early semester VLE: login_count, clicks, unique resources for date <= EARLY_SEMESTER_DAYS."""
    early = student_vle[
        student_vle["date"].notna() & (student_vle["date"] <= EARLY_SEMESTER_DAYS)
    ]
    return (
        early.groupby(["id_student", "code_module", "code_presentation"])
        .agg(
            early_login_count=("date", "nunique"),
            early_clicks=("sum_click", "sum"),
            unique_resources_early=("id_site", "nunique"),
        )
        .reset_index()
    )


def build_prep(student_info, student_reg, agg_sub, vle_early):
    """Step 4: Merge and derive features; label from LateRatio, LastMinuteRatio, AvgDelay (NOT used as features)."""
    prep = (
        student_info.merge(
            agg_sub, on=["id_student", "code_module", "code_presentation"], how="left"
        )
        .merge(
            vle_early,
            on=["id_student", "code_module", "code_presentation"],
            how="left",
        )
        .merge(
            student_reg[
                ["id_student", "code_module", "code_presentation", "date_registration"]
            ],
            on=["id_student", "code_module", "code_presentation"],
            how="left",
        )
    )

    prep["assignments_count"] = prep["assignments_count"].fillna(0).astype(int)
    prep["early_login_count"] = prep["early_login_count"].fillna(0).astype(int)
    prep["early_clicks"] = prep["early_clicks"].fillna(0)
    prep["unique_resources_early"] = prep["unique_resources_early"].fillna(0).astype(int)
    prep["num_of_prev_attempts"] = pd.to_numeric(
        prep["num_of_prev_attempts"], errors="coerce"
    ).fillna(0).astype(int)
    prep["early_login_consistency"] = np.clip(
        prep["early_login_count"] / EARLY_SEMESTER_DAYS, 0, 1
    )
    prep["last_minute_ratio"] = prep["last_minute_ratio"].fillna(0).clip(0, 1)
    prep["submission_deviation"] = prep["submission_deviation"].fillna(0).clip(0, 1)
    prep["delay_score"] = np.clip(
        prep["previous_delays_count"].fillna(0)
        / np.maximum(prep["assignments_count"], 1),
        0,
        1,
    )

    prep["late_registration_score"] = np.clip(
        (prep["date_registration"].fillna(-30) + 30) / 60.0, 0, 1
    )
    prep["workload_level"] = np.clip(
        pd.to_numeric(prep["studied_credits"], errors="coerce").fillna(60) / 120.0,
        0,
        1.5,
    )
    prep["courses_count"] = 1

    # Label: from LateRatio, LastMinuteRatio, AvgDelay (behavior-based). These are NOT features.
    prep["procrastination_label"] = (
        (prep["delay_score"] >= 0.25)
        | (prep["previous_delays_count"].fillna(0) >= 2)
        | (prep["submission_deviation"] >= 0.2)
    ).astype(int)

    return prep


def build_feature_matrix(prep):
    """Step 5: Aggregate to one row per student, X (non-leaking features only) and y."""
    agg_student = (
        prep.groupby("id_student")
        .agg(
            early_login_count=("early_login_count", "sum"),
            early_clicks=("early_clicks", "sum"),
            unique_resources_early=("unique_resources_early", "sum"),
            num_of_prev_attempts=("num_of_prev_attempts", "max"),
            late_registration_score=("late_registration_score", "mean"),
            workload_level=("workload_level", "mean"),
            assignments_count=("assignments_count", "sum"),
            courses_count=("code_module", "nunique"),
            procrastination_label=("procrastination_label", "max"),
        )
        .reset_index()
    )
    agg_student["early_login_consistency"] = np.clip(
        agg_student["early_login_count"] / EARLY_SEMESTER_DAYS, 0, 1
    )
    agg_student["early_clicks_per_login"] = np.where(
        agg_student["early_login_count"] > 0,
        agg_student["early_clicks"] / agg_student["early_login_count"],
        0,
    )
    agg_student["early_clicks_per_login"] = np.clip(
        agg_student["early_clicks_per_login"], 0, 500
    )

    X = agg_student[FEATURE_ORDER].copy()
    y = agg_student["procrastination_label"]
    X = X.fillna(0)
    return X, y


def build_final_dataframe(prep):
    """Build one row per student with id_student, 10 features, procrastination_label."""
    X, y = build_feature_matrix(prep)
    df = X.copy()
    df["procrastination_label"] = y.values
    df.insert(0, "id_student", y.index)
    return df.reset_index(drop=True)


def load_oulad():
    """Full OULAD pipeline: load, preprocess, return X, y."""
    ds = find_dataset_path()
    print("Dataset path:", ds)

    student_info, student_reg, assessments, student_ass, student_vle = load_and_clean(
        ds
    )
    print("Step 1 done. studentInfo:", student_info.shape)

    agg_sub = build_agg_sub(student_ass, assessments)
    print("Step 2 done. agg_sub:", agg_sub.shape)

    vle_early = build_vle_early(student_vle)
    print("Step 3 done. vle_early:", vle_early.shape)

    prep = build_prep(student_info, student_reg, agg_sub, vle_early)
    print("Step 4 done. prep:", prep.shape)

    X, y = build_feature_matrix(prep)
    print("Step 5 done. X:", X.shape, "y:", y.shape)
    print("Label distribution:", y.value_counts().to_dict())
    return X, y


def main():
    X, y = load_oulad()

    X = X[FEATURE_ORDER]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    results = {}
    for name, model in [
        ("Logistic Regression", LogisticRegression(max_iter=1000, random_state=42)),
        ("Random Forest", RandomForestClassifier(n_estimators=100, random_state=42)),
        (
            "XGBoost",
            __import__("xgboost").XGBClassifier(eval_metric="logloss", random_state=42),
        ),
    ]:
        model.fit(X_train_s, y_train)
        pred = model.predict(X_test_s)
        results[name] = {
            "accuracy": accuracy_score(y_test, pred),
            "precision": precision_score(y_test, pred, zero_division=0),
            "recall": recall_score(y_test, pred, zero_division=0),
            "f1": f1_score(y_test, pred, zero_division=0),
            "confusion_matrix": confusion_matrix(y_test, pred).tolist(),
        }
        print(name, "F1:", results[name]["f1"], "|", results[name])

    best_name = max(results, key=lambda k: results[k]["f1"])
    if best_name == "Logistic Regression":
        final = LogisticRegression(max_iter=1000, random_state=42)
    elif best_name == "Random Forest":
        final = RandomForestClassifier(n_estimators=100, random_state=42)
    else:
        final = __import__("xgboost").XGBClassifier(
            eval_metric="logloss", random_state=42
        )
    final.fit(scaler.fit_transform(X), y)

    out_dir = os.path.join(os.path.dirname(__file__), "model")
    os.makedirs(out_dir, exist_ok=True)
    model_path = os.path.join(out_dir, "procrastination_model.joblib")
    joblib.dump(
        {"model": final, "scaler": scaler, "feature_order": FEATURE_ORDER},
        model_path,
    )
    features_path = os.path.join(os.path.dirname(__file__), "features.txt")
    with open(features_path, "w") as f:
        f.write("\n".join(FEATURE_ORDER))

    # Evaluation report
    eval_path = os.path.join(out_dir, "evaluation_report.txt")
    with open(eval_path, "w") as f:
        f.write("Procrastination model – evaluation (test set, 80/20 split)\n")
        f.write("=" * 60 + "\n\n")
        for name, r in results.items():
            f.write(f"{name}\n")
            f.write(f"  Accuracy:  {r['accuracy']:.4f}\n")
            f.write(f"  Precision: {r['precision']:.4f}\n")
            f.write(f"  Recall:    {r['recall']:.4f}\n")
            f.write(f"  F1:        {r['f1']:.4f}\n")
            f.write(f"  Confusion matrix (TN FP / FN TP): {r['confusion_matrix']}\n\n")
        f.write("=" * 60 + "\n")
        f.write(f"Best model (by F1): {best_name}\n")
        f.write(f"Features: {len(FEATURE_ORDER)}\n")
    print("Saved:", model_path, features_path, "and", eval_path)
    print("Best model:", best_name)


if __name__ == "__main__":
    main()
