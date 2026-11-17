'use client';
import { saveFile, dataUrlToBlob } from './files';

/** Render a DOM node to a PNG blob (2x for crisp sharing). */
export async function nodeToPng(node: HTMLElement, bg?: string): Promise<Blob> {
  const { toPng } = await import('html-to-image');
  const url = await toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: bg, skipFonts: false });
  return dataUrlToBlob(url);
}
export async function exportPng(node: HTMLElement, filename: string, bg?: string) { await saveFile(await nodeToPng(node, bg), filename); }

/** Render a DOM node into a paginated A4 PDF. */
export async function exportPdf(node: HTMLElement, filename: string) {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  const canvas = await toCanvas(node, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true });
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true }); const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(); const mg = 32;
  const scale = (pw - mg * 2) / canvas.width; const sliceH = Math.floor((ph - mg * 2) / scale); let y = 0, page = 0;
  while (y < canvas.height) {
    const h = Math.min(sliceH, canvas.height - y); const part = document.createElement('canvas'); part.width = canvas.width; part.height = h;
    part.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    if (page++ > 0) pdf.addPage(); pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', mg, mg, canvas.width * scale, h * scale); y += h;
  }
  await saveFile(pdf.output('blob'), filename);
}
