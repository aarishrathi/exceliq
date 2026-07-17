import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { isLocalMode, getWorkbook } from '@/lib/local-store';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    if (isLocalMode()) {
      const workbook = await getWorkbook(id);
      if (!workbook) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json({
        workbook: {
          id: workbook.id,
          name: workbook.name,
          description: workbook.description,
          createdBy: workbook.createdBy,
          createdAt: workbook.createdAt,
          lastModifiedAt: workbook.lastModifiedAt,
          healthScore: workbook.healthScore,
          openFlagCount: workbook.openFlagCount,
        },
      });
    }

    const { rows } = await sql`
      SELECT id, name, description,
        created_by as "createdBy", created_at as "createdAt",
        last_modified_at as "lastModifiedAt",
        health_score as "healthScore",
        open_flag_count as "openFlagCount"
      FROM workbooks WHERE id = ${id}
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ workbook: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
