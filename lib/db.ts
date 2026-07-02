/**
 * Database helpers using Vercel Postgres.
 * Schema: workbooks, workbook_versions, anomaly_flags
 */

import { sql } from '@vercel/postgres';
import type { Workbook, WorkbookVersion, AnomalyFlag } from '@/types/workbook';

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS workbooks (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_modified_at TIMESTAMPTZ DEFAULT NOW(),
      health_score INT DEFAULT 100,
      open_flag_count INT DEFAULT 0
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS workbook_versions (
      id UUID PRIMARY KEY,
      workbook_id UUID REFERENCES workbooks(id) ON DELETE CASCADE,
      version_number INT NOT NULL,
      uploaded_by TEXT NOT NULL,
      uploaded_at TIMESTAMPTZ DEFAULT NOW(),
      file_name TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      blob_url TEXT NOT NULL,
      diff JSONB,
      ai_summary TEXT,
      ai_inferred_reason TEXT
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS anomaly_flags (
      id UUID PRIMARY KEY,
      version_id UUID REFERENCES workbook_versions(id) ON DELETE CASCADE,
      workbook_id UUID REFERENCES workbooks(id) ON DELETE CASCADE,
      severity TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      affected_cell TEXT,
      affected_sheet TEXT,
      ai_inferred_cause TEXT,
      status TEXT DEFAULT 'open',
      resolved_by TEXT,
      resolved_at TIMESTAMPTZ,
      resolution_note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
}

export async function getWorkbooks(): Promise<Workbook[]> {
  const { rows } = await sql`
    SELECT w.*,
      COUNT(af.id) FILTER (WHERE af.status = 'open') as open_flag_count
    FROM workbooks w
    LEFT JOIN anomaly_flags af ON af.workbook_id = w.id
    GROUP BY w.id
    ORDER BY w.last_modified_at DESC
  `;
  return rows as unknown as Workbook[];
}

export async function getWorkbookById(id: string): Promise<Workbook | null> {
  const { rows } = await sql`SELECT * FROM workbooks WHERE id = ${id}`;
  if (rows.length === 0) return null;
  return rows[0] as unknown as Workbook;
}

export async function getVersionsByWorkbookId(workbookId: string): Promise<WorkbookVersion[]> {
  const { rows } = await sql`
    SELECT * FROM workbook_versions
    WHERE workbook_id = ${workbookId}
    ORDER BY version_number DESC
  `;
  return rows as unknown as WorkbookVersion[];
}

export async function getFlagsByWorkbookId(workbookId: string): Promise<AnomalyFlag[]> {
  const { rows } = await sql`
    SELECT * FROM anomaly_flags
    WHERE workbook_id = ${workbookId}
    ORDER BY created_at DESC
  `;
  return rows as unknown as AnomalyFlag[];
}

export async function resolveFlag(
  flagId: string,
  resolvedBy: string,
  note: string
) {
  await sql`
    UPDATE anomaly_flags
    SET status = 'resolved', resolved_by = ${resolvedBy},
        resolved_at = NOW(), resolution_note = ${note}
    WHERE id = ${flagId}
  `;

  // Recompute open flag count on the parent workbook
  await sql`
    UPDATE workbooks w
    SET open_flag_count = (
      SELECT COUNT(*) FROM anomaly_flags
      WHERE workbook_id = w.id AND status = 'open'
    )
    FROM anomaly_flags af
    WHERE af.id = ${flagId} AND w.id = af.workbook_id
  `;
}
