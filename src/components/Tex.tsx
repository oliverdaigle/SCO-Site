import { Fragment, type ReactNode } from 'react';

// Mini-TeX renderer: the subset of TeX the engine emits (fractions, roots, sub/superscripts, Greek, operators).
// Pure HTML and CSS, so formulas render identically on the server and the client with zero dependencies.
const SYM: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', lambda: 'λ', mu: 'μ', rho: 'ρ', sigma: 'σ', phi: 'φ', Phi: 'Φ', theta: 'θ', pi: 'π',
  infty: '∞', dots: '…', '%': '%', $: '$', lceil: '⌈', rceil: '⌉', lfloor: '⌊', rfloor: '⌋', mid: '|',
};
const OPS: Record<string, [string, string]> = { times: ['×', 'op'], cdot: ['·', 'op'], le: ['≤', 'rel'], ge: ['≥', 'rel'], approx: ['≈', 'rel'], to: ['→', 'rel'], Rightarrow: ['⇒', 'rel'], pm: ['±', 'op'], ne: ['≠', 'rel'] };
const FUNCS = new Set(['min', 'max', 'ln', 'log', 'exp']);
// Named quantities are set upright as one word. Any other run of letters is a product of single-letter variables (dL = d times L).
const NAMES = new Set(['ROP', 'EOQ', 'EPQ', 'POQ', 'SL', 'CSL', 'FR', 'ESC', 'OUL', 'TC', 'ss', 'SS', 'WIP', 'TH', 'CT', 'FT', 'UCL', 'LCL', 'USL', 'LSL', 'MAD', 'MSE', 'MAPE', 'RSFE', 'TS', 'RMSE', 'BEP', 'EMV', 'EV', 'EVPI', 'EVwPI', 'ES', 'EF', 'LS', 'LF', 'OEE', 'DPMO', 'COQ', 'CR', 'DIO', 'DSO', 'DPO', 'ROA', 'FIT', 'CV', 'LD', 'TCO', 'GMROI', 'LT', 'dLT', 'fr', 'max', 'min', 'pooled', 'each', 'dec', 'cen', 'opt', 'make', 'buy', 'orders', 'demand', 'LS', 'E', 'hC']);

type Tok = { t: 'cmd' | 'chr' | 'open' | 'close' | 'sub' | 'sup' | 'num' | 'word'; v: string };
function lex(s: string): Tok[] {
  const out: Tok[] = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') { const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i)); if (m) { out.push({ t: 'cmd', v: m[1] }); i += m[0].length; continue; } }
    if (c === '{') { out.push({ t: 'open', v: c }); i++; continue; }
    if (c === '}') { out.push({ t: 'close', v: c }); i++; continue; }
    if (c === '_') { out.push({ t: 'sub', v: c }); i++; continue; }
    if (c === '^') { out.push({ t: 'sup', v: c }); i++; continue; }
    const num = /^\$?-?\d[\d,]*(\.\d+)?%?/.exec(s.slice(i)); if (num && (c !== '-' || !out.length || ['open', 'sub', 'sup'].includes(out[out.length - 1].t) || (out[out.length - 1].t === 'chr' && '(=,'.includes(out[out.length - 1].v)))) { if (c !== '-' || /^-?\d/.test(num[0])) { out.push({ t: 'num', v: num[0] }); i += num[0].length; continue; } }
    const word = /^[A-Za-z]+/.exec(s.slice(i)); if (word) { out.push({ t: 'word', v: word[0] }); i += word[0].length; continue; }
    out.push({ t: 'chr', v: c }); i++;
  }
  return out;
}

function parse(toks: Tok[], pos: { i: number }, stop: boolean, script = false, st: { frac: number } = { frac: 0 }): ReactNode[] {
  const nodes: ReactNode[] = []; let key = 0;
  const group = (scr = script): ReactNode[] => { if (toks[pos.i]?.t === 'open') { pos.i++; const g = parse(toks, pos, true, scr, st); return g; } const one = atom(scr); return one === null ? [] : [one]; };
  const textGroup = (): string => { let txt = ''; if (toks[pos.i]?.t === 'open') { pos.i++; let depth = 1; while (pos.i < toks.length) { const t = toks[pos.i++]; if (t.t === 'open') depth++; else if (t.t === 'close') { if (--depth === 0) break; } txt += t.t === 'cmd' ? (SYM[t.v] ?? t.v) : t.v; } } return txt; };
  function atom(scr = script): ReactNode {
    const t = toks[pos.i]; if (!t) return null; pos.i++; const k = key++;
    if (t.t === 'num') return <span key={k} className="n">{t.v}</span>;
    if (t.t === 'word') return t.v.length === 1 ? <span key={k} className="v">{t.v}</span> : scr || NAMES.has(t.v) ? <span key={k} className="rm">{t.v}</span> : <span key={k} className="v">{t.v}</span>;
    if (t.t === 'open') { const g = parse(toks, pos, true, scr, st); return <Fragment key={k}>{g}</Fragment>; }
    if (t.t === 'chr') {
      if (t.v === ' ') return null;
      if ('=<>'.includes(t.v)) return <span key={k} className="rel">{t.v}</span>;
      if ('+'.includes(t.v)) return <span key={k} className="op">{t.v}</span>;
      if (t.v === '-') return <span key={k} className="op">−</span>;
      if (t.v === ',') return <span key={k} style={{ marginRight: '0.3em' }}>,</span>;
      if (t.v === ':') return <span key={k} style={{ margin: '0 0.3em 0 0.05em' }}>:</span>;
      return <span key={k}>{t.v}</span>;
    }
    if (t.t === 'cmd') {
      const c = t.v;
      if (c === 'frac') { const a = group(), b = group(); st.frac++; return <span key={k} className="frac"><span className="num_">{a}</span><span className="den">{b}</span></span>; }
      if (c === 'sqrt') { const f0 = st.frac; const a = group(); return <span key={k} className={st.frac > f0 ? 'sqrt tall' : 'sqrt'}><span className="rad">√</span><span className="body">{a}</span></span>; }
      if (c === 'text') return <span key={k} className="txt">{textGroup()}</span>;
      if (c === 'bar') { const a = group(); return <span key={k} className="acc bar">{a}</span>; }
      if (c === 'hat') { const a = group(); return <span key={k} className="acc">{a}<span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: '-0.62em', textAlign: 'center', fontSize: '0.8em' }}>^</span></span>; }
      if (c === 'left' || c === 'right') { const d = toks[pos.i]; if (d) { pos.i++; const ch = d.t === 'cmd' ? (SYM[d.v] ?? '') : d.v === '.' ? '' : d.v; return <span key={k} className="big">{ch}</span>; } return null; }
      if (c === 'sum') return <span key={k} className="big" style={{ margin: '0 0.12em' }}>Σ</span>;
      if (c === 'quad') return <span key={k} className="sp" />;
      if (c === ',' || c === ';' || c === ' ') return <span key={k} className="tsp" />;
      if (OPS[c]) return <span key={k} className={OPS[c][1]}>{OPS[c][0]}</span>;
      if (FUNCS.has(c)) return <span key={k} className="rm" style={{ marginRight: '0.12em' }}>{c}</span>;
      if (SYM[c] !== undefined) return <span key={k} className={/[α-ωΑ-Ω]/.test(SYM[c]) ? 'v' : ''}>{SYM[c]}</span>;
      return <span key={k} className="rm">{c}</span>;
    }
    return null;
  }
  while (pos.i < toks.length) {
    const t = toks[pos.i];
    if (t.t === 'close') { pos.i++; if (stop) return nodes; continue; }
    if (t.t === 'sub' || t.t === 'sup') { pos.i++; const g = group(true); const k = key++; nodes.push(t.t === 'sub' ? <sub key={`s${k}`}>{g}</sub> : <sup key={`s${k}`}>{g}</sup>); continue; }
    const a = atom(); if (a !== null) nodes.push(a);
  }
  return nodes;
}

/** Plain-text reading of a formula for screen readers and exports. */
export function texToPlain(src: string): string {
  return src.replace(/\\frac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '($1) / ($2)').replace(/\\sqrt\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, 'sqrt($1)').replace(/\\text\{([^}]*)\}/g, '$1').replace(/\\(left|right)/g, '').replace(/\\times/g, '×').replace(/\\cdot/g, '·').replace(/\\([a-zA-Z]+)/g, (_m, c) => SYM[c] ?? OPS[c]?.[0] ?? c).replace(/\\(.)/g, '$1').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
}

export function Tex({ children, block, className = '' }: { children: string; block?: boolean; className?: string }) {
  const nodes = parse(lex(children), { i: 0 }, false);
  const el = <span className={`tex ${className}`} role="math" aria-label={texToPlain(children)}>{nodes}</span>;
  return block ? <span className="tex-block">{el}</span> : el;
}
