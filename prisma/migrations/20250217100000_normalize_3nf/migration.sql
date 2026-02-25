-- Normalize schema to 3NF: remove redundant derived columns, replace Task.course_name with course_id FK

-- Courses: remove derived count columns (computable from assignments/exams)
ALTER TABLE `courses` DROP COLUMN `total_assignments`;
ALTER TABLE `courses` DROP COLUMN `completed_assignments`;
ALTER TABLE `courses` DROP COLUMN `pending_assignments`;
ALTER TABLE `courses` DROP COLUMN `total_exams`;
ALTER TABLE `courses` DROP COLUMN `completed_exams`;
ALTER TABLE `courses` DROP COLUMN `pending_exams`;

-- LmsActivity: remove derived date columns (computable from assignments/exams)
ALTER TABLE `lms_activities` DROP COLUMN `assignment_submission_date`;
ALTER TABLE `lms_activities` DROP COLUMN `exam_submission_date`;
ALTER TABLE `lms_activities` DROP COLUMN `assignment_deadline`;
ALTER TABLE `lms_activities` DROP COLUMN `exam_deadline`;

-- Tasks: add course_id FK, drop course_name
ALTER TABLE `tasks` ADD COLUMN `course_id` INTEGER NULL;
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `tasks` DROP COLUMN `course_name`;
