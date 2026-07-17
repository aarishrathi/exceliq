/**
 * Excel Parser — client-side orchestrator using the xlsx library.
 * Extracts: sheets, cell values, formulas, named ranges, metadata.
 * VBA extraction requires the Python microservice (python/main.py).
 */

import * as XLSX from 'xlsx';

export interface ParsedSheet {
  name: string;
  cells: Record<string, { value: unknown; formula?: string; type: string }>;
  rowCount: number;
  colCount: number;
}

export interface ParsedWorkbook {
  fileName: string;
  fileHash: string;
  sheetNames: string[];
  sheets: ParsedSheet[];
  namedRanges: Record<string, string>;
  hasVBA: boolean;
  parsedAt: string;
}

/**
 * Generates a simple hash of an ArrayBuffer for fingerprinting.
 */
export async function hashBuffer(buffer: ArrayBuffer): Promise<string> {
  const subtle =
    globalThis.crypto?.subtle ??
    (await import('crypto')).webcrypto.subtle;
  const hashBuf = await subtle.digest('SHA-256', buffer);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parses an Excel file buffer into a structured ParsedWorkbook object.
 */
export function parseExcelBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  fileHash: string
): ParsedWorkbook {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellFormula: true,
    cellDates: true,
    cellNF: true,
    cellStyles: false,
    bookVBA: true,
  });

  const sheets: ParsedSheet[] = workbook.SheetNames.map((sheetName) => {
    const ws = workbook.Sheets[sheetName];
    const ref = ws['!ref'];
    const cells: ParsedSheet['cells'] = {};

    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[cellAddr];
          if (cell) {
            cells[cellAddr] = {
              value: cell.v ?? null,
              formula: cell.f ? `=${cell.f}` : undefined,
              type: cell.t ?? 'unknown',
            };
          }
        }
      }
    }

    const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
    return {
      name: sheetName,
      cells,
      rowCount: range ? range.e.r - range.s.r + 1 : 0,
      colCount: range ? range.e.c - range.s.c + 1 : 0,
    };
  });

  // Extract named ranges
  const namedRanges: Record<string, string> = {};
  if (workbook.Workbook?.Names) {
    for (const named of workbook.Workbook.Names) {
      if (named.Name && named.Ref) {
        namedRanges[named.Name] = named.Ref;
      }
    }
  }

  return {
    fileName,
    fileHash,
    sheetNames: workbook.SheetNames,
    sheets,
    namedRanges,
    // xlsx library sets vbaraw when bookVBA:true and VBA is present
    hasVBA: !!workbook.vbaraw,
    parsedAt: new Date().toISOString(),
  };
}
