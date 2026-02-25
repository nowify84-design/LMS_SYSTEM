/**
 * Nowify LMS – database seed.
 * Creates the database if it does not exist, then seeds.
 * Student list and university_id come only from Excel (date_references_seed.xlsx) student_id column.
 * Tasks, courses, assignments, and exams are generated in-code.
 */

import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import * as path from "path";
import * as mysql from "mysql2/promise";
import { execSync } from "child_process";

const prisma = new PrismaClient();

const EXCEL_PATH = path.join(__dirname, "date_references_seed.xlsx");

/** Create the database from DATABASE_URL if it does not exist. */
async function ensureDatabaseExists(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("mysql")) return;
  try {
    const parsed = new URL(url.replace(/^mysql:/, "http:"));
    const host = parsed.hostname;
    const port = parsed.port ? Number(parsed.port) : 3306;
    const user = decodeURIComponent(parsed.username);
    const password = decodeURIComponent(parsed.password);
    const database = parsed.pathname.slice(1).replace(/\?.*$/, "").trim();
    if (!database) return;

    const conn = await mysql.createConnection({
      host,
      port,
      user,
      password,
    });
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database.replace(/`/g, "``")}\``);
    await conn.end();
    console.log(`Database \`${database}\` ensured.`);
  } catch (e) {
    console.warn("Could not ensure database exists:", (e as Error).message);
  }
}

/** Run Prisma migrations so tables exist (no-op if already applied). */
function ensureMigrationsApplied(): void {
  try {
    const projectRoot = path.join(__dirname, "..");
    execSync("npx prisma migrate deploy", {
      stdio: "inherit",
      cwd: projectRoot,
      env: { ...process.env },
    });
    console.log("Migrations applied.");
  } catch (e) {
    console.warn("Could not run migrations (tables may already exist):", (e as Error).message);
  }
}

/** Read student_id values from Excel (only source for student list / university_id); column may be "student_id", "Student ID", or first column. */
function getStudentIdsFromExcel(): string[] {
  try {
    const workbook = XLSX.readFile(EXCEL_PATH);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    if (rows.length === 0) return [];

    const firstRow = rows[0];
    const keys = Object.keys(firstRow);
    const idKey =
      keys.find((k) => /student_id|student id/i.test(k)) ?? keys[0];
    const ids = rows
      .map((r: Record<string, unknown>) => r[idKey])
      .filter((v: unknown) => v != null && String(v).trim() !== "")
      .map((v: unknown) => String(v).trim());
    return Array.from(new Set(ids));
  } catch (e) {
    console.warn("Could not read date_references_seed.xlsx, using default student IDs:", (e as Error).message);
    return [];
  }
}

// —— Date reference: align with date_references_seed.xlsx (2026) ——
const DATE_REFERENCES = {
  semesterStart: new Date("2026-02-01"),
  semesterEnd: new Date("2026-06-15"),
  assignmentDueStart: new Date("2026-03-01"),
  assignmentDueEnd: new Date("2026-05-20"),
  examWindowStart: new Date("2026-05-25"),
  examWindowEnd: new Date("2026-06-10"),
  taskStart: new Date("2026-02-10"),
  taskEnd: new Date("2026-06-01"),
};

const COURSE_NAMES = [
  "Artificial Intelligence",
  "Database Systems",
  "Software Engineering",
  "Computer Networks",
  "Systems Rules Management",
  "Data Structures",
  "Operating Systems",
  "Web Technologies",
];

const CAMPUSES = ["Main", "Women's Campus", "Branch A"];
const MAJORS = ["Computer Science", "Information Technology", "Software Engineering", "Data Science"];

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function randomBetween(start: Date, end: Date): Date {
  const t = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(t);
}

async function main() {
  await ensureDatabaseExists();
  ensureMigrationsApplied();

  await prisma.task.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.course.deleteMany();
  await prisma.lmsActivity.deleteMany();
  await prisma.student.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  const excelStudentIds = getStudentIdsFromExcel();
  const studentIds =
    excelStudentIds.length > 0
      ? excelStudentIds
      : Array.from({ length: 50 }, (_, i) => String(400000001 + i));
  const totalStudents = studentIds.length;

  for (let i = 0; i < totalStudents; i++) {
    const universityId = studentIds[i];
    const oneBased = i + 1;
    const campus = CAMPUSES[i % CAMPUSES.length];
    const major = MAJORS[i % MAJORS.length];
    const student = await prisma.student.create({
      data: {
        universityId,
        name: `Student ${oneBased}`,
        email: `student${oneBased}@university.edu`,
        passwordHash,
        major,
        campus,
        academicStatus: "Active",
        degree: "Bachelor",
        dataConsentAt: oneBased <= 25 ? new Date() : null,
      },
    });

    const numCourses = 3 + (i % 3);
    const chosen = COURSE_NAMES.slice(0, numCourses).sort(() => Math.random() - 0.5);
    const studentCourseNames: string[] = [];
    for (let ci = 0; ci < chosen.length; ci++) {
      const courseName = chosen[ci];
      studentCourseNames.push(courseName);
      // Vary completion per course so progress % differs (e.g. 20%, 40%, 60%, 80%, 100%)
      const completedAssignmentsForCourse = 1 + (ci + i) % 4; // 1–4 completed per course
      const examCompleted = (i + ci) % 3 === 0; // some courses have exam done
      const courseStartDate = DATE_REFERENCES.semesterStart;
      const enrolledAt = addDays(
        courseStartDate,
        -14 - (ci * 3) + (i % 5)
      ); // mix of early (-14 to -9) and on-time (-6 to -1) enrollment
      const course = await prisma.course.create({
        data: {
          studentId: student.id,
          courseName,
          courseStartDate,
          enrolledAt,
        },
      });

      for (let a = 1; a <= 4; a++) {
        const dueDate = randomBetween(DATE_REFERENCES.assignmentDueStart, DATE_REFERENCES.assignmentDueEnd);
        const isCompleted = a <= completedAssignmentsForCourse;
        const isLate = !isCompleted && oneBased <= 10 && a === 3;
        const submissionDate = isCompleted ? addDays(dueDate, -1) : isLate ? addDays(dueDate, 2) : null;
        await prisma.assignment.create({
          data: {
            courseId: course.id,
            assignmentTitle: `Assignment ${a} – ${courseName}`,
            dueDate,
            submissionDate,
            status: isCompleted ? "Completed" : isLate ? "Late" : "Pending",
          },
        });
      }

      const examDate = randomBetween(DATE_REFERENCES.examWindowStart, DATE_REFERENCES.examWindowEnd);
      await prisma.exam.create({
        data: {
          courseId: course.id,
          examTitle: `Final Exam – ${courseName}`,
          examDate,
          submissionDate: examCompleted ? addDays(examDate, -1) : null,
          status: examCompleted ? "Completed" : "Pending",
        },
      });
    }

    await prisma.lmsActivity.create({
      data: {
        studentId: student.id,
        loginCount: 5 + (i % 20),
        lastLoginDate: addDays(DATE_REFERENCES.semesterStart, 30 + (i % 30)),
      },
    });

    const numTasks = i % 4;
    const statuses = ["To-Do", "In Progress", "In Review", "Done"];
    const firstCourseId =
      studentCourseNames.length > 0
        ? (await prisma.course.findFirst({
            where: { studentId: student.id, courseName: studentCourseNames[0] },
            select: { id: true },
          }))?.id ?? null
        : null;
    for (let t = 0; t < numTasks; t++) {
      const startDate = randomBetween(DATE_REFERENCES.taskStart, DATE_REFERENCES.taskEnd);
      const endDate = addDays(startDate, 7 + (t % 14));
      await prisma.task.create({
        data: {
          studentId: student.id,
          courseId: t === 0 ? firstCourseId : null,
          taskTitle: `Task ${t + 1} – Student ${oneBased}`,
          startDate,
          endDate,
          dueTime: "23:59",
          status: statuses[t % statuses.length],
        },
      });
    }
  }

  console.log(`Seed completed: ${totalStudents} students (university_id from Excel student_id only).`);
  console.log("Date reference used (align with date_references_seed.xlsx):", DATE_REFERENCES);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
