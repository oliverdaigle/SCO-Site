'use client';
import { useEffect, useRef, useState } from 'react';
import type { VizSpec } from '@lotwise/engine';
import { Icon } from '../icons';
import { useInView, useReducedMotion } from '../ui';

type Q = Extract<VizSpec, { kind: 'queue' }>;
function gamma(k: number): number { // Marsaglia-Tsang
  if (k < 1) return gamma(k + 1) * Math.pow(Math.random(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) { let x: number, v: number; do { const u1 = Math.random(), u2 = Math.random(); x = Math.sqrt(-2 * Math.log(u1 || 1e-12)) * Math.cos(2 * Math.PI * u2); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = Math.random(); if (u < 1 - 0.0331 * x * x * x * x || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v; }
}
const draw = (mean: number, cv: number) => (cv <= 0.001 ? mean : gamma(1 / (cv * cv)) * mean * cv * cv);
interface Cust { id: number; arrived: number; x: number; y: number; state: 'queue' | 'service' | 'done'; server: number; start: number; end: number; alpha: number }

/** Animated simulation of the waiting line. Runs the same arrival and service process the formulas describe. */
export function QueueSim({ spec }: { spec: Q }) {
  const canvas = useRef<HTMLCanvasElement>(null); const [wrap, inView] = useInView<HTMLDivElement>('100px'); const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(true); const [stats, setStats] = useState({ inLine: 0, avgWait: 0, served: 0 });
  const specRef = useRef(spec); specRef.current = spec;
  const key = `${spec.lambda}|${spec.mu}|${spec.servers}|${spec.cva}|${spec.cvs}`;
  useEffect(() => { if (reduced) setPlaying(false); }, [reduced]);

  useEffect(() => {
    const cv = canvas.current; if (!cv) return; const ctx = cv.getContext('2d')!;
    const S = Math.max(1, Math.min(specRef.current.servers, 8)); const shown = Math.min(S, 6);
    let W = 0, H = 0; const fit = () => { const r = cv.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }; fit();
    const ro = new ResizeObserver(fit); ro.observe(cv);
    const css = () => { const g = getComputedStyle(cv); return { accent: g.getPropertyValue('--accent').trim() || '#8e9bff', fg: g.getPropertyValue('--fg').trim(), muted: g.getPropertyValue('--muted').trim(), line: g.getPropertyValue('--line-strong').trim(), raised: g.getPropertyValue('--raised').trim(), alt: g.getPropertyValue('--alt').trim(), warn: g.getPropertyValue('--warn').trim() }; };
    let col = css(); let colT = 0;
    const custs: Cust[] = []; const busy: (Cust | null)[] = new Array(S).fill(null); let now = 0, nextArr = 0, nid = 0, waitSum = 0, served = 0, last = performance.now(), raf = 0, statT = 0;
    // warm start so the picture is not empty on first paint
    const step = (dt: number) => {
      const sp = specRef.current; const speed = 1.4 / sp.lambda; const simDt = dt * speed; now += simDt;
      while (nextArr <= now) { custs.push({ id: nid++, arrived: nextArr, x: -20, y: H / 2, state: 'queue', server: -1, start: 0, end: 0, alpha: 1 }); nextArr += draw(1 / sp.lambda, sp.cva); }
      for (let s = 0; s < S; s++) { const c = busy[s]; if (c && now >= c.end) { c.state = 'done'; busy[s] = null; } if (!busy[s]) { const q = custs.find((c2) => c2.state === 'queue'); if (q) { q.state = 'service'; q.server = s; q.start = now; q.end = now + draw(1 / sp.mu, sp.cvs); busy[s] = q; waitSum += q.start - q.arrived; served++; } } }
      const sx = W - 74, r = Math.max(7, Math.min(11, H / (shown * 3.4))); const srvY = (s: number) => (H / (shown + 1)) * (Math.min(s, shown - 1) + 1);
      let qi = 0; const perRow = Math.max(4, Math.floor((sx - 70) / (r * 2.6))); const k = Math.min(1, dt * 9);
      for (const c of custs) {
        let tx: number, ty: number;
        if (c.state === 'queue') { const row = Math.floor(qi / perRow), colI = qi % perRow; tx = sx - 46 - colI * r * 2.6; ty = H / 2 + (row % 2 ? 1 : -1) * Math.ceil(row / 2) * r * 2.5; qi++; }
        else if (c.state === 'service') { tx = sx; ty = srvY(c.server); }
        else { tx = W + 30; ty = c.y; c.alpha -= dt * 2.2; }
        c.x += (tx - c.x) * k; c.y += (ty - c.y) * k;
      }
      for (let i = custs.length - 1; i >= 0; i--) if (custs[i].state === 'done' && custs[i].alpha <= 0) custs.splice(i, 1);
      if (custs.length > 400) custs.splice(0, custs.length - 400);
      // draw
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = col.line; ctx.lineWidth = 1; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(8, H / 2 + r * 1.9); ctx.lineTo(sx - 30, H / 2 + r * 1.9); ctx.stroke(); ctx.setLineDash([]);
      for (let s = 0; s < shown; s++) { const y = srvY(s); ctx.fillStyle = col.raised; ctx.strokeStyle = busy[s] ? col.accent : col.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(sx - r * 1.9, y - r * 1.9, r * 3.8, r * 3.8, 8); ctx.fill(); ctx.stroke(); }
      for (const c of custs) {
        ctx.globalAlpha = Math.max(0, c.alpha); ctx.fillStyle = c.state === 'queue' && now - c.arrived > 2.5 * (specRef.current.Wq || 1e9) && specRef.current.Wq > 0 ? col.warn : c.state === 'done' ? col.alt : col.accent;
        ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
        if (c.state === 'service' && c.end > c.start) { ctx.strokeStyle = col.fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y, r + 3.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, (now - c.start) / (c.end - c.start))); ctx.stroke(); }
      }
      ctx.globalAlpha = 1; ctx.fillStyle = col.muted; ctx.font = '11px ui-sans-serif, system-ui'; ctx.fillText('Arrivals', 8, 14); ctx.textAlign = 'right'; ctx.fillText(S > shown ? `${S} servers (6 shown)` : S > 1 ? `${S} servers` : 'Server', W - 8, 14); ctx.textAlign = 'left';
      return qi;
    };
    for (let i = 0; i < 240; i++) step(1 / 30);
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t; const inLine = step(dt);
      if (t - colT > 1200) { col = css(); colT = t; }
      if (t - statT > 300) { statT = t; setStats({ inLine, avgWait: served ? waitSum / served : 0, served }); }
      raf = requestAnimationFrame(loop);
    };
    if (playing && inView) { last = performance.now(); raf = requestAnimationFrame(loop); } else setStats({ inLine: custs.filter((c) => c.state === 'queue').length, avgWait: served ? waitSum / served : 0, served });
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [key, playing, inView]);

  const u = spec.timeUnit; const toMin = (t: number) => (u === 'hour' ? t * 60 : u === 'day' ? t * 1440 : t); const unitOut = u === 'minute' ? 'time units' : 'min';
  return (
    <div ref={wrap}>
      <div className="relative overflow-hidden rounded-xl border border-line bg-sunken">
        <canvas ref={canvas} className="block h-[210px] w-full" role="img" aria-label={`Animated waiting line: ${spec.servers} server${spec.servers > 1 ? 's' : ''} at ${Math.round(spec.rho * 100)} percent utilization, about ${spec.Lq.toFixed(1)} waiting on average.`} />
        <button type="button" className="btn btn-sm absolute bottom-2 right-2" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause simulation' : 'Play simulation'}><Icon name={playing ? 'pause' : 'play'} size={13} />{playing ? 'Pause' : 'Play'}</button>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="panel px-2 py-2"><dt className="text-muted">In line now</dt><dd className="num text-lg font-semibold">{stats.inLine}</dd><dd className="text-faint">formula avg {spec.Lq.toFixed(2)}</dd></div>
        <div className="panel px-2 py-2"><dt className="text-muted">Simulated avg wait</dt><dd className="num text-lg font-semibold">{toMin(stats.avgWait).toFixed(1)} <span className="text-xs font-normal">{unitOut}</span></dd><dd className="text-faint">formula {toMin(spec.Wq).toFixed(1)}</dd></div>
        <div className="panel px-2 py-2"><dt className="text-muted">Utilization</dt><dd className="num text-lg font-semibold">{Math.round(spec.rho * 100)}%</dd><dd className="text-faint">{stats.served.toLocaleString('en-US')} served</dd></div>
      </dl>
    </div>
  );
}
