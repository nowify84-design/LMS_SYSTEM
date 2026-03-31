# Optimized 8-Feature Matrix Description
## Nowify LMS: Machine Learning Intelligence Layer

This document provides a detailed technical description of the 8 features used in the final **XGBoost Classifier** for procrastination prediction. These features were selected for their high predictive power and "no-leakage" design.

---

### 1. `previous_delays_count`
*   **Definition:** A cumulative count of a student's historical late submissions.
*   **Calculation:** It combines late submissions from previous semesters with any late submissions occurring in the current semester prior to the assessment being predicted.
*   **Significance:** This is the strongest predictor (Importance: 0.2982), identifying persistent behavioral patterns of delay.

### 2. `assignments_count`
*   **Definition:** The total volume of assessment items (TMA, CMA, Exams) assigned to the student.
*   **Calculation:** Count of all distinct assessment IDs for courses where the student has an active enrollment.
*   **Significance:** Higher volumes of assignments can contribute to increased procrastination risk due to higher academic pressure.

### 3. `activity_count_in_enrolled_courses`
*   **Definition:** A structural measure of the course design's complexity.
*   **Calculation:** The total number of distinct VLE resources (id_site) available in the courses the student is attending.
*   **Significance:** Reflects the "richness" or "complexity" of the learning environment provided to the student.

### 4. `courses_count`
*   **Definition:** The number of unique modules the student is currently enrolled in.
*   **Calculation:** Count of distinct `code_module` entries for the current `code_presentation`.
*   **Significance:** Identifies students attempting to balance multiple subjects simultaneously, which often impacts time management.

### 5. `workload_level`
*   **Definition:** A dynamic score representing the student's immediate academic burden.
*   **Calculation:** A normalized score combining (1) the number of assessments due within a 30-day window and (2) the structural activity count of those courses.
*   **Significance:** Directly measures "deadline density," a primary trigger for academic procrastination.

### 6. `non_submission_count`
*   **Definition:** The number of mandatory assessments that were never submitted.
*   **Calculation:** Total TMA/CMA assessments in enrolled courses minus the student's actual submission records.
*   **Significance:** High non-submission counts are strong indicators of total disengagement and a precursor to severe procrastination.

### 7. `last7d_engagement`
*   **Definition:** Intensity of student activity in the "critical window" (7 days before a deadline).
*   **Calculation:** The geometric mean (`sqrt`) of login frequency and total clicks recorded in the 7 days prior to an assessment deadline.
*   **Significance:** Identifies "last-minute rushing" behavior vs. consistent early engagement.

### 8. `course_engagement`
*   **Definition:** Baseline engagement level during the "early phase" of the assessment cycle.
*   **Calculation:** The geometric mean (`sqrt`) of login frequency and total clicks from the start of the semester up to 7 days before a deadline.
*   **Significance:** Provides a baseline to compare against `last7d_engagement` to detect a "decay" in study habits.
