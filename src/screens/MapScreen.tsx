'use client';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { CATEGORIES, LEARNING_PATHS, byId, catById, symbols, type Mode } from '@lotwise/engine';
import { useStore } from '@/lib/store';
import { CAT_COLOR, LAYOUT, TOTAL, pathEdges } from '@/lib/mapLayout';
import { calcHref } from '@/lib/routes';
import { Link, useNav } from '@/platform/nav';
import { Tex } from '@/components/Tex';
import { Icon } from '@/components/icons';
import { Segmented, cx, toast, useReducedMotion } from '@/components/ui';
import { useAppMode } from '@/components/shell/Shell';

const Map3D = lazy(() => import('@/components/map/Map3D'));
/** WebGL support, and whether it is drawn in software (no graphics acceleration), where the 3D map would stutter. */
function webgl(): { ok: boolean; software: boolean } {
  try {
    const c = document.createElement('canvas'); const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null; if (!gl) return { ok: false, software: false };
    const ext = gl.getExtension('WEBGL_debug_renderer_info'); const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { ok: true, software: /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name) };
  } catch { return { ok: false, software: false }; }
}

/** Flat fallback: the same graph as an SVG. Used for reduced motion, low-power devices, and when WebGL is missing. */
function Map2D({ filter, pathSteps, path, selected, onHover, onPick }: { filter: string | null; path: string | null; pathSteps: string[]; selected: string | null; onHover: (id: string | null) => void; onPick: (id: string) => void }) {
  const inPath = new Set(pathSteps); const on = (i: number) => { const n = LAYOUT.nodes[i]; return path ? inPath.has(n.id) : !filter || n.cat === filter; };
  return (
    <svg viewBox="0 0 1200 800" className="h-full w-full" role="group" aria-label={`Formula Map: ${TOTAL} calculators grouped by topic`}>
      {LAYOUT.cats.map((c) => <g key={c.id} opacity={path ? 0.35 : !filter || filter === c.id ? 1 : 0.3}><circle cx={c.x} cy={c.y} r={c.r} fill={CAT_COLOR[c.id]} fillOpacity={0.06} stroke={CAT_COLOR[c.id]} strokeOpacity={0.25} /><text x={c.x} y={c.y + c.r + 20} textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--fg)">{c.name}</text></g>)}
      {LAYOUT.edges.map(([a, b], i) => { const A = LAYOUT.nodes[a]; const B = LAYOUT.nodes[b]; const act = on(a) && on(b) && !path; return <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={act ? CAT_COLOR[A.cat] : 'var(--line-strong)'} strokeOpacity={act ? 0.55 : 0.25} strokeWidth={act ? 1.4 : 1} />; })}
      {pathEdges(path).map(([a, b], i) => { const A = LAYOUT.nodes[a]; const B = LAYOUT.nodes[b]; return <line key={'p' + i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" />; })}
      {LAYOUT.nodes.map((n, i) => { const act = on(i); const sel = selected === n.id; const step = pathSteps.indexOf(n.id); return (
        <g key={n.id} role="link" tabIndex={0} aria-label={`${n.name}, ${catById[n.cat].name}`} className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-[3px]" onMouseEnter={() => onHover(n.id)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(n.id)} onClick={() => onPick(n.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(n.id); } }}>
          <circle cx={n.x} cy={n.y} r={16} fill="transparent" />
          <circle cx={n.x} cy={n.y} r={sel ? 11 : path && act ? 9.5 : 6 + Math.min(n.deg, 6) * 0.5} fill={act ? CAT_COLOR[n.cat] : 'var(--line-strong)'} stroke="var(--fg)" strokeWidth={sel ? 2.5 : 0} opacity={act ? 1 : 0.6} />
          {path && step >= 0 && <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0a0c14" pointerEvents="none">{step + 1}</text>}
        </g>); })}
    </svg>
  );
}

export function MapScreen() {
  const nav = useNav(); const mode: Mode = useAppMode(); const theme = useStore((s) => s.theme); const hydrated = useStore((s) => s.hydrated); const reduced = useReducedMotion();
  const [filter, setFilter] = useState<string | null>(null); const [path, setPath] = useState<string | null>(null); const [selected, setSelected] = useState<string | null>('eoq'); const [hover, setHover] = useState<{ id: string; x?: number; y?: number } | null>(null);
  const [view, setView] = useState<'3d' | '2d'>('2d'); const [gl, setGl] = useState(false); const [auto, setAuto] = useState(true);
  useEffect(() => { const w = webgl(); setGl(w.ok); let pref: string | null = null; try { pref = localStorage.getItem('lotwise:map'); } catch { /* ignore */ } const low = w.software || (navigator.hardwareConcurrency ?? 8) <= 2 || ((navigator as any).deviceMemory ?? 8) <= 2; setAuto(!pref); setView(w.ok && !reduced && (pref ? pref === '3d' : !low) ? '3d' : '2d'); }, [reduced]);
  const choose = (v: '3d' | '2d') => { setView(v); setAuto(false); try { localStorage.setItem('lotwise:map', v); } catch { /* ignore */ } };
  // If the 3D map was picked automatically and turns out to stutter on this device, fall back to the flat map.
  const onSlow = () => { if (auto) { setView('2d'); toast('Switched to the flat map so it stays smooth on this device.'); } };
  const lp = LEARNING_PATHS.find((p) => p.id === path) ?? null; const steps = useMemo(() => lp?.steps ?? [], [lp]);
  const shownId = hover?.id ?? selected; const def = shownId ? byId[shownId] : null; const light = hydrated && theme === 'light';
  const open = (id: string) => nav.push(calcHref(mode, id));
  const pick = (id: string, viaMouse: boolean) => { if (viaMouse && selected === id) open(id); else if (viaMouse) { setSelected(id); open(id); } else setSelected(id); };
  const neighbours = def ? LAYOUT.edges.filter(([a, b]) => LAYOUT.nodes[a].id === def.id || LAYOUT.nodes[b].id === def.id).length : 0;
  return (
    <div className="pb-20">
      <div className="wrap pt-8 sm:pt-12">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl"><p className="eyebrow">Formula Map</p><h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Every formula, and how they connect.</h1><p className="mt-3 text-lg text-muted">{TOTAL} calculators, {LAYOUT.edges.length} connections. A line means one calculator’s answer feeds another. Drag to turn it, hover to preview, click to open.</p></div>
          <Segmented label="Map view" size="sm" value={view} onChange={choose} options={[{ value: '3d', label: '3D', title: gl ? 'Three-dimensional map' : 'Not available on this device' }, { value: '2d', label: '2D', title: 'Flat map' }]} />
        </header>
        <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by topic">
          <button type="button" onClick={() => { setFilter(null); setPath(null); }} aria-pressed={!filter && !path} className={cx('btn btn-sm', !filter && !path && 'border-accent-line text-accent')}>All topics</button>
          {CATEGORIES.map((c) => <button key={c.id} type="button" aria-pressed={filter === c.id} onClick={() => { setPath(null); setFilter(filter === c.id ? null : c.id); }} className={cx('btn btn-sm', filter === c.id && 'border-accent-line')}><span className="h-2.5 w-2.5 rounded-full" style={{ background: CAT_COLOR[c.id] }} />{c.name}</button>)}
        </div>
      </div>
      <div className="wrap mt-5">
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="relative h-[58vh] min-h-[380px] overflow-hidden rounded-2xl border border-line bg-sunken lg:col-span-8 lg:h-[70vh]">
            {view === '3d' && gl ? <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted">Loading the map…</div>}><Map3D filter={filter} path={path} pathSteps={steps} selected={selected} light={light} onHover={(id, x, y) => setHover(id ? { id, x, y } : null)} onPick={pick} onSlow={onSlow} /></Suspense>
              : <Map2D filter={filter} path={path} pathSteps={steps} selected={selected} onHover={(id) => setHover(id ? { id } : null)} onPick={(id) => { if (selected === id) open(id); else setSelected(id); }} />}
            {view === '3d' && gl && (<div className="absolute bottom-3 right-3 flex flex-col gap-1.5"><button type="button" className="btn btn-sm !px-2" aria-label="Zoom in" onClick={() => window.dispatchEvent(new CustomEvent('lotwise-map-zoom', { detail: -4 }))}><Icon name="plus" size={15} /></button><button type="button" className="btn btn-sm !px-2" aria-label="Zoom out" onClick={() => window.dispatchEvent(new CustomEvent('lotwise-map-zoom', { detail: 4 }))}><Icon name="minus" size={15} /></button></div>)}
            {hover && hover.x !== undefined && byId[hover.id] && <div role="tooltip" className="pointer-events-none fixed z-30 max-w-[15rem] -translate-x-1/2 -translate-y-full rounded-lg border border-line-strong bg-raised px-3 py-2 text-sm shadow-xl" style={{ left: hover.x, top: (hover.y ?? 0) - 14 }}><span className="block font-semibold">{byId[hover.id].name}</span><span className="block text-xs text-muted">{catById[byId[hover.id].cat].name}</span></div>}
            <p className="pointer-events-none absolute bottom-3 left-4 text-xs text-faint">{view === '3d' && gl ? 'Drag to rotate · Ctrl + scroll or the buttons to zoom' : 'Select a dot to preview it, select again to open'}</p>
          </div>
          <aside className="space-y-5 lg:col-span-4" aria-live="polite">
            {def ? (
              <div className="card p-5">
                <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}><span className="h-2.5 w-2.5 rounded-full" style={{ background: CAT_COLOR[def.cat] }} />{catById[def.cat].name}</p>
                <h2 className="mt-2 text-2xl font-semibold">{def.name}</h2><p className="mt-1 text-muted">{def.bq}</p>
                <div className="scroll-x mt-4 rounded-lg border border-line bg-sunken px-3 py-3"><Tex>{def.formula(symbols('heizer'))}</Tex></div>
                <p className="mt-3 text-sm text-muted">{def.blurb}</p>
                <p className="mt-3 text-xs text-faint">{neighbours} connection{neighbours === 1 ? '' : 's'} in the map</p>
                <div className="mt-4 flex flex-wrap gap-2"><Link href={calcHref(mode, def.id)} className="btn btn-primary btn-sm">Open calculator<Icon name="arrowRight" size={14} /></Link><Link href={calcHref(mode === 'business' ? 'learner' : 'business', def.id)} className="btn btn-sm">{mode === 'business' ? 'Learner view' : 'Business view'}</Link></div>
              </div>) : <div className="card p-5 text-sm text-muted">Hover or select a calculator to preview it.</div>}
            <div className="card p-5">
              <h2 className="text-lg font-semibold">Learning paths</h2><p className="mt-1 text-sm text-muted">Light up a route through the map, one idea building on the last.</p>
              <ul className="mt-3 space-y-1.5">{LEARNING_PATHS.map((p) => (<li key={p.id}><button type="button" aria-pressed={path === p.id} onClick={() => { setFilter(null); setPath(path === p.id ? null : p.id); if (path !== p.id) setSelected(p.steps[0]); }} className={cx('w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors', path === p.id ? 'border-accent-line bg-accent-soft' : 'border-line hover:border-line-strong')}><span className="block font-medium">{p.name}</span><span className="block text-xs text-muted">{p.blurb}</span></button></li>))}</ul>
              {lp && <ol className="mt-4 space-y-1 border-t border-line pt-3 text-sm">{lp.steps.map((s, i) => byId[s] && (<li key={s} className="flex items-center gap-2.5"><span className="num flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-fg">{i + 1}</span><button type="button" className={cx('truncate text-left hover:text-accent', selected === s && 'text-accent')} onClick={() => setSelected(s)}>{byId[s].name}</button><Link href={calcHref(mode, s)} aria-label={`Open ${byId[s].name}`} className="ml-auto text-faint hover:text-fg"><Icon name="arrowRight" size={14} /></Link></li>))}</ol>}
            </div>
          </aside>
        </div>
        <details className="card mt-6 p-5"><summary className="cursor-pointer font-semibold">All {TOTAL} calculators as a list</summary>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{CATEGORIES.map((c) => (<div key={c.id}><h3 className="flex items-center gap-2 font-sans text-sm font-semibold tracking-normal"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CAT_COLOR[c.id] }} />{c.name}</h3><ul className="mt-2 space-y-1 text-sm">{LAYOUT.nodes.filter((n) => n.cat === c.id).map((n) => <li key={n.id}><Link href={calcHref(mode, n.id)} className="text-muted hover:text-fg">{n.name}</Link></li>)}</ul></div>))}</div>
        </details>
      </div>
    </div>
  );
}
