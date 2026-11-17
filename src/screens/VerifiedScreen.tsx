// The public Verified page. Everything here is read from verification/report.json, which `npm run verify` writes.
import { CATEGORIES, byId } from '@lotwise/engine';
import report from '../../verification/report.json';
import { Link } from '@/platform/nav';
import { Icon } from '@/components/icons';

type Row = { label: string; predicted: number; simulated: number; ok: boolean; kind: string };
type Sim = { title: string; detail: string; n: number; passed: boolean; rows: Row[] };
type Calc = { id: string; name: string; cat: string; claim?: string | null; passed: boolean; examples: { n: number; passed: number; titles: string[] }; crosscheck: { cases: number; comparisons: number; mismatches: number; tolerance: number; passed: boolean }; properties: { n: number; passed: number; titles: string[] }; simulations: Sim[] };
const R = report as unknown as { generated: string; environment: Record<string, string>; summary: Record<string, number>; calculators: Calc[] };
const n = (x: number) => x.toLocaleString('en-US');
const g = (x: number) => (Number.isInteger(x) ? n(x) : Math.abs(x) >= 1000 ? n(Math.round(x * 100) / 100) : Math.abs(x) < 0.001 && x !== 0 ? x.toExponential(2) : String(Number(x.toPrecision(5))));
const Tick = ({ ok }: { ok: boolean }) => <span className={ok ? 'text-good' : 'text-bad'} aria-label={ok ? 'passed' : 'failed'}><Icon name={ok ? 'check' : 'x'} size={14} /></span>;

export function VerifiedScreen() {
  const s = R.summary; const all = s.passed === s.calculators;
  const layers = [
    { k: 'Layer 1', t: 'Textbook worked examples', d: 'Each calculator reproduces at least two textbook-style problems to the precision a textbook prints.', v: `${n(s.examplesPassed)} of ${n(s.examples)}`, ok: s.examplesPassed === s.examples, icon: 'book' },
    { k: 'Layer 2', t: 'Independent cross-check', d: 'A second implementation, written separately in Python with NumPy, SciPy, and statsmodels, is compared on randomized inputs at a tolerance of one part in a billion.', v: `${n(s.crossComparisons)} comparisons, ${n(s.crossMismatches)} mismatches`, ok: s.crossMismatches === 0, icon: 'layers' },
    { k: 'Layer 3', t: 'Simulation proof', d: 'Where a formula makes a claim about the real world, a simulation plays that world out and checks the claim holds.', v: `${n(s.simulationsPassed)} of ${n(s.simulations)} suites, ${n(s.simulatedTrials)} trials`, ok: s.simulationsPassed === s.simulations, icon: 'zap' },
    { k: 'Plus', t: 'Property tests', d: 'Monotonicity, limits, unit-conversion consistency, and edge cases such as zero variance, zero lead time, and malformed data.', v: `${n(s.propertiesPassed)} of ${n(s.properties)}`, ok: s.propertiesPassed === s.properties, icon: 'shield' },
  ];
  return (
    <div className="wrap pb-24 pt-8 sm:pt-14">
      <header className="max-w-3xl">
        <p className="eyebrow">Verified</p>
        <h1 className="mt-2 text-4xl font-semibold sm:text-6xl">{all ? `All ${s.calculators} calculators pass every check.` : `${s.passed} of ${s.calculators} calculators pass every check.`}</h1>
        <p className="mt-4 text-lg text-muted">A calculator you cannot trust is worse than no calculator. Every formula on Lotwise has to pass three independent layers of verification before it ships. This page is generated from the most recent test run, not written by hand.</p>
        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-faint"><span className="badge badge-good"><Icon name="shield" size={12} />Last run {R.generated}</span><span className="num">Python {R.environment.python} · NumPy {R.environment.numpy} · SciPy {R.environment.scipy} · statsmodels {R.environment.statsmodels} · Node {R.environment.node}</span></p>
      </header>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {layers.map((l) => (<li key={l.k} className="card flex flex-col p-5"><span className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent"><Icon name={l.icon} size={17} /></span><span className="badge badge-neutral">{l.k}</span></span><h2 className="mt-4 font-sans text-base font-semibold tracking-normal">{l.t}</h2><p className="mt-1.5 flex-1 text-sm text-muted">{l.d}</p><p className="num mt-4 flex items-start gap-2 border-t border-line pt-3 text-sm font-medium"><Tick ok={l.ok} />{l.v}</p></li>))}
      </ul>
      <section className="mt-12 grid gap-8 lg:grid-cols-2" aria-label="How to read this page">
        <div><h2 className="text-2xl font-semibold">Why three layers</h2><p className="mt-3 text-muted">A worked example proves a formula matches the book on one set of numbers. A cross-check against separately written code proves it matches everywhere, including the awkward corners. A simulation proves the formula is the right one to begin with: if a safety stock is meant to give a 95% chance of no stockout, we run tens of thousands of simulated cycles and count.</p></div>
        <div><h2 className="text-2xl font-semibold">Reproduce it yourself</h2><p className="mt-3 text-muted">The whole harness ships with the source code. One command runs every layer and rewrites this page:</p><pre className="scroll-x mt-3 rounded-lg border border-line bg-sunken p-3 text-sm"><code>npm run verify</code></pre><p className="mt-3 text-sm text-faint">Tolerances are never loosened to make a test pass. A calculator that fails any layer loses its Verified badge until it is fixed.</p></div>
      </section>

      <nav aria-label="Jump to a category" className="mt-12 flex flex-wrap gap-2">{CATEGORIES.map((c) => <Link key={c.id} href={`/verified#cat-${c.id}`} className="btn btn-sm">{c.name}</Link>)}</nav>
      {CATEGORIES.map((cat) => { const list = R.calculators.filter((c) => c.cat === cat.id); if (!list.length) return null; return (
        <section key={cat.id} id={`cat-${cat.id}`} className="mt-12 scroll-mt-24" aria-label={cat.name}>
          <h2 className="text-2xl font-semibold">{cat.name}</h2>
          <div className="mt-4 space-y-3">
            {list.map((c) => (
              <details key={c.id} id={c.id} className="card group scroll-mt-24 overflow-hidden target:border-accent-line">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 p-4 sm:px-5 [&::-webkit-details-marker]:hidden">
                  <span className={c.passed ? 'badge badge-good' : 'badge badge-bad'}><Icon name="shield" size={12} />{c.passed ? 'Verified' : 'Failing'}</span>
                  <span className="min-w-0 flex-1 font-semibold">{c.name}</span>
                  <span className="num flex flex-wrap gap-x-4 text-xs text-muted"><span>{c.examples.passed}/{c.examples.n} examples</span><span>{n(c.crosscheck.cases)} cross-checks</span><span>{c.properties.passed}/{c.properties.n} properties</span>{c.simulations.length > 0 && <span className="text-accent">{c.simulations.length} simulation{c.simulations.length > 1 ? 's' : ''}</span>}</span>
                  <Icon name="chevronDown" size={16} className="text-faint transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-5 border-t border-line p-4 text-sm sm:px-5">
                  {c.claim && <p><span className="text-faint">What it claims: </span>{c.claim}</p>}
                  <div className="grid gap-5 md:grid-cols-2">
                    <div><h3 className="font-sans text-sm font-semibold tracking-normal">Layer 1 · Worked examples</h3><ul className="mt-2 space-y-1 text-muted">{c.examples.titles.map((t, i) => <li key={i} className="flex gap-2"><Tick ok={i < c.examples.passed} />{t}</li>)}</ul></div>
                    <div><h3 className="font-sans text-sm font-semibold tracking-normal">Layer 2 · Independent cross-check</h3><p className="mt-2 text-muted">{n(c.crosscheck.cases)} randomized inputs, {n(c.crosscheck.comparisons)} output comparisons against the Python reference, tolerance {c.crosscheck.tolerance.toExponential(0)}. <span className={c.crosscheck.mismatches ? 'text-bad' : 'text-good'}>{n(c.crosscheck.mismatches)} mismatches.</span></p></div>
                  </div>
                  {c.simulations.map((sim, i) => (
                    <div key={i}><h3 className="flex items-start gap-2 font-sans text-sm font-semibold tracking-normal"><Tick ok={sim.passed} />Layer 3 · {sim.title}</h3><p className="mt-1 text-muted">{sim.detail}</p>
                      <div className="scroll-x mt-2"><table className="tbl"><thead><tr><th>Check</th><th className="text-right">Formula says</th><th className="text-right">Simulation shows</th><th /></tr></thead><tbody>{sim.rows.map((r, j) => <tr key={j}><td>{r.label}</td><td className="num text-right">{r.kind === 'info' ? '' : g(r.predicted)}</td><td className="num text-right">{g(r.simulated)}</td><td className="w-8 text-right">{r.kind === 'info' ? null : <Tick ok={r.ok} />}</td></tr>)}</tbody></table></div></div>))}
                  <div><h3 className="font-sans text-sm font-semibold tracking-normal">Property and edge-case tests</h3><ul className="mt-2 grid gap-x-6 gap-y-1 text-muted sm:grid-cols-2">{c.properties.titles.map((t, i) => <li key={i} className="flex gap-2"><Tick ok={i < c.properties.passed} />{t}</li>)}</ul></div>
                  {byId[c.id] && <p className="flex flex-wrap gap-3"><Link href={`/business/${c.id}`} className="btn btn-sm">Open in Business mode</Link><Link href={`/learn/${c.id}`} className="btn btn-sm">Open in Learner mode</Link></p>}
                </div>
              </details>))}
          </div>
        </section>); })}
    </div>
  );
}
