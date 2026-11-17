'use client';
import type { PlanResult } from '@lotwise/engine';
import { planWorkbook } from './planModel';

/** Functions added after Excel 2007 must be stored with the _xlfn. prefix inside the file, or Excel and LibreOffice show #NAME?.
 * Excel adds the prefix itself when it saves; a file written by code has to do the same. */
const FUTURE_FUNCTIONS = ['NORM.S.INV', 'NORM.INV', 'NORM.S.DIST', 'NORM.DIST', 'STDEV.S', 'STDEV.P', 'VAR.S', 'VAR.P', 'PERCENTILE.INC', 'QUARTILE.INC'];
const FUTURE = new RegExp(`(?<![A-Za-z0-9_.])(${FUTURE_FUNCTIONS.map((f) => f.replace(/\./g, '\\.')).join('|')})\\(`, 'g');
export const toFileFormula = (f: string) => f.replace(FUTURE, '_xlfn.$1(');

/** Build the .xlsx file. Calculated cells are written as formulas (with cached results so it also opens correctly in viewers that do not recalculate). */
export async function planToXlsx(plan: PlanResult): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default ?? (await import('exceljs'));
  const wb = new (ExcelJS as any).Workbook(); wb.creator = 'Lotwise'; wb.created = new Date(); wb.calcProperties = { fullCalcOnLoad: true };
  for (const s of planWorkbook(plan)) {
    const ws = wb.addWorksheet(s.name, { views: [{ state: s.freeze ? 'frozen' : 'normal', ySplit: s.freeze?.[0] ?? 0, xSplit: s.freeze?.[1] ?? 0 }] });
    s.rows.forEach((row) => ws.addRow(row.map((c) => (c && typeof c === 'object' ? { formula: toFileFormula(c.f), result: c.v } : c))));
    s.widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
    for (const hr of s.headerRows ?? []) { const r = ws.getRow(hr + 1); r.font = { bold: true, color: { argb: 'FFFFFFFF' } }; r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B3BC4' } }; r.alignment = { vertical: 'middle', wrapText: true }; if (s.name === 'Policy' && hr === 0) r.height = 44; }
    if (s.name === 'Policy') { const fm: Record<number, string> = { 3: '#,##0.0', 4: '#,##0.0', 5: '0.0%', 6: '$#,##0.00', 7: '$#,##0.00', 9: '#,##0', 10: '$#,##0', 11: '0.0%', 13: '0.0%', 14: '0.000', 15: '$#,##0.00', 16: '#,##0', 17: '#,##0', 18: '#,##0', 19: '#,##0.0', 20: '0.0', 21: '$#,##0', 22: '$#,##0', 23: '#,##0', 24: '#,##0', 25: '$#,##0' }; for (const [c, f] of Object.entries(fm)) ws.getColumn(+c).numFmt = f; }
    if (s.name === 'Summary') { ws.getColumn(2).numFmt = '#,##0'; ['B5', 'B6', 'B7', 'B8', 'B9'].forEach((a) => (ws.getCell(a).numFmt = '$#,##0')); ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }; }
    if (s.name === 'Settings') { ['B2', 'B3', 'B4', 'B5', 'B6', 'B7'].forEach((a) => { ws.getCell(a).numFmt = '0%'; ws.getCell(a).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4CC' } }; }); }
    if (s.name === 'Forecast') ws.eachRow((r: any, i: number) => { if (i > 4) r.eachCell((c: any) => { if (typeof c.value === 'object' && c.value?.formula) c.numFmt = '#,##0.00'; }); });
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
