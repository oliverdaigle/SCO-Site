'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from './icons';

export function cx(...a: (string | false | null | undefined)[]) { return a.filter(Boolean).join(' '); }

export function Disclosure({ title, children, defaultOpen = false, badge, id }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean; badge?: ReactNode; id?: string }) {
  const [open, setOpen] = useState(defaultOpen); const pid = useId();
  return (
    <div className="card overflow-hidden" id={id}>
      <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left font-medium hover:bg-raised/60 sm:px-5" aria-expanded={open} aria-controls={pid} onClick={() => setOpen(!open)}>
        <span className="flex items-center gap-2.5">{title}{badge}</span>
        <Icon name="chevronDown" className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      <div id={pid} hidden={!open} className="border-t border-line px-4 py-4 sm:px-5">{children}</div>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; title?: string }[]; label: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[10px] border border-line bg-sunken p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} title={o.title} onClick={() => onChange(o.value)}
          className={cx('rounded-lg font-medium transition-colors', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm', value === o.value ? 'bg-raised text-fg shadow-sm ring-1 ring-line-strong' : 'text-muted hover:text-fg')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Hover or focus definition. Keyboard accessible, and nudged sideways so it never leaves the screen. */
export function Tip({ text, children }: { text: string; children: ReactNode }) {
  const id = useId(); const ref = useRef<HTMLSpanElement>(null); const [pos, setPos] = useState<{ left: number; width: number } | null>(null);
  const show = () => { const r = ref.current?.getBoundingClientRect(); if (!r) return; const width = Math.min(256, window.innerWidth - 24); setPos({ left: Math.max(12, Math.min(r.left, window.innerWidth - width - 12)) - r.left, width }); };
  return (
    <span ref={ref} className="relative inline-flex" onMouseEnter={show} onMouseLeave={() => setPos(null)} onFocus={show} onBlur={() => setPos(null)}>
      <span tabIndex={0} aria-describedby={id} className="inline-flex cursor-help items-center rounded outline-offset-2">{children}</span>
      <span id={id} role="tooltip" hidden={!pos} style={pos ? { left: pos.left, width: pos.width } : undefined} className="pointer-events-none absolute bottom-full z-30 mb-2 rounded-lg border border-line-strong bg-raised px-3 py-2 text-xs font-normal leading-relaxed text-fg shadow-xl">{text}</span>
    </span>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return; const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'Tab' && ref.current) { const f = ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'); if (!f.length) return; const first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } };
    document.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector<HTMLElement>('[data-autofocus],input,button')?.focus(), 30);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[10vh] backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={cx('card animate-pop w-full', wide ? 'max-w-2xl' : 'max-w-md')}>{children}</div>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (b: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cx('relative h-6 w-10 shrink-0 rounded-full border transition-colors', checked ? 'border-transparent bg-accent' : 'border-line-strong bg-sunken')}>
      <span className={cx('absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-all', checked ? 'left-[19px]' : 'left-0.5')} />
    </button>
  );
}

export function Slider({ value, onChange, min, max, step = 1, label, id }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; label: string; id?: string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input id={id} type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
      className="lw-range h-6 w-full cursor-pointer appearance-none bg-transparent" style={{ ['--pct' as any]: `${pct}%` }} />
  );
}

export function Empty({ icon = 'info', title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (<div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-6 py-10 text-center"><Icon name={icon} size={22} className="text-faint" /><p className="font-medium">{title}</p>{children && <div className="max-w-md text-sm text-muted">{children}</div>}</div>);
}

let toastFn: ((msg: string) => void) | null = null;
export function toast(msg: string) { toastFn?.(msg); }
export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { let t: any; toastFn = (m) => { setMsg(m); clearTimeout(t); t = setTimeout(() => setMsg(null), 2600); }; return () => { toastFn = null; clearTimeout(t); }; }, []);
  return (<div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">{msg && <div className="animate-pop pointer-events-auto flex items-center gap-2 rounded-full border border-line-strong bg-raised px-4 py-2 text-sm shadow-2xl"><Icon name="check" size={15} className="text-good" />{msg}</div>}</div>);
}

/** Celebration burst. Satisfying, brief, and skipped entirely when the user prefers reduced motion. */
export function Confetti({ fire }: { fire: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!fire || !ref.current) return; if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = ref.current, ctx = c.getContext('2d')!; const dpr = Math.min(2, window.devicePixelRatio || 1); c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const colors = ['#8E9BFF', '#FFA35C', '#34D3BE', '#F48FB1', '#FBBF24', '#4ADE80'];
    const ps = Array.from({ length: 110 }, () => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.45, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 4, r: 3 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[Math.floor(Math.random() * colors.length)], life: 1 }));
    let raf = 0; const tick = () => { ctx.clearRect(0, 0, innerWidth, innerHeight); let alive = false; for (const p of ps) { p.vy += 0.42; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 0.011; if (p.life > 0 && p.y < innerHeight + 20) { alive = true; ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); } } if (alive) raf = requestAnimationFrame(tick); else ctx.clearRect(0, 0, innerWidth, innerHeight); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [fire]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[70] h-full w-full" />;
}

export function useReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => { const m = window.matchMedia('(prefers-reduced-motion: reduce)'); setR(m.matches); const f = () => setR(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return r;
}
export function useInView<T extends Element>(margin = '0px'): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null); const [seen, setSeen] = useState(false);
  useEffect(() => { if (!ref.current) return; const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { rootMargin: margin }); io.observe(ref.current); return () => io.disconnect(); }, [margin]);
  return [ref, seen];
}
export function useWidth<T extends HTMLElement>(initial = 640): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null); const [w, setW] = useState(initial);
  useEffect(() => { if (!ref.current) return; const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width)))); ro.observe(ref.current); setW(Math.max(240, Math.round(ref.current.getBoundingClientRect().width))); return () => ro.disconnect(); }, []);
  return [ref, w];
}
