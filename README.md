# Nowify LMS

Intelligent system for studying the effect of procrastination on academic performance.  
King Khalid University.

## Stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Next.js API routes, Prisma (MySQL)
- **ML:** Python (Flask API), scikit-learn – procrastination prediction

## Setup

1. Copy [`.env.example`](.env.example) to `.env` and set `DATABASE_URL` (MySQL).
2. Install and apply **deployment** migrations (one squashed migration for a
   fresh MySQL database):
   ```bash
   npm install
   npx prisma generate
   npx prisma migrate deploy
   ```
   If you previously used older migration folders on this database, use a new
   empty schema or follow Prisma **baselining** — history was replaced by
   [`20260416120000_deploy_schema`](prisma/migrations/20260416120000_deploy_schema/migration.sql).
3. Seed the database:
   ```bash
   npm run db:seed
   ```
   - **Dates, courses, assignments, exams, tasks, and activity** are generated only from
     [`prisma/seed.ts`](prisma/seed.ts) (no dates are read from spreadsheets).
   - **`universityId` (login)** — IDs are taken, in order, from:
     1. `SEED_UNIVERSITY_IDS_FILE` — text file, one ID per line (`#` starts a comment), or
     2. `SEED_STUDENT_IDS_EXCEL_PATH`, or if unset
        [`prisma/date_references_seed.xlsx`](prisma/date_references_seed.xlsx) — column
        `student_id` / `Student ID`, or the first column (IDs only).
     3. If no file yields IDs: synthetic **`400000001`** … **`400000050`**.
   - Default password for every seeded student: **`password123`**.
4. Run the app:
   ```bash
   npm run dev
   ```
   (serves on **http://localhost:3001**).
5. **Optional — Flask ML API** (procrastination prediction used by the dashboard):
   ```bash
   cd ml/api && pip install -r requirements.txt && python app.py
   ```
   Default URL **http://127.0.0.1:5000**. Set `FLASK_API_URL` in `.env` if it runs elsewhere.

### GitHub Codespaces

The repo includes [`.devcontainer/devcontainer.json`](.devcontainer/devcontainer.json):
Node 20, `npm install` and `npx prisma generate` on container create, and forwarded ports
**3001** (Next.js), **5000** (Flask), **3306** (MySQL if you attach or tunnel a server).
Codespaces do not start MySQL; point `DATABASE_URL` at a reachable database. Use
`FLASK_API_URL` when the ML API is not on localhost.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | MySQL connection string for Prisma. |
| `FLASK_API_URL` | No | Base URL of the Flask API (default `http://127.0.0.1:5000`). The **Next.js server** calls it (SSR and API routes), not the browser. |
| `SEED_UNIVERSITY_IDS_FILE` | No | Path to a UTF-8 file: one `universityId` per line; overrides Excel for seeding. |
| `SEED_STUDENT_IDS_EXCEL_PATH` | No | Path to an Excel workbook used **only** for ID columns when seeding. |

See [`.env.example`](.env.example) for commented templates.

## ML and prediction

- **Feature contract:** eight numeric features are defined in
  [`lib/featureVector.ts`](lib/featureVector.ts), listed in
  [`ml/features.txt`](ml/features.txt), and consumed by
  [`ml/api/app.py`](ml/api/app.py) `POST /predict` (trained model in
  `ml/model/procrastination_model.joblib`).
- **Next.js:** the dashboard builds the vector in the server and POSTs to Flask.
  **`GET /api/features`** returns the current student’s vector (debugging / QA).
  **`POST /api/predict`** returns Flask’s `level` and `percentage` for the session
  student (`GET` returns **405** — use POST).
- **Smoke test (Flask running):** `python ml/api/test_predict.py`

## Dataset

The ML pipeline expects the **OULAD** (Open University Learning Analytics Dataset) in `ml/dataset/`. The folder is not committed; download the dataset and place the CSV files there.

**Dataset URL:**  
[https://www.kaggle.com/datasets/anlgrbz/student-demographics-online-education-dataoulad](https://www.kaggle.com/datasets/anlgrbz/student-demographics-online-education-dataoulad)

After downloading, extract the CSV files (e.g. `studentInfo.csv`,
`studentRegistration.csv`, `studentVle.csv`, `vle.csv`, `assessments.csv`,
`courses.csv`, `studentAssessment.csv`) into `ml/dataset/`. Training and export
scripts live in [`docs/03-ml-prediction.md`](docs/03-ml-prediction.md)
and [`ml/notebooks/`](ml/notebooks/) — use them to build `ml/final_dataset.csv` and
refresh `ml/model/procrastination_model.joblib` when you change the pipeline.

## Project Structure

```
.
├── .devcontainer/                               # GitHub Codespaces / Dev Containers
│   └── devcontainer.json                        # Node 20 + ports + postCreateCommand
├── .eslintrc.json                               # ESLint (Next.js core-web-vitals)
├── .gitignore                                   # Git ignore rules
├── next-env.d.ts                                # Next.js TypeScript env types
├── next.config.js                               # Next.js configuration
├── package-lock.json                            # npm dependency lockfile
├── package.json                                 # Project scripts/dependencies
├── postcss.config.js                            # PostCSS configuration
├── README.md                                    # Project documentation
├── tailwind.config.js                           # Tailwind CSS configuration
├── tsconfig.json                                # TypeScript configuration
├── app/                                         # Next.js App Router source
│   ├── globals.css                              # Global styles
│   ├── layout.tsx                               # Root app layout
│   ├── page.tsx                                 # Landing page
│   ├── api/                                     # API route handlers
│   │   ├── assignments/                         # Assignments API group
│   │   │   └── route.ts                         # /api/assignments endpoint
│   │   ├── auth/                                # Authentication API group
│   │   │   ├── login/                           # Login endpoint group
│   │   │   │   └── route.ts                     # /api/auth/login endpoint
│   │   │   ├── logout/                          # Logout endpoint group
│   │   │   │   └── route.ts                     # /api/auth/logout endpoint
│   │   │   └── me/                              # Current user endpoint group
│   │   │       └── route.ts                     # /api/auth/me endpoint
│   │   ├── consent/                             # Consent API group
│   │   │   └── route.ts                         # /api/consent endpoint
│   │   ├── courses/                             # Courses API group
│   │   │   └── route.ts                         # /api/courses endpoint
│   │   ├── dashboard/                           # Dashboard aggregate API group
│   │   │   └── route.ts                         # /api/dashboard endpoint
│   │   ├── exams/                               # Exams API group
│   │   │   └── route.ts                         # /api/exams endpoint
│   │   ├── features/                            # ML feature vector API group
│   │   │   └── route.ts                         # GET /api/features (session student)
│   │   ├── predict/                             # Prediction API group
│   │   │   └── route.ts                         # POST /api/predict (session → Flask)
│   │   ├── student/                             # Student API group
│   │   │   └── route.ts                         # /api/student endpoint
│   │   ├── tasks/                               # Tasks API group
│   │   │   ├── route.ts                         # /api/tasks endpoint
│   │   │   └── [id]/                            # Task-by-id API group
│   │   │       └── route.ts                     # /api/tasks/[id] endpoint
│   ├── consent/                                 # Consent page module
│   │   └── page.tsx                             # Consent page UI
│   ├── dashboard/                               # Dashboard module
│   │   ├── DashboardSidebar.tsx                 # Dashboard sidebar component
│   │   ├── layout.tsx                           # Dashboard layout wrapper
│   │   ├── page.tsx                             # Dashboard home page
│   │   ├── calendar/                            # Calendar feature module
│   │   │   ├── AddTaskForm.tsx                  # Add task form component
│   │   │   ├── AddTaskScrollButton.tsx          # Scroll/floating add-task button
│   │   │   ├── AllTasksTable.tsx                # Task table component
│   │   │   ├── CalendarView.tsx                 # Calendar visualization component
│   │   │   └── page.tsx                         # Calendar page
│   │   ├── student/                             # Student dashboard submodule
│   │   │   └── page.tsx                         # Student details page
│   │   └── tasks/                               # Tasks dashboard submodule
│   │       ├── AddTaskCard.tsx                  # Add-task card component
│   │       ├── page.tsx                         # Tasks board page
│   │       └── TaskBoard.tsx                    # Kanban/task board component
│   ├── forgot-password/                         # Forgot-password module
│   │   └── page.tsx                             # Forgot-password page
│   ├── lms/                                     # LMS overview module
│   │   └── page.tsx                             # LMS page
│   ├── login/                                   # Login module
│   │   └── page.tsx                             # Login page
│   └── logout/                                  # Logout module
│       └── page.tsx                             # Logout page
├── lib/                                         # Shared utilities
│   ├── auth.ts                                  # Auth/session helpers
│   ├── featureVector.ts                         # ML feature-vector builder
│   ├── messageRules.ts                          # Message rule mappings
│   └── prisma.ts                                # Prisma client singleton
├── ml/                                          # Machine learning workspace
│   ├── 8_Feature_Matrix.md                      # Feature matrix notes/document
│   ├── feature_engineering.py                   # Feature engineering script
│   ├── feature_matrix.csv                       # Engineered feature matrix
│   ├── features.txt                             # Feature list reference
│   ├── requirements.txt                         # Python dependencies
│   ├── api/                                     # Flask prediction API
│   │   ├── app.py                               # Flask app (/health, /predict)
│   │   └── test_predict.py                      # Prediction API test script
│   ├── dataset/                                 # Raw dataset folder (OULAD)
│   ├── model/                                   # Trained model artifacts
│   │   ├── evaluation_report.txt                # Model evaluation summary
│   │   └── procrastination_model.joblib         # Serialized trained model
│   └── notebooks/                               # Jupyter notebooks
│       ├── EDA.ipynb                            # Exploratory data analysis notebook
│       └──Model_Training.ipynb                  # Main training notebook
├── prisma/                                      # Prisma ORM/database assets
│   ├── date_references_seed.xlsx                # Optional: university IDs for seed (Excel)
│   ├── schema.prisma                            # Database schema
│   ├── seed.ts                                  # Seed script
│   └── migrations/                              # Prisma migrate history
│       ├── migration_lock.toml                  # MySQL provider lock
│       └── 20260416120000_deploy_schema/        # Squashed deploy (full schema)
│           └── migration.sql                    # CREATE TABLE + FKs
├── public/                                      # Public static assets
│   └── images/                                  # Image assets folder
│       └── logo_nowify.png                      # Application logo
```

## Next steps

- Verify the app builds cleanly: `npm run lint` then `npm run build`
- Seed + login:
  - Run `npm run db:seed`
  - Login at `/login` with any seeded `universityId` and password **`password123`**
- Walk the core UI:
  - `/lms` → `/consent` (if consent not set) → `/dashboard`
  - `/dashboard/calendar` (month + week views)
  - `/dashboard/tasks` (create task, move status, delete)
- Verify the ML integration (optional):
  - Start Flask: `cd ml/api && pip install -r requirements.txt && python app.py`
  - Smoke test Flask: `python ml/api/test_predict.py`
  - Debug feature payload: `GET /api/features`
  - Prediction route: `POST /api/predict` (note: `GET` returns 405)

## License

Private / academic use.
