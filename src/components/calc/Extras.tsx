'use client';
import { useRef, useState } from 'react';
import { F, byId, catById, related, run, defaults, type CalcDef, type InputDef, type Mode, type RunResult, type Vals } from '@lotwise/engine';
import summary from '@/data/verified-summary.json';
import { useStore } from '@/lib/store';
import { encodeValues } from '@/lib/share';
import { copyText } from '@/lib/files';
import { exportPdf } from '@/lib/export';
import { track } from '@/lib/analytics';
import { calcHref } from '@/lib/routes';
import { absoluteUrl, Link } from '@/platform/nav';
import { BRAND, IS_ARTIFACT, SITE_URL } from '@/platform/env';
import { Icon, LogoMark } from '../icons';
import { Slider, toast, cx } from '../ui';
import { Viz } from '../viz/Viz';
import { fmtOut, visibleOutputs } from './Results';
import { usePro, UpgradeCard } from './Pro';

export function VerifiedBadge({ id, compact }: { id: string; compact?: boolean }) {
  const v = (summary.calcs as Record<string, { x: number; s: number; e: number; ok: boolean }>)[id]; if (!v?.ok) return null;
  return (<Link href={`/verified#${id}`} className="badge badge-good hover:brightness-110" title={`${v.e} worked examples, ${v.x.toLocaleString('en-US')} randomized cross-checks${v.s ? ', simulation proof' : ''}`}><Icon name="shield" size={12} />Verified{!compact && <span className="font-normal">· {v.x.toLocaleString('en-US')} checks</span>}</Link>);
}

export const sensInputs = (def: CalcDef, v: Vals) => def.inputs.filter((i) => i.sens && (!i.show || i.show(v)) && ['number', 'money', 'percent', 'int'].includes(i.kind)).slice(0, 4);
export function applyAdj(def: CalcDef, v: Vals, adj: Record<string, number>): Vals {
  const out = { ...v };
  for (const [id, pct] of Object.entries(adj)) { const i = def.inputs.find((x) => x.id === id); if (!i || !pct) continue; let x = v[id] * (1 + pct / 100); if (i.kind === 'int') x = Math.max(i.min ?? 1, Math.round(x)); if (i.max !== undefined) x = Math.min(i.max, x); if (i.min !== undefined) x = Math.max(i.min, x); out[id] = x; }
  return out;
}
export const adjLabel = (def: CalcDef, adj: Record<string, number>) => Object.entries(adj).filter(([, p]) => p).map(([id, p]) => `${(def.inputs.find((i) => i.id === id)?.blabel ?? def.inputs.find((i) => i.id === id)?.label ?? id).replace(/\s*\(.*\)$/, '').toLowerCase()} ${p > 0 ? '+' : ''}${p}%`).join(', ');

/** Live what-if sliders. Dragging one re-runs the calculator and redraws the chart instantly. */
export function Sensitivity({ def, values, adj, setAdj }: { def: CalcDef; values: Vals; adj: Record<string, number>; setAdj: (a: Record<string, number>) => void }) {
  const pro = usePro('business'); const inputs = sensInputs(def, values); if (!inputs.length) return null; const active = Object.values(adj).some(Boolean);
  if (!pro) return <UpgradeCard mode="business" feature="sensitivity">Test your answer before you commit: drag sliders like “what if {String(inputs[0].blabel ?? inputs[0].label).toLowerCase().replace(/\?$/, '')} rises 20%?” and watch the chart move.</UpgradeCard>;
  return (
    <section aria-label="What-if sliders" className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold">What if things change?</h3>{active && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAdj({})}><Icon name="refresh" size={13} />Reset</button>}</div>
      <p className="mt-1 text-sm text-muted">Drag a slider. The answer and chart update as you move.</p>
      <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {inputs.map((i: InputDef) => { const p = adj[i.id] ?? 0; return (
          <div key={i.id}>
            <div className="flex items-baseline justify-between gap-2 text-sm"><label htmlFor={`sens-${i.id}`} className="truncate text-muted">{i.blabel ?? i.label}</label><span className={cx('num shrink-0 font-semibold', p ? 'text-accent' : 'text-faint')}>{p > 0 ? '+' : ''}{p}%</span></div>
            <Slider id={`sens-${i.id}`} label={`Change ${i.label} by percent`} min={-50} max={100} step={5} value={p} onChange={(x) => setAdj({ ...adj, [i.id]: x })} />
            <div className="num flex justify-between text-[11px] text-faint"><span>-50%</span><span>{i.kind === 'money' ? F.money(values[i.id] * (1 + p / 100)) : F.num(values[i.id] * (1 + p / 100))}</span><span>+100%</span></div>
          </div>); })}
      </div>
    </section>
  );
}

/** Save and compare scenarios (Business Pro). */
export function Scenarios({ def, values, r, onLoad }: { def: CalcDef; values: Vals; r: RunResult; onLoad: (v: Vals) => void }) {
  const pro = usePro('business'); const all = useStore((s) => s.scenarios); const save = useStore((s) => s.saveScenario); const remove = useStore((s) => s.removeScenario); const [name, setName] = useState('');
  const mine = all.filter((s) => s.calcId === def.id); const outs = visibleOutputs(def, r).filter((o) => o.primary).slice(0, 3);
  if (!pro) return <UpgradeCard mode="business" feature="scenarios">Save this as a scenario and compare options side by side.</UpgradeCard>;
  return (
    <section aria-label="Saved scenarios" className="card p-4 sm:p-5">
      <h3 className="text-lg font-semibold">Compare scenarios</h3>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); save({ calcId: def.id, name: name.trim() || `Scenario ${mine.length + 1}`, values, headline: r.biz?.headline ?? '' }); setName(''); toast('Scenario saved'); }}>
        <input className="input" placeholder="Name this scenario (for example: new supplier)" aria-label="Scenario name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn shrink-0" type="submit"><Icon name="plus" size={14} />Save</button>
      </form>
      {mine.length > 0 && (
        <div className="scroll-x mt-4">
          <table className="tbl"><thead><tr><th scope="col">Scenario</th>{outs.map((o) => <th key={o.id} scope="col">{o.blabel ?? o.label}</th>)}<th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              <tr className="hl"><td>Current inputs</td>{outs.map((o) => <td key={o.id} className="num">{fmtOut(o, r.o[o.id])}</td>)}<td /></tr>
              {mine.map((s) => { const rr = run(def, s.values); return (<tr key={s.id}><td><button type="button" className="link text-left" onClick={() => onLoad({ ...defaults(def), ...s.values })}>{s.name}</button></td>{outs.map((o) => <td key={o.id} className="num">{rr.ok ? fmtOut(o, rr.o[o.id]) : 'n/a'}</td>)}<td><button type="button" aria-label={`Delete ${s.name}`} className="text-faint hover:text-bad" onClick={() => remove(s.id)}><Icon name="trash" size={14} /></button></td></tr>); })}
            </tbody></table>
        </div>)}
    </section>
  );
}

/** Off-screen, light-theme summary used for the PDF export. */
function PdfSummary({ def, r, mode }: { def: CalcDef; r: RunResult; mode: Mode }) {
  const ins = def.inputs.filter((i) => (!i.show || i.show(r.v)) && ['number', 'money', 'percent', 'int', 'select'].includes(i.kind));
  return (
    <div data-theme="light" data-mode={mode} style={{ width: 760, padding: 36, background: '#fff', color: '#0e1118', fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #d8dbe4', paddingBottom: 14 }}><span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 18 }}><LogoMark size={24} />{BRAND.name}</span><span style={{ fontSize: 12, color: '#5b6375' }}>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
      <p style={{ marginTop: 20, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#3b49df' }}>{def.name}</p>
      <h1 style={{ fontSize: 15, color: '#4a5264', fontWeight: 500, marginTop: 4 }}>{def.bq}</h1>
      <p style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, marginTop: 10, fontFamily: 'var(--font-display)' }}>{r.biz?.headline}</p>
      <h2 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#636c80', marginTop: 22 }}>What it means</h2>
      <ul style={{ marginTop: 6, paddingLeft: 18, listStyle: 'disc', fontSize: 14, lineHeight: 1.55 }}>{r.biz?.meaning.map((m, i) => <li key={i}>{m}</li>)}</ul>
      <h2 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#636c80', marginTop: 18 }}>Recommended actions</h2>
      <ol style={{ marginTop: 6, paddingLeft: 18, listStyle: 'decimal', fontSize: 14, lineHeight: 1.55 }}>{r.biz?.actions.map((m, i) => <li key={i}>{m}</li>)}</ol>
      <div style={{ marginTop: 20, border: '1px solid #d8dbe4', borderRadius: 10, padding: 12 }}>{r.viz && r.viz.kind !== 'queue' && <Viz spec={r.viz} height={240} />}{r.viz?.kind === 'queue' && <p style={{ fontSize: 13 }}>Average in line: {r.viz.Lq.toFixed(2)}. Average wait: {r.viz.Wq.toFixed(3)} {r.viz.timeUnit}s. Utilization: {(r.viz.rho * 100).toFixed(0)}%.</p>}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 20, fontSize: 13 }}>
        <div><h2 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#636c80' }}>Inputs</h2><table style={{ width: '100%', marginTop: 6 }}><tbody>{ins.map((i) => <tr key={i.id} style={{ borderBottom: '1px solid #eceef3' }}><td style={{ padding: '4px 0', color: '#4a5264' }}>{i.blabel ?? i.label}</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{i.kind === 'select' ? i.options!.find((o) => o.value === r.v[i.id])?.label : i.kind === 'money' ? F.money(r.v[i.id]) : F.num(r.v[i.id])}{i.kind === 'percent' ? '%' : ''}{i.time ? ` ${i.time.role === 'dur' ? r.unit + 's' : 'per ' + r.unit}` : ''}</td></tr>)}</tbody></table></div>
        <div><h2 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#636c80' }}>Results</h2><table style={{ width: '100%', marginTop: 6 }}><tbody>{visibleOutputs(def, r).map((o) => <tr key={o.id} style={{ borderBottom: '1px solid #eceef3' }}><td style={{ padding: '4px 0', color: '#4a5264' }}>{o.blabel ?? o.label}</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: o.primary ? 700 : 400 }}>{fmtOut(o, r.o[o.id])}</td></tr>)}</tbody></table></div>
      </div>
      <p style={{ marginTop: 22, fontSize: 10.5, color: '#636c80', lineHeight: 1.5 }}>Generated by {BRAND.name} ({BRAND.domain}). Every calculator is verified against worked examples, an independent reference implementation, and simulation. Results are decision support for educational and planning purposes and are not professional advice.</p>
    </div>
  );
}

export function ShareBar({ def, values, r, mode }: { def: CalcDef; values: Vals; r: RunResult; mode: Mode }) {
  const pro = usePro('business'); const [busy, setBusy] = useState(false); const [pdf, setPdf] = useState(false); const pdfRef = useRef<HTMLDivElement>(null);
  const path = `/s/${mode === 'learner' ? 'learn' : 'business'}/${def.id}?v=${encodeValues(def, values)}`;
  const share = async () => { const url = IS_ARTIFACT ? SITE_URL + path : absoluteUrl(path); const ok = await copyText(url); toast(ok ? (IS_ARTIFACT ? 'Link copied. On the live site it opens this calculator with these exact inputs.' : 'Link copied. It restores these exact inputs.') : 'Could not copy. Select the address bar instead.'); track('share', { calc: def.id, mode }); };
  const doPdf = async () => { setPdf(true); setBusy(true); await new Promise((res) => setTimeout(res, 350)); try { if (pdfRef.current) await exportPdf(pdfRef.current, `lotwise-${def.id}.pdf`); track('export', { kind: 'pdf', calc: def.id }); toast('PDF summary ready'); } catch { toast('Could not create the PDF. Try again.'); } setBusy(false); setPdf(false); };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn btn-sm" onClick={share}><Icon name="share" size={14} />Share result</button>
      {mode === 'business' && (pro ? <button type="button" className="btn btn-sm" onClick={doPdf} disabled={busy || !r.ok}><Icon name="file" size={14} />{busy ? 'Building PDF…' : 'PDF summary'}</button> : <Link href="/pricing#business" className="btn btn-sm" title="PDF summary is part of Business Pro"><Icon name="lock" size={13} />PDF summary</Link>)}
      <Link href={`/embed-builder?calc=${def.id}`} className="btn btn-sm btn-ghost"><Icon name="code" size={14} />Embed</Link>
      {pdf && r.ok && <div aria-hidden style={{ position: 'fixed', left: -10000, top: 0 }}><div ref={pdfRef}><PdfSummary def={def} r={r} mode={mode} /></div></div>}
    </div>
  );
}

export function Related({ id, mode }: { id: string; mode: Mode }) {
  const list = related(id, 6); if (!list.length) return null;
  return (
    <section aria-label="Related calculators">
      <h2 className="text-xl font-semibold">Related calculators</h2>
      <p className="mt-1 text-sm text-muted">These connect to this one in the <Link href="/map" className="link">Formula Map</Link>.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (<li key={c.id}><Link href={calcHref(mode, c.id)} className="card group flex h-full flex-col p-4 transition-colors hover:border-accent-line"><span className="text-xs text-faint">{catById[c.cat]?.name}</span><span className="mt-1 font-semibold group-hover:text-accent">{mode === 'business' ? c.bq : c.name}</span><span className="mt-1 line-clamp-2 text-sm text-muted">{mode === 'business' ? c.name : c.blurb}</span></Link></li>))}
      </ul>
    </section>
  );
}

export function WorkedExamples({ def, onLoad, mode }: { def: CalcDef; onLoad: (v: Vals) => void; mode: Mode }) {
  return (
    <section aria-label="Worked examples">
      <h2 className="text-xl font-semibold">Worked examples</h2>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {def.examples.map((ex, i) => { const r = run(def, ex.v); return (
          <li key={i} className="card flex flex-col p-4">
            <h3 className="font-sans text-base font-semibold tracking-normal">{ex.title}</h3>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{ex.story}</p>
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-sm">{Object.keys(ex.expect).slice(0, 4).map((k) => { const o = def.outputs.find((x) => x.id === k); return (<div key={k}><dt className="text-xs text-faint">{(mode === 'business' ? o?.blabel : undefined) ?? o?.label ?? k}</dt><dd className="num font-semibold text-accent">{o ? fmtOut(o, r.o[k]) : F.num(r.o[k])}</dd></div>); })}</dl>
            <button type="button" className="btn btn-sm mt-3 self-start" onClick={() => { onLoad({ ...defaults(def), ...ex.v }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Icon name="play" size={12} />Load this example</button>
          </li>); })}
      </ul>
    </section>
  );
}
export { byId };
