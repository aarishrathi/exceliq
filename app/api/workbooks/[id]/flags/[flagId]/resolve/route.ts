import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; flagId: string } }
) {
  const { note } = await req.json();
  await sql`
    UPDATE anomaly_flags
    SET status = 'resolved', resolved_at = NOW(), resolution_note = ${note}
    WHERE id = ${params.flagId}
  `;
  await sql`
    UPDATE workbooks
    SET open_flag_count = (
      SELECT COUNT(*) FROM anomaly_flags
      WHERE workbook_id = ${params.id} AND status = 'open'
    )
    WHERE id = ${params.id}
  `;
  return NextResponse.json({ ok: true });
}
