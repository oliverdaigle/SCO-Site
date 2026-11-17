"""Layer 3: simulation proofs. Every calculator that makes a real-world claim is tested against a simulation
or a brute-force search that does not use the formula being tested. Engine results come from the TypeScript engine."""
import json, math, os, subprocess, sys, time, itertools
from functools import lru_cache
import numpy as np
from scipy import stats, optimize, integrate

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RNG = np.random.default_rng(20261117)
SIMS = []

def engine(reqs):
    """Call the TypeScript engine. reqs: list of (calc_id, inputs). Returns list of output dicts."""
    p = subprocess.run(['npx', 'tsx', 'scripts/engine-run.ts'], input=json.dumps([dict(id=i, v=v) for i, v in reqs]), capture_output=True, text=True, cwd=ROOT)
    if p.returncode != 0: raise RuntimeError(p.stderr[-2000:])
    out = json.loads(p.stdout)
    for (cid, v), r in zip(reqs, out):
        if not r['ok']: raise RuntimeError(f'engine rejected {cid} {v}: {r["errors"]}')
    return [r['o'] for r in out]

def sim(calcs, title):
    def deco(fn):
        SIMS.append((calcs, title, fn)); return fn
    return deco

def row(label, predicted, simulated, tol, kind='abs'):
    d = abs(predicted - simulated)
    ok = d <= tol if kind == 'abs' else d <= tol * max(abs(predicted), 1e-12)
    return dict(label=label, predicted=float(predicted), simulated=float(simulated), diff=float(d if kind == 'abs' else d / max(abs(predicted), 1e-12)), tol=tol, kind=kind, ok=bool(ok))

# ---------------------------------------------------------------- order quantity: brute-force searches
def _rand_inv(n):
    return [dict(D=float(RNG.integers(5, 400) * 50), S=float(RNG.integers(1, 60) * 5), H=float(RNG.integers(1, 80) * 0.25)) for _ in range(n)]

@sim(['eoq'], 'Brute-force search: no order quantity has a lower total cost than the EOQ')
def s_eoq():
    cases = _rand_inv(250); outs = engine([('eoq', c) for c in cases]); worst, bad = 0.0, 0
    for c, o in zip(cases, outs):
        q = np.arange(1, max(10, int(o['Q'] * 4)) + 1, dtype=float)
        cost = c['D'] / q * c['S'] + q / 2 * c['H']
        gmin = cost.min(); qbest = q[cost.argmin()]
        if o['TC'] > gmin + 1e-9 or abs(qbest - o['Q']) > 1.0: bad += 1
        worst = max(worst, (gmin - o['TC']) / o['TC'])
    return dict(n=250, detail='250 random demand, ordering-cost and holding-cost combinations. Total cost was evaluated at every whole-unit order quantity up to four times the EOQ.', rows=[dict(label='Cases where some grid quantity beat the EOQ cost, or the cheapest grid quantity was more than 1 unit from the EOQ', predicted=0, simulated=bad, diff=bad, tol=0, kind='count', ok=bad == 0), dict(label='Largest gap between best whole-unit cost and EOQ cost (relative)', predicted=0, simulated=worst, diff=worst, tol=1e-3, kind='abs', ok=worst <= 1e-3)])

@sim(['epq'], 'Brute-force search: no batch size has a lower cost than the production order quantity')
def s_epq():
    cases = [dict(c, P=c['D'] * float(RNG.uniform(1.2, 6))) for c in _rand_inv(250)]; outs = engine([('epq', c) for c in cases]); bad, worst = 0, 0.0
    for c, o in zip(cases, outs):
        q = np.arange(1, max(10, int(o['Q'] * 4)) + 1, dtype=float); k = 1 - c['D'] / c['P']
        cost = c['D'] / q * c['S'] + q * k / 2 * c['H']
        if o['TC'] > cost.min() + 1e-9 or abs(q[cost.argmin()] - o['Q']) > 1.0: bad += 1
        worst = max(worst, (cost.min() - o['TC']) / o['TC'])
    return dict(n=250, detail='250 random cases. Setup plus holding cost was evaluated at every whole-unit batch size up to four times the answer.', rows=[dict(label='Cases where a grid batch size beat the answer', predicted=0, simulated=bad, diff=bad, tol=0, kind='count', ok=bad == 0), dict(label='Largest relative gap to the best whole-unit cost', predicted=0, simulated=worst, diff=worst, tol=1e-3, kind='abs', ok=worst <= 1e-3)])

@sim(['quantity-discount'], 'Brute-force search over the whole price schedule')
def s_qd():
    cases = []
    for _ in range(200):
        p = float(RNG.integers(4, 160) * 0.5); b1 = int(RNG.choice([100, 250, 500, 1000, 2000])); n = int(RNG.integers(1, 4))
        br = [dict(min=0, price=p)] + [dict(min=b1 * i, price=round(p * (1 - 0.02 * i - float(RNG.uniform(0, 0.02))), 3)) for i in range(1, n + 1)]
        cases.append(dict(D=float(RNG.integers(5, 200) * 100), S=float(RNG.integers(5, 300)), I=float(RNG.integers(5, 40)), breaks=br))
    outs = engine([('quantity-discount', c) for c in cases]); bad, worst = 0, 0.0
    for c, o in zip(cases, outs):
        mins = np.array([b['min'] for b in c['breaks']], dtype=float); prices = np.array([b['price'] for b in c['breaks']], dtype=float)
        qmax = max(mins.max() * 1.5, o['Q'] * 3, 50)
        q = np.unique(np.concatenate([np.arange(1, qmax, 0.5), mins[mins > 0]]))
        pr = prices[np.searchsorted(mins, q, side='right') - 1]
        cost = c['D'] * pr + c['D'] / q * c['S'] + q / 2 * (c['I'] / 100) * pr
        if o['TC'] > cost.min() + 1e-6: bad += 1
        worst = max(worst, (cost.min() - o['TC']) / o['TC'])
    return dict(n=200, detail='200 random price schedules with 2 to 4 tiers. Total annual cost (purchase + ordering + holding) was evaluated on a half-unit grid plus every break quantity.', rows=[dict(label='Cases where a grid quantity was cheaper than the answer', predicted=0, simulated=bad, diff=bad, tol=0, kind='count', ok=bad == 0), dict(label='Largest relative gap to the best grid cost', predicted=0, simulated=worst, diff=worst, tol=1e-4, kind='abs', ok=worst <= 1e-4)])

@sim(['backorder-eoq'], 'Numerical optimisation over order size and backorder level')
def s_bo():
    cases = [dict(c, B=float(RNG.integers(1, 120) * 0.5)) for c in _rand_inv(150)]; outs = engine([('backorder-eoq', c) for c in cases]); bad, worst = 0, 0.0
    for c, o in zip(cases, outs):
        f = lambda x: c['D'] / x[0] * c['S'] + (x[0] - x[1]) ** 2 / (2 * x[0]) * c['H'] + x[1] ** 2 / (2 * x[0]) * c['B'] if x[0] > 0 and 0 <= x[1] <= x[0] else 1e18
        best = min((optimize.minimize(f, x0, method='Nelder-Mead', options=dict(xatol=1e-7, fatol=1e-10, maxiter=4000)).fun for x0 in ([o['Q'] * 0.5, 0.0], [o['Q'] * 1.7, o['Q'] * 0.5], [50.0, 5.0])))
        gap = (best - o['TC']) / o['TC']; worst = max(worst, abs(gap))
        if gap < -1e-7 or gap > 1e-5: bad += 1
    return dict(n=150, detail='150 random cases. A derivative-free optimiser (Nelder-Mead, three starting points) minimised ordering + holding + backorder cost over both the order quantity and the maximum backorder level.', rows=[dict(label='Cases where the optimiser found a cheaper policy', predicted=0, simulated=bad, diff=bad, tol=0, kind='count', ok=bad == 0), dict(label='Largest relative difference between optimiser cost and formula cost', predicted=0, simulated=worst, diff=worst, tol=1e-5, kind='abs', ok=worst <= 1e-5)])

# ---------------------------------------------------------------- service level simulations
N_CYC = 100_000
def _ss_cases():
    return [dict(d=100, sd=20, L=4, SL=95), dict(d=15, sd=5, L=2, SL=90), dict(d=350, sd=90, L=9, SL=99), dict(d=40, sd=12, L=1, SL=85), dict(d=500, sd=60, L=16, SL=97.5), dict(d=75, sd=30, L=5, SL=92)]

@sim(['safety-stock-demand'], 'Simulated 100,000 order cycles per case: share of cycles with no stockout')
def s_ssd():
    cases = _ss_cases(); outs = engine([('safety-stock-demand', c) for c in cases]); rows = []
    for c, o in zip(cases, outs):
        dlt = RNG.normal(c['d'], c['sd'], size=(N_CYC, c['L'])).sum(axis=1)   # daily demands added up over the lead time
        rows.append(row(f"d={c['d']}, σ={c['sd']}, L={c['L']}, target {c['SL']}%", c['SL'], (dlt <= o['ROP']).mean() * 100, 0.5))
    return dict(n=N_CYC * len(cases), detail='Each cycle draws a separate normal demand for every day of the lead time and adds them up. A stockout occurs when lead-time demand exceeds the reorder point.', rows=rows)

@sim(['safety-stock-lead-time'], 'Simulated 100,000 order cycles per case with random lead times')
def s_ssl():
    cases = [dict(d=10, L=6, sL=3, SL=98), dict(d=50, L=14, sL=2, SL=95), dict(d=200, L=5, sL=1.5, SL=90), dict(d=30, L=20, sL=6, SL=99)]
    outs = engine([('safety-stock-lead-time', c) for c in cases]); rows = []
    for c, o in zip(cases, outs):
        dlt = c['d'] * RNG.normal(c['L'], c['sL'], N_CYC)
        rows.append(row(f"d={c['d']}, L={c['L']}, σLT={c['sL']}, target {c['SL']}%", c['SL'], (dlt <= o['ROP']).mean() * 100, 0.5))
    return dict(n=N_CYC * len(cases), detail='Demand per day is constant; each cycle draws a normally distributed lead time.', rows=rows)

@sim(['safety-stock-combined'], 'Simulated 100,000 order cycles per case with random demand and random lead time')
def s_ssc():
    cases = [dict(d=150, sd=16, L=5, sL=1, SL=95), dict(d=100, sd=30, L=10, sL=2, SL=90), dict(d=40, sd=10, L=20, sL=3, SL=97.5), dict(d=2500, sd=500, L=7, sL=1.5, SL=90)]
    outs = engine([('safety-stock-combined', c) for c in cases]); rows = []
    for c, o in zip(cases, outs):
        lt = np.clip(RNG.normal(c['L'], c['sL'], N_CYC), 0, None)
        dlt = RNG.normal(c['d'] * lt, c['sd'] * np.sqrt(lt))
        rows.append(row(f"d={c['d']}, σd={c['sd']}, L={c['L']}, σLT={c['sL']}, target {c['SL']}%", c['SL'], (dlt <= o['ROP']).mean() * 100, 1.5))
        rows.append(row('   standard deviation of lead-time demand', o['sigLT'], dlt.std(ddof=1), 0.01, 'rel'))
    return dict(n=N_CYC * len(cases), detail='Each cycle draws a lead time, then demand over that lead time. The formula for the standard deviation is exact; treating the total as normal is an approximation, so the service level is allowed 1.5 points of error.', rows=rows)

@sim(['cycle-service-level'], 'Simulated 100,000 cycles per case for a given reorder point')
def s_csl():
    cases = [dict(d=2500, sd=500, L=2, ROP=6000), dict(d=100, sd=20, L=4, ROP=460, d_u='day', sd_u='day', L_u='day'), dict(d=800, sd=300, L=3, ROP=2500), dict(d=60, sd=25, L=6, ROP=330)]
    outs = engine([('cycle-service-level', c) for c in cases]); rows = []
    for c, o in zip(cases, outs):
        dlt = RNG.normal(c['d'], c['sd'], size=(N_CYC, c['L'])).sum(axis=1)
        rows.append(row(f"d={c['d']}, σ={c['sd']}, L={c['L']}, ROP={c['ROP']}", o['CSL'], (dlt <= c['ROP']).mean() * 100, 0.5))
    return dict(n=N_CYC * len(cases), detail='Share of simulated cycles in which lead-time demand stayed at or below the reorder point.', rows=rows)

def _sq_system(d, sd, L, s, Q, days=60_000, K=24, seed=1):
    """Continuous-review (s, Q) inventory system simulated in small time steps with full backordering."""
    rng = np.random.default_rng(seed); steps = days * K; dem = rng.normal(d / K, sd / math.sqrt(K), steps)
    level, on_order, arrive_at = s + Q, 0.0, -1; lead = int(round(L * K)); cycles = stockouts = 0; short = 0.0; total = float(dem.sum())
    for t in range(steps):
        if t == arrive_at:
            cycles += 1
            if level < 0: stockouts += 1; short += -level
            level += on_order; on_order = 0.0; arrive_at = -1
        level -= dem[t]
        if on_order == 0.0 and level <= s: on_order = Q; arrive_at = t + lead
    return 1 - stockouts / cycles, 1 - short / total, cycles

@sim(['fill-rate', 'continuous-review'], 'Discrete-event simulation of an (s, Q) inventory system')
def s_fill():
    cases = [dict(d=100, sd=20, L=4, S=50, H=7.3, SL=95), dict(d=100, sd=30, L=9, S=120, H=5.0, SL=90), dict(d=40, sd=15, L=5, S=80, H=9.0, SL=85)]
    outs = engine([('continuous-review', c) for c in cases]); rows = []; n = 0
    fr = engine([('fill-rate', dict(d=c['d'], d_u='day', sd=c['sd'], sd_u='day', L=c['L'], L_u='day', ROP=o['s'], Q=o['Q'])) for c, o in zip(cases, outs)])
    for i, (c, o, f) in enumerate(zip(cases, outs, fr)):
        csl, fill, cyc = _sq_system(c['d'], c['sd'], c['L'], o['s'], o['Q'], seed=10 + i); n += cyc
        rows.append(row(f"d={c['d']}, σ={c['sd']}, L={c['L']}: cycle service level (%)", c['SL'], csl * 100, 1.5))
        rows.append(row('   fill rate (%), (s, Q) calculator', o['fillRate'], fill * 100, 0.4))
        rows.append(row('   fill rate (%), fill rate calculator', f['fillRate'], fill * 100, 0.4))
    # Expected shortage per cycle against the loss-function formula
    mc = [dict(d=2500, sd=500, L=2, ROP=6000, Q=10000), dict(d=100, d_u='day', sd=20, sd_u='day', L=4, L_u='day', ROP=460, Q=500), dict(d=300, sd=120, L=3, ROP=950, Q=1500)]
    for c, o in zip(mc, engine([('fill-rate', c) for c in mc])):
        dlt = RNG.normal(c['d'] * c['L'], c['sd'] * math.sqrt(c['L']), 2_000_000)
        rows.append(row(f"expected shortage per cycle, ROP={c['ROP']}", o['ESC'], np.maximum(dlt - c['ROP'], 0).mean(), 0.02, 'rel'))
    return dict(n=n, detail='A full inventory system (demand arriving in 24 slices per day, orders of Q placed when stock reaches s, backorders filled on arrival) was run for 60,000 days per case. Cycle service level is the share of cycles ending without a backorder; fill rate is one minus backordered units over total demand. Expected shortage per cycle was also checked against 2,000,000 Monte Carlo draws.', rows=rows)

@sim(['newsvendor'], 'Simulated 400,000 selling seasons: profit at the recommended quantity versus every alternative')
def s_nv():
    cases = [dict(price=1.25, cost=0.7, salvage=0.3, mu=120, sigma=15), dict(price=190, cost=110, salvage=90, mu=3192, sigma=1181), dict(price=40, cost=30, salvage=5, mu=500, sigma=150), dict(costMode='direct', Cu=8, Co=2, mu=1000, sigma=250)]
    outs = engine([('newsvendor', c) for c in cases]); rows = []
    for c, o in zip(cases, outs):
        dem = RNG.normal(c['mu'], c['sigma'], 400_000); cu, co = o['Cu'], o['Co']
        prof = lambda q: (cu * np.minimum(dem, q) - co * np.maximum(q - dem, 0)).mean()
        grid = np.linspace(c['mu'] - 3 * c['sigma'], c['mu'] + 3 * c['sigma'], 241); profits = np.array([prof(q) for q in grid]); at = prof(o['Q'])
        rows.append(row(f"μ={c['mu']}, σ={c['sigma']}, CR={o['CR']:.3f}: expected profit", o['profit'], at, 0.01, 'rel'))
        rows.append(row('   best profit on a 241-point grid minus profit at Q* (as a share of profit)', 0, max(0.0, (profits.max() - at) / abs(at)), 2e-4))
        rows.append(row('   quantity with the best simulated profit vs Q* (in σ)', 0, abs(grid[profits.argmax()] - o['Q']) / c['sigma'], 0.12))
        rows.append(row('   expected lost sales', o['lost'], np.maximum(dem - o['Q'], 0).mean(), 0.02, 'rel'))
        rows.append(row('   expected leftover', o['leftover'], np.maximum(o['Q'] - dem, 0).mean(), 0.02, 'rel'))
    return dict(n=400_000 * len(cases), detail='The same 400,000 simulated demands were used to score the recommended quantity and 241 alternatives spanning three standard deviations either side of the mean.', rows=rows)

@sim(['periodic-review'], 'Simulated 100,000 review cycles per case')
def s_pr():
    cases = [dict(d=10, sd=3, T=30, L=14, SL=98, onHand=150), dict(d=2500, d_u='week', sd=500, sd_u='week', T=4, T_u='week', L=2, L_u='week', SL=90, onHand=0), dict(d=60, sd=25, T=7, L=3, SL=95, onHand=100)]
    outs = engine([('periodic-review', c) for c in cases]); rows = []
    for c, o in zip(cases, outs):
        per = int(c['T'] + c['L'])
        dem = RNG.normal(c['d'], c['sd'], size=(N_CYC, per)).sum(axis=1)   # demand until the NEXT order can arrive
        rows.append(row(f"d={c['d']}, σ={c['sd']}, T={c['T']}, L={c['L']}, target {c['SL']}%", c['SL'], (dem <= o['OUL']).mean() * 100, 0.5))
    return dict(n=N_CYC * len(cases), detail='An order raises the inventory position to the order-up-to level. It must cover demand over one review period plus one lead time, simulated period by period.', rows=rows)

@sim(['risk-pooling'], 'Simulated correlated demand at several locations, 200,000 periods per case')
def s_pool():
    cases = [dict(n=4, sd=50, L=1, SL=95, rho=0), dict(n=9, sd=30, L=4, SL=97.5, rho=0.5), dict(n=16, sd=80, L=2, SL=90, rho=0.2), dict(n=3, sd=25, L=3, SL=99, rho=0.8)]
    outs = engine([('risk-pooling', c) for c in cases]); rows = []
    for c, o in zip(cases, outs):
        n = c['n']; cov = c['sd'] ** 2 * (np.full((n, n), c['rho']) + (1 - c['rho']) * np.eye(n))
        dem = sum(RNG.multivariate_normal(np.zeros(n), cov, 200_000) for _ in range(c['L']))     # deviations from mean over the lead time
        rows.append(row(f"n={n}, ρ={c['rho']}: pooled service level (%)", c['SL'], (dem.sum(axis=1) <= o['ssCen']).mean() * 100, 0.6))
        rows.append(row('   each separate location service level (%)', c['SL'], (dem[:, 0] <= o['each']).mean() * 100, 0.6))
    return dict(n=200_000 * len(cases), detail='Demand at the locations is drawn from a multivariate normal with the stated correlation. The pooled buffer and each separate buffer are tested for the share of lead times they cover.', rows=rows)

# ---------------------------------------------------------------- forecasting
@sim(['exponential-smoothing'], 'Brute force and statsmodels: the optimised α is the best on the grid, and fitted values match an independent library')
def s_alpha():
    from statsmodels.tsa.holtwinters import SimpleExpSmoothing
    series = [RNG.integers(50, 400, size=int(RNG.integers(8, 30))).astype(float).tolist() for _ in range(30)]
    reqs = [('exponential-smoothing', dict(data=s, init='given', f1=s[0] + 5, optimize=crit)) for s in series for crit in ('mad', 'mse')]
    outs = engine(reqs); bad = 0
    for (cid, v), o in zip(reqs, outs):
        a = np.array(v['data']); scores = []
        for k in range(1, 100):
            al = k / 100; f = v['f1']; errs = []
            for x in a: errs.append(x - f); f = f + al * (x - f)
            e = np.array(errs); scores.append(np.abs(e).mean() if v['optimize'] == 'mad' else (e ** 2).mean())
        if abs((int(np.argmin(scores)) + 1) / 100 - o['alphaUsed']) > 1e-9: bad += 1
    worst = 0.0
    fixed = [('exponential-smoothing', dict(data=s, init='given', f1=s[0], alpha=0.3, optimize='none')) for s in series]
    for (cid, v), o in zip(fixed, engine(fixed)):
        fit = SimpleExpSmoothing(np.array(v['data']), initialization_method='known', initial_level=v['f1']).fit(smoothing_level=0.3, optimized=False)
        worst = max(worst, float(np.abs(np.array(fit.fittedvalues) - np.array(o['fc'])).max()), abs(float(fit.forecast(1)[0]) - o['next']))
    return dict(n=60, detail='30 random demand histories. For each, MAD and MSE were recomputed in Python for all 99 values of α. Separately, forecasts with α = 0.3 were compared with statsmodels SimpleExpSmoothing.', rows=[dict(label='Histories where a different α had a lower error', predicted=0, simulated=bad, diff=bad, tol=0, kind='count', ok=bad == 0), dict(label='Largest difference from statsmodels fitted values', predicted=0, simulated=worst, diff=worst, tol=1e-8, kind='abs', ok=worst <= 1e-8)])

@sim(['holt', 'linear-regression'], 'Independent libraries: statsmodels Holt and OLS regression')
def s_holt():
    from statsmodels.tsa.holtwinters import Holt
    import statsmodels.api as sm
    series = [(np.arange(n) * RNG.uniform(-3, 8) + RNG.integers(60, 300) + RNG.normal(0, 12, n)).round(1).tolist() for n in RNG.integers(8, 30, size=25)]
    reqs = [('holt', dict(data=s, alpha=0.3, beta=0.2, init='given', f1=s[0], t1=1.5)) for s in series]
    worst_h = 0.0
    for (cid, v), o in zip(reqs, engine(reqs)):
        # statsmodels indexes the level one period later than Heizer: l0 + b0 is the first forecast.
        fit = Holt(np.array(v['data']), initialization_method='known', initial_level=v['f1'], initial_trend=v['t1']).fit(smoothing_level=0.3, smoothing_trend=0.2, optimized=False)
        worst_h = max(worst_h, float(np.abs(np.array(fit.fittedvalues) - np.array(o['fc'])).max()), abs(float(fit.forecast(1)[0]) - o['next']))
    reqs = [('linear-regression', dict(data=s, xs=[], xNew=0)) for s in series]; worst_r = 0.0
    for (cid, v), o in zip(reqs, engine(reqs)):
        y = np.array(v['data']); x = np.arange(1, len(y) + 1); m = sm.OLS(y, sm.add_constant(x)).fit()
        worst_r = max(worst_r, abs(m.params[0] - o['a']), abs(m.params[1] - o['b']), abs(m.rsquared - o['r2']), abs(math.sqrt(m.mse_resid) - o['syx']))
    return dict(n=50, detail='25 random trending histories. Holt forecasts were compared with statsmodels Holt (known initial level and trend, fixed α and β). Regression coefficients, r² and standard error were compared with statsmodels OLS.', rows=[dict(label='Largest difference from statsmodels Holt forecasts', predicted=0, simulated=worst_h, diff=worst_h, tol=1e-7, kind='abs', ok=worst_h <= 1e-7), dict(label='Largest difference from statsmodels OLS (a, b, r², Syx)', predicted=0, simulated=worst_r, diff=worst_r, tol=1e-7, kind='abs', ok=worst_r <= 1e-7)])

# ---------------------------------------------------------------- queues
def _lindley(inter, service):
    """Waiting times in a single-server FIFO queue (Lindley recursion, vectorised)."""
    x = service[:-1] - inter[1:]; c = np.concatenate([[0.0], np.cumsum(x)])
    return c - np.minimum.accumulate(np.minimum(c, 0.0))

def _time_avg_in_system(arr, dep, samples=300_000):
    t = RNG.uniform(arr[len(arr) // 20], arr[-1], samples)
    return (np.searchsorted(arr, t, side='right') - np.searchsorted(np.sort(dep), t, side='right')).mean()

@sim(['mm1', 'littles-law'], 'Simulated 3,000,000 customers per case through a single-server queue')
def s_mm1():
    cases = [dict(lam=2.0, mu=3.0), dict(lam=10.0, mu=12.0), dict(lam=5.0, mu=10.0)]; outs = engine([('mm1', {'lambda': c['lam'], 'mu': c['mu']}) for c in cases]); rows = []; N = 3_000_000
    for c, o in zip(cases, outs):
        inter = RNG.exponential(1 / c['lam'], N); svc = RNG.exponential(1 / c['mu'], N); w = _lindley(inter, svc)
        arr = np.cumsum(inter); dep = arr + w + svc; L = _time_avg_in_system(arr, dep); lam_hat = N / arr[-1]; W = (w + svc).mean()
        rows.append(row(f"λ={c['lam']}, μ={c['mu']}: average wait in line Wq", o['Wq'], w.mean(), 0.03, 'rel'))
        rows.append(row('   average number in system Ls (sampled at 300,000 random instants)', o['Ls'], L, 0.03, 'rel'))
        rows.append(row("   Little's Law: sampled number in system vs arrival rate × time in system", lam_hat * W, L, 0.02, 'rel'))
        rows.append(row('   probability the server is idle P0', o['P0'], 1 - svc.sum() / dep.max(), 0.01))
    return dict(n=N * len(cases), detail="Exponential interarrival and service times. Waiting times come from the Lindley recursion. The number in the system is measured independently by sampling random instants, which is what makes the Little's Law comparison a real test.", rows=rows)

@sim(['md1'], 'Simulated 3,000,000 customers per case with constant service time')
def s_md1():
    cases = [dict(lam=8.0, mu=12.0), dict(lam=10.0, mu=15.0), dict(lam=9.0, mu=10.0)]; outs = engine([('md1', {'lambda': c['lam'], 'mu': c['mu']}) for c in cases]); rows = []; N = 3_000_000
    for c, o in zip(cases, outs):
        inter = RNG.exponential(1 / c['lam'], N); svc = np.full(N, 1 / c['mu']); w = _lindley(inter, svc)
        rows.append(row(f"λ={c['lam']}, μ={c['mu']}: average wait in line Wq", o['Wq'], w.mean(), 0.03, 'rel'))
        rows.append(row('   average number in line Lq', o['Lq'], w.mean() * N / inter.sum(), 0.03, 'rel'))
    return dict(n=N * len(cases), detail='Exponential interarrival times, identical service time for every customer.', rows=rows)

def _ctmc(lam, mu, s, jumps=1_500_000, seed=3):
    """Simulate the M/M/s birth-death process directly. Returns time share in each state."""
    rng = np.random.default_rng(seed); u = rng.random(jumps); e = rng.exponential(1.0, jumps); n = 0; tin = {}
    for i in range(jumps):
        out = min(n, s) * mu; rate = lam + out; tin[n] = tin.get(n, 0.0) + e[i] / rate
        n = n + 1 if u[i] < lam / rate else n - 1
    tot = sum(tin.values()); return {k: v / tot for k, v in tin.items()}

@sim(['mms', 'queue-probabilities'], 'Simulated the multi-server queue as a Markov chain, 1,500,000 events per case')
def s_mms():
    cases = [dict(lam=2.0, mu=3.0, s=2, k=2, t=0.5), dict(lam=40.0, mu=15.0, s=3, k=5, t=0.1), dict(lam=18.0, mu=4.0, s=6, k=7, t=0.2), dict(lam=2.0, mu=3.0, s=1, k=3, t=0.5)]
    o1 = engine([('mms', {'lambda': c['lam'], 'mu': c['mu'], 's': c['s']}) for c in cases]); o2 = engine([('queue-probabilities', {'lambda': c['lam'], 'mu': c['mu'], 's': c['s'], 'k': c['k'], 't': c['t']}) for c in cases]); rows = []
    for i, (c, a, b) in enumerate(zip(cases, o1, o2)):
        p = _ctmc(c['lam'], c['mu'], c['s'], seed=30 + i); lq = sum(max(0, n - c['s']) * q for n, q in p.items())
        rows.append(row(f"λ={c['lam']}, μ={c['mu']}, s={c['s']}: average number in line Lq", a['Lq'], lq, 0.04, 'rel'))
        rows.append(row('   average wait in line Wq (= Lq / λ)', a['Wq'], lq / c['lam'], 0.04, 'rel'))
        rows.append(row('   probability a customer waits (all servers busy)', a['Pw'], sum(q for n, q in p.items() if n >= c['s']), 0.01))
        rows.append(row('   probability the system is empty P0', b['P0'], p.get(0, 0), 0.01))
        rows.append(row(f"   probability of exactly {c['k']} in system", b['Pk'], p.get(c['k'], 0), 0.008))
        rows.append(row(f"   probability of more than {c['k']} in system", b['PmoreK'], sum(q for n, q in p.items() if n > c['k']), 0.01))
    # waiting-time tail for M/M/1 by Lindley
    inter = RNG.exponential(0.5, 2_000_000); svc = RNG.exponential(1 / 3, 2_000_000); w = _lindley(inter, svc)
    rows.append(row('M/M/1 λ=2, μ=3: probability the wait exceeds 0.5', o2[3]['PwaitT'], (w > 0.5).mean(), 0.01))
    return dict(n=1_500_000 * len(cases), detail='The number in the system was simulated as a continuous-time Markov chain (arrivals at rate λ, departures at rate min(n, s)·μ). State probabilities are the share of simulated time spent in each state.', rows=rows)

def _ggm_wait(inter, svc, m):
    """Kiefer-Wolfowitz recursion: FIFO waiting times with m servers."""
    w = [0.0] * m; tot = 0.0; n = len(inter)
    for i in range(n):
        tot += w[0]; w[0] += svc[i]
        if i + 1 < n: a = inter[i + 1]; w = sorted(x - a if x > a else 0.0 for x in w)
    return tot / n

@sim(['kingman'], "Simulated general queues (gamma-distributed times) against Kingman's approximation")
def s_king():
    cases = [dict(a=5, p=4, m=1, cva=1, cvp=1), dict(a=10, p=9, m=1, cva=0.5, cvp=0.5), dict(a=10, p=8.5, m=1, cva=1.5, cvp=0.5), dict(a=10, p=8, m=1, cva=0.75, cvp=1.25), dict(a=35, p=120, m=4, cva=1, cvp=1), dict(a=4, p=10, m=3, cva=1.2, cvp=0.8)]
    outs = engine([('kingman', c) for c in cases]); rows = []; n_tot = 0
    for c, o in zip(cases, outs):
        N = 2_000_000 if c['m'] == 1 else 400_000; n_tot += N
        g = lambda mean, cv: np.full(N, float(mean)) if cv == 0 else RNG.gamma(1 / cv ** 2, mean * cv ** 2, N)
        inter, svc = g(c['a'], c['cva']), g(c['p'], c['cvp'])
        wq = _lindley(inter, svc).mean() if c['m'] == 1 else _ggm_wait(inter.tolist(), svc.tolist(), c['m'])
        exact = c['cva'] == 1 and c['cvp'] == 1 and c['m'] == 1
        rows.append(row(f"a={c['a']}, p={c['p']}, m={c['m']}, CVa={c['cva']}, CVp={c['cvp']} (u={o['u']:.2f}): wait in line", o['Wq'], wq, 0.03 if exact else 0.20, 'rel'))
    return dict(n=n_tot, detail="Interarrival and service times follow gamma distributions with the stated coefficients of variation. With both CVs equal to 1 and one server the formula is exact (3% tolerance). Otherwise it is an approximation, most accurate at high utilisation: results must be within 20% and the actual gap is shown.", rows=rows)

# ---------------------------------------------------------------- quality
@sim(['xbar-r-chart'], 'Control chart factors rebuilt from first principles, and false-alarm rate of an in-control process')
def s_xbar():
    sys.path.insert(0, os.path.dirname(__file__)); from reference import FACTORS
    eng = json.loads(subprocess.run(['npx', 'tsx', '-e', "import {CC} from './packages/engine/src'; console.log(JSON.stringify(CC))"], capture_output=True, text=True, cwd=ROOT).stdout)
    worst = dict(A2=0.0, D3=0.0, D4=0.0, d2=0.0); mism = 0
    for n in range(2, 26):
        F = stats.norm.cdf; d2 = float(integrate.quad(lambda x: 1 - F(x) ** n - (1 - F(x)) ** n, -10, 10, limit=400)[0])
        r = np.concatenate([np.ptp(RNG.standard_normal((500_000, n)), axis=1) for _ in range(6)]); d3 = r.std(ddof=1)
        A2, D3, D4 = 3 / (d2 * math.sqrt(n)), max(0.0, 1 - 3 * d3 / d2), 1 + 3 * d3 / d2
        t = eng[str(n)]
        for k, val, ti in (('A2', A2, 0), ('D3', D3, 1), ('D4', D4, 2), ('d2', d2, 3)): worst[k] = max(worst[k], abs(val - t[ti]))
        if tuple(t) != tuple(float(x) for x in FACTORS[n]): mism += 1
    rows = [row('largest gap, A2 table vs 3/(d2·√n)', 0, worst['A2'], 0.0015), row('largest gap, d2 table vs numerical integration', 0, worst['d2'], 0.0015), row('largest gap, D3 table vs simulated', 0, worst['D3'], 0.004), row('largest gap, D4 table vs simulated', 0, worst['D4'], 0.004), dict(label='rows where the engine table differs from the independently typed table', predicted=0, simulated=mism, diff=mism, tol=0, kind='count', ok=mism == 0)]
    for n in (4, 5, 8):
        obs = RNG.normal(50, 2, size=(400_000, n)); o = engine([('xbar-r-chart', dict(mode='summary', means=obs.mean(axis=1)[:2000].round(6).tolist(), ranges=np.ptp(obs, axis=1)[:2000].round(6).tolist(), n=n))])[0]
        m = obs.mean(axis=1); rows.append(row(f'n={n}: share of in-control sample means outside the limits (%)', 0.27, ((m > o['uclX']) | (m < o['lclX'])).mean() * 100, 0.09))
    return dict(n=3_000_000 * 24 + 1_200_000, detail='d2 comes from numerical integration of the range distribution and d3 from 3,000,000 simulated samples per subgroup size; A2, D3 and D4 follow from them and must match the built-in table to rounding. Then limits were computed from 2,000 in-control samples and applied to 400,000 fresh ones: about 0.27% should fall outside.', rows=rows)

@sim(['p-chart', 'c-chart'], 'Simulated stable attribute processes against exact binomial and Poisson tail probabilities')
def s_attr():
    rows = []
    for n, p in ((100, 0.04), (50, 0.05), (200, 0.1)):
        d = RNG.binomial(n, p, 1_000_000); o = engine([('p-chart', dict(defects=d[:400].tolist(), n=n, z=3))])[0]
        hi, lo = math.floor(o['ucl'] * n + 1e-9), math.ceil(o['lcl'] * n - 1e-9)
        exact = stats.binom.sf(hi, n, p) + (stats.binom.cdf(lo - 1, n, p) if o['lcl'] > 0 else 0)
        rows.append(row(f'p-chart n={n}, p={p}: share of samples outside the limits (%)', exact * 100, ((d / n > o['ucl'] + 1e-12) | (d / n < o['lcl'] - 1e-12)).mean() * 100, 0.06))
        rows.append(row('   centre line vs true defect rate', p, o['pbar'], 0.006))
    for lam in (6, 13, 25):
        c = RNG.poisson(lam, 1_000_000); o = engine([('c-chart', dict(counts=c[:400].tolist(), z=3))])[0]
        exact = stats.poisson.sf(math.floor(o['ucl'] + 1e-9), lam) + (stats.poisson.cdf(math.ceil(o['lcl'] - 1e-9) - 1, lam) if o['lcl'] > 0 else 0)
        rows.append(row(f'c-chart mean {lam}: share of periods outside the limits (%)', exact * 100, ((c > o['ucl'] + 1e-12) | (c < o['lcl'] - 1e-12)).mean() * 100, 0.06))
    return dict(n=6_000_000, detail='Limits were computed by the engine from the first 400 samples, then 1,000,000 simulated samples were classified. The share outside is compared with the exact binomial or Poisson probability for those limits.', rows=rows)

@sim(['process-capability', 'taguchi-loss'], 'Simulated 5,000,000 units of normal output per case')
def s_cap():
    rows = []; cases = [dict(usl=10.5, lsl=9.5, mean=10.2, sigma=0.15), dict(usl=103, lsl=97, mean=100, sigma=1), dict(usl=50, lsl=44, mean=46, sigma=1.1)]
    for c, o in zip(cases, engine([('process-capability', c) for c in cases])):
        x = RNG.normal(c['mean'], c['sigma'], 5_000_000)
        rows.append(row(f"Cpk={o['cpk']:.2f}: defects per million", o['ppm'], ((x > c['usl']) | (x < c['lsl'])).mean() * 1e6, 0.05, 'rel'))
    t = [dict(T=10, tol=0.5, C=20, x=10.2, mu=10.1, sigma=0.2), dict(T=50, tol=2, C=45, x=51, mu=50.6, sigma=1.3)]
    for c, o in zip(t, engine([('taguchi-loss', c) for c in t])):
        x = RNG.normal(c['mu'], c['sigma'], 5_000_000); k = c['C'] / c['tol'] ** 2
        rows.append(row(f"Taguchi expected loss per unit, μ={c['mu']}, σ={c['sigma']}", o['EL'], (k * (x - c['T']) ** 2).mean(), 0.005, 'rel'))
    return dict(n=25_000_000, detail='Normal output was generated and compared unit by unit with the specification limits (capability) or scored with the quadratic loss (Taguchi).', rows=rows)

# ---------------------------------------------------------------- process: line balancing
def _opt_stations(times, preds, cycle):
    n = len(times); full = (1 << n) - 1; pm = [sum(1 << p for p in ps) for ps in preds]
    best = {0: (1, 0.0)}
    for mask in range(full + 1):
        if mask not in best: continue
        st, load = best[mask]
        for t in range(n):
            if mask >> t & 1 or (pm[t] & mask) != pm[t]: continue
            cand = (st, load + times[t]) if load + times[t] <= cycle + 1e-9 else (st + 1, times[t])
            nm = mask | 1 << t
            if nm not in best or cand < best[nm]: best[nm] = cand
    return best[full][0]

@sim(['line-balancing'], 'Feasibility audit and exhaustive search for the true minimum number of stations')
def s_line():
    cases = []
    for _ in range(300):
        n = int(RNG.integers(4, 10)); tasks = []
        for i in range(n):
            ps = [f'T{j + 1}' for j in range(i) if RNG.random() < 1.4 / max(1, i)]
            tasks.append(dict(id=f'T{i + 1}', time=int(RNG.integers(1, 13)), preds=','.join(ps)))
        cyc = max(t['time'] for t in tasks) + int(RNG.integers(0, 10))
        cases.append(dict(tasks=tasks, avail=480, demand=480 / cyc))
    outs = engine([('line-balancing', c) for c in cases]); infeasible = below = optimal = 0; gap = 0
    for c, o in zip(cases, outs):
        ids = [t['id'] for t in c['tasks']]; times = [t['time'] for t in c['tasks']]; preds = [[ids.index(p) for p in t['preds'].split(',') if p] for t in c['tasks']]
        load = {}
        for i, s in enumerate(o['station']):
            load[s] = load.get(s, 0) + times[i]
            if any(o['station'][p] > s for p in preds[i]): infeasible += 1
        if any(v > o['cycle'] + 1e-9 for v in load.values()) or len(load) != o['N']: infeasible += 1
        best = _opt_stations(times, preds, o['cycle'])
        if o['N'] < best: below += 1
        if o['N'] == best: optimal += 1
        gap = max(gap, o['N'] - best)
    return dict(n=300, detail='300 random lines with 4 to 9 tasks. Every assignment was checked for precedence and cycle-time violations, and the true minimum number of stations was found by dynamic programming over all task subsets.', rows=[dict(label='assignments that break precedence or exceed the cycle time', predicted=0, simulated=infeasible, diff=infeasible, tol=0, kind='count', ok=infeasible == 0), dict(label='lines where the answer used fewer stations than the true minimum (impossible)', predicted=0, simulated=below, diff=below, tol=0, kind='count', ok=below == 0), dict(label='share of lines where the heuristic found the true minimum (%)', predicted=100, simulated=optimal / 3, diff=100 - optimal / 3, tol=15, kind='abs', ok=optimal / 3 >= 85), dict(label='largest excess over the true minimum (stations)', predicted=0, simulated=gap, diff=gap, tol=1, kind='abs', ok=gap <= 1)])

# ---------------------------------------------------------------- MRP and lot sizing
def _ww(need, S, h):
    """Wagner-Whitin optimal cost for net requirements (holding charged on end-of-period inventory)."""
    n = len(need); f = [0.0] + [math.inf] * n
    for j in range(1, n + 1):
        for i in range(1, j + 1):
            hold = sum(need[k - 1] * (k - i) for k in range(i, j + 1)) * h
            f[j] = min(f[j], f[i - 1] + (S if sum(need[i - 1:j]) > 0 else 0) + hold)
    return f[n]

@sim(['lot-for-lot', 'fixed-order-quantity', 'poq-lot-sizing', 'part-period-balancing', 'mrp-gross-to-net'], 'Inventory balance audit and comparison with the optimal (Wagner-Whitin) plan')
def s_lots():
    cases = [dict(gross=[int(x) if RNG.random() > 0.2 else 0 for x in RNG.integers(5, 120, size=int(RNG.integers(5, 13)))], onHand=0, S=float(RNG.integers(20, 300)), h=float(RNG.integers(1, 40) * 0.1)) for _ in range(200)]
    rules = ['lot-for-lot', 'fixed-order-quantity', 'poq-lot-sizing', 'part-period-balancing']; res = {r: engine([(r, c) for c in cases]) for r in rules}
    bad_bal = below = 0; gaps = {r: [] for r in rules}
    for i, c in enumerate(cases):
        opt = _ww(c['gross'], c['S'], c['h'])
        for r in rules:
            o = res[r][i]; inv = c['onHand']; held = 0.0; orders = 0
            for t, g in enumerate(c['gross']):
                inv += o['receipts'][t] - g; held += max(0, inv); orders += o['receipts'][t] > 1e-9
                if inv < -1e-9 or abs(inv - o['end'][t]) > 1e-6: bad_bal += 1
            if abs(orders * c['S'] + held * c['h'] - o['total']) > 1e-6: bad_bal += 1
            if o['total'] < opt - 1e-6: below += 1
            gaps[r].append(o['total'] / opt - 1 if opt > 0 else 0)
    mrp = [dict(gross=c['gross'], sched=[], onHand=int(RNG.integers(0, 80)), ss=int(RNG.integers(0, 25)), lead=int(RNG.integers(0, 4)), rule='l4l') for c in cases]
    viol = 0
    for c, o in zip(mrp, engine([('mrp-gross-to-net', c) for c in mrp])):
        inv = c['onHand']
        for t, g in enumerate(c['gross']):
            inv += o['receipts'][t] - g
            if o['receipts'][t] > 0 and inv < c['ss'] - 1e-9: viol += 1
        if abs(sum(o['rel']) + o['pastDue'] - sum(o['receipts'])) > 1e-9: viol += 1
    rows = [dict(label='periods where inventory went negative, or recomputed balance or cost differed', predicted=0, simulated=bad_bal, diff=bad_bal, tol=0, kind='count', ok=bad_bal == 0), dict(label='plans cheaper than the proven optimum (impossible)', predicted=0, simulated=below, diff=below, tol=0, kind='count', ok=below == 0), dict(label='MRP records that dipped below safety stock after an order, or lost units between receipt and release', predicted=0, simulated=viol, diff=viol, tol=0, kind='count', ok=viol == 0)]
    for r in rules: rows.append(dict(label=f'{r}: average cost above the optimal plan (%)', predicted=0, simulated=float(np.mean(gaps[r]) * 100), diff=float(np.mean(gaps[r]) * 100), tol=None, kind='info', ok=True))
    return dict(n=200 * 5, detail='200 random requirement schedules. Each plan was replayed period by period to recompute inventory and cost, and compared with the minimum-cost plan from Wagner-Whitin dynamic programming. The lot-sizing rules are heuristics, so their average gap to the optimum is reported for information.', rows=rows)

@sim(['aggregate-planning'], 'Period-by-period replay of each production plan')
def s_agg():
    cases = [dict(demand=[int(x) for x in RNG.integers(300, 2000, size=int(RNG.integers(4, 12)))], days=[], hrs=float(RNG.integers(5, 40) / 10), wage=float(RNG.integers(8, 30)), hire=float(RNG.integers(0, 400)), fire=float(RNG.integers(0, 600)), hold=float(RNG.integers(1, 12)), subCost=float(RNG.integers(15, 120)), back=0, begInv=0, roundRates='no') for _ in range(200)]
    bad = 0
    for c, o in zip(cases, engine([('aggregate-planning', c) for c in cases])):
        d = np.array(c['demand'], dtype=float); n = len(d)
        prod = np.full(n, d.mean()); inv = np.cumsum(prod - d); lvl = prod.sum() * c['hrs'] * c['wage'] + np.clip(inv, 0, None).sum() * c['hold']
        if abs(inv[-1]) > 1e-6 or (inv.min() >= -1e-9 and abs(lvl - o['level']) > 1e-6 * lvl): bad += 1
        ch = d.sum() * c['hrs'] * c['wage'] + np.clip(np.diff(d), 0, None).sum() * c['hire'] + np.clip(-np.diff(d), 0, None).sum() * c['fire']
        hy = d.min() * n * c['hrs'] * c['wage'] + (d - d.min()).sum() * c['subCost']
        if abs(ch - o['chase']) > 1e-6 * ch or abs(hy - o['hybrid']) > 1e-6 * hy: bad += 1
    return dict(n=200, detail='200 random demand plans. Each strategy was rebuilt independently with array arithmetic: level output with cumulative inventory, chase output with rate changes, and a base workforce at minimum demand with the remainder subcontracted. Every plan must meet total demand exactly.', rows=[dict(label='plans whose cost or ending inventory differed from the replay', predicted=0, simulated=bad, diff=bad, tol=0, kind='count', ok=bad == 0)])

# ---------------------------------------------------------------- logistics
@sim(['center-of-gravity'], 'Numerical minimisation of volume-weighted squared distance')
def s_cog():
    cases = [dict(points=[dict(name=f'P{i}', x=float(RNG.integers(0, 200)), y=float(RNG.integers(0, 200)), w=float(RNG.integers(1, 3000))) for i in range(int(RNG.integers(2, 10)))]) for _ in range(200)]
    worst = 0.0
    for c, o in zip(cases, engine([('center-of-gravity', c) for c in cases])):
        P = c['points']; f = lambda z: sum(p['w'] * ((p['x'] - z[0]) ** 2 + (p['y'] - z[1]) ** 2) for p in P)
        r = optimize.minimize(f, [100.0, 100.0], method='Nelder-Mead', options=dict(xatol=1e-9, fatol=1e-12, maxiter=5000))
        worst = max(worst, math.hypot(r.x[0] - o['cx'], r.x[1] - o['cy']))
    return dict(n=200, detail='200 random sets of 2 to 9 locations. A derivative-free optimiser searched for the point with the lowest volume-weighted sum of squared distances.', rows=[row('largest distance between the optimiser’s point and the center of gravity', 0, worst, 1e-3)])

# ---------------------------------------------------------------- projects
def _rand_net(n):
    return [dict(id=f'A{i + 1}', preds=','.join(f'A{j + 1}' for j in range(i) if RNG.random() < 1.5 / max(1, i))) for i in range(n)]
def _longest(acts, durs):
    ids = [a['id'] for a in acts]; preds = [[ids.index(p) for p in a['preds'].split(',') if p] for a in acts]; succ = [[j for j in range(len(ids)) if i in preds[j]] for i in range(len(ids))]
    best = 0.0; stack = [(i, durs[i]) for i in range(len(ids)) if not preds[i]]
    while stack:
        i, d = stack.pop(); best = max(best, d)
        for j in succ[i]: stack.append((j, d + durs[j]))
    return best

@sim(['cpm'], 'Exhaustive path enumeration on 300 random project networks')
def s_cpm():
    cases = [dict(acts=[dict(a, dur=int(RNG.integers(0, 20))) for a in _rand_net(int(RNG.integers(3, 12)))]) for _ in range(300)]; bad = 0
    for c, o in zip(cases, engine([('cpm', c) for c in cases])):
        if abs(_longest(c['acts'], [a['dur'] for a in c['acts']]) - o['duration']) > 1e-9: bad += 1
    return dict(n=300, detail='Every start-to-finish path was enumerated by depth-first search and the longest was compared with the reported project duration.', rows=[dict(label='networks where the longest path differed from the project duration', predicted=0, simulated=bad, diff=bad, tol=0, kind='count', ok=bad == 0)])

MILW = [dict(id='A', a=1, m=2, b=3, preds=''), dict(id='B', a=2, m=3, b=4, preds=''), dict(id='C', a=1, m=2, b=3, preds='A'), dict(id='D', a=2, m=4, b=6, preds='A,B'), dict(id='E', a=1, m=4, b=7, preds='C'), dict(id='F', a=1, m=2, b=9, preds='C'), dict(id='G', a=3, m=4, b=11, preds='D,E'), dict(id='H', a=1, m=2, b=3, preds='F,G')]
def _mc_network(acts, draws):
    ids = [a['id'] for a in acts]; ef = {}
    for i, a in enumerate(acts):
        start = np.zeros(draws.shape[0])
        for p in [x for x in a['preds'].split(',') if x]: start = np.maximum(start, ef[p])
        ef[a['id']] = start + draws[:, i]
    return np.max(np.stack(list(ef.values())), axis=0)

@sim(['pert', 'pert-probability'], 'Monte Carlo simulation of project completion time, 500,000 runs per case')
def s_pert():
    serial = [dict(id='A', a=2, m=4, b=6, preds=''), dict(id='B', a=3, m=6, b=15, preds='A'), dict(id='C', a=1, m=2, b=3, preds='B'), dict(id='D', a=4, m=5, b=12, preds='C')]
    rows = []; N = 500_000
    for name, acts in (('four activities in series', serial), ('eight-activity network with parallel paths', MILW)):
        o = engine([('pert', dict(acts=acts))])[0]; te = np.array(o['te']); sd = np.sqrt(np.array(o['vars']))
        T = _mc_network(acts, RNG.normal(te, sd, size=(N, len(acts))))
        if name.startswith('four'):
            rows.append(row(f'{name}: expected duration', o['T'], T.mean(), 0.005, 'rel')); rows.append(row('   project variance', o['variance'], T.var(), 0.02, 'rel'))
            # PERT-beta activity times: the mean formula is exact for this distribution
            beta = np.column_stack([a['a'] + (a['b'] - a['a']) * RNG.beta(1 + 4 * (a['m'] - a['a']) / (a['b'] - a['a']), 1 + 4 * (a['b'] - a['m']) / (a['b'] - a['a']), N) for a in acts])
            rows.append(row('   expected duration with beta-distributed activity times', o['T'], beta.sum(axis=1).mean(), 0.005, 'rel'))
        for dl in ((o['T'] + 0.6 * o['sd'], o['T'] + 1.5 * o['sd']) if name.startswith('four') else (16.0, 18.0)):
            p = engine([('pert-probability', dict(T=o['T'], variance=o['variance'], deadline=float(dl), target=95))])[0]
            rows.append(row(f'{name}: chance of finishing by {dl:.1f} (%)', p['prob'], (T <= dl).mean() * 100, 0.5 if name.startswith('four') else 8.0))
    return dict(n=N * 2, detail='Activity times were drawn with the PERT means and variances and pushed through the network. For a single path the normal approximation is exact (0.5-point tolerance). With parallel paths the textbook method looks only at the critical path, so it is slightly optimistic: the gap is shown and must stay within 8 points.', rows=rows)

@sim(['crashing'], 'Exhaustive enumeration of every crash plan on 80 small projects')
def s_crash():
    cases = []
    for _ in range(80):
        acts = []
        for a in _rand_net(int(RNG.integers(3, 7))):
            d = int(RNG.integers(2, 9)); cd = max(1, d - int(RNG.integers(0, 4))); nc = int(RNG.integers(1, 40)) * 100
            acts.append(dict(a, dur=d, crashDur=cd, normalCost=nc, crashCost=nc + (d - cd) * int(RNG.integers(1, 30)) * 50))
        normal = _longest(acts, [x['dur'] for x in acts]); fast = _longest(acts, [x['crashDur'] for x in acts])
        cases.append(dict(acts=acts, target=int(RNG.integers(int(fast), int(normal) + 1))))
    bad = 0
    for c, o in zip(cases, engine([('crashing', c) for c in cases])):
        A = c['acts']; best = math.inf
        for combo in itertools.product(*[range(a['dur'] - a['crashDur'] + 1) for a in A]):
            if _longest(A, [a['dur'] - y for a, y in zip(A, combo)]) <= c['target'] + 1e-9:
                best = min(best, sum(y * (a['crashCost'] - a['normalCost']) / (a['dur'] - a['crashDur']) for a, y in zip(A, combo) if y))
        if abs(best - o['crashCost']) > 1e-6 * max(1.0, best): bad += 1
    return dict(n=80, detail='80 random projects with 3 to 6 activities and whole-period crash limits. Every combination of crash amounts was tried, and the cheapest one that meets the target was compared with the linear-programming answer.', rows=[dict(label='projects where enumeration found a different minimum cost', predicted=0, simulated=bad, diff=bad, tol=0, kind='count', ok=bad == 0)])

# ---------------------------------------------------------------- decisions
@sim(['expected-value', 'evpi'], 'Simulated 1,000,000 repetitions of each decision')
def s_ev():
    cases = [dict(payoffs=[dict(alt='Large', s1=200000, s2=-180000, s3=0, s4=0), dict(alt='Small', s1=100000, s2=-20000, s3=0, s4=0), dict(alt='None', s1=0, s2=0, s3=0, s4=0)], nStates=2, probs=[0.5, 0.5]), dict(payoffs=[dict(alt='A', s1=50, s2=20, s3=-10, s4=0), dict(alt='B', s1=35, s2=25, s3=5, s4=0), dict(alt='C', s1=10, s2=10, s3=10, s4=0)], nStates=3, probs=[0.3, 0.5, 0.2]), dict(payoffs=[dict(alt='X', s1=90, s2=40, s3=10, s4=-60), dict(alt='Y', s1=60, s2=45, s3=30, s4=5), dict(alt='Z', s1=20, s2=20, s3=20, s4=20)], nStates=4, probs=[0.15, 0.35, 0.3, 0.2])]
    rows = []
    for c, o in zip(cases, engine([('expected-value', c) for c in cases])):
        m = np.array([[r['s1'], r['s2'], r['s3'], r['s4']][:c['nStates']] for r in c['payoffs']], dtype=float); st = RNG.choice(c['nStates'], 1_000_000, p=c['probs']); pay = m[:, st]
        scale = np.abs(m).max(); means = pay.mean(axis=1)
        rows.append(row(f"{c['nStates']} states: average payoff of the recommended alternative (share of largest payoff)", o['best'] / scale, means[o['bestIdx'] - 1] / scale, 0.004))
        rows.append(dict(label='   alternative with the best simulated average', predicted=o['bestIdx'], simulated=int(means.argmax()) + 1, diff=abs(int(means.argmax()) + 1 - o['bestIdx']), tol=0, kind='count', ok=int(means.argmax()) + 1 == o['bestIdx']))
        rows.append(row('   value of perfect information (share of largest payoff)', o['evpi'] / scale, (pay.max(axis=0).mean() - means.max()) / scale, 0.004))
    return dict(n=3_000_000, detail='The state of nature was drawn 1,000,000 times. Each alternative was scored by its average payoff; perfect information was scored by always taking the best payoff for the state that occurred.', rows=rows)

@sim(['decision-tree'], 'Simulated 1,000,000 passes through a two-stage decision tree')
def s_tree():
    leaf = lambda i, l, p, x: dict(id=i, type='end', label=l, prob=p, payoff=x)
    tree = dict(id='root', type='decision', label='Launch plan', children=[dict(id='B', type='chance', label='Build now', children=[leaf('B1', 'Strong', 0.6, 100), leaf('B2', 'Weak', 0.4, -40)]), dict(id='T', type='chance', label='Test first', cost=5, children=[dict(id='TP', type='decision', label='Positive', prob=0.7, children=[dict(id='TPB', type='chance', label='Build', children=[leaf('a', 'Strong', 0.8, 100), leaf('b', 'Weak', 0.2, -40)]), leaf('c', 'Stop', None, 0)]), dict(id='TN', type='decision', label='Negative', prob=0.3, children=[dict(id='TNB', type='chance', label='Build', children=[leaf('d', 'Strong', 0.2, 100), leaf('e', 'Weak', 0.8, -40)]), leaf('f', 'Stop', None, 0)])])])
    o = engine([('decision-tree', dict(tree=tree))])[0]; N = 1_000_000
    pos = RNG.random(N) < 0.7; strong = RNG.random(N) < np.where(pos, 0.8, 0.2)
    test_first = np.where(pos, np.where(strong, 100, -40), 0) - 5            # optimal policy: build only after a positive test
    build_now = np.where(RNG.random(N) < 0.6, 100, -40); always_build = np.where(strong, 100, -40) - 5
    return dict(n=N, detail='The recommended strategy (test first, build only after a positive result) was played 1,000,000 times, along with the two alternatives it beat.', rows=[row('average payoff of the recommended strategy', o['emv'], test_first.mean(), 0.15), row('   "build now" earns less', 44.0, build_now.mean(), 0.15), row('   "test, then build regardless" earns less', 41.8, always_build.mean(), 0.15), dict(label='   recommended first move is the best simulated one', predicted=o['bestIdx'], simulated=2 if test_first.mean() > build_now.mean() else 1, diff=0, tol=0, kind='count', ok=o['bestIdx'] == 2 and test_first.mean() > build_now.mean())])

def run(only=None):
    results = []
    for calcs, title, fn in SIMS:
        if only and not any(c in only for c in calcs): continue
        t0 = time.time()
        try:
            r = fn(); r.update(calcs=calcs, title=title, seconds=round(time.time() - t0, 1), passed=all(x['ok'] for x in r['rows']))
        except Exception as e:
            import traceback; r = dict(calcs=calcs, title=title, n=0, detail='', rows=[], passed=False, error=traceback.format_exc()[-1500:], seconds=round(time.time() - t0, 1))
        results.append(r)
        print(('PASS' if r['passed'] else 'FAIL'), f"{r['seconds']:6.1f}s", ', '.join(calcs), '-', title, flush=True)
        if not r['passed']:
            if r.get('error'): print(r['error'])
            for x in r['rows']:
                if not x['ok']: print('      ', x['label'], 'predicted', x['predicted'], 'simulated', x['simulated'], 'tol', x['tol'])
    return results

if __name__ == '__main__':
    only = set(sys.argv[1:]) or None
    res = run(only)
    if not only: json.dump(res, open(os.path.join(os.path.dirname(__file__), '.cache', 'simulations.json'), 'w'), default=lambda o: o.item() if hasattr(o, 'item') else str(o))
    print(f"simulations: {sum(r['passed'] for r in res)}/{len(res)} passed, {sum(r['n'] for r in res):,} simulated trials")
    sys.exit(0 if all(r['passed'] for r in res) else 1)
