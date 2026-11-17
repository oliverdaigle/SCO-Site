'use client';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CALCS, CATEGORIES, byId, calcsIn, type Mode } from '@lotwise/engine';
import { CalculatorView } from '@/components/calc/CalculatorView';
import { Icon, LogoMark } from '@/components/icons';
import { Segmented, toast, cx } from '@/components/ui';
import { calcHref } from '@/lib/routes';
import { copyText } from '@/lib/files';
import { track } from '@/lib/analytics';
import { IS_ARTIFACT, SITE_URL, BRAND } from '@/platform/env';
import { useQuery } from '@/platform/nav';

export interface EmbedOpts { mode: Mode; theme: 'dark' | 'light'; accent: string | null }
const hex = (s: string | null | undefined) => (s && /^[0-9a-f]{6}$/i.test(s.replace('#', '')) ? '#' + s.replace('#', '').toLowerCase() : null);
/** Black or white text, whichever reads better on the chosen accent. */
function onColor(h: string): string { const n = parseInt(h.slice(1), 16); const lin = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); return L > 0.36 ? '#0a0c14' : '#ffffff'; }

/** The embeddable widget. Inside an iframe it reports its height to the host page so the frame can grow with it. */
export function EmbedFrame({ slug, opts, inline }: { slug: string; opts?: EmbedOpts; inline?: boolean }) {
  const q = useQuery(); const ref = useRef<HTMLDivElement>(null);
  const o: EmbedOpts = opts ?? { mode: q?.get('mode') === 'learner' ? 'learner' : 'business', theme: q?.get('theme') === 'light' ? 'light' : 'dark', accent: hex(q?.get('accent')) };
  const def = byId[slug];
  useEffect(() => {
    if (inline || !ref.current || typeof ResizeObserver === 'undefined') return;
    const send = () => { try { window.parent?.postMessage({ lotwise: 'resize', calc: slug, height: Math.ceil(ref.current!.getBoundingClientRect().height) }, '*'); } catch { /* not framed */ } };
    const ro = new ResizeObserver(send); ro.observe(ref.current); send(); return () => ro.disconnect();
  }, [inline, slug]);
  const style = o.accent ? ({ '--accent': o.accent, '--accent-fg': onColor(o.accent) } as CSSProperties) : undefined;
  if (!def) return <div className="p-6 text-sm text-muted">This calculator does not exist. Check the embed code.</div>;
  return (
    <div ref={ref} data-theme={o.theme} data-mode={o.mode} style={style} className={cx('bg-bg text-fg', inline ? 'rounded-xl' : 'min-h-dvh')}>
      <div className="mx-auto max-w-3xl p-3 sm:p-4">
        <h1 className="mb-3 font-sans text-lg font-semibold tracking-normal">{o.mode === 'business' ? def.bq : def.name}</h1>
        <CalculatorView calcId={slug} mode={o.mode} embed />
        <p className="mt-3 flex items-center justify-between gap-3 text-xs text-faint">
          <a href={`${SITE_URL}${calcHref(o.mode, slug)}?ref=embed`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-medium text-muted hover:text-fg"><LogoMark size={16} />Powered by {BRAND.name}</a>
          <a href={`${SITE_URL}/verified#${slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 hover:text-fg"><Icon name="shield" size={12} />Verified math</a>
        </p>
      </div>
    </div>
  );
}

const PRESETS = ['8e9bff', 'ffa35c', '34d3be', 'f48fb1', '4ade80', 'fbbf24'];
export function EmbedBuilderScreen() {
  const q = useQuery(); const [calc, setCalc] = useState('eoq'); const [mode, setMode] = useState<Mode>('business'); const [theme, setTheme] = useState<'dark' | 'light'>('dark'); const [accent, setAccent] = useState<string | null>(null); const [height, setHeight] = useState(720); const [tab, setTab] = useState<'iframe' | 'script'>('iframe');
  useEffect(() => { const c = q?.get('calc'); if (c && byId[c]) setCalc(c); }, [q]);
  const def = byId[calc]; const qs = useMemo(() => { const p = new URLSearchParams({ mode, theme }); if (accent) p.set('accent', accent.replace('#', '')); return p.toString(); }, [mode, theme, accent]);
  const src = `${SITE_URL}/embed/${calc}?${qs}`;
  const code = tab === 'iframe'
    ? `<iframe src="${src}" title="${def.name} calculator by ${BRAND.name}" width="100%" height="${height}" style="border:0;border-radius:14px;max-width:760px" loading="lazy"></iframe>\n<p style="font:13px system-ui;margin:6px 0 0"><a href="${SITE_URL}${calcHref(mode, calc)}">${def.name} calculator</a> by <a href="${SITE_URL}">${BRAND.name}</a></p>`
    : `<div data-lotwise="${calc}" data-mode="${mode}" data-theme="${theme}"${accent ? ` data-accent="${accent.replace('#', '')}"` : ''}></div>\n<script async src="${SITE_URL}/embed.js"></script>`;
  const copy = async () => { const ok = await copyText(code); toast(ok ? 'Embed code copied' : 'Could not copy. Select the code and copy it manually.'); track('embed_copy', { calc, kind: tab }); };
  return (
    <div className="wrap pb-20 pt-8 sm:pt-12">
      <header className="max-w-3xl"><p className="eyebrow">Embeds</p><h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Put a verified calculator on your site</h1><p className="mt-3 text-lg text-muted">Pick any of the {CALCS.length} calculators, match it to your brand, and paste one snippet into your blog, course page, or help center. Free, with a small “Powered by {BRAND.name}” link.</p></header>
      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-5">
          <div className="card space-y-4 p-4 sm:p-5">
            <div><label className="label block" htmlFor="eb-calc">Calculator</label>
              <select id="eb-calc" className="input" value={calc} onChange={(e) => setCalc(e.target.value)}>{CATEGORIES.map((c) => <optgroup key={c.id} label={c.name}>{calcsIn(c.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</optgroup>)}</select></div>
            <div className="grid grid-cols-2 gap-4">
              <div><span className="label block">Voice</span><Segmented label="Mode" value={mode} onChange={setMode} size="sm" options={[{ value: 'business', label: 'Business' }, { value: 'learner', label: 'Learner' }]} /></div>
              <div><span className="label block">Theme</span><Segmented label="Theme" value={theme} onChange={setTheme} size="sm" options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} /></div>
            </div>
            <div><span className="label block">Accent color</span>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setAccent(null)} aria-pressed={!accent} className={cx('btn btn-sm', !accent && 'border-accent-line')}>Default</button>
                {PRESETS.map((p) => <button key={p} type="button" aria-label={`Accent #${p}`} aria-pressed={accent === '#' + p} onClick={() => setAccent('#' + p)} className={cx('h-8 w-8 rounded-full border-2', accent === '#' + p ? 'border-fg' : 'border-transparent')} style={{ background: '#' + p }} />)}
                <label className="btn btn-sm cursor-pointer">Custom<input type="color" className="sr-only" value={accent ?? '#8e9bff'} onChange={(e) => setAccent(e.target.value)} /></label>
              </div></div>
            <div><label className="label block" htmlFor="eb-h">Starting height (px)</label><input id="eb-h" type="number" className="input num w-32" min={320} max={2000} step={20} value={height} onChange={(e) => setHeight(Math.max(320, Math.min(2000, Number(e.target.value) || 720)))} /><p className="mt-1.5 text-xs text-faint">The script version resizes itself to fit, so you can ignore this there.</p></div>
          </div>
          <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3"><Segmented label="Embed type" value={tab} onChange={setTab} size="sm" options={[{ value: 'iframe', label: 'Iframe' }, { value: 'script', label: 'Script (auto-resize)' }]} /><button type="button" className="btn btn-primary btn-sm" onClick={copy}><Icon name="copy" size={14} />Copy code</button></div>
            <pre tabIndex={0} aria-label="Embed code" className="scroll-x mt-3 max-h-56 overflow-auto rounded-lg border border-line bg-sunken p-3 text-xs leading-relaxed"><code>{code}</code></pre>
            <p className="mt-3 text-xs text-faint">{tab === 'iframe' ? 'Works anywhere HTML is allowed, including Notion, Canvas, WordPress, and Squarespace embed blocks.' : 'One small script turns every tagged element on the page into a calculator and keeps its height in sync.'}</p>
          </div>
        </div>
        <div className="lg:col-span-7">
          <div className="mb-2 flex items-center justify-between text-sm text-muted"><span className="flex items-center gap-2"><Icon name="eye" size={14} />Live preview</span><span className="num text-xs text-faint">{calc}</span></div>
          <div className="overflow-hidden rounded-2xl border border-line-strong" style={{ background: theme === 'light' ? '#f6f7fb' : '#090b10' }}>
            {IS_ARTIFACT ? <div style={{ maxHeight: height, overflow: 'auto' }}><EmbedFrame slug={calc} inline opts={{ mode, theme, accent }} /></div>
              : <iframe key={calc + qs} src={`/embed/${calc}?${qs}`} title={`${def.name} embed preview`} width="100%" height={height} style={{ border: 0, display: 'block' }} loading="lazy" />}
          </div>
        </div>
      </div>
    </div>
  );
}
