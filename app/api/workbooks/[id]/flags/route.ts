import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { rows } = await sql`
    SELECT
      id, version_id as "versionId",
      severity, category, title, description,
      affected_cell as "affectedCell",
      affected_sheet as "affectedSheet",
      ai_inferred_cause as "aiInferredCause",
      status, resolved_by as "resolvedBy",
      resolved_at as "resolvedAt",
      resolution_note as "resolutionNote",
      created_at as "createdAt"
    FROM anomaly_flags
    WHERE workbook_id = ${params.id}
    ORDER BY created_at DESC
  `;
  return NextResponse.json({ flags: rows });
}
