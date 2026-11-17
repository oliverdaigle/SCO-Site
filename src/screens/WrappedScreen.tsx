'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildPlan, wrappedCards, type WrappedCard } from '@lotwise/engine';
import { usePlan } from '@/lib/planStore';
import { exportPng } from '@/lib/export';
import { copyText } from '@/lib/files';
import { track } from '@/lib/analytics';
import { loadSample } from '@/platform/samples';
import { Link } from '@/platform/nav';
import { BRAND } from '@/platform/env';
import { Icon, LogoMark } from '@/components/icons';
import { toast, useReducedMotion, cx } from '@/components/ui';
import { usePro, UpgradeCard } from '@/components/calc/Pro';

const TONES: Record<WrappedCard['tone'], [string, string, string]> = {
  accent: ['#1B2166', '#5361F0', '#C9CFFF'], alt: ['#04332E', '#0FA391', '#B8F5EC'], alt2: ['#4A0E2B', '#D6457F', '#FFD0E2'], warn: ['#4A2A05', '#E08A12', '#FFE3B3'], good: ['#0B3A1E', '#22A055', '#C5F5D6'], bad: ['#4A1010', '#D94545', '#FFD3D3'],
};
/** One story card. Fixed 4:5 design size so the exported image is identical on every device. */
function Card({ c, index, total, source, animate }: { c: WrappedCard; index: number; total: number; source: string; animate: boolean }) {
  const [a, b, hi] = TONES[c.tone]; const big = c.big.length > 16 ? 58 : c.big.length > 10 ? 78 : 108;
  return (
    <div style={{ width: 540, height: 675, background: `radial-gradient(120% 90% at 85% 0%, ${b} 0%, ${a} 55%, #07080D 100%)`, color: '#fff', fontFamily: 'var(--font-display)', position: 'relative', overflow: 'hidden', borderRadius: 28 }}>
      <svg aria-hidden viewBox="0 0 540 675" style={{ position: 'absolute', inset: 0, opacity: 0.16 }}><path d="M-20 560 L-20 420 L120 560 L120 420 L260 560 L260 420 L400 560 L400 420 L560 580" fill="none" stroke="#fff" strokeWidth="18" strokeLinejoin="round" /></svg>
      <div style={{ position: 'absolute', top: 30, left: 34, right: 34, display: 'flex', gap: 5 }}>{Array.from({ length: total }, (_, i) => <span key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= index ? '#fff' : 'rgba(255,255,255,.28)' }} />)}</div>
      <div style={{ position: 'absolute', left: 38, right: 38, top: 86 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 15, letterSpacing: '0.12em', textTransform: 'uppercase', color: hi }}>{c.kicker}</p>
        <p key={c.id} className={animate ? 'animate-pop' : ''} style={{ fontSize: big, fontWeight: 800, lineHeight: 0.98, letterSpacing: '-0.045em', marginTop: 26, textWrap: 'balance' as any }}>{c.big}</p>
        <p className={animate ? 'animate-rise' : ''} style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.18, marginTop: 26, letterSpacing: '-0.02em', animationDelay: '.15s', textWrap: 'balance' as any }}>{c.line}</p>
        {c.sub && <p className={animate ? 'animate-rise' : ''} style={{ fontFamily: 'var(--font-sans)', fontSize: 17, lineHeight: 1.45, marginTop: 22, color: hi, animationDelay: '.3s' }}>{c.sub}</p>}
      </div>
      <div style={{ position: 'absolute', left: 38, right: 38, bottom: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--font-sans)', fontSize: 14, color: 'rgba(255,255,255,.8)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#fff', fontSize: 17 }}><LogoMark size={26} />{BRAND.name}</span><span>{source} · {BRAND.domain}</span>
      </div>
    </div>
  );
}

export function WrappedScreen() {
  const pro = usePro('business'); const { plan, source, set } = usePlan(); const [i, setI] = useState(0); const [playing, setPlaying] = useState(true); const [scale, setScale] = useState(1); const reduced = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null); const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!plan) loadSample('coffee-shop').then((t) => { const p = buildPlan(t); if (p.ok) set(p, 'Coffee shop (sample)', t); }).catch(() => {}); }, [plan, set]);
  const cards = useMemo(() => (plan ? wrappedCards(plan) : []), [plan]); const shownCards = pro ? cards : cards.slice(0, 3); const n = shownCards.length;
  const go = useCallback((d: number) => setI((x) => Math.max(0, Math.min(n - 1, x + d))), [n]);
  useEffect(() => { if (!playing || reduced || !n || i >= n - 1) return; const t = setTimeout(() => go(1), 4200); return () => clearTimeout(t); }, [i, playing, reduced, n, go]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1); } else if (e.key === 'ArrowLeft') go(-1); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [go]);
  useEffect(() => { const fit = () => { if (box.current) setScale(Math.min(1, (box.current.clientWidth - 2) / 540, (window.innerHeight - 250) / 675)); }; fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }, [n]);
  const c = shownCards[i]; const caption = c ? `${c.kicker}: ${c.big} ${c.line} ${c.sub}`.replace(/\s+/g, ' ').trim() + ` Made with ${BRAND.name}.` : '';
  const save = async () => { if (!cardRef.current) return; try { await exportPng(cardRef.current, `lotwise-wrapped-${i + 1}-${c.id}.png`); track('export', { kind: 'wrapped-png', card: c.id }); toast('Image saved. Ready to post.'); } catch { toast('Could not save the image. Try again.'); } };
  return (
    <div className="relative overflow-hidden">
      <div className="aurora" aria-hidden />
      <div className="wrap relative grid gap-8 py-8 sm:py-12 lg:grid-cols-[1fr_minmax(0,560px)] lg:items-center">
        <div className="order-2 lg:order-1">
          <p className="eyebrow">Business Pro</p><h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Your Supply Chain, Wrapped</h1>
          <p className="mt-3 max-w-xl text-lg text-muted">Story cards built from your own sales data. Flip through, save the ones you like as images, and share what you learned.</p>
          <p className="mt-4 text-sm text-muted">Showing: <b className="text-fg">{source || 'loading…'}</b>. <Link href="/business/plan-builder" className="link">Use your own data in the Plan Builder</Link>.</p>
          {c && (<div className="mt-6 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={save}><Icon name="download" size={15} />Save this card as an image</button>
            <button type="button" className="btn" onClick={async () => { toast((await copyText(caption)) ? 'Caption copied' : 'Could not copy'); }}><Icon name="copy" size={15} />Copy caption</button>
          </div>)}
          {c && <p className="mt-4 max-w-xl rounded-xl border border-line bg-raised px-4 py-3 text-sm text-muted"><span className="text-xs uppercase tracking-wider text-faint">Caption</span><br />{caption}</p>}
          {!pro && cards.length > 3 && <div className="mt-6 max-w-xl"><UpgradeCard mode="business" feature="wrapped">See all {cards.length} cards, including your excess stock, forecast accuracy, and inventory personality.</UpgradeCard></div>}
        </div>
        <div className="order-1 lg:order-2" ref={box}>
          {c ? (<>
            <div className="mx-auto" style={{ width: 540 * scale, height: 675 * scale }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 540, height: 675 }} className="relative shadow-2xl" role="group" aria-roledescription="story card" aria-label={`Card ${i + 1} of ${n}: ${caption}`}>
                <div ref={cardRef}><Card c={c} index={i} total={n} source={source} animate={!reduced} /></div>
                <button type="button" aria-label="Previous card" className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize rounded-l-[28px]" onClick={() => go(-1)} />
                <button type="button" aria-label="Next card" className="absolute inset-y-0 right-0 w-2/3 cursor-e-resize rounded-r-[28px]" onClick={() => go(1)} />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button type="button" className="btn btn-sm" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous"><Icon name="chevronLeft" size={15} /></button>
              <span className="num w-16 text-center text-sm text-muted" aria-live="polite">{i + 1} / {n}</span>
              <button type="button" className="btn btn-sm" onClick={() => go(1)} disabled={i === n - 1} aria-label="Next"><Icon name="chevronRight" size={15} /></button>
              <button type="button" className={cx('btn btn-sm', i === n - 1 && 'btn-primary')} onClick={() => { if (i === n - 1) { setI(0); setPlaying(true); } else setPlaying(!playing); }}><Icon name={i === n - 1 ? 'refresh' : playing && !reduced ? 'pause' : 'play'} size={13} />{i === n - 1 ? 'Replay' : playing && !reduced ? 'Pause' : 'Play'}</button>
            </div></>) : <div className="card mx-auto flex aspect-[4/5] max-w-[540px] items-center justify-center text-muted">Building your story…</div>}
        </div>
      </div>
    </div>
  );
}
