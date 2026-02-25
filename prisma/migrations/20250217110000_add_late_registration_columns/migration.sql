-- Add columns to courses for late_registration_score (research: early risk indicator)
-- enrolled_at: when the student enrolled in the course
-- course_start_date: course/semester start (to compute days offset)

ALTER TABLE `courses` ADD COLUMN `enrolled_at` DATETIME(3) NULL;
ALTER TABLE `courses` ADD COLUMN `course_start_date` DATETIME(3) NULL;
