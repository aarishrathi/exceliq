/**
 * POST /api/upload
 * Ingests an Excel file, parses it, diffs against previous version,
 * runs AI analysis (when configured), and persists to local store or Postgres.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { v4 as uuidv4 } from 'uuid';
import { parseExcelBuffer, hashBuffer } from '@/lib/parser';
import { computeSemanticDiff } from '@/lib/diff';
import { generateDiffSummary, detectAnomalies } from '@/lib/ai';
import { storeWorkbookFile } from '@/lib/storage';
import {
  isLocalMode,
  createWorkbook,
  touchWorkbook,
  getLatestVersionNumber,
  getLatestVersion,
  createVersion,
  createFlags,
} from '@/lib/local-store';
import { initDb } from '@/lib/db';
import type { ParsedWorkbook } from '@/lib/parser';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const uploadedBy = (formData.get('uploadedBy') as string) ?? 'Unknown';
    const workbookName = (formData.get('workbookName') as string) ?? '';
    const existingWorkbookId = formData.get('workbookId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileHash = await hashBuffer(arrayBuffer);
    const parsed: ParsedWorkbook = parseExcelBuffer(arrayBuffer, file.name, fileHash);

    const blobUrl = await storeWorkbookFile(
      fileHash,
      file.name,
      new Uint8Array(arrayBuffer),
      file.type ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    if (isLocalMode()) {
      return handleLocalUpload({
        file,
        fileHash,
        parsed,
        blobUrl,
        uploadedBy,
        workbookName,
        existingWorkbookId,
      });
    }

    // Ensure Postgres schema exists (idempotent)
    await initDb();

    let workbookId = existingWorkbookId;
    let versionNumber = 1;

    if (workbookId) {
      const { rows: vRows } = await sql`
        SELECT version_number FROM workbook_versions
        WHERE workbook_id = ${workbookId}
        ORDER BY version_number DESC LIMIT 1
      `;
      versionNumber = (vRows[0]?.version_number ?? 0) + 1;

      await sql`
        UPDATE workbooks SET last_modified_at = NOW() WHERE id = ${workbookId}
      `;
    } else {
      workbookId = uuidv4();
      await sql`
        INSERT INTO workbooks (id, name, description, created_by, health_score)
        VALUES (${workbookId}, ${workbookName || file.name}, '', ${uploadedBy}, 100)
      `;
    }

    let diff = null;
    let aiSummary = 'First version — no previous version to compare against.';
    let anomalies: Awaited<ReturnType<typeof detectAnomalies>> = [];

    if (versionNumber > 1) {
      const { rows: prevRows } = await sql`
        SELECT diff FROM workbook_versions
        WHERE workbook_id = ${workbookId}
        ORDER BY version_number DESC LIMIT 1
      `;

      const prevParsed = prevRows[0]?.diff?.parsedSnapshot as ParsedWorkbook | undefined;

      if (prevParsed) {
        diff = computeSemanticDiff(prevParsed, parsed);
        [aiSummary, anomalies] = await Promise.all([
          generateDiffSummary(diff, file.name, uploadedBy),
          detectAnomalies(diff, file.name),
        ]);
      }
    }

    const versionId = uuidv4();
    const diffPayload = JSON.stringify({ ...(diff ?? {}), parsedSnapshot: parsed });

    await sql`
      INSERT INTO workbook_versions
        (id, workbook_id, version_number, uploaded_by, file_name, file_hash, blob_url, diff, ai_summary)
      VALUES
        (${versionId}, ${workbookId}, ${versionNumber}, ${uploadedBy},
         ${file.name}, ${fileHash}, ${blobUrl},
         ${diffPayload}::jsonb,
         ${aiSummary})
    `;

    if (anomalies.length > 0) {
      for (const flag of anomalies) {
        await sql`
          INSERT INTO anomaly_flags
            (id, version_id, workbook_id, severity, category, title, description,
             affected_cell, affected_sheet, ai_inferred_cause, status)
          VALUES
            (${flag.id}, ${versionId}, ${workbookId}, ${flag.severity},
             ${flag.category}, ${flag.title}, ${flag.description},
             ${flag.affectedCell ?? null}, ${flag.affectedSheet ?? null},
             ${flag.aiInferredCause ?? null}, 'open')
        `;
      }

      const criticalCount = anomalies.filter((f) => f.severity === 'critical').length;
      const warningCount = anomalies.filter((f) => f.severity === 'warning').length;
      const healthScore = Math.max(0, 100 - criticalCount * 20 - warningCount * 5);
      await sql`
        UPDATE workbooks
        SET health_score = ${healthScore}, open_flag_count = ${anomalies.length}
        WHERE id = ${workbookId}
      `;
    }

    return NextResponse.json({
      workbookId,
      versionId,
      anomalyCount: anomalies.length,
      mode: 'postgres',
    });
  } catch (err) {
    console.error('[upload]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

async function handleLocalUpload(opts: {
  file: File;
  fileHash: string;
  parsed: ParsedWorkbook;
  blobUrl: string;
  uploadedBy: string;
  workbookName: string;
  existingWorkbookId: string | null;
}) {
  const {
    file,
    fileHash,
    parsed,
    blobUrl,
    uploadedBy,
    workbookName,
    existingWorkbookId,
  } = opts;

  let workbookId = existingWorkbookId;
  let versionNumber = 1;

  if (workbookId) {
    versionNumber = (await getLatestVersionNumber(workbookId)) + 1;
    await touchWorkbook(workbookId);
  } else {
    workbookId = uuidv4();
    await createWorkbook({
      id: workbookId,
      name: workbookName || file.name,
      createdBy: uploadedBy,
    });
  }

  let diff = null;
  let aiSummary = 'First version — no previous version to compare against.';
  let anomalies: Awaited<ReturnType<typeof detectAnomalies>> = [];

  if (versionNumber > 1) {
    const prev = await getLatestVersion(workbookId);
    const prevParsed = prev?.diff?.parsedSnapshot;
    if (prevParsed) {
      diff = computeSemanticDiff(prevParsed, parsed);
      [aiSummary, anomalies] = await Promise.all([
        generateDiffSummary(diff, file.name, uploadedBy),
        detectAnomalies(diff, file.name),
      ]);
    }
  }

  const versionId = uuidv4();
  await createVersion({
    id: versionId,
    workbookId,
    versionNumber,
    uploadedBy,
    uploadedAt: new Date().toISOString(),
    fileName: file.name,
    fileHash,
    blobUrl,
    diff: { ...(diff ?? {}), parsedSnapshot: parsed },
    aiSummary,
  });

  await createFlags(workbookId, versionId, anomalies);

  return NextResponse.json({
    workbookId,
    versionId,
    anomalyCount: anomalies.length,
    mode: 'local',
  });
}
