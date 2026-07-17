import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { isLocalMode, listWorkbooks } from '@/lib/local-store';
import { initDb } from '@/lib/db';

export async function GET() {
  try {
    if (isLocalMode()) {
      const workbooks = await listWorkbooks();
      return NextResponse.json({
        workbooks: workbooks.map((w) => ({
          id: w.id,
          name: w.name,
          description: w.description,
          createdBy: w.createdBy,
          createdAt: w.createdAt,
          lastModifiedAt: w.lastModifiedAt,
          healthScore: w.healthScore,
          openFlagCount: w.openFlagCount,
        })),
        mode: 'local',
      });
    }

    await initDb();
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
    return NextResponse.json({ workbooks: rows, mode: 'postgres' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
