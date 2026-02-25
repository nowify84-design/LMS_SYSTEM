# Nowify LMS

Intelligent system for studying the effect of procrastination on academic performance.  
King Khalid University.

## Stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Next.js API routes, Prisma (MySQL)
- **ML:** Python (Flask API), scikit-learn – procrastination prediction

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` (MySQL).
2. `npm install` then `npx prisma generate` and `npx prisma migrate deploy`.
3. Seed: `npm run db:seed` (uses `prisma/date_references_seed.xlsx` for student IDs).
4. Run app: `npm run dev` (port 3001).
5. Optional ML API: `cd ml/api && pip install -r requirements.txt && python app.py` (port 5000).

## Dataset

The ML pipeline expects the **OULAD** (Open University Learning Analytics Dataset) in `ml/dataset/`. The folder is not committed; download the dataset and place the CSV files there.

**Dataset URL:**  
[https://www.kaggle.com/datasets/anlgrbz/student-demographics-online-education-dataoulad](https://www.kaggle.com/datasets/anlgrbz/student-demographics-online-education-dataoulad)

After downloading, extract the CSV files (e.g. `studentInfo.csv`, `studentRegistration.csv`, `studentVle.csv`, `vle.csv`, `assessments.csv`, `courses.csv`, `studentAssessment.csv`) into `ml/dataset/`. Then run `python ml/export_final_dataset.py` from the project root to build `ml/final_dataset.csv`, and `python ml/train_model_final.py` to train the model.

## License

Private / academic use.
