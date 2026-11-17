'use client';
import type { KpiNode, VizSpec } from '@lotwise/engine';
import { toneVar, tick } from './XYChart';
import { cx, useWidth } from '../ui';

type Of<K extends VizSpec['kind']> = Extract<VizSpec, { kind: K }>;
const fmtCell = (x: number, f?: string) => (f === 'money' ? '$' + Math.round(x).toLocaleString('en-US') : f === 'pct' ? x.toFixed(1) + '%' : (+x.toFixed(2)).toLocaleString('en-US'));

export function Meters({ spec }: { spec: Of<'meters'> }) {
  return (
    <div className="space-y-3.5 py-1">
      {spec.chain && <p className="num text-xs text-muted">{spec.chain}</p>}
      {spec.items.map((it, i) => { const pct = Math.max(0, Math.min(100, (it.value / (it.max || 1)) * 100)); return (
        <div key={i}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm"><span className="text-muted">{it.label}</span><span className="num text-base font-semibold" style={{ color: toneVar(it.tone) }}>{it.text}</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-sunken ring-1 ring-line" role="meter" aria-label={it.label} aria-valuenow={Math.round(it.value)} aria-valuemin={0} aria-valuemax={Math.round(it.max)}><div className="h-full rounded-full transition-[width] duration-300 ease-out" style={{ width: `${pct}%`, background: toneVar(it.tone) }} /></div>
        </div>); })}
    </div>
  );
}

export function Matrix({ spec }: { spec: Of<'matrix'> }) {
  const flat = spec.cells.flat(); const lo = Math.min(...flat), hi = Math.max(...flat);
  const isBest = (r: number, c: number) => spec.best?.some(([a, b]) => a === r && b === c);
  return (
    <div className="scroll-x">
      <table className="tbl">
        <thead><tr><th scope="col"><span className="sr-only">Row</span></th>{spec.cols.map((c, j) => <th key={j} scope="col">{c}{spec.colNote?.[j] && <div className="num font-normal text-accent">{spec.colNote[j]}</div>}</th>)}{spec.rowTags && <th scope="col" />}</tr></thead>
        <tbody>{spec.rows.map((r, i) => (<tr key={i}><td className="font-medium">{r}</td>{spec.cells[i].map((x, j) => { const k = hi > lo ? (x - lo) / (hi - lo) : 0.5; return (<td key={j} className={cx('num', isBest(i, j) && 'font-semibold')} style={{ background: `color-mix(in oklab, ${isBest(i, j) ? 'var(--accent)' : 'var(--muted)'} ${Math.round(6 + k * 18)}%, transparent)` }}>{fmtCell(x, spec.fmt)}</td>); })}{spec.rowTags && <td className="num whitespace-nowrap text-xs text-muted">{spec.rowTags[i]}</td>}</tr>))}</tbody>
      </table>
    </div>
  );
}

export function Timeline({ spec }: { spec: Of<'timeline'> }) {
  const lo = Math.min(0, ...spec.segs.map((s) => Math.min(s.start, s.end))), hi = Math.max(...spec.segs.map((s) => Math.max(s.start, s.end)), spec.marker?.x ?? 0, 1); const span = hi - lo || 1;
  const rows = [...new Set(spec.segs.map((s) => s.row))].sort((a, b) => a - b);
  return (
    <div className="space-y-2 py-2">
      {rows.map((r) => (
        <div key={r} className="relative h-10 rounded-lg bg-sunken ring-1 ring-line">
          {spec.segs.filter((s) => s.row === r).map((s, i) => { const a = Math.min(s.start, s.end), b = Math.max(s.start, s.end); return (
            <div key={i} className="absolute inset-y-1 flex items-center justify-center overflow-hidden rounded-md px-2 text-xs font-semibold transition-all duration-300" style={{ left: `${((a - lo) / span) * 100}%`, width: `${Math.max(1.5, ((b - a) / span) * 100)}%`, background: `color-mix(in oklab, ${toneVar(s.tone)} 30%, transparent)`, color: 'var(--fg)', border: `1px solid ${toneVar(s.tone)}` }} title={`${s.label}: ${tick(a)} to ${tick(b)} ${spec.unit}`}><span className="truncate">{s.label}</span></div>); })}
          {spec.marker && r === rows[0] && <div className="absolute -top-1 bottom-0 border-l border-dashed border-muted" style={{ left: `${((spec.marker.x - lo) / span) * 100}%` }}><span className="absolute -top-4 left-1 whitespace-nowrap text-[10px] text-faint">{spec.marker.label}</span></div>}
        </div>))}
      <div className="num flex justify-between text-[11px] text-faint"><span>{tick(lo)}</span><span>{tick(lo + span / 2)} {spec.unit}</span><span>{tick(hi)}</span></div>
    </div>
  );
}

export function GridViz({ spec }: { spec: Of<'grid'> }) {
  const mx = Math.max(1, ...spec.rows.flatMap((r) => r.vals.map((v) => Math.abs(v ?? 0))));
  return (
    <div className="scroll-x">
      <table className="tbl">
        <thead><tr><th scope="col">Period</th>{spec.periods.map((p) => <th key={p} scope="col">{p}</th>)}</tr></thead>
        <tbody>{spec.rows.map((r, i) => (<tr key={i}><td className={cx('whitespace-nowrap', r.bold && 'font-semibold')} style={{ color: r.tone ? toneVar(r.tone) : undefined }}>{r.label}</td>{r.vals.map((v, j) => (<td key={j} className="num relative min-w-12">{v ? (<><span className="absolute inset-x-1.5 bottom-0.5 rounded-sm" style={{ height: `${Math.max(8, (Math.abs(v) / mx) * 70)}%`, background: toneVar(r.tone ?? 'muted'), opacity: 0.16 }} /><span className={cx('relative', r.bold && 'font-semibold')} style={{ color: v < 0 ? 'var(--bad)' : undefined }}>{tick(v)}</span></>) : <span className="text-faint">·</span>}</td>))}</tr>))}</tbody>
      </table>
    </div>
  );
}

export function StackBars({ spec }: { spec: Of<'stack'> }) {
  const totals = spec.bars.map((b) => b.parts.reduce((s, p) => s + Math.max(0, p.value), 0)); const mx = Math.max(...totals, 1e-9);
  const names = [...new Map(spec.bars.flatMap((b) => b.parts).map((p) => [p.name, p.tone])).entries()];
  const f = (x: number) => (spec.unit === '$' ? '$' + (x >= 100 ? Math.round(x).toLocaleString('en-US') : x.toFixed(2)) : spec.unit === '%' ? x.toFixed(1) + '%' : tick(x));
  return (
    <div className="space-y-3 py-1">
      {spec.bars.map((b, i) => (
        <div key={i}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm"><span className={cx(b.best ? 'font-semibold text-fg' : 'text-muted')}>{b.label}{b.best && <span className="badge ml-2">Lowest</span>}</span><span className="num font-semibold">{f(totals[i])}</span></div>
          <div className="flex h-7 overflow-hidden rounded-md bg-sunken ring-1 ring-line" style={{ width: `${Math.max(4, (totals[i] / mx) * 100)}%`, transition: 'width .3s ease-out' }}>
            {b.parts.filter((p) => p.value > 0).map((p, j) => (<div key={j} title={`${p.name}: ${f(p.value)}`} className="h-full border-r border-bg/60 last:border-0" style={{ width: `${(p.value / totals[i]) * 100}%`, background: toneVar(p.tone), opacity: 0.85 }} />))}
          </div>
        </div>))}
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted">{names.map(([n, t]) => (<span key={n} className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: toneVar(t) }} />{n}</span>))}</div>
    </div>
  );
}

export function ContainerViz({ spec }: { spec: Of<'container'> }) {
  const cube = Math.max(0, Math.min(100, spec.cubePct)), wt = Math.max(0, Math.min(100, spec.weightPct)); const cols = 12, rows = 5, filled = Math.round((cube / 100) * cols * rows);
  return (
    <div className="grid gap-5 py-2 sm:grid-cols-[1.4fr_1fr] sm:items-center">
      <div>
        <div className="relative rounded-xl border-2 border-line-strong bg-sunken p-2" aria-label={`Trailer ${cube.toFixed(0)} percent full by space`} role="img">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: cols * rows }, (_, k) => { const col = k % cols, row = rows - 1 - Math.floor(k / cols); const idx = col * rows + row; return <div key={k} className="aspect-square rounded-[3px] transition-colors duration-300" style={{ background: idx < filled ? 'var(--accent)' : 'var(--line)', opacity: idx < filled ? 0.85 : 1 }} />; })}
          </div>
          <div className="absolute -bottom-3 left-6 h-5 w-5 rounded-full border-2 border-line-strong bg-bg" /><div className="absolute -bottom-3 right-6 h-5 w-5 rounded-full border-2 border-line-strong bg-bg" />
        </div>
        <p className="mt-5 text-center text-xs text-muted">{Math.round(spec.units).toLocaleString('en-US')} cartons loaded. Limited by <b className="text-fg">{spec.limiting}</b>.</p>
      </div>
      <Meters spec={{ kind: 'meters', items: [{ label: 'Space used (cube)', value: cube, max: 100, text: cube.toFixed(0) + '%', tone: 'accent' }, { label: 'Weight used', value: wt, max: 100, text: wt.toFixed(0) + '%', tone: 'alt' }] }} />
    </div>
  );
}

function KpiBox({ n, depth }: { n: KpiNode; depth: number }) {
  return (
    <div className="flex flex-col items-center">
      <div className={cx('rounded-lg border px-3 py-2 text-center', depth === 0 ? 'border-accent-line bg-accent-soft' : 'border-line bg-raised')} style={n.tone && depth > 0 ? { borderColor: toneVar(n.tone) } : undefined}>
        <div className="whitespace-nowrap text-[11px] text-muted">{n.label}</div><div className={cx('num font-semibold', depth === 0 ? 'text-xl text-accent' : 'text-sm')}>{n.value}</div>
      </div>
      {n.children && (<>
        <div className="h-3 w-px bg-line-strong" />
        <div className="flex items-start gap-1.5">
          {n.children.map((c, i) => (<div key={i} className="flex items-start gap-1.5">{i > 0 && <span className="num mt-3 text-sm text-faint">{n.op}</span>}<KpiBox n={c} depth={depth + 1} /></div>))}
        </div></>)}
    </div>
  );
}
export function KpiTree({ spec }: { spec: Of<'kpitree'> }) { return <div className="scroll-x py-2"><div className="mx-auto w-max min-w-full px-1"><KpiBox n={spec.root} depth={0} /></div></div>; }

export function FlowViz({ spec }: { spec: Of<'flow'> }) {
  const [ref, w] = useWidth<HTMLDivElement>(600); const mx = Math.max(...spec.steps.map((s) => s.cap), 1e-9); const vertical = w < 420 || spec.steps.length > 5;
  return (
    <div ref={ref} className="py-2">
      <div className={cx('flex gap-2', vertical ? 'flex-col' : 'items-stretch')}>
        {spec.steps.map((s, i) => (
          <div key={i} className={cx('flex min-w-0 flex-1 items-center gap-2', vertical && 'flex-row')}>
            <div className={cx('relative min-w-0 flex-1 overflow-hidden rounded-xl border p-3', s.bottleneck ? 'border-warn bg-[color-mix(in_oklab,var(--warn)_12%,transparent)]' : 'border-line bg-raised')}>
              <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{s.name}</span>{s.bottleneck && <span className="badge shrink-0" style={{ color: 'var(--warn)', borderColor: 'var(--warn)', background: 'transparent' }}>Bottleneck</span>}</div>
              <div className="num mt-1 text-lg font-semibold">{tick(s.cap)} <span className="text-xs font-normal text-muted">{spec.unit}</span></div>
              {s.sub && <div className="text-xs text-muted">{s.sub}</div>}
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.min(100, s.util * 100)}%`, background: s.bottleneck ? 'var(--warn)' : 'var(--accent)' }} /></div>
              <div className="mt-1 flex justify-between text-[11px] text-faint"><span>{Math.round(Math.min(s.util, 9.99) * 100)}% busy</span><span>{Math.round((s.cap / mx) * 100)}% of max</span></div>
            </div>
            {i < spec.steps.length - 1 && !vertical && <svg width="18" height="14" viewBox="0 0 18 14" className="shrink-0 text-faint" aria-hidden><path d="M1 7h14M10 2l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </div>))}
      </div>
      <p className="mt-3 text-sm text-muted">Flow through the whole process: <b className="num text-fg">{tick(spec.flowRate)} {spec.unit}</b></p>
    </div>
  );
}
