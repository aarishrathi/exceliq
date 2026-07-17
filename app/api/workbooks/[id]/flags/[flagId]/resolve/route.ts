import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { isLocalMode, resolveFlagLocal } from '@/lib/local-store';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; flagId: string } }
) {
  try {
    const body = await req.json();
    const note = typeof body.note === 'string' ? body.note : '';
    const resolvedBy =
      typeof body.resolvedBy === 'string'
        ? body.resolvedBy
        : note.includes('Resolved by ')
          ? note.replace(/^Resolved by /, '').split(':')[0]?.trim() || 'Unknown'
          : 'Unknown';

    if (isLocalMode()) {
      const ok = await resolveFlagLocal(params.id, params.flagId, resolvedBy, note);
      if (!ok) {
        return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    await sql`
      UPDATE anomaly_flags
      SET status = 'resolved',
          resolved_by = ${resolvedBy},
          resolved_at = NOW(),
          resolution_note = ${note}
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
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
