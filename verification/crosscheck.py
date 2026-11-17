"""Layer 2: compare the TypeScript engine against the independent Python reference on randomized inputs."""
import json, math, os, sys, time
from reference import REF, normalize

CACHE = os.path.join(os.path.dirname(__file__), '.cache', 'xcheck')
REL, ABS = 1e-9, 1e-9
# Calculators whose results pass through an iterative solver or an LP get a slightly wider (still tight) tolerance.
TOL = {'fill-rate': 1e-7, 'crashing': 1e-6}

def num(x):
    if x == 'inf': return math.inf
    if x == '-inf': return -math.inf
    if x == 'nan': return math.nan
    return x

def compare(a, b, rel, path, diffs):
    """Recursively compare engine value a with reference value b. Returns the number of scalar comparisons."""
    a, b = num(a), num(b)
    if isinstance(b, (list, tuple)):
        if not isinstance(a, list) or len(a) != len(b): diffs.append((path, a, b, 'shape')); return 1
        return sum(compare(x, y, rel, f'{path}[{i}]', diffs) for i, (x, y) in enumerate(zip(a, b)))
    if isinstance(b, bool): b = int(b)
    if isinstance(b, (int, float)):
        if not isinstance(a, (int, float)): diffs.append((path, a, b, 'type')); return 1
        if math.isnan(b) and math.isnan(a): return 1
        if math.isinf(b) or math.isinf(a):
            if a != b: diffs.append((path, a, b, 'inf'))
            return 1
        if not math.isclose(a, b, rel_tol=rel, abs_tol=max(ABS, rel * 1e-3)): diffs.append((path, a, b, abs(a - b) / max(abs(b), 1e-300)))
        return 1
    return 0

def run():
    schema = {s['id']: s for s in json.load(open(os.path.join(CACHE, '_schema.json')))}
    results = {}
    for cid, sch in schema.items():
        fn = REF.get(cid)
        if fn is None: results[cid] = dict(cases=0, comparisons=0, mismatches=1, maxRelErr=None, passed=False, note='no reference implementation'); continue
        cases = json.load(open(os.path.join(CACHE, cid + '.json')))
        rel = TOL.get(cid, REL)
        ncmp, bad, worst, examples, covered = 0, 0, 0.0, [], set()
        for case in cases:
            try: ref_out = fn(normalize(sch, case['v']))
            except Exception as e:
                bad += 1
                if len(examples) < 3: examples.append(dict(input=case['v'], error=repr(e)))
                continue
            diffs = []
            for k, rv in ref_out.items():
                if k not in case['o']: continue
                covered.add(k)
                ncmp += compare(case['o'][k], rv, rel, k, diffs)
            if diffs:
                bad += 1
                for d in diffs:
                    if isinstance(d[3], float): worst = max(worst, d[3])
                if len(examples) < 3: examples.append(dict(input=case['v'], diffs=[dict(key=d[0], engine=d[1], reference=d[2], err=d[3]) for d in diffs[:4]]))
        missing = [p for p in sch['primary'] if p not in covered]
        results[cid] = dict(cases=len(cases), comparisons=ncmp, mismatches=bad, tolerance=rel, outputsCompared=sorted(covered), passed=bad == 0 and not missing and len(cases) > 0, examples=examples, missingPrimary=missing)
    return results

if __name__ == '__main__':
    t0 = time.time(); res = run()
    json.dump(res, open(os.path.join(CACHE, '..', 'crosscheck.json'), 'w'))
    bad = {k: v for k, v in res.items() if not v['passed']}
    print(f"cross-check: {sum(v['cases'] for v in res.values()):,} cases, {sum(v['comparisons'] for v in res.values()):,} value comparisons, {len(res) - len(bad)}/{len(res)} calculators agree ({time.time() - t0:.1f}s)")
    for k, v in bad.items():
        print('  FAIL', k, 'mismatched cases:', v['mismatches'], 'missing primary:', v.get('missingPrimary'), v.get('note', ''))
        for ex in v.get('examples', [])[:2]: print('     ', json.dumps(ex)[:700])
    sys.exit(1 if bad else 0)
