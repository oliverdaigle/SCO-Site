import { byId, defaults, type CalcDef, type Vals } from '@lotwise/engine';

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s); let bin = ''; bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return (typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): string {
  const b = s.replace(/-/g, '+').replace(/_/g, '/'); const bin = typeof atob === 'function' ? atob(b) : Buffer.from(b, 'base64').toString('binary');
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
/** Encode only the inputs that differ from defaults, so share links stay short. */
export function encodeValues(def: CalcDef, v: Vals): string {
  const d = defaults(def); const diff: Vals = {};
  for (const [k, val] of Object.entries(v)) { if (k.startsWith('_')) continue; if (JSON.stringify(val) !== JSON.stringify(d[k])) diff[k] = val; }
  return b64urlEncode(JSON.stringify(diff));
}
export function decodeValues(calcId: string, code: string | null | undefined): Vals | null {
  const def = byId[calcId]; if (!def || !code) return null;
  try {
    const raw = JSON.parse(b64urlDecode(code)); if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const allowed = new Set(def.inputs.flatMap((i) => (i.time ? [i.id, i.id + '_u'] : [i.id])));
    const out: Vals = {}; for (const [k, val] of Object.entries(raw)) if (allowed.has(k)) out[k] = val;
    return { ...defaults(def), ...out };
  } catch { return null; }
}
