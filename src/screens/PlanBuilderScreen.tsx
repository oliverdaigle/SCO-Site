'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPlan, DEFAULT_OPTIONS, METHOD_NAME, F, type PlanOptions, type PlanResult, type SkuPlan, type VizSpec } from '@lotwise/engine';
import { usePlan } from '@/lib/planStore';
import { saveFile } from '@/lib/files';
import { track } from '@/lib/analytics';
import { loadSample, SAMPLES } from '@/platform/samples';
import { Link } from '@/platform/nav';
import { Icon } from '@/components/icons';
import { Modal, toast, cx } from '@/components/ui';
import { XYChart } from '@/components/viz/XYChart';
import { usePro, UpgradeCard } from '@/components/calc/Pro';

const pill = (s: SkuPlan['status']) => (s === 'Reorder now' ? 'bg-[color-mix(in_oklab,var(--bad)_16%,transparent)] text-bad' : s === 'Overstocked' ? 'bg-[color-mix(in_oklab,var(--warn)_16%,transparent)] text-warn' : s === 'Healthy' ? 'bg-[color-mix(in_oklab,var(--good)_16%,transparent)] text-good' : 'bg-raised text-muted');

function SkuDetail({ s, plan, onClose }: { s: SkuPlan; plan: PlanResult; onClose: () => void }) {
  const n = s.weekly.length; const fit = s.fitted.map((y, i) => [i + 1, y] as [number, number]).filter((p) => Number.isFinite(p[1])); const all: [number, number][] = [...fit, [n + 1, s.forecast]];
  const chart: Extract<VizSpec, { kind: 'xy' }> = { kind: 'xy', x: { label: 'Week' }, y: { label: 'Units per week', zero: true }, series: [{ name: 'Actual', style: 'line', tone: 'muted', pts: s.weekly.map((y, i) => [i + 1, y]) }, { name: 'Forecast', style: 'dash', tone: 'accent', pts: all }, { name: 'Next week', style: 'dots', tone: 'accent', pts: [[n + 1, s.forecast]] }], ribbon: s.mad > 0 ? { upper: all.map(([x, y]) => [x, y + s.mad]), lower: all.map(([x, y]) => [x, Math.max(0, y - s.mad)]), label: '± 1 MAD', tone: 'accent' } : undefined };
  const rows: [string, string][] = [['Forecast method', METHOD_NAME[s.method] + (s.method === 'ses' ? ` (α = ${s.alpha})` : s.method === 'holt' ? ` (α = ${s.alpha}, β = ${s.beta})` : '')], ['Weekly forecast', F.num(s.forecast, 1) + ' units'], ['Typical miss (MAD)', F.num(s.mad, 1) + ` units (${F.pct(s.mape, 0)})`], ['Forecast error std. dev.', F.num(s.sigma, 1)], ['Class and service level', `${s.abc} item at ${s.service}% (z = ${s.z.toFixed(2)})`], ['Lead time', `${s.leadDays} days`], ['Order quantity', F.int(s.eoq) + ' units'], ['Safety stock', F.int(s.safetyStock) + ' units'], ['Reorder point', F.int(s.rop) + ' units'], ['Orders per year', F.num(s.ordersPerYear, 1)], ['Yearly ordering + holding cost', F.money(s.annualCost)], ...(s.onHand !== null ? [['On hand today', `${F.int(s.onHand)} units (${s.daysOfCover !== null ? F.int(s.daysOfCover) + ' days of cover' : 'no demand'})`] as [string, string]] : [])];
  return (
    <Modal open onClose={onClose} title={s.sku} wide>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Policy for</p><h2 className="mt-1 text-2xl font-semibold">{s.sku}</h2></div><button type="button" className="btn btn-ghost btn-sm !px-2" aria-label="Close" onClick={onClose}><Icon name="x" /></button></div>
        <p className="display mt-3 text-xl font-semibold">{s.status === 'Reorder now' ? `Order ${F.int(s.eoq)} units now.` : `Reorder ${F.int(s.eoq)} units when stock falls to ${F.int(s.rop)}.`}</p>
        {s.limitedHistory && <p className="mt-2 text-sm text-warn">Limited history for this item. Treat the forecast as a rough starting point.</p>}
        <div className="mt-4 rounded-xl border border-line bg-sunken p-2"><XYChart spec={chart} height={230} /></div>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">{rows.map(([k, v]) => (<div key={k} className="flex justify-between gap-3 border-b border-line py-1.5"><dt className="text-muted">{k}</dt><dd className="num text-right font-medium">{v}</dd></div>))}</dl>
        <p className="mt-4 text-xs text-faint">History covers {plan.report.weeks} weeks. Safety stock = z × forecast error × √(lead time in weeks).</p>
      </div>
    </Modal>
  );
}

export function PlanBuilderScreen() {
  const pro = usePro('business'); const { plan, source, csv, set } = usePlan(); const [opts, setOpts] = useState<PlanOptions>(DEFAULT_OPTIONS); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(''); const [detail, setDetail] = useState<SkuPlan | null>(null); const [sort, setSort] = useState<'value' | 'status'>('value'); const [drag, setDrag] = useState(false); const file = useRef<HTMLInputElement>(null);
  const runCsv = (text: string, name: string, o = opts) => { const p = buildPlan(text, o); if (!p.ok) { setErr(p.error); set(null, name, text); return; } setErr(null); set(p, name, text); track('plan_run', { source: name, skus: p.skus.length }); };
  const pickSample = async (id: string, name: string) => { setBusy(id); try { runCsv(await loadSample(id), name); } catch (e) { setErr((e as Error).message); } setBusy(''); };
  const upload = async (f: File | undefined) => { if (!f) return; if (!pro) { toast('Uploading your own file is part of Business Pro'); return; } if (f.size > 20e6) { setErr('That file is over 20 MB. Export a shorter date range or fewer columns.'); return; } runCsv(await f.text(), f.name); };
  useEffect(() => { if (!plan && !csv) pickSample('coffee-shop', 'Coffee shop'); }, []); // eslint-disable-line
  const setOpt = (k: keyof PlanOptions, v: number) => { if (!Number.isFinite(v)) return; const o = { ...opts, [k]: v }; setOpts(o); if (csv) runCsv(csv, source, o); };
  const rows = useMemo(() => { if (!plan) return []; const order = { 'Reorder now': 0, Overstocked: 1, Healthy: 2, 'No stock data': 3 }; return sort === 'status' ? [...plan.skus].sort((a, b) => order[a.status] - order[b.status] || b.annualVolume - a.annualVolume) : plan.skus; }, [plan, sort]);
  const exportXlsx = async () => { if (!plan) return; setBusy('xlsx'); try { const { planToXlsx } = await import('@/lib/planExcel'); await saveFile(await planToXlsx(plan), `lotwise-plan-${source.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-csv$/, '')}.xlsx`); track('export', { kind: 'xlsx' }); toast('Excel file ready. Every number is a live formula.'); } catch { toast('Could not build the Excel file. Try again.'); } setBusy(''); };
  const s = plan?.summary; const shown = pro ? rows : rows.slice(0, 3);
  const pareto: Extract<VizSpec, { kind: 'xy' }> | null = plan ? { kind: 'xy', x: { label: 'Products ranked by yearly sales value', cats: plan.skus.map((x) => x.sku) }, y: { label: 'Cumulative share of sales value (%)', zero: true }, series: [{ name: 'Share of total', style: 'bars', tone: 'accent', pts: plan.skus.map((x, i) => [i, (x.annualVolume / plan.summary.totalVolume) * 100]) }, { name: 'Cumulative', style: 'line', tone: 'alt', pts: plan.skus.reduce<[number, number][]>((a, x, i) => [...a, [i, (a[i - 1]?.[1] ?? 0) + (x.annualVolume / plan.summary.totalVolume) * 100]], []) }], hlines: [{ y: plan.options.cutA, label: `A cutoff ${plan.options.cutA}%`, tone: 'muted' }, { y: plan.options.cutB, label: `B cutoff ${plan.options.cutB}%`, tone: 'muted' }] } : null;

  return (
    <div className="wrap pb-20 pt-8 sm:pt-12">
      <header className="max-w-3xl"><p className="eyebrow">Business Pro</p><h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Supply Chain Plan Builder</h1><p className="mt-3 text-lg text-muted">Upload your sales history. Lotwise cleans it, picks the best forecast for each product, and gives you one inventory policy per SKU: how much to order, when to reorder, and how much buffer to hold.</p></header>

      <section aria-label="Choose data" className="mt-8 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="card p-5">
          <h2 className="text-lg font-semibold">Try a sample business</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">{SAMPLES.map((d) => (<li key={d.id}><button type="button" onClick={() => pickSample(d.id, d.name)} aria-pressed={source === d.name} className={cx('flex h-full w-full flex-col rounded-xl border p-4 text-left transition-colors', source === d.name ? 'border-accent-line bg-accent-soft' : 'border-line bg-raised hover:border-accent-line')}><Icon name={d.icon} className="text-accent" /><span className="mt-2 font-semibold">{d.name}</span><span className="mt-1 text-xs leading-relaxed text-muted">{busy === d.id ? 'Loading…' : d.blurb}</span></button></li>))}</ul>
        </div>
        <div className={cx('card flex flex-col items-center justify-center border-dashed p-5 text-center transition-colors', drag && 'border-accent bg-accent-soft')} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]); }}>
          <Icon name="upload" size={22} className="text-accent" />
          <h2 className="mt-2 text-lg font-semibold">Use your own sales history</h2>
          <p className="mt-1 max-w-sm text-sm text-muted">A CSV with <b className="text-fg">date, SKU, units</b>. Optional: unit cost, lead time (days), order cost, on hand. Your file is processed in your browser and never uploaded.</p>
          <input ref={file} type="file" accept=".csv,.tsv,.txt,text/csv" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
          <div className="mt-3 flex flex-wrap justify-center gap-2">{pro ? <button type="button" className="btn btn-primary" onClick={() => file.current?.click()}><Icon name="upload" size={15} />Choose a CSV file</button> : <Link href="/pricing#business" className="btn btn-primary"><Icon name="lock" size={14} />Upload with Business Pro</Link>}</div>
        </div>
      </section>

      {err && (<div role="alert" className="card mt-6 border-bad/40 p-5"><p className="flex items-center gap-2 font-semibold"><Icon name="alert" className="text-bad" />We could not use that file</p><p className="mt-2 text-sm text-muted">{err}</p></div>)}

      {plan && s && (<>
        <section aria-label="Data check" className="card mt-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Data check: {source}</h2><span className="badge badge-good"><Icon name="check" size={12} />{plan.report.rowsKept.toLocaleString('en-US')} rows used</span></div>
          <p className="mt-2 text-sm text-muted">{plan.report.rowsRead.toLocaleString('en-US')} rows read, {plan.report.rowsDropped} skipped. {plan.report.skus} products across {plan.report.weeks} weeks ({plan.report.start} to {plan.report.end}). Columns found: {Object.values(plan.report.columns).join(', ')}.</p>
          {plan.report.issues.length > 0 && <ul className="mt-3 space-y-1 text-sm">{plan.report.issues.map((i, k) => (<li key={k} className="flex gap-2 text-muted"><Icon name="info" size={15} className="mt-0.5 shrink-0 text-warn" /><span>{i.kind} <span className="num text-fg">({i.count})</span>{i.example && <span className="text-faint"> for example {i.example}</span>}</span></li>))}</ul>}
        </section>

        <section aria-label="Summary" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[{ k: 'Top 3 products', v: F.pct(s.top3Share, 0), d: 'of yearly sales value' }, { k: 'Forecast accuracy', v: F.pct(100 - s.mape, 0), d: `typical miss ${F.pct(s.mape, 0)}` }, { k: 'Reorder now', v: String(s.reorderNow.length), d: plan.report.hasOnHand ? 'products at or below reorder point' : 'add an on_hand column to see this' }, { k: 'Excess stock', v: plan.report.hasOnHand ? F.money(s.excessValue, 0) : 'n/a', d: s.excessSku ? `most in ${s.excessSku}` : 'above reorder point + one order' }].map((t) => (<div key={t.k} className="card p-4"><p className="text-sm text-muted">{t.k}</p><p className="num mt-1 text-3xl font-semibold tracking-tight text-accent">{t.v}</p><p className="mt-1 truncate text-xs text-faint" title={t.d}>{t.d}</p></div>))}
        </section>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {pro ? <button type="button" className="btn btn-primary" onClick={exportXlsx} disabled={busy === 'xlsx'}><Icon name="download" size={15} />{busy === 'xlsx' ? 'Building Excel…' : 'Export to Excel (live formulas)'}</button> : <Link href="/pricing#business" className="btn"><Icon name="lock" size={14} />Export to Excel</Link>}
          <Link href="/business/wrapped" className="btn"><Icon name="sparkles" size={15} />See your Supply Chain, Wrapped</Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section aria-label="ABC analysis" className="card p-5"><h2 className="text-lg font-semibold">Where your money is (ABC analysis)</h2><p className="mb-2 mt-1 text-sm text-muted">{s.classCount.A} A items make up {F.pct(s.classShare.A, 0)} of yearly sales value. {s.classCount.C} C items make up {F.pct(s.classShare.C, 0)}.</p>{pareto && <XYChart spec={pareto} height={280} />}</section>
          <section aria-label="Assumptions" className="card p-5">
            <h2 className="text-lg font-semibold">Assumptions</h2><p className="mt-1 text-sm text-muted">Change one and the whole plan recalculates. Values in your file override the defaults.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {([['holdingRate', 'Holding cost (% of cost per year)', 1], ['serviceA', 'Service level, A items (%)', 0.5], ['serviceB', 'Service level, B items (%)', 0.5], ['serviceC', 'Service level, C items (%)', 0.5], ['leadTimeDays', 'Default lead time (days)', 1], ['orderCost', 'Default cost per order ($)', 5]] as [keyof PlanOptions, string, number][]).map(([k, label, step]) => (<label key={k} className="block"><span className="label">{label}</span><input className="input num mt-1" type="number" step={step} min={k.startsWith('service') ? 50 : 0} max={k.startsWith('service') ? 99.9 : undefined} value={opts[k]} onChange={(e) => setOpt(k, Number(e.target.value))} /></label>))}
            </div>
            <p className="mt-4 text-xs text-faint">Forecast: best of moving average, exponential smoothing, and trend-adjusted smoothing for each product, scored on how well it would have predicted your own history.</p>
          </section>
        </div>

        <section aria-label="Inventory policies" className="card mt-6 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><h2 className="text-lg font-semibold">One policy per product</h2><p className="text-sm text-muted">Tap a row for the forecast chart and details.</p></div><div role="radiogroup" aria-label="Sort" className="inline-flex rounded-[10px] border border-line bg-sunken p-0.5 text-xs">{(['value', 'status'] as const).map((k) => <button key={k} type="button" role="radio" aria-checked={sort === k} onClick={() => setSort(k)} className={cx('rounded-lg px-2.5 py-1 font-medium', sort === k ? 'bg-raised ring-1 ring-line-strong' : 'text-muted')}>{k === 'value' ? 'By sales value' : 'By urgency'}</button>)}</div></div>
          <div className="scroll-x border-t border-line">
            <table className="tbl">
              <thead><tr><th scope="col">Product</th><th scope="col">Class</th><th scope="col">Weekly forecast</th><th scope="col">Typical miss</th><th scope="col">Order quantity</th><th scope="col">Safety stock</th><th scope="col">Reorder point</th><th scope="col">On hand</th><th scope="col">Status</th></tr></thead>
              <tbody>{shown.map((x) => (<tr key={x.sku} className="cursor-pointer hover:bg-raised" onClick={() => setDetail(x)}><td className="max-w-[15rem]"><button type="button" className="block w-full truncate text-left font-medium hover:text-accent" title={x.sku}>{x.sku}</button></td><td><span className={cx('num inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold', x.abc === 'A' ? 'bg-accent text-accent-fg' : x.abc === 'B' ? 'bg-accent-soft text-accent' : 'bg-raised text-muted')}>{x.abc}</span></td><td className="num">{F.num(x.forecast, 1)}</td><td className="num">{F.pct(x.mape, 0)}</td><td className="num font-semibold">{F.int(x.eoq)}</td><td className="num">{F.int(x.safetyStock)}</td><td className="num font-semibold">{F.int(x.rop)}</td><td className="num">{x.onHand === null ? '' : F.int(x.onHand)}</td><td><span className={cx('inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold', pill(x.status))}>{x.status}</span></td></tr>))}</tbody>
            </table>
          </div>
          {!pro && rows.length > 3 && <div className="border-t border-line p-5"><UpgradeCard mode="business" feature="plan-builder">See the policy for all {rows.length} products, upload your own sales file, and export a live-formula Excel workbook.</UpgradeCard></div>}
        </section>
        <p className="mt-6 text-xs text-faint">The plan is decision support based on your history. Check lead times and costs with your suppliers before changing how you order. <Link href="/disclaimer" className="link">Disclaimer</Link>.</p>
      </>)}
      {detail && plan && <SkuDetail s={detail} plan={plan} onClose={() => setDetail(null)} />}
    </div>
  );
}
