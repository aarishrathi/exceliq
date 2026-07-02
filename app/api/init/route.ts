/**
 * GET /api/init — Run once to create DB tables.
 * In production, replace with proper migrations.
 */
import { NextResponse } from 'next/server';
import { initDb } from '@/lib/db';

export async function GET() {
  await initDb();
  return NextResponse.json({ ok: true, message: 'Database initialized' });
}
