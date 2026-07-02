import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    const { rows } = await sql`
      SELECT
        w.id, w.name, w.description, w.created_by as "createdBy",
        w.created_at as "createdAt", w.last_modified_at as "lastModifiedAt",
        w.health_score as "healthScore",
        COUNT(af.id) FILTER (WHERE af.status = 'open') as "openFlagCount"
      FROM workbooks w
      LEFT JOIN anomaly_flags af ON af.workbook_id = w.id
      GROUP BY w.id
      ORDER BY w.last_modified_at DESC
    `;
    return NextResponse.json({ workbooks: rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
