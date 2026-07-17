# ExcelIQ — AI-Powered Excel Workbook Intelligence Platform

A smart QC specialist and metadata engine for corporate Excel workbooks. Upload `.xlsx`/`.xlsm` files, get semantic diffs, AI-generated audit logs, anomaly detection, and a collaborative resolution dashboard.

## MVP Scope
- Manual file upload (`.xlsx` / `.xlsm`)
- Semantic diff: formula, value, structural changes
- AI-generated change summaries + inferred intent (optional)
- Anomaly flagging with severity levels
- Persistent audit log per workbook
- Team dashboard to review and resolve flags

## Tech Stack
- **Frontend**: Next.js 14 (App Router), Tailwind CSS
- **Backend**: Next.js API Routes
- **Parsing**: SheetJS (`xlsx`) in Node
- **AI** (optional): Anthropic Claude via Vercel AI SDK
- **Storage**: Local `.data/` store by default; Vercel Postgres + Blob when configured
- **Optional**: Python FastAPI microservice for VBA extraction (`python/`)

## Getting Started (local — zero cloud keys)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter your name, and upload an `.xlsx` file.

Data is stored under `.data/` (gitignored). No Postgres, Blob, or Anthropic key is required for the core upload → dashboard → diff flow.

Optional: copy `.env.example` to `.env.local` and add `ANTHROPIC_API_KEY` for richer AI summaries on version 2+.

## Production / Vercel mode

Set these in `.env.local` (or Vercel project settings):

```bash
POSTGRES_URL=...
BLOB_READ_WRITE_TOKEN=...
ANTHROPIC_API_KEY=...   # optional
```

Then visit `/api/init` once (or just upload — schema auto-inits) to create tables.

## Environment Variables
See `.env.example` for all keys. Local mode activates automatically when `POSTGRES_URL` is unset.

## Project Structure
```
exceliq/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Landing / upload page
│   ├── dashboard/          # Team dashboard
│   ├── workbook/[id]/      # Workbook detail + diff viewer
│   └── api/                # API routes
│       ├── upload/         # File ingestion + hashing + analysis
│       ├── workbooks/      # CRUD for audit log
│       ├── files/          # Local file serving
│       └── init/           # Storage bootstrap
├── lib/                    # Core logic
│   ├── parser.ts           # Excel parsing (SheetJS)
│   ├── diff.ts             # Semantic diff engine
│   ├── ai.ts               # Claude + rule-based anomalies
│   ├── db.ts               # Postgres helpers
│   ├── local-store.ts      # File-backed local store
│   └── storage.ts          # Blob / local file storage
├── python/                 # Optional FastAPI VBA extractor
│   ├── main.py
│   ├── parser.py
│   └── requirements.txt
└── types/                  # Shared TypeScript types
```
