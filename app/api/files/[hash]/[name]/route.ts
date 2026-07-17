/**
 * GET /api/files/[hash]/[name]
 * Serves locally stored workbook uploads from `.data/files`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(
  _req: NextRequest,
  { params }: { params: { hash: string; name: string } }
) {
  const hash = params.hash;
  const name = decodeURIComponent(params.name);

  if (!/^[a-f0-9]{64}$/i.test(hash) || name.includes('..') || name.includes('/')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), '.data', 'files', hash, name);

  try {
    const bytes = await fs.readFile(filePath);
    return new NextResponse(bytes, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${name}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
