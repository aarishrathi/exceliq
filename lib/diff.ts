/**
 * Semantic Diff Engine
 * Compares two ParsedWorkbook snapshots and produces a SemanticDiff.
 */

import type { ParsedWorkbook, ParsedSheet } from './parser';
import type { SemanticDiff, CellChange, StructuralChange } from '@/types/workbook';

export function computeSemanticDiff(
  previous: ParsedWorkbook,
  current: ParsedWorkbook
): SemanticDiff {
  const cellChanges: CellChange[] = [];
  const structuralChanges: StructuralChange[] = [];

  const prevSheetMap = new Map(previous.sheets.map((s) => [s.name, s]));
  const currSheetMap = new Map(current.sheets.map((s) => [s.name, s]));

  // Detect added/removed sheets
  for (const name of current.sheetNames) {
    if (!prevSheetMap.has(name)) {
      structuralChanges.push({
        changeType: 'sheet_added',
        target: name,
        detail: `Sheet "${name}" was added`,
      });
    }
  }
  for (const name of previous.sheetNames) {
    if (!currSheetMap.has(name)) {
      structuralChanges.push({
        changeType: 'sheet_removed',
        target: name,
        detail: `Sheet "${name}" was removed`,
      });
    }
  }

  // Diff named ranges
  const prevNames = previous.namedRanges;
  const currNames = current.namedRanges;
  for (const [name, ref] of Object.entries(currNames)) {
    if (prevNames[name] !== ref) {
      structuralChanges.push({
        changeType: 'named_range_changed',
        target: name,
        detail: `Named range "${name}" changed from "${prevNames[name] ?? 'undefined'}" to "${ref}"`,
      });
    }
  }

  // Cell-level diff on shared sheets
  for (const [sheetName, currSheet] of currSheetMap) {
    const prevSheet = prevSheetMap.get(sheetName);
    if (!prevSheet) continue;
    diffCells(sheetName, prevSheet, currSheet, cellChanges);
  }

  return {
    cellChanges,
    vbaChanges: [],  // populated by AI layer after VBA extraction
    structuralChanges,
    totalChanges: cellChanges.length + structuralChanges.length,
  };
}

function diffCells(
  sheet: string,
  prev: ParsedSheet,
  curr: ParsedSheet,
  output: CellChange[]
) {
  const allCells = new Set([
    ...Object.keys(prev.cells),
    ...Object.keys(curr.cells),
  ]);

  for (const cellAddr of allCells) {
    const prevCell = prev.cells[cellAddr];
    const currCell = curr.cells[cellAddr];

    if (!prevCell && currCell) {
      // New cell populated
      output.push({
        sheet,
        cell: cellAddr,
        changeType: currCell.formula ? 'formula_changed' : 'value_changed',
        oldValue: null,
        newValue: String(currCell.value ?? ''),
        newFormula: currCell.formula,
      });
      continue;
    }

    if (prevCell && !currCell) {
      // Cell cleared
      output.push({
        sheet,
        cell: cellAddr,
        changeType: 'value_changed',
        oldValue: String(prevCell.value ?? ''),
        newValue: null,
        oldFormula: prevCell.formula,
      });
      continue;
    }

    if (prevCell && currCell) {
      const formulaChanged = prevCell.formula !== currCell.formula;
      const valueChanged =
        String(prevCell.value ?? '') !== String(currCell.value ?? '');

      if (formulaChanged) {
        output.push({
          sheet,
          cell: cellAddr,
          changeType: 'formula_changed',
          oldValue: String(prevCell.value ?? ''),
          newValue: String(currCell.value ?? ''),
          oldFormula: prevCell.formula,
          newFormula: currCell.formula,
          deviationPercent: computeDeviation(prevCell.value, currCell.value),
        });
      } else if (valueChanged) {
        output.push({
          sheet,
          cell: cellAddr,
          changeType: 'value_changed',
          oldValue: String(prevCell.value ?? ''),
          newValue: String(currCell.value ?? ''),
          deviationPercent: computeDeviation(prevCell.value, currCell.value),
        });
      }
    }
  }
}

function computeDeviation(a: unknown, b: unknown): number | undefined {
  const na = parseFloat(String(a));
  const nb = parseFloat(String(b));
  if (!isNaN(na) && !isNaN(nb) && na !== 0) {
    return Math.abs((nb - na) / na) * 100;
  }
  return undefined;
}
