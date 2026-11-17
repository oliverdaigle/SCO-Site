"""Runs all three verification layers plus property tests and writes verification/report.json and VERIFICATION-REPORT.md.

Usage: npm run verify   (or: python3 verification/run_all.py [cases_per_calculator])
"""
import datetime, json, os, platform, subprocess, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); CACHE = os.path.join(HERE, '.cache')
sys.path.insert(0, HERE)
N = int(sys.argv[1]) if len(sys.argv) > 1 else 2000

def sh(cmd, **kw):
    print('$', ' '.join(cmd), flush=True)
    return subprocess.run(cmd, cwd=ROOT, text=True, **kw)

def main():
    os.makedirs(CACHE, exist_ok=True); t0 = time.time()
    # Layer 1 + property tests (Vitest)
    vt = os.path.join(CACHE, 'vitest.json')
    sh(['npx', 'vitest', 'run', 'packages/engine', '--reporter=json', '--outputFile=' + vt], capture_output=True)
    tests = [a for f in json.load(open(vt))['testResults'] for a in f['assertionResults']]
    # Layer 2
    r = sh(['npx', 'tsx', 'scripts/xcheck-export.ts', str(N)], capture_output=True)
    if r.returncode: print(r.stderr); sys.exit(1)
    import crosscheck, simulate
    xc = crosscheck.run()
    # Layer 3
    sims = simulate.run()
    schema = json.load(open(os.path.join(CACHE, 'xcheck', '_schema.json')))
    # Plan Builder Excel export, recalculated in LibreOffice with every cached result removed
    import shutil, tempfile, xlsx_libreoffice
    excel = None
    if shutil.which('soffice'):
        work = tempfile.mkdtemp(prefix='lotwise-xlsx-'); rows = []
        for sample in xlsx_libreoffice.SAMPLES:
            n, bad = xlsx_libreoffice.check(sample, work); rows.append(dict(sample=sample, cells=n, passed=not bad, problems=bad))
            print(f"{'PASS' if not bad else 'FAIL'}  Excel export ({sample}): {n} formula cells recalculated by LibreOffice", flush=True)
        shutil.rmtree(work, ignore_errors=True)
        ver = subprocess.run(['soffice', '--version'], capture_output=True, text=True).stdout.split()
        excel = dict(tool='LibreOffice ' + (ver[1] if len(ver) > 1 else ''), cells=sum(r['cells'] for r in rows), passed=all(r['passed'] for r in rows), samples=rows)

    calcs = []
    for s in schema:
        cid = s['id']
        ex = [t for t in tests if t['ancestorTitles'][:1] == ['Layer 1: textbook-style worked examples'] and t['ancestorTitles'][1:2] == [cid] and not t['title'].startswith('has at least')]
        pr = [t for t in tests if t['ancestorTitles'][:1] and t['ancestorTitles'][0].startswith('Properties') and t['ancestorTitles'][1:2] == [cid]]
        x = xc[cid]
        sm = [dict(title=q['title'], detail=q['detail'], n=q['n'], passed=q['passed'], rows=[dict(label=w['label'], predicted=w['predicted'], simulated=w['simulated'], ok=w['ok'], kind=w['kind']) for w in q['rows']], shared=q['calcs']) for q in sims if cid in q['calcs']]
        layers = dict(
            examples=dict(n=len(ex), passed=sum(t['status'] == 'passed' for t in ex), titles=[t['title'] for t in ex]),
            crosscheck=dict(cases=x['cases'], comparisons=x['comparisons'], mismatches=x['mismatches'], tolerance=x.get('tolerance'), outputs=len(x.get('outputsCompared', [])), passed=x['passed']),
            properties=dict(n=len(pr), passed=sum(t['status'] == 'passed' for t in pr), titles=[t['title'] for t in pr]),
            simulations=sm)
        ok = layers['examples']['n'] >= 2 and layers['examples']['passed'] == layers['examples']['n'] and x['passed'] and layers['properties']['passed'] == layers['properties']['n'] and all(q['passed'] for q in sm) and (bool(sm) or not s['claim'])
        calcs.append(dict(id=cid, name=s['name'], cat=s['cat'], claim=s['claim'], passed=bool(ok), **layers))
    other = [t for t in tests if not (t['ancestorTitles'][:1] == ['Layer 1: textbook-style worked examples'] or (t['ancestorTitles'][:1] and t['ancestorTitles'][0].startswith('Properties') and len(t['ancestorTitles']) > 1 and any(c['id'] == t['ancestorTitles'][1] for c in calcs)))]
    import numpy, scipy, statsmodels
    report = dict(
        generated=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'),
        environment=dict(python=platform.python_version(), numpy=numpy.__version__, scipy=scipy.__version__, statsmodels=statsmodels.__version__, node=subprocess.run(['node', '-v'], capture_output=True, text=True).stdout.strip()),
        summary=dict(calculators=len(calcs), passed=sum(c['passed'] for c in calcs), examples=sum(c['examples']['n'] for c in calcs), examplesPassed=sum(c['examples']['passed'] for c in calcs),
                     crossCases=sum(c['crosscheck']['cases'] for c in calcs), crossComparisons=sum(c['crosscheck']['comparisons'] for c in calcs), crossMismatches=sum(c['crosscheck']['mismatches'] for c in calcs),
                     properties=sum(c['properties']['n'] for c in calcs), propertiesPassed=sum(c['properties']['passed'] for c in calcs), otherTests=len(other), otherTestsPassed=sum(t['status'] == 'passed' for t in other),
                     simulations=len(sims), simulationsPassed=sum(q['passed'] for q in sims), simulatedTrials=sum(q['n'] for q in sims), withSimulation=sum(1 for c in calcs if c['simulations']), totalTests=len(tests), totalTestsPassed=sum(t['status'] == 'passed' for t in tests)),
        calculators=calcs, excel=excel)
    json.dump(report, open(os.path.join(HERE, 'report.json'), 'w'), indent=1, default=lambda o: o.item() if hasattr(o, 'item') else str(o))
    # Small summary the app bundles for the Verified badge on every calculator page.
    slim = {'generated': report['generated'], 'summary': report['summary'], 'calcs': {c['id']: {'x': c['crosscheck']['cases'], 'e': c['examples']['n'], 'p': c['properties']['n'], 's': len(c['simulations']), 'ok': bool(c['passed'])} for c in report['calculators']}}
    os.makedirs(os.path.join(ROOT, 'src', 'data'), exist_ok=True)
    json.dump(slim, open(os.path.join(ROOT, 'src', 'data', 'verified-summary.json'), 'w'), separators=(',', ':'), default=lambda o: o.item() if hasattr(o, 'item') else str(o))
    write_md(report)
    s = report['summary']
    print(f"\n{s['passed']}/{s['calculators']} calculators verified | examples {s['examplesPassed']}/{s['examples']} | cross-check {s['crossCases']:,} cases, {s['crossMismatches']} mismatches | properties {s['propertiesPassed']}/{s['properties']} | simulations {s['simulationsPassed']}/{s['simulations']} ({s['simulatedTrials']:,} trials) | {time.time() - t0:.0f}s")
    if excel: print(f"Excel export: {excel['cells']:,} formula cells recalculated in {excel['tool']}, {'all match' if excel['passed'] else 'MISMATCHES'}")
    sys.exit(0 if s['passed'] == s['calculators'] and s['totalTestsPassed'] == s['totalTests'] and (not excel or excel['passed']) else 1)

def write_md(rep):
    s = rep['summary']; L = []
    L += ['# Lotwise Verification Report', '', f"Generated {rep['generated']} by `npm run verify`. This file and the public Verified page are built from the same test run (`verification/report.json`).", '',
          '## Result', '', f"**{s['passed']} of {s['calculators']} calculators pass every verification layer.**", '',
          '| Layer | What it checks | Result |', '|---|---|---|',
          f"| 1. Worked examples | Textbook-style problems with known answers, matched to the stated precision | {s['examplesPassed']} of {s['examples']} pass |",
          f"| 2. Independent reference | A separate Python implementation (numpy, scipy, statsmodels) run on randomized inputs | {s['crossCases']:,} cases, {s['crossComparisons']:,} values compared, {s['crossMismatches']} mismatches |",
          f"| 3. Simulation proof | Monte Carlo, discrete-event simulation, and brute-force search for every calculator that makes a real-world claim | {s['simulationsPassed']} of {s['simulations']} suites pass, {s['simulatedTrials']:,} simulated trials, covering {s['withSimulation']} calculators |",
          f"| Property tests | Monotonicity, limits, identities, edge cases, malformed input | {s['propertiesPassed']} of {s['properties']} pass |",
          f"| Catalog tests | Search, wizards reach every calculator, practice problems, problem parser | {s['otherTestsPassed']} of {s['otherTests']} pass |", '',
          '## How to read this', '',
          '- **Layer 1** uses the stated precision of each expected answer: 16.5 must match to one decimal, 200 must match exactly.',
          '- **Layer 2** tolerance is 1e-9 relative. Two calculators that pass through an iterative solver use a slightly wider tolerance (fill rate 1e-7, crashing 1e-6). Inputs include randomized time units and every mode switch, so unit conversion and conventions are compared too.',
          '- **Layer 3** never uses the formula under test. Where a formula is itself an approximation (Kingman, PERT completion probability, combined safety stock), the tolerance is stated and the actual gap is shown.',
          '- Calculators that are definitions or accounting identities (for example inventory turnover or DSO) have no simulation because there is nothing random to simulate. They are verified by layers 1 and 2 and by property tests.', '',
          f"Environment: Python {rep['environment']['python']}, numpy {rep['environment']['numpy']}, scipy {rep['environment']['scipy']}, statsmodels {rep['environment']['statsmodels']}, Node {rep['environment']['node']}.", '',
          '## Summary by calculator', '', '| Calculator | Examples | Cross-check cases | Values compared | Property tests | Simulation | Status |', '|---|---|---|---|---|---|---|']
    for c in rep['calculators']:
        sim = 'pass' if c['simulations'] and all(q['passed'] for q in c['simulations']) else ('FAIL' if c['simulations'] else 'n/a')
        L.append(f"| {c['name']} | {c['examples']['passed']}/{c['examples']['n']} | {c['crosscheck']['cases']:,} | {c['crosscheck']['comparisons']:,} | {c['properties']['passed']}/{c['properties']['n']} | {sim} | {'Verified' if c['passed'] else 'FAILED'} |")
    if rep.get('excel'):
        e = rep['excel']
        L += ['', '## Plan Builder Excel export', '', f"The Plan Builder exports a workbook in which every calculated number is a formula. For each sample dataset the file is written exactly as the app writes it, every cached result is deleted, and {e['tool']} recalculates the workbook from the raw sales history. Every formula cell is compared with the number the app shows.", '',
              '| Sample dataset | Formula cells | Result |', '|---|---|---|'] + [f"| {r['sample']} | {r['cells']:,} | {'all match' if r['passed'] else 'MISMATCH'} |" for r in e['samples']]
    L += ['', '## Simulation results', '']
    seen = set()
    for c in rep['calculators']:
        for q in c['simulations']:
            if q['title'] in seen: continue
            seen.add(q['title'])
            L += [f"### {q['title']}", '', f"Calculators: {', '.join(q['shared'])}. Trials: {q['n']:,}. Result: {'pass' if q['passed'] else 'FAIL'}.", '', q['detail'], '', '| Check | Predicted | Simulated | OK |', '|---|---|---|---|']
            for w in q['rows']: L.append(f"| {w['label'].strip()} | {w['predicted']:.6g} | {w['simulated']:.6g} | {'yes' if w['ok'] else 'NO'} |")
            L.append('')
    open(os.path.join(ROOT, 'VERIFICATION-REPORT.md'), 'w').write('\n'.join(L) + '\n')

if __name__ == '__main__':
    main()
