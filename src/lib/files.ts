'use client';
// One place for "give the user a file". The standalone demo replaces `saveImpl` with its host's save capability.
type Saver = (blob: Blob, filename: string) => Promise<void> | void;
let saveImpl: Saver = (blob, filename) => {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
};
export function setSaver(fn: Saver) { saveImpl = fn; }
export async function saveFile(blob: Blob, filename: string) { await saveImpl(blob, filename); }
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch { return false; }
  }
}
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> { const r = await fetch(dataUrl); return r.blob(); }
