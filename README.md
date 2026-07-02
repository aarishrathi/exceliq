# ExcelIQ — AI-Powered Excel Workbook Intelligence Platform

A smart QC specialist and metadata engine for corporate Excel workbooks. Upload `.xlsx`/`.xlsm` files, get semantic diffs, AI-generated audit logs, anomaly detection, and a collaborative resolution dashboard.

## MVP Scope
- Manual file upload (`.xlsx` / `.xlsm`)
- Semantic diff: formula, value, structural, VBA/macro changes
- AI-generated change summaries + inferred intent
- Anomaly flagging with severity levels
- Persistent audit log per workbook
- Team dashboard to review and resolve flags

## Tech Stack
- **Frontend**: Next.js 14 (App Router), Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes (serverless)
- **AI**: Anthropic Claude via Vercel AI SDK
- **Parsing**: Python microservice (FastAPI) via `/api/parse`
- **Storage**: Vercel Postgres (audit log) + Vercel Blob (file storage)
- **Deployment**: Vercel

## Getting Started

```bash
npm install
cp .env.example .env.local
# Fill in your keys
npm run dev
```

## Environment Variables
See `.env.example` for all required keys.

## Project Structure
```
exceliq/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Landing / upload page
│   ├── dashboard/          # Team dashboard
│   ├── workbook/[id]/      # Workbook detail + diff viewer
│   └── api/                # API routes
│       ├── upload/         # File ingestion + hashing
│       ├── analyze/        # AI diff + anomaly detection
│       └── workbooks/      # CRUD for audit log
├── components/             # UI components
├── lib/                    # Core logic
│   ├── parser.ts           # Excel parsing orchestrator
│   ├── diff.ts             # Semantic diff engine
│   ├── ai.ts               # Claude integration
│   └── db.ts               # Database helpers
├── python/                 # FastAPI parsing microservice
│   ├── main.py
│   ├── parser.py
│   └── requirements.txt
└── types/                  # Shared TypeScript types
```
