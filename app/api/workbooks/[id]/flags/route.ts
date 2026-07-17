import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { isLocalMode, listFlags } from '@/lib/local-store';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (isLocalMode()) {
      const flags = await listFlags(params.id);
      return NextResponse.json({
        flags: flags.map((f) => ({
          id: f.id,
          versionId: f.versionId,
          severity: f.severity,
          category: f.category,
          title: f.title,
          description: f.description,
          affectedCell: f.affectedCell,
          affectedSheet: f.affectedSheet,
          aiInferredCause: f.aiInferredCause,
          status: f.status,
          resolvedBy: f.resolvedBy,
          resolvedAt: f.resolvedAt,
          resolutionNote: f.resolutionNote,
          createdAt: f.createdAt,
        })),
      });
    }

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
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
