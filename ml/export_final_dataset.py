"""
Export final_dataset.csv from OULAD preprocessing.
Run from project root: python ml/export_final_dataset.py
Output: ml/final_dataset.csv (id_student, 10 features, procrastination_label)
"""
import os
import sys

# Ensure we can import from train_model_final
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.train_model_final import (
    find_dataset_path,
    load_and_clean,
    build_agg_sub,
    build_vle_early,
    build_prep,
    build_final_dataframe,
)


def main():
    ds = find_dataset_path()
    print("Dataset path:", ds)

    student_info, student_reg, assessments, student_ass, student_vle = load_and_clean(
        ds
    )
    agg_sub = build_agg_sub(student_ass, assessments)
    vle_early = build_vle_early(student_vle)
    prep = build_prep(student_info, student_reg, agg_sub, vle_early)
    df = build_final_dataframe(prep)

    out_path = os.path.join(os.path.dirname(__file__), "final_dataset.csv")
    df.to_csv(out_path, index=False)
    print(f"Saved: {out_path}")
    print(f"Shape: {df.shape}")
    print("Columns:", list(df.columns))
    print("Label distribution:", df["procrastination_label"].value_counts().to_dict())


if __name__ == "__main__":
    main()
