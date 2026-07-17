/**
 * GET /api/init — Initialize storage.
 * Local mode: ensures `.data/` exists.
 * Postgres mode: creates tables if missing.
 */
import { NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { isLocalMode } from '@/lib/local-store';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  if (isLocalMode()) {
    await fs.mkdir(path.join(process.cwd(), '.data', 'files'), { recursive: true });
    return NextResponse.json({
      ok: true,
      mode: 'local',
      message: 'Local file store ready (.data/). No Postgres credentials required.',
    });
  }

  await initDb();
  return NextResponse.json({
    ok: true,
    mode: 'postgres',
    message: 'Database initialized',
  });
}
