import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { rows } = await sql`
    SELECT
      id, workbook_id as "workbookId",
      version_number as "versionNumber",
      uploaded_by as "uploadedBy",
      uploaded_at as "uploadedAt",
      file_name as "fileName",
      file_hash as "fileHash",
      blob_url as "blobUrl",
      diff, ai_summary as "aiSummary"
    FROM workbook_versions
    WHERE workbook_id = ${params.id}
    ORDER BY version_number DESC
  `;
  // Strip parsedSnapshot from diff before sending to client (large payload)
  const sanitized = rows.map((r) => ({
    ...r,
    diff: r.diff ? {
      cellChanges: r.diff.cellChanges ?? [],
      vbaChanges: r.diff.vbaChanges ?? [],
      structuralChanges: r.diff.structuralChanges ?? [],
      totalChanges: r.diff.totalChanges ?? 0,
    } : null,
  }));
  return NextResponse.json({ versions: sanitized });
}
