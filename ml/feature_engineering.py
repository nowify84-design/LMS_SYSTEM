"""
Feature engineering for procrastination ML model.

Implements features per docs/feature_engineering_instructions.md.
All features use enrolled courses only (date_unregistration is NaN).

Features computed:
- courses_count, assignments_count, workload_level
- activity_count_in_enrolled_courses
- previous_delays_count (prev semester + prev assignments in current semester)
- course_engagement, last7d_engagement (sqrt of login_count × clicks); last7d_unique_resources ([deadline-7, deadline]); days_to_first_activity
- num_of_prev_attempts
- non_submission_count (TMA/CMA only; excludes Exam - exam results often missing in OULAD)

Only interaction features (course_*, last7d_*) are log1p-transformed before output.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# Constants (avoid magic numbers)
DAYS_30D_WINDOW = 30
DAYS_7D_WINDOW = 7
# Tuned so workload_level spreads across [0, 1.5] (activity_count mean~336, max~1209)
WORKLOAD_SCALE_ASSESSMENTS = 15.0
WORKLOAD_SCALE_ACTIVITIES = 400.0
WORKLOAD_CLIP_MAX = 1.5
LABEL_DELAY_SCORE_THRESHOLD = 0.25
LABEL_LATE_COUNT_THRESHOLD = 2
LABEL_SUBMISSION_DEVIATION_THRESHOLD = 0.2
SUBMISSION_DEVIATION_NORMALIZE_DAYS = 30
# TMA/CMA only for non-submission (Exam results often missing in OULAD by design)
NON_SUBMISSION_ASSESSMENT_TYPES = ("TMA", "CMA")
# Features to log1p-transform (interaction features only)
LOG_FEATURES = [
    "course_engagement",
    "last7d_engagement",
    "last7d_unique_resources",
]


# -----------------------------------------------------------------------------
# Helper: Active enrollments
# -----------------------------------------------------------------------------


def get_enrolled(student_reg: pd.DataFrame) -> pd.DataFrame:
    """
    Return active enrollments only (student has not withdrawn).

    Active = date_unregistration is NaN. Used as base for all feature computations
    so we only count courses the student is actually enrolled in.
    """
    student_reg = student_reg.copy()
    student_reg["date_unregistration"] = pd.to_numeric(
        student_reg["date_unregistration"], errors="coerce"
    )
    return student_reg[student_reg["date_unregistration"].isna()][
        ["id_student", "code_module", "code_presentation"]
    ].drop_duplicates()


# -----------------------------------------------------------------------------
# Structural features (courses, assignments, workload)
# -----------------------------------------------------------------------------


def compute_courses_count(student_reg):
    """
    Number of distinct courses (modules) per student per semester.

    Scope: active enrollments only. Group by (id_student, code_presentation),
    count nunique(code_module).
    """
    enrolled = get_enrolled(student_reg)
    return (
        enrolled.groupby(["id_student", "code_presentation"])["code_module"]
        .nunique()
        .reset_index()
        .rename(columns={"code_module": "courses_count"})
    )


def compute_assignments_count(student_reg, assessments):
    """
    Total number of assessments for enrolled courses only.

    Joins assessments with enrolled (code_module, code_presentation).
    Does NOT count assessments from courses the student is not enrolled in.
    """
    enrolled = get_enrolled(student_reg)
    assessments_enrolled = assessments.merge(
        enrolled, on=["code_module", "code_presentation"], how="inner"
    )
    return (
        assessments_enrolled.groupby("id_student")["id_assessment"]
        .count()
        .reset_index()
        .rename(columns={"id_assessment": "assignments_count"})
    )


def compute_activity_count_in_enrolled_courses(student_reg, vle):
    """
    Count VLE activities (id_site) available in enrolled courses, per semester only.

    Structural only: from vle.csv (course design), NOT studentVle (student behavior).
    Per (id_student, code_presentation): count activities in that semester.
    Student-level: mean across semesters (same-semester scope, no mixing).
    """
    enrolled = get_enrolled(student_reg)
    vle_enrolled = vle.merge(
        enrolled, on=["code_module", "code_presentation"], how="inner"
    )
    per_semester = (
        vle_enrolled.groupby(["id_student", "code_presentation"])["id_site"]
        .count()
        .reset_index()
        .rename(columns={"id_site": "activity_count_in_enrolled_courses"})
    )
    return (
        per_semester.groupby("id_student")["activity_count_in_enrolled_courses"]
        .mean()
        .reset_index()
    )


def compute_assessments_30d_before_deadline(student_reg, assessments):
    """
    For each assessment: count how many assessments are due in [deadline-30, deadline]
    from the same semester (same code_presentation), based on current assessment's deadline.

    Used for workload_level. Returns mean per student (across their assessments).
    """
    enrolled = get_enrolled(student_reg)
    ae = assessments.merge(
        enrolled, on=["code_module", "code_presentation"], how="inner"
    )
    ae["date"] = pd.to_numeric(ae["date"], errors="coerce")
    ae = ae.dropna(subset=["date"])

    if ae.empty:
        return pd.DataFrame(columns=["id_student", "n_assessments_30d"])

    m = ae.merge(
        ae[["id_student", "code_presentation", "date"]],
        on=["id_student", "code_presentation"],
        suffixes=("", "_o"),
    )
    m = m[(m["date_o"] >= m["date"] - DAYS_30D_WINDOW) & (m["date_o"] <= m["date"])]
    n_per_assessment = (
        m.groupby(["id_student", "id_assessment", "date"])["date_o"]
        .count()
        .reset_index(name="n_assessments_30d")
    )
    return (
        n_per_assessment.groupby("id_student")["n_assessments_30d"]
        .mean()
        .reset_index()
    )


def compute_workload_level(
    student_reg,
    assessments,
    vle,
    scale1=WORKLOAD_SCALE_ASSESSMENTS,
    scale2=WORKLOAD_SCALE_ACTIVITIES,
):
    """
    Structural workload = (1) assessment count in 30d before deadline + (2) activity count.

    (1) n_assessments_30d: per current assessment's deadline, count assessments in [deadline-30, deadline].
    (2) activity_count: mean activity count per semester in enrolled courses (same-semester scope).
    No studentVle used.
    """
    n_assessments_30d = compute_assessments_30d_before_deadline(
        student_reg, assessments
    )
    activity_count = compute_activity_count_in_enrolled_courses(student_reg, vle)

    workload = n_assessments_30d.merge(
        activity_count, on="id_student", how="outer"
    ).fillna(0)
    workload["workload_level"] = np.clip(
        (workload["n_assessments_30d"] / scale1)
        + (workload["activity_count_in_enrolled_courses"] / scale2),
        0,
        WORKLOAD_CLIP_MAX,
    )
    return workload[["id_student", "workload_level"]]


# -----------------------------------------------------------------------------
# previous_delays_count (single combined feature)
# -----------------------------------------------------------------------------


def compute_previous_delays_count(student_ass, assessments, student_reg):
    """
    One feature = (1) delays in previous semester + (2) delays on previous assignments
    in current semester (deadline < current assessment).

    A delay = late submission (date_submitted > deadline).
    Vectorized: groupby + merge instead of iterrows.
    """
    # Merge submissions with assessment deadlines
    sub = student_ass.merge(
        assessments[["id_assessment", "code_module", "code_presentation", "date"]],
        on="id_assessment",
        how="left",
    )
    sub["date_submitted"] = pd.to_numeric(sub["date_submitted"], errors="coerce")
    sub["date"] = pd.to_numeric(sub["date"], errors="coerce")
    sub["is_late"] = (
        sub["date_submitted"].notna()
        & sub["date"].notna()
        & (sub["date_submitted"] > sub["date"])
    )

    # (1) Delays in previous semester: cumulative sum of is_late per student
    # ordered by presentation (2013J < 2014J)
    late_per_enroll = (
        sub.groupby(["id_student", "code_presentation"])["is_late"].sum().reset_index()
    )
    pres_order = sorted(late_per_enroll["code_presentation"].dropna().unique())
    pres_rank = {p: i for i, p in enumerate(pres_order)}
    late_per_enroll["pres_rank"] = late_per_enroll["code_presentation"].map(pres_rank)
    late_per_enroll = late_per_enroll.sort_values(["id_student", "pres_rank"])
    late_per_enroll["delays_prev_semester"] = (
        late_per_enroll.groupby("id_student")["is_late"].cumsum().shift(1, fill_value=0)
    )
    df_prev = (
        late_per_enroll.groupby("id_student")["delays_prev_semester"]
        .max()
        .reset_index()
    )

    # (2) Delays on previous assignments in current semester (deadline < current)
    sub_with_deadline = sub.rename(columns={"date": "deadline"})
    m = sub_with_deadline.merge(
        sub_with_deadline[["id_student", "code_presentation", "deadline", "is_late"]],
        on=["id_student", "code_presentation"],
        suffixes=("", "_prev"),
    )
    m = m[m["deadline_prev"] < m["deadline"]]
    df_assign = (
        m.groupby(["id_student", "id_assessment"])["is_late_prev"]
        .sum()
        .reset_index()
        .rename(columns={"is_late_prev": "delays_prev_assignments"})
    )

    # Combine: use df_prev as base so we keep all students with submissions
    df_assign_max = (
        df_assign.groupby("id_student")["delays_prev_assignments"].max().reset_index()
    )
    combined = df_prev.merge(df_assign_max, on="id_student", how="left").fillna(0)
    combined["previous_delays_count"] = (
        combined["delays_prev_assignments"] + combined["delays_prev_semester"]
    ).astype(int)
    return combined[["id_student", "previous_delays_count"]]


# -----------------------------------------------------------------------------
# Time-based: days to first activity
# -----------------------------------------------------------------------------


def compute_days_to_first_activity(student_vle, student_reg):
    """
    Days from course start until first VLE activity.

    Per (id_student, code_module, code_presentation): min(date).
    Per student: mean across enrollments. Higher = started engaging later (procrastination signal).
    Students with no VLE activity get a high placeholder (e.g. 365) to indicate delayed start.
    """
    enrolled = get_enrolled(student_reg)
    sv = student_vle.merge(
        enrolled, on=["id_student", "code_module", "code_presentation"], how="inner"
    )
    sv["date"] = pd.to_numeric(sv["date"], errors="coerce")
    first_per_course = (
        sv.dropna(subset=["date"])
        .groupby(["id_student", "code_module", "code_presentation"])["date"]
        .min()
        .reset_index()
        .rename(columns={"date": "days_to_first_activity"})
    )
    per_student = (
        first_per_course.groupby("id_student")["days_to_first_activity"]
        .mean()
        .reset_index()
    )
    all_students = pd.DataFrame({"id_student": enrolled["id_student"].unique()})
    result = all_students.merge(per_student, on="id_student", how="left")
    result["days_to_first_activity"] = result["days_to_first_activity"].fillna(365)
    return result


# -----------------------------------------------------------------------------
# Student interactions: (1) [0, deadline-7]; (2) last 7 days [deadline-7, deadline]
# Dropped: login_consistency_score (redundant with course_login_count, last7d_login_count)
# -----------------------------------------------------------------------------

SEMESTER_START_DAY = 0


def compute_student_interaction_features(student_vle, assessments, student_reg):
    """
    (1) From start to 7 days before deadline [0, deadline-7]:
        course_engagement = sqrt(course_login_count * course_clicks), combines both
    (2) Last 7 days [deadline-7, deadline]:
        last7d_engagement = sqrt(login_count × clicks); last7d_unique_resources
    """
    enrolled = get_enrolled(student_reg)
    student_vle = student_vle.merge(
        enrolled, on=["id_student", "code_module", "code_presentation"], how="inner"
    )
    student_vle["date"] = pd.to_numeric(student_vle["date"], errors="coerce")
    student_vle["sum_click"] = pd.to_numeric(student_vle["sum_click"], errors="coerce")

    assessments_renamed = assessments.rename(columns={"date": "deadline"})
    assessments_renamed["deadline"] = pd.to_numeric(
        assessments_renamed["deadline"], errors="coerce"
    )
    vle_with_deadline = student_vle.merge(
        assessments_renamed[
            ["id_assessment", "code_module", "code_presentation", "deadline"]
        ],
        on=["code_module", "code_presentation"],
        how="inner",
    )

    # (1) From start to 7 days before deadline: [0, deadline-7]
    vle_course = vle_with_deadline[
        (vle_with_deadline["date"].notna())
        & (vle_with_deadline["deadline"].notna())
        & (vle_with_deadline["date"] >= SEMESTER_START_DAY)
        & (vle_with_deadline["date"] <= vle_with_deadline["deadline"] - DAYS_7D_WINDOW)
    ]
    course_per_assessment = (
        vle_course.groupby(
            ["id_student", "code_module", "code_presentation", "id_assessment"]
        )
        .agg(
            course_login_count=("date", "nunique"),
            course_clicks=("sum_click", "sum"),
            deadline=("deadline", "first"),
        )
        .reset_index()
    )
    # (2) Last 7 days: [deadline-7, deadline]
    vle_last7d = vle_with_deadline[
        (vle_with_deadline["date"].notna())
        & (vle_with_deadline["deadline"].notna())
        & (vle_with_deadline["date"] >= vle_with_deadline["deadline"] - DAYS_7D_WINDOW)
        & (vle_with_deadline["date"] <= vle_with_deadline["deadline"])
    ]
    last7d_per_assessment = (
        vle_last7d.groupby(
            ["id_student", "code_module", "code_presentation", "id_assessment"]
        )
        .agg(
            last7d_login_count=("date", "nunique"),
            last7d_clicks=("sum_click", "sum"),
            last7d_unique_resources=("id_site", "nunique"),
        )
        .reset_index()
    )

    # Merge (1) and (2)
    merged = course_per_assessment.merge(
        last7d_per_assessment,
        on=["id_student", "code_module", "code_presentation", "id_assessment"],
        how="outer",
    ).fillna(0)

    # Per (id_student, code_module, code_presentation): mean across assessments
    per_course = (
        merged.groupby(["id_student", "code_module", "code_presentation"])
        .agg(
            course_login_count=("course_login_count", "mean"),
            course_clicks=("course_clicks", "mean"),
            last7d_login_count=("last7d_login_count", "mean"),
            last7d_clicks=("last7d_clicks", "mean"),
            last7d_unique_resources=("last7d_unique_resources", "mean"),
        )
        .reset_index()
    )

    # Per student: sum across enrollments
    per_student = (
        per_course.groupby("id_student")
        .agg(
            course_login_count=("course_login_count", "sum"),
            course_clicks=("course_clicks", "sum"),
            last7d_login_count=("last7d_login_count", "sum"),
            last7d_clicks=("last7d_clicks", "sum"),
            last7d_unique_resources=("last7d_unique_resources", "sum"),
        )
        .reset_index()
    )
    # Combine course_login_count, course_clicks into one
    per_student["course_engagement"] = np.sqrt(
        per_student["course_login_count"].clip(lower=0)
        * per_student["course_clicks"].clip(lower=0)
    )
    # Combine last7d_login_count, last7d_clicks into one
    per_student["last7d_engagement"] = np.sqrt(
        per_student["last7d_login_count"].clip(lower=0)
        * per_student["last7d_clicks"].clip(lower=0)
    )
    return per_student


# -----------------------------------------------------------------------------
# Non-submission feature (TMA/CMA only; excludes Exam)
# -----------------------------------------------------------------------------


def compute_non_submission_count(
    student_reg: pd.DataFrame,
    student_ass: pd.DataFrame,
    assessments: pd.DataFrame,
) -> pd.DataFrame:
    """
    Count TMA/CMA assessments in enrolled courses that the student did not submit.

    Excludes Exam: exam results are often missing in OULAD by design, not due to
    student non-submission. Higher count = more skipped assignments = disengagement.
    """
    enrolled = get_enrolled(student_reg)
    if "assessment_type" not in assessments.columns:
        # Fallback: return zeros if assessment_type missing
        all_students = enrolled["id_student"].unique()
        return pd.DataFrame({"id_student": all_students, "non_submission_count": 0})

    ass_tma_cma = assessments[
        assessments["assessment_type"].str.upper().isin(NON_SUBMISSION_ASSESSMENT_TYPES)
    ]
    ass_enrolled = ass_tma_cma.merge(
        enrolled, on=["code_module", "code_presentation"], how="inner"
    )
    total_per_student = (
        ass_enrolled.groupby("id_student")["id_assessment"]
        .count()
        .reset_index()
        .rename(columns={"id_assessment": "total_tma_cma"})
    )
    submitted = student_ass.merge(
        ass_enrolled[["id_assessment", "id_student"]],
        on=["id_assessment", "id_student"],
        how="inner",
    )
    submitted_per_student = (
        submitted.groupby("id_student")["id_assessment"]
        .nunique()
        .reset_index()
        .rename(columns={"id_assessment": "submitted_tma_cma"})
    )
    merged = total_per_student.merge(
        submitted_per_student, on="id_student", how="left"
    ).fillna(0)
    merged["non_submission_count"] = np.maximum(
        0,
        merged["total_tma_cma"] - merged["submitted_tma_cma"],
    ).astype(int)
    # Include all enrolled students (fill 0 for those with no TMA/CMA)
    all_students = pd.DataFrame({"id_student": enrolled["id_student"].unique()})
    return (
        all_students.merge(
            merged[["id_student", "non_submission_count"]],
            on="id_student",
            how="left",
        )
        .fillna(0)
        .astype({"non_submission_count": int})
    )


# -----------------------------------------------------------------------------
# Other project-needed features
# -----------------------------------------------------------------------------


def compute_num_of_prev_attempts(student_info):
    """
    Max num_of_prev_attempts across enrollments per student.

    From studentInfo; higher = repeat attempts, often associated with higher risk.
    """
    return (
        student_info.groupby("id_student")["num_of_prev_attempts"].max().reset_index()
    )


# -----------------------------------------------------------------------------
# Target (label) for procrastination prediction
# -----------------------------------------------------------------------------


def compute_procrastination_label(student_ass, assessments, student_reg):
    """
    Compute binary procrastination label per student (aligned with train_model_final).

    Label = 1 (at-risk) if any enrollment has:
      - delay_score >= 0.25 (late_ratio = late_count / assignments_count), or
      - previous_delays_count >= 2, or
      - submission_deviation >= 0.2 (mean late days normalized)

    Scope: enrolled courses only. Returns DataFrame with id_student, procrastination_label.
    """
    enrolled = get_enrolled(student_reg)
    sub = student_ass.merge(
        assessments[["id_assessment", "code_module", "code_presentation", "date"]],
        on="id_assessment",
        how="left",
    )
    sub["date_submitted"] = pd.to_numeric(sub["date_submitted"], errors="coerce")
    sub["date"] = pd.to_numeric(sub["date"], errors="coerce")
    sub["is_late"] = (
        sub["date_submitted"].notna()
        & sub["date"].notna()
        & (sub["date_submitted"] > sub["date"])
    )

    agg = (
        sub.groupby(["id_student", "code_module", "code_presentation"])
        .agg(
            assignments_count=("id_assessment", "count"),
            late_count=("is_late", "sum"),
            submission_dates=("date_submitted", list),
            deadline_dates=("date", list),
        )
        .reset_index()
    )
    agg["late_count"] = agg["late_count"].fillna(0).astype(int)

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
        return min(
            1.0,
            sum(late_days) / len(late_days) / SUBMISSION_DEVIATION_NORMALIZE_DAYS,
        )

    agg["submission_deviation"] = agg.apply(mean_late_deviation, axis=1)
    agg["delay_score"] = np.clip(
        agg["late_count"] / np.maximum(agg["assignments_count"], 1), 0, 1
    )
    agg["procrastination_label"] = (
        (agg["delay_score"] >= LABEL_DELAY_SCORE_THRESHOLD)
        | (agg["late_count"] >= LABEL_LATE_COUNT_THRESHOLD)
        | (agg["submission_deviation"] >= LABEL_SUBMISSION_DEVIATION_THRESHOLD)
    ).astype(int)

    agg_enrolled = agg.merge(
        enrolled[["id_student", "code_module", "code_presentation"]],
        on=["id_student", "code_module", "code_presentation"],
        how="inner",
    )
    label_per_student = (
        agg_enrolled.groupby("id_student")["procrastination_label"].max().reset_index()
    )
    all_students = enrolled["id_student"].unique()
    result = pd.DataFrame({"id_student": all_students})
    result = result.merge(label_per_student, on="id_student", how="left")
    result["procrastination_label"] = (
        result["procrastination_label"].fillna(0).astype(int)
    )
    return result


# -----------------------------------------------------------------------------
# Main: Build full feature matrix
# -----------------------------------------------------------------------------


def build_feature_matrix(
    student_info: pd.DataFrame,
    student_reg: pd.DataFrame,
    student_ass: pd.DataFrame,
    assessments: pd.DataFrame,
    student_vle: pd.DataFrame,
    vle: pd.DataFrame,
    include_target: bool = False,
) -> pd.DataFrame:
    """
    Build full feature matrix per student from OULAD data.

    Returns DataFrame with id_student and all features. Missing values filled with 0.

    If include_target=True, adds procrastination_label column (0/1).
    """
    enrolled = get_enrolled(student_reg)

    # Ensure numeric types for date/score columns (copy to avoid mutating inputs)
    assessments = assessments.copy()
    student_ass = student_ass.copy()
    student_reg = student_reg.copy()
    student_vle = student_vle.copy()
    for df, cols in [
        (assessments, ["date"]),
        (student_ass, ["date_submitted", "score"]),
        (student_reg, ["date_registration", "date_unregistration"]),
        (student_vle, ["date", "sum_click"]),
    ]:
        for c in cols:
            if c in df.columns:
                df[c] = pd.to_numeric(df[c], errors="coerce")

    # courses_count: sum across semesters for student-level
    courses = compute_courses_count(student_reg)
    courses_student = courses.groupby("id_student")["courses_count"].sum().reset_index()

    # assignments_count: total assessments in enrolled courses
    assignments = compute_assignments_count(student_reg, assessments)

    # workload_level: assessment count 30d before deadline + activity count
    workload = compute_workload_level(student_reg, assessments, vle)

    # activity_count_in_enrolled_courses: VLE resources in enrolled courses
    activity_count = compute_activity_count_in_enrolled_courses(student_reg, vle)

    # previous_delays_count: prev semester + prev assignments in current semester
    prev_delays = compute_previous_delays_count(student_ass, assessments, student_reg)

    # non_submission_count: TMA/CMA not submitted (excludes Exam)
    non_submission = compute_non_submission_count(student_reg, student_ass, assessments)

    # Student interaction features: course-level + last 7 days
    interaction = compute_student_interaction_features(
        student_vle, assessments, student_reg
    )

    # Time-based: days to first VLE activity
    days_to_first = compute_days_to_first_activity(student_vle, student_reg)

    # num_of_prev_attempts (from studentInfo)
    prev_attempts = compute_num_of_prev_attempts(student_info)

    # Merge all feature DataFrames on id_student (left join, fill NaN with 0)
    all_students = enrolled["id_student"].unique()
    result = pd.DataFrame({"id_student": all_students})

    for name, df in [
        ("courses_count", courses_student),
        ("assignments_count", assignments),
        ("workload_level", workload),
        ("activity_count_in_enrolled_courses", activity_count),
        ("previous_delays_count", prev_delays),
        ("non_submission_count", non_submission),
        ("course_engagement", interaction[["id_student", "course_engagement"]]),
        ("last7d_engagement", interaction[["id_student", "last7d_engagement"]]),
        ("last7d_unique_resources", interaction[["id_student", "last7d_unique_resources"]]),
        ("days_to_first_activity", days_to_first),
        ("num_of_prev_attempts", prev_attempts),
    ]:
        result = result.merge(df, on="id_student", how="left")

    # days_to_first_activity: use 365 for missing (no VLE activity), ensure non-negative
    if "days_to_first_activity" in result.columns:
        result["days_to_first_activity"] = (
            result["days_to_first_activity"].fillna(365).clip(lower=0)
        )
    result = result.fillna(0)

    # Log1p transform for count/magnitude features (skewed distributions)
    for col in LOG_FEATURES:
        if col in result.columns:
            result[col] = np.log1p(result[col].astype(float))
            result[col] = np.nan_to_num(
                result[col], nan=0.0, posinf=0.0, neginf=0.0
            )

    if include_target:
        target_df = compute_procrastination_label(student_ass, assessments, student_reg)
        result = result.merge(
            target_df[["id_student", "procrastination_label"]],
            on="id_student",
            how="left",
        )
        result["procrastination_label"] = (
            result["procrastination_label"].fillna(0).astype(int)
        )

    return result


# -----------------------------------------------------------------------------
# CLI: Run as script to build feature matrix from ml/dataset
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    import os

    ds = os.path.join(os.path.dirname(__file__), "dataset")
    if not os.path.isdir(ds):
        print("ml/dataset not found. Run from project root.")
        raise SystemExit(1)

    student_info = pd.read_csv(os.path.join(ds, "studentInfo.csv"))
    student_reg = pd.read_csv(os.path.join(ds, "studentRegistration.csv"))
    student_ass = pd.read_csv(os.path.join(ds, "studentAssessment.csv"))
    assessments = pd.read_csv(os.path.join(ds, "assessments.csv"))
    student_vle = pd.read_csv(os.path.join(ds, "studentVle.csv"))
    vle = pd.read_csv(os.path.join(ds, "vle.csv"))

    features = build_feature_matrix(
        student_info,
        student_reg,
        student_ass,
        assessments,
        student_vle,
        vle,
        include_target=True,
    )
    out_path = os.path.join(os.path.dirname(__file__), "feature_matrix.csv")
    features.to_csv(out_path, index=False)
    print("Feature matrix shape:", features.shape)
    print("Saved:", out_path)
    print(
        "Label distribution:",
        features["procrastination_label"].value_counts().to_dict(),
    )
    print(features.head())
