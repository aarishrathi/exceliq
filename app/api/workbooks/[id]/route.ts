import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const { rows } = await sql`
    SELECT id, name, description,
      created_by as "createdBy", created_at as "createdAt",
      last_modified_at as "lastModifiedAt",
      health_score as "healthScore",
      open_flag_count as "openFlagCount"
    FROM workbooks WHERE id = ${id}
  `;
  if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ workbook: rows[0] });
}
