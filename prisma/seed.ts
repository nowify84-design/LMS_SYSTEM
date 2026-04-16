/**
 * Nowify LMS – database seed.
 * Creates the database if it does not exist, then seeds.
 * Semester and assessment dates are defined only in this file (never read from a file).
 * University IDs (login `universityId`) can come from:
 *   - SEED_UNIVERSITY_IDS_FILE: UTF-8 text, one ID per line (# starts a comment), or
 *   - SEED_STUDENT_IDS_EXCEL_PATH or prisma/date_references_seed.xlsx: first sheet,
 *     column "student_id" / "Student ID" / first column — IDs only, no dates are read.
 * If neither yields IDs, synthetic 400000001+ are used.
 */

import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import * as mysql from "mysql2/promise";
import { execSync } from "child_process";

const prisma = new PrismaClient();

const DEFAULT_EXCEL_IDS_PATH = path.join(__dirname, "date_references_seed.xlsx");

/** One university ID per line; empty lines and # comments skipped. */
function readUniversityIdsFromTxt(filePath: string): string[] {
  const raw = fs.readFileSync(filePath, "utf8");
  return Array.from(
    new Set(
      raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== "" && !line.startsWith("#")),
    ),
  );
}

/**
 * Reads student_id-style column from Excel. Only string IDs are used; workbook is
 * not used for dates (see DATE_REFERENCES in this file).
 */
function readUniversityIdsFromExcel(filePath: string): string[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  if (rows.length === 0) return [];

  const firstRow = rows[0];
  const keys = Object.keys(firstRow);
  const idKey =
    keys.find((k) => /student_id|student id/i.test(k)) ?? keys[0];
  return Array.from(
    new Set(
      rows
        .map((r: Record<string, unknown>) => r[idKey])
        .filter((v: unknown) => v != null && String(v).trim() !== "")
        .map((v: unknown) => String(v).trim()),
    ),
  );
}

function getUniversityIdsFromFile(): { ids: string[]; source: string } {
  const txtPath = process.env.SEED_UNIVERSITY_IDS_FILE?.trim();
  if (txtPath) {
    if (!fs.existsSync(txtPath)) {
      console.warn(`SEED_UNIVERSITY_IDS_FILE not found: ${txtPath}`);
      return { ids: [], source: "none" };
    }
    const ids = readUniversityIdsFromTxt(txtPath);
    return { ids, source: `text (${txtPath})` };
  }

  const excelPath =
    process.env.SEED_STUDENT_IDS_EXCEL_PATH?.trim() || DEFAULT_EXCEL_IDS_PATH;
  if (!fs.existsSync(excelPath)) {
    return { ids: [], source: "none" };
  }
  try {
    const ids = readUniversityIdsFromExcel(excelPath);
    return { ids, source: `Excel (${excelPath})` };
  } catch (e) {
    console.warn("Could not read university IDs from Excel:", (e as Error).message);
    return { ids: [], source: "none" };
  }
}

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

/**
 * Academic calendar (code only). Assignment due dates are derived from each
 * course start so TMAs stay ordered like a real LMS.
 */
const DATE_REFERENCES = {
  semesterStart: new Date("2026-02-01"),
  semesterEnd: new Date("2026-06-15"),
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
  "Systems Requirements Management",
  "Data Structures",
  "Operating Systems",
  "Web Technologies",
];

const CAMPUSES = ["Main", "Women's Campus", "Branch A"];
const MAJORS = [
  "Computer Science",
  "Information Technology",
  "Software Engineering",
  "Data Science",
];

const ASSIGNMENT_TYPES = ["TMA", "CMA", "TMA", "CMA"] as const;

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function randomBetween(start: Date, end: Date): Date {
  const t = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(t);
}

/**
 * LMS-style spaced due dates: week 2, 4, 6, 8 after course start, with a small
 * per-course offset so rows differ but stay monotonic per course.
 */
function assignmentDueDate(
  courseStartDate: Date,
  assignmentIndex1Based: number,
  courseIndex: number,
): Date {
  const week = assignmentIndex1Based * 2;
  const baseDays = week * 7 + (courseIndex % 3) - 1;
  const due = addDays(courseStartDate, Math.max(7, baseDays));
  if (due.getTime() > DATE_REFERENCES.semesterEnd.getTime()) {
    return new Date(DATE_REFERENCES.semesterEnd);
  }
  return due;
}

/** Final exam placed deterministically inside the exam window. */
function finalExamDate(courseIndex: number, studentIndex: number): Date {
  const span =
    DATE_REFERENCES.examWindowEnd.getTime() -
    DATE_REFERENCES.examWindowStart.getTime();
  const step = span / 16;
  const offset = (courseIndex * 3 + studentIndex * 2) % 12;
  return new Date(DATE_REFERENCES.examWindowStart.getTime() + step * offset);
}

async function main() {
  await ensureDatabaseExists();
  ensureMigrationsApplied();

  await prisma.task.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.lmsResource.deleteMany();
  await prisma.course.deleteMany();
  await prisma.lmsActivityDaily.deleteMany();
  await prisma.lmsActivity.deleteMany();
  await prisma.student.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  const { ids: fileIds, source: idSource } = getUniversityIdsFromFile();
  const studentIds =
    fileIds.length > 0
      ? fileIds
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
      const completedAssignmentsForCourse = 1 + (ci + i) % 4;
      const examCompleted = (i + ci) % 3 === 0;
      const courseStartDate = DATE_REFERENCES.semesterStart;
      const enrolledAt = addDays(
        courseStartDate,
        -14 - ci * 3 + (i % 5),
      );
      const course = await prisma.course.create({
        data: {
          studentId: student.id,
          courseName,
          courseStartDate,
          enrolledAt,
        },
      });

      for (let a = 1; a <= 4; a++) {
        const dueDate = assignmentDueDate(courseStartDate, a, ci);
        const isCompleted = a <= completedAssignmentsForCourse;
        const isLate = !isCompleted && oneBased <= 10 && a === 3;
        const submissionDate = isCompleted
          ? addDays(dueDate, -1)
          : isLate
            ? addDays(dueDate, 2)
            : null;
        await prisma.assignment.create({
          data: {
            courseId: course.id,
            type: ASSIGNMENT_TYPES[a - 1],
            assignmentTitle: `${ASSIGNMENT_TYPES[a - 1]} ${a} – ${courseName}`,
            dueDate,
            submissionDate,
            status: isCompleted ? "Completed" : isLate ? "Late" : "Pending",
          },
        });
      }

      const examDate = finalExamDate(ci, i);
      await prisma.exam.create({
        data: {
          courseId: course.id,
          type: "Exam",
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

    for (let d = 0; d < 25 + (i % 10); d++) {
      const actDate = addDays(DATE_REFERENCES.semesterStart, d + 5);
      await prisma.lmsActivityDaily.create({
        data: {
          studentId: student.id,
          activityDate: actDate,
          clicks: 3 + (i % 5),
          uniqueSites: 2 + (d % 3),
        },
      });
    }

    for (const course of await prisma.course.findMany({
      where: { studentId: student.id },
    })) {
      for (let r = 0; r < 15 + (i % 10); r++) {
        await prisma.lmsResource.create({
          data: {
            courseId: course.id,
            title: `Resource ${r + 1}`,
          },
        });
      }
    }

    const numTasks = 1 + (i % 4);
    const statuses = ["To-Do", "In Progress", "In Review", "Done"];
    const firstCourseId =
      studentCourseNames.length > 0
        ? (
            await prisma.course.findFirst({
              where: { studentId: student.id, courseName: studentCourseNames[0] },
              select: { id: true },
            })
          )?.id ?? null
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

  const idLabel =
    fileIds.length > 0 ? `university_id from ${idSource}` : "synthetic university_id";
  console.log(`Seed completed: ${totalStudents} students (${idLabel}).`);
  console.log("Date reference (code only):", DATE_REFERENCES);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
