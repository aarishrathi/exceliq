import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { isLocalMode, listVersions } from '@/lib/local-store';

function sanitizeDiff(diff: Record<string, unknown> | null | undefined) {
  if (!diff) return null;
  return {
    cellChanges: diff.cellChanges ?? [],
    vbaChanges: diff.vbaChanges ?? [],
    structuralChanges: diff.structuralChanges ?? [],
    totalChanges: diff.totalChanges ?? 0,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (isLocalMode()) {
      const versions = await listVersions(params.id);
      const sanitized = versions.map((r) => ({
        id: r.id,
        workbookId: r.workbookId,
        versionNumber: r.versionNumber,
        uploadedBy: r.uploadedBy,
        uploadedAt: r.uploadedAt,
        fileName: r.fileName,
        fileHash: r.fileHash,
        blobUrl: r.blobUrl,
        diff: sanitizeDiff(r.diff as Record<string, unknown> | null),
        aiSummary: r.aiSummary,
      }));
      return NextResponse.json({ versions: sanitized });
    }

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

    const sanitized = rows.map((r) => ({
      ...r,
      diff: sanitizeDiff(r.diff as Record<string, unknown> | null),
    }));
    return NextResponse.json({ versions: sanitized });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
