"""Independent reference implementation of every Lotwise calculator.

Written separately from the TypeScript engine, straight from the textbook formulas, using
numpy / scipy for statistics and optimisation. `REF[calc_id](v)` takes raw inputs (as a user
would enter them, including time-unit choices) and returns the outputs to compare.
"""
import math
from functools import lru_cache
import numpy as np
from scipy.stats import norm, linregress
from scipy.optimize import brentq, linprog

REF = {}
def ref(name):
    def deco(fn):
        REF[name] = fn
        return fn
    return deco

# ---------------------------------------------------------------- time units
def _per_year(u, dpy):
    return {'day': dpy, 'week': 52.0, 'month': 12.0, 'year': 1.0}[u]

def _periods(frm, to, dpy):
    """How many `to` periods are in one `frm` period (a week is always 7 days)."""
    if frm == to: return 1.0
    if frm == 'week' and to == 'day': return 7.0
    if frm == 'day' and to == 'week': return 1.0 / 7.0
    return _per_year(to, dpy) / _per_year(frm, dpy)

def normalize(schema, raw):
    """Convert time-dimensioned inputs to the calculator's basis unit."""
    v = dict(raw)
    basis = schema['basis']
    if basis is None: return v
    timed = {i['id']: i['time'] for i in schema['inputs'] if i['time']}
    dpy = raw.get('daysPerYear') or 365
    if not isinstance(dpy, (int, float)) or dpy <= 0: dpy = 365
    if isinstance(basis, dict):
        src = basis['from']
        basis = raw.get(src + '_u') or timed[src]['unit']
    for k, t in timed.items():
        x = raw.get(k)
        if not isinstance(x, (int, float)): continue
        u = raw.get(k + '_u') or t['unit']
        if u != basis:
            n = _periods(u, basis, dpy)
            if t['role'] == 'dur': x = x * n          # a length of time
            elif t['role'] == 'rate': x = x / n       # an amount per period
            else: x = x / math.sqrt(n)                # a standard deviation per period
        v[k] = x
    v['_basis'] = basis
    return v

# ---------------------------------------------------------------- statistics helpers
_TABLE_Z = np.round(np.arange(0, 4.10, 0.01), 2)
_TABLE_A = np.round(norm.cdf(_TABLE_Z), 4)
def z_value(p, mode='exact'):
    z = float(norm.ppf(p))
    if mode == 'table':
        if p < 0.5: return -z_value(1 - p, 'table')
        d = np.abs(_TABLE_A - p)
        best = d.min()
        return float(_TABLE_Z[np.where(d <= best + 1e-9)[0].max()])   # ties go to the larger z
    if mode == 'roundup':
        return math.ceil(z * 100 - 1e-9) / 100
    return z

def loss(z):
    """Unit normal loss function."""
    if z == math.inf: return 0.0
    return float(norm.pdf(z) - z * norm.sf(z))

def loss_inverse(g):
    if g > 30: return -g
    return brentq(lambda z: loss(z) - g, -45, 45, xtol=1e-14, rtol=1e-14, maxiter=500)

def holding(v):
    return v['I'] / 100.0 * v['C'] if v.get('hMode') == 'percent' else v['H']

def js_round(x):
    return math.floor(x + 0.5)

def first_best(vals, sign=1):
    b = 0
    for i, x in enumerate(vals):
        if sign * x > sign * vals[b] + 1e-12: b = i
    return b

# ================================================================ inventory: order quantity
@ref('eoq')
def _eoq(v):
    D, S, H = v['D'], v['S'], holding(v)
    Q = math.sqrt(2 * D * S / H)
    return dict(H=H, Q=Q, N=D / Q, T=Q / D, Tdays=Q / D * v.get('daysPerYear', 365), orderCost=D / Q * S, holdCost=Q / 2 * H, TC=D / Q * S + Q / 2 * H, avgInv=Q / 2)

@ref('total-inventory-cost')
def _tic(v):
    D, S, H, Q = v['D'], v['S'], holding(v), v['Q']
    oc, hc = D / Q * S, Q / 2 * H
    qs, tcs = math.sqrt(2 * D * S / H), math.sqrt(2 * D * S * H)
    return dict(H=H, orderCost=oc, holdCost=hc, TC=oc + hc, TCP=oc + hc + D * v.get('P', 0), Qstar=qs, TCstar=tcs, penalty=oc + hc - tcs, penaltyPct=(oc + hc - tcs) / tcs * 100)

@ref('epq')
def _epq(v):
    D, S, H, P, dpy = v['D'], v['S'], holding(v), v['P'], v.get('daysPerYear', 365)
    k = 1 - D / P
    Q = math.sqrt(2 * D * S / (H * k))
    return dict(H=H, k=k, Q=Q, Imax=Q * k, runDays=Q / P * dpy, N=D / Q, Tdays=Q / D * dpy, setupCost=D / Q * S, holdCost=Q * k / 2 * H, TC=D / Q * S + Q * k / 2 * H)

@ref('quantity-discount')
def _qd(v):
    D, S, rate = v['D'], v['S'], v['I'] / 100.0
    tiers = sorted(((max(0.0, float(t['min'])), float(t['price'])) for t in v['breaks']), key=lambda t: t[0])
    rows = []
    for i, (mn, price) in enumerate(tiers):
        hi = tiers[i + 1][0] if i + 1 < len(tiers) else math.inf
        h = rate * price
        eoq = math.sqrt(2 * D * S / h)
        if eoq < mn: q, ok = mn, True
        elif eoq >= hi: q, ok = eoq, False
        else: q, ok = eoq, True
        q = max(q, 1e-9)
        tc = D * price + D / q * S + q / 2 * h if ok else math.inf
        rows.append((q, price, tc, eoq, ok))
    best = min(range(len(rows)), key=lambda i: (rows[i][2], i))
    feas = [r for r in rows if r[4]]
    base = feas[0] if feas else rows[best]
    return dict(Q=rows[best][0], price=rows[best][1], TC=rows[best][2], tier=best, savings=base[2] - rows[best][2], tierQs=[r[3] for r in rows])

@ref('backorder-eoq')
def _bo(v):
    D, S, H, B = v['D'], v['S'], holding(v), v['B']
    Q = math.sqrt(2 * D * S / H * (H + B) / B)
    b = Q * H / (H + B)
    oc, hc, bc = D / Q * S, (Q - b) ** 2 / (2 * Q) * H, b * b / (2 * Q) * B
    return dict(H=H, Q=Q, b=b, Imax=Q - b, orderCost=oc, holdCost=hc, backCost=bc, TC=oc + hc + bc, shortPct=b / Q * 100)

@ref('orders-per-year')
def _opy(v):
    return dict(N=v['D'] / v['Q'], orderCost=v['D'] / v['Q'] * v.get('S', 0), Tdays=v['Q'] / v['D'] * 365)

@ref('time-between-orders')
def _tbo(v):
    N = v['D'] / v['Q']
    return dict(N=N, Tdays=v['daysPerYear'] / N, Tweeks=v['Q'] / v['D'] * 52)

# ================================================================ inventory: uncertainty and service
@ref('reorder-point')
def _rop(v):
    return dict(dlt=v['d'] * v['L'], ROP=v['d'] * v['L'] + v.get('ss', 0))

@ref('safety-stock-demand')
def _ssd(v):
    z = z_value(v['SL'] / 100, v.get('zMode', 'exact'))
    s = v['sd'] if v.get('sdGiven') == 'leadtime' else v['sd'] * math.sqrt(v['L'])
    return dict(z=z, sigLT=s, ss=z * s, dlt=v['d'] * v['L'], ROP=v['d'] * v['L'] + z * s)

@ref('safety-stock-lead-time')
def _ssl(v):
    z = z_value(v['SL'] / 100, v.get('zMode', 'exact'))
    s = v['d'] * v['sL']
    return dict(z=z, sigLT=s, ss=z * s, dlt=v['d'] * v['L'], ROP=v['d'] * v['L'] + z * s)

@ref('safety-stock-combined')
def _ssc(v):
    z = z_value(v['SL'] / 100, v.get('zMode', 'exact'))
    vd, vl = v['L'] * v['sd'] ** 2, v['d'] ** 2 * v['sL'] ** 2
    s = math.sqrt(vd + vl)
    tot = vd + vl
    return dict(z=z, varD=vd, varL=vl, sigLT=s, ss=z * s, dlt=v['d'] * v['L'], ROP=v['d'] * v['L'] + z * s, shareDemand=vd / tot * 100 if tot > 0 else 0, shareLead=vl / tot * 100 if tot > 0 else 0)

@ref('cycle-service-level')
def _csl(v):
    mu, s = v['d'] * v['L'], v['sd'] * math.sqrt(v['L'])
    ss = v['ROP'] - mu
    if s > 0: z = ss / s; p = float(norm.cdf(z))
    else: z = math.inf if ss >= 0 else -math.inf; p = 1.0 if ss >= 0 else 0.0
    return dict(dlt=mu, sigLT=s, ss=ss, z=z, CSL=p * 100, pOut=(1 - p) * 100)

@ref('fill-rate')
def _fr(v):
    mu, s = v['d'] * v['L'], v['sd'] * math.sqrt(v['L'])
    if v.get('solve') == 'ss':
        esc = v['Q'] * (1 - v['target'] / 100)
        g = esc / s
        z = loss_inverse(g)
        return dict(dlt=mu, sigLT=s, ESC=esc, G=g, z=z, ss=z * s, ROPout=mu + z * s, fillRate=v['target'], CSL=float(norm.cdf(z)) * 100)
    ss = v['ROP'] - mu
    z = ss / s
    g = loss(z)
    return dict(dlt=mu, sigLT=s, ss=ss, z=z, G=g, ESC=s * g, ROPout=v['ROP'], fillRate=(1 - s * g / v['Q']) * 100, CSL=float(norm.cdf(z)) * 100)

@ref('newsvendor')
def _nv(v):
    if v.get('costMode') == 'direct': cu, co = v['Cu'], v['Co']
    else: cu, co = v['price'] - v['cost'], v['cost'] - v['salvage']
    cr = cu / (cu + co)
    z = z_value(cr, v.get('zMode', 'exact'))
    q = v['mu'] + z * v['sigma']
    lost = v['sigma'] * loss(z)
    sales = v['mu'] - lost
    left = q - sales
    profit = cu * sales - co * left
    return dict(Cu=cu, Co=co, CR=cr, z=z, Q=q, lost=lost, sales=sales, leftover=left, profit=profit, maxProfit=cu * v['mu'], mismatch=cu * v['mu'] - profit)

@ref('periodic-review')
def _pr(v):
    z = z_value(v['SL'] / 100, v.get('zMode', 'exact'))
    s = v['sd'] * math.sqrt(v['T'] + v['L'])
    oul = v['d'] * (v['T'] + v['L']) + z * s
    return dict(z=z, sigTL=s, ss=z * s, OUL=oul, Q=max(0.0, oul - v['onHand']), avgQ=v['d'] * v['T'])

@ref('continuous-review')
def _cr(v):
    ppy = _per_year(v.get('_basis', 'day'), v.get('daysPerYear', 365))
    d, sd, L, S, H = v['d'], v['sd'], v['L'], v['S'], v['H']
    Q = math.sqrt(2 * d * S / H)
    z = z_value(v['SL'] / 100, v.get('zMode', 'exact'))
    s = sd * math.sqrt(L)
    ss = z * s
    avg = Q / 2 + ss
    N = d / Q * ppy
    return dict(Q=Q, z=z, sigLT=s, ss=ss, s=d * L + ss, avgInv=avg, N=N, annualCost=N * S + avg * H * ppy, annualD=d * ppy, annualH=H * ppy, fillRate=(1 - s * loss(z) / Q) * 100 if s > 0 else 100.0)

@ref('risk-pooling')
def _rp(v):
    z = z_value(v['SL'] / 100, v.get('zMode', 'exact'))
    each = z * v['sd'] * math.sqrt(v['L'])
    n, rho = v['n'], v['rho']
    f = math.sqrt(n + n * (n - 1) * rho)
    dec, cen = n * each, each * f
    return dict(z=z, each=each, factor=f, ssDec=dec, ssCen=cen, saved=dec - cen, savedPct=(dec - cen) / dec * 100 if dec != 0 else 0)

# ================================================================ inventory: performance
@ref('inventory-turnover')
def _turn(v):
    t = v['cogs'] / v['inv']
    return dict(turns=t, days=365 / t, weeks=52 / t)

@ref('days-of-supply')
def _dos(v):
    d = v['onHand'] / v['usage'] if v.get('basis') == 'units' else v['inv'] / (v['cogs'] / 365)
    return dict(days=d, weeks=d / 7, turns=365 / d if d > 0 else math.inf)

@ref('average-inventory')
def _avg(v):
    a = (v['begin'] + v['end']) / 2 if v.get('method') == 'balances' else v['Q'] / 2 + v['ss']
    return dict(avg=a, value=a * v.get('unitCost', 0), cycle=v['Q'] / 2)

@ref('holding-cost')
def _hc(v):
    r = v['capital'] + v['storage'] + v['insurance'] + v['risk']
    H = r / 100 * v['C']
    return dict(rate=r, H=H, invValue=v['avgInv'] * v['C'], annual=v['avgInv'] * H)

@ref('abc-classification')
def _abc(v):
    vols = [(r['units'] * r['cost'], i) for i, r in enumerate(v['items'])]
    vols.sort(key=lambda t: (-t[0], t[1]))
    total = sum(x for x, _ in vols)
    cum, cls, cums = 0.0, [], []
    for x, _ in vols:
        before = cum / total * 100
        cum += x
        cls.append('A' if before < v['cutA'] - 1e-9 else 'B' if before < v['cutB'] - 1e-9 else 'C')
        cums.append(cum / total * 100)
    share = lambda k: sum(x for (x, _), c in zip(vols, cls) if c == k) / total * 100
    return dict(total=total, nA=cls.count('A'), nB=cls.count('B'), nC=cls.count('C'), shareA=share('A'), shareB=share('B'), shareC=share('C'), order=[i for _, i in vols], vols=[x for x, _ in vols], cumPct=cums)

@ref('gmroi')
def _gmroi(v):
    gm = v['sales'] - v['cogs']
    return dict(gm=gm, gmPct=gm / v['sales'] * 100, gmroi=gm / v['inv'], turns=v['cogs'] / v['inv'])

# ================================================================ forecasting
def _errors(actual, fc, start=0, sign='AF'):
    e = []
    for i in range(start, len(actual)):
        f = fc[i]
        if f is None or (isinstance(f, float) and math.isnan(f)): continue
        e.append((actual[i] - f) if sign == 'AF' else (f - actual[i]))
    e = np.array(e, dtype=float)
    a = np.array([actual[i] for i in range(start, len(actual)) if fc[i] is not None and not (isinstance(fc[i], float) and math.isnan(fc[i]))], dtype=float)
    n = len(e)
    if n == 0: return dict(n=0, MAD=math.nan, MSE=math.nan, MAPE=math.nan, bias=math.nan, RSFE=0.0, TS=0.0, e=[], runTs=[])
    mad, mse = float(np.mean(np.abs(e))), float(np.mean(e ** 2))
    nz = a != 0
    mape = float(np.mean(np.abs(e[nz] / a[nz])) * 100) if nz.any() else math.nan
    rs = float(e.sum())
    cs, ca = np.cumsum(e), np.cumsum(np.abs(e)) / np.arange(1, n + 1)
    run = [float(cs[i] / ca[i]) if ca[i] > 0 else 0.0 for i in range(n)]
    return dict(n=n, MAD=mad, MSE=mse, MAPE=mape, bias=rs / n, RSFE=rs, TS=rs / mad if mad > 0 else 0.0, e=e.tolist(), runTs=run)

def _acc(er):
    return dict(MAD=er['MAD'], MSE=er['MSE'], MAPE=er['MAPE'], nErr=er['n'])

@ref('moving-average')
def _sma(v):
    a, n = v['data'], int(v['n'])
    fc = [None] * n + [float(np.mean(a[i - n:i])) for i in range(n, len(a))]
    return dict(next=float(np.mean(a[-n:])), fc=fc[n:], **_acc(_errors(a, fc, n)))

@ref('weighted-moving-average')
def _wma(v):
    a, w = v['data'], v['weights']
    k, sw = len(w), sum(w)
    f = lambda i: sum(w[j] * a[i - 1 - j] for j in range(k)) / sw
    fc = [None] * k + [f(i) for i in range(k, len(a))]
    return dict(next=f(len(a)), wsum=sw, fc=fc[k:], **_acc(_errors(a, fc, k)))

def _ses(a, alpha, f1):
    fc = [f1]
    for x in a: fc.append(fc[-1] + alpha * (x - fc[-1]))
    return fc[:-1], fc[-1]

@ref('exponential-smoothing')
def _es(v):
    a = v['data']
    f1 = v['f1'] if v['init'] == 'given' else float(np.mean(a)) if v['init'] == 'average' else a[0]
    start = 1 if v['init'] == 'first' else 0
    alpha = v['alpha']
    if v.get('optimize') in ('mad', 'mse'):
        key = 'MAD' if v['optimize'] == 'mad' else 'MSE'
        best = math.inf
        for k in range(1, 100):
            val = _errors(a, _ses(a, k / 100, f1)[0], start)[key]
            if val < best - 1e-12: best, alpha = val, k / 100
    fc, nxt = _ses(a, alpha, f1)
    return dict(next=nxt, alphaUsed=alpha, f1=f1, fc=fc, **_acc(_errors(a, fc, start)))

@ref('holt')
def _holt(v):
    a, al, be = v['data'], v['alpha'], v['beta']
    n = len(a)
    if v['init'] == 'auto': t1 = (a[-1] - a[0]) / (n - 1); f1 = a[0] - t1
    else: t1, f1 = v['t1'], v['f1']
    F, T = [f1], [t1]
    for i in range(1, n + 1):
        f = al * a[i - 1] + (1 - al) * (F[-1] + T[-1])
        t = be * (f - F[-1]) + (1 - be) * T[-1]
        F.append(f); T.append(t)
    fit = [F[i] + T[i] for i in range(n)]
    return dict(next=F[n] + v.get('ahead', 1) * T[n], level=F[n], trend=T[n], f1=f1, t1=t1, fc=fit, lv=F, tr=T, **_acc(_errors(a, fit, 1 if v['init'] == 'auto' else 0)))

@ref('seasonal-indices')
def _si(v):
    a, m = np.array(v['data'], dtype=float), int(v['m'])
    grid = a.reshape(-1, m)
    avg = grid.mean(axis=0)
    overall = a.mean()
    idx = avg / overall
    return dict(seasonAvg=avg.tolist(), overall=float(overall), idx=idx.tolist(), forecast=(idx * v['nextTotal'] / m).tolist(), peak=float(idx.max()), low=float(idx.min()), peakSeason=int(np.argmax(idx)) + 1)

@ref('holt-winters')
def _hw(v):
    a, m, al, be, ga = v['data'], int(v['m']), v['alpha'], v['beta'], v['gamma']
    n = len(a)
    L = sum(a[:m]) / m
    T = (sum(a[m:2 * m]) / m - L) / m
    S = {i: a[i] / L for i in range(m)}
    fc = {}
    for t in range(m, n):
        fc[t] = (L + T) * S[t - m]
        newL = al * (a[t] / S[t - m]) + (1 - al) * (L + T)
        T = be * (newL - L) + (1 - be) * T
        L = newL
        S[t] = ga * (a[t] / L) + (1 - ga) * S[t - m]
    ahead = [(L + h * T) * S[n - m + ((h - 1) % m)] for h in range(1, m + 1)]
    fcl = [None] * m + [fc[t] for t in range(m, n)]
    return dict(next=ahead[0], level=L, trend=T, ahead=ahead, fc=fcl[m:], **_acc(_errors(a, fcl, m)))

@ref('linear-regression')
def _lr(v):
    y = np.array(v['data'], dtype=float)
    x = np.array(v['xs'], dtype=float) if len(v['xs']) else np.arange(1, len(y) + 1, dtype=float)
    res = linregress(x, y)
    b, a = float(res.slope), float(res.intercept)
    r = float(res.rvalue) if np.var(y) > 0 else 0.0
    sse = float(((y - (a + b * x)) ** 2).sum())
    xn = len(y) + 1 if (v['xNew'] == 0 and not len(v['xs'])) else v['xNew']
    return dict(a=a, b=b, r=r, r2=r * r, syx=math.sqrt(sse / (len(y) - 2)) if len(y) > 2 else 0.0, xNew=xn, forecast=a + b * xn, xbar=float(x.mean()), ybar=float(y.mean()), sxy=float((x * y).sum()), sxx=float((x * x).sum()))

def _accuracy(v):
    er = _errors(v['actual'], v['forecast'], 0, v.get('errSign', 'AF'))
    return dict(MAD=er['MAD'], MSE=er['MSE'], MAPE=er['MAPE'], bias=er['bias'], RSFE=er['RSFE'], TS=er['TS'], RMSE=math.sqrt(er['MSE']), n=er['n'], e=er['e'], runTs=er['runTs'], sigma=1.25 * er['MAD'])
for _id in ('mad', 'mse', 'forecast-bias', 'tracking-signal'): REF[_id] = _accuracy
@ref('mape')
def _mape(v):
    o = _accuracy(v); o['accuracy'] = 100 - o['MAPE']; return o

# ================================================================ process and capacity
@ref('littles-law')
def _ll(v):
    s = v['solve']
    I = v['R'] * v['T'] if s == 'I' else v['I']
    T = v['I'] / v['R'] if s == 'T' else v['T']
    R = v['I'] / v['T'] if s == 'R' else v['R']
    return dict(I=I, T=T, R=R, turns=1 / T)

@ref('takt-time')
def _takt(v):
    avail = (v['shift'] - v['breaks']) * v['shifts']
    t = avail / v['demand']
    return dict(avail=avail, taktMin=t, taktSec=t * 60, rate=60 / t)

@ref('cycle-time')
def _ct(v):
    eff = [s['time'] / s['n'] for s in v['steps']]
    c = max(eff)
    return dict(eff=eff, cycle=c, flow=sum(s['time'] for s in v['steps']), capacity=60 / c, slowest=eff.index(c) + 1)

@ref('throughput')
def _tp(v):
    r = min(v['demand'], v['capacity'])
    return dict(rate=r, daily=r * v['hours'] * v['yield'] / 100, util=r / v['capacity'] * 100, gap=max(0, v['demand'] - v['capacity']), capConstrained=1 if v['demand'] > v['capacity'] else 0)

@ref('bottleneck')
def _bn(v):
    caps = [s['n'] * 60 / s['time'] for s in v['steps']]
    cap = min(caps)
    flow = min(v['demand'], cap)
    return dict(caps=caps, capacity=cap, bn=caps.index(cap) + 1, flow=flow, utils=[flow / c * 100 for c in caps], bnUtil=flow / cap * 100, implied=[v['demand'] / c * 100 for c in caps])

@ref('utilization')
def _util(v): return dict(util=v['actual'] / v['design'] * 100, idle=v['design'] - v['actual'])
@ref('efficiency')
def _eff(v): return dict(eff=v['actual'] / v['effective'] * 100, lost=v['effective'] - v['actual'])
@ref('effective-capacity')
def _ec(v):
    e = v['design'] - v['lossUnits'] if v.get('lossMode') == 'units' else v['design'] * (1 - v['lossPct'] / 100)
    x = e * v['eff'] / 100
    return dict(effective=e, expected=x, util=x / v['design'] * 100 if v['design'] > 0 else 0)

@ref('oee')
def _oee(v):
    run = v['planned'] - v['down']
    A, P, Q = run / v['planned'], v['ideal'] * v['total'] / (run * 60), v['good'] / v['total']
    return dict(run=run, A=A * 100, P=P * 100, Q=Q * 100, oee=A * P * Q * 100)

def _parse_preds(s):
    out = []
    for tok in str(s or '').replace(';', ',').replace(' ', ',').split(','):
        tok = tok.strip()
        if tok and tok not in ('-', '—') and tok.lower() != 'none': out.append(tok)
    return out

@ref('line-balancing')
def _lb(v):
    ids = [str(t['id']).strip() or f'T{i + 1}' for i, t in enumerate(v['tasks'])]
    times = [float(t['time']) for t in v['tasks']]
    preds = [[ids.index(p) for p in _parse_preds(t.get('preds'))] for t in v['tasks']]
    n = len(ids)
    succ = [[j for j in range(n) if i in preds[j]] for i in range(n)]
    @lru_cache(None)
    def followers(i):
        s = set()
        for j in succ[i]: s.add(j); s |= followers(j)
        return frozenset(s)
    cycle = v['avail'] / v['demand']
    station, done, st, rem = [0] * n, [False] * n, 1, cycle
    while not all(done):
        best = None
        for i in range(n):
            if done[i] or times[i] > rem + 1e-9 or not all(done[p] for p in preds[i]): continue
            if best is None or times[i] > times[best] + 1e-12 or (abs(times[i] - times[best]) <= 1e-12 and len(followers(i)) > len(followers(best))): best = i
        if best is None: st += 1; rem = cycle; continue
        done[best] = True; station[best] = st; rem -= times[best]
    total = sum(times)
    eff = total / (st * cycle)
    return dict(cycle=cycle, total=total, Nmin=math.ceil(total / cycle - 1e-9), N=st, eff=eff * 100, delay=(1 - eff) * 100, idle=st * cycle - total, station=station)

@ref('learning-curve')
def _lc(v):
    b = math.log(v['rate'] / 100) / math.log(2)
    n = int(v['n'])
    units = v['T1'] * np.arange(1, n + 1, dtype=float) ** b
    tot = float(math.fsum(units))
    return dict(b=b, Tn=float(v['T1'] * n ** b), total=tot, avg=tot / n)

@ref('capacity-break-even')
def _be(v):
    m = v['P'] - v['V']
    bep = v['F'] / m
    return dict(margin=m, bepUnits=bep, bepDollars=v['F'] / (1 - v['V'] / v['P']), profit=m * v['volume'] - v['F'], safety=(v['volume'] - bep) / v['volume'] * 100 if v['volume'] > 0 else 0, crossover=(v['F2'] - v['F']) / (v['V'] - v['V2']) if v.get('compare') == 'yes' else 0)

# ================================================================ queuing
def _mms(lam, mu, s):
    r = lam / mu
    rho = r / s
    head = sum(r ** n / math.factorial(n) for n in range(s))
    tail = r ** s / (math.factorial(s) * (1 - rho))
    p0 = 1 / (head + tail)
    pw = tail * p0
    lq = pw * rho / (1 - rho)
    return dict(rho=rho, P0=p0, Lq=lq, Ls=lq + r, Wq=lq / lam, Ws=lq / lam + 1 / mu, Pw=pw)

def _pn(lam, mu, s, n, p0):
    r = lam / mu
    return p0 * r ** n / math.factorial(n) if n <= s else p0 * r ** n / (math.factorial(s) * s ** (n - s))

@ref('mm1')
def _mm1(v):
    lam, mu = v['lambda'], v['mu']
    return dict(rho=lam / mu, P0=1 - lam / mu, Lq=lam ** 2 / (mu * (mu - lam)), Ls=lam / (mu - lam), Wq=lam / (mu * (mu - lam)), Ws=1 / (mu - lam), Pw=lam / mu)

@ref('mms')
def _mmsc(v):
    lam, mu, s = v['lambda'], v['mu'], int(v['s'])
    q = _mms(lam, mu, s)
    cw, cs = v.get('cw', 0) or 0, v.get('cs', 0) or 0
    best_s = s
    if cw > 0 and cs > 0:
        best = math.inf
        s0 = int(math.floor(lam / mu)) + 1
        for k in range(s0, s0 + 61):
            c = cs * k + cw * _mms(lam, mu, k)['Ls']
            if c < best - 1e-12: best, best_s = c, k
    q.update(cost=cs * s + cw * q['Ls'], sBest=best_s)
    return q

@ref('md1')
def _md1(v):
    lam, mu = v['lambda'], v['mu']
    lq = lam ** 2 / (2 * mu * (mu - lam))
    return dict(rho=lam / mu, P0=1 - lam / mu, Lq=lq, Ls=lq + lam / mu, Wq=lq / lam, Ws=lq / lam + 1 / mu, Pw=lam / mu)

@ref('kingman')
def _king(v):
    a, p, m = v['a'], v['p'], int(v['m'])
    u = p / (a * m)
    V = (v['cva'] ** 2 + v['cvp'] ** 2) / 2
    U = u ** (math.sqrt(2 * (m + 1)) - 1) / (1 - u)
    wq = p / m * U * V
    return dict(u=u, rho=u, V=V, U=U, Wq=wq, Lq=wq / a, Ws=wq + p, Ls=(wq + p) / a)

@ref('queue-probabilities')
def _qp(v):
    lam, mu, s, k, t = v['lambda'], v['mu'], int(v['s']), int(v['k']), v['t']
    q = _mms(lam, mu, s)
    cum = sum(_pn(lam, mu, s, n, q['P0']) for n in range(k + 1))
    return dict(rho=q['rho'], P0=q['P0'], Pw=q['Pw'], Pk=_pn(lam, mu, s, k, q['P0']), PmoreK=max(0.0, 1 - cum), PwaitT=q['Pw'] * math.exp(-(s * mu - lam) * t), pn=[_pn(lam, mu, s, n, q['P0']) for n in range(min(max(k + 6, 12), 40))])

# ================================================================ quality
# Control chart factors typed independently from published ASTM / Montgomery tables: n -> (A2, D3, D4, d2)
FACTORS = {2: (1.880, 0, 3.267, 1.128), 3: (1.023, 0, 2.574, 1.693), 4: (0.729, 0, 2.282, 2.059), 5: (0.577, 0, 2.114, 2.326), 6: (0.483, 0, 2.004, 2.534), 7: (0.419, 0.076, 1.924, 2.704), 8: (0.373, 0.136, 1.864, 2.847),
           9: (0.337, 0.184, 1.816, 2.970), 10: (0.308, 0.223, 1.777, 3.078), 11: (0.285, 0.256, 1.744, 3.173), 12: (0.266, 0.283, 1.717, 3.258), 13: (0.249, 0.307, 1.693, 3.336), 14: (0.235, 0.328, 1.672, 3.407),
           15: (0.223, 0.347, 1.653, 3.472), 16: (0.212, 0.363, 1.637, 3.532), 17: (0.203, 0.378, 1.622, 3.588), 18: (0.194, 0.391, 1.608, 3.640), 19: (0.187, 0.403, 1.597, 3.689), 20: (0.180, 0.415, 1.585, 3.735),
           21: (0.173, 0.425, 1.575, 3.778), 22: (0.167, 0.434, 1.566, 3.819), 23: (0.162, 0.443, 1.557, 3.858), 24: (0.157, 0.451, 1.548, 3.895), 25: (0.153, 0.459, 1.541, 3.931)}
def _flag(vals, ucl, lcl): return [i for i, x in enumerate(vals) if x > ucl + 1e-12 or x < lcl - 1e-12]

@ref('xbar-r-chart')
def _xbar(v):
    n = int(v['n'])
    if v.get('mode') == 'summary': means, ranges = list(v['means']), list(v['ranges'])
    else:
        g = np.array(v['obs'], dtype=float).reshape(-1, n)
        means, ranges = g.mean(axis=1).tolist(), (g.max(axis=1) - g.min(axis=1)).tolist()
    A2, D3, D4, d2 = FACTORS[n]
    xbb, rbar = float(np.mean(means)), float(np.mean(ranges))
    ux, lx, ur, lr = xbb + A2 * rbar, xbb - A2 * rbar, D4 * rbar, D3 * rbar
    ox, orr = _flag(means, ux, lx), _flag(ranges, ur, lr)
    return dict(means=means, ranges=ranges, A2=A2, D3=D3, D4=D4, d2=d2, xbb=xbb, rbar=rbar, uclX=ux, lclX=lx, uclR=ur, lclR=lr, outX=ox, outR=orr, nOut=len(set(ox) | set(orr)), sigma=rbar / d2)

@ref('p-chart')
def _pch(v):
    d, n, z = v['defects'], v['n'], v['z']
    p = [x / n for x in d]
    pbar = sum(d) / (len(d) * n)
    sp = math.sqrt(pbar * (1 - pbar) / n)
    ucl, lcl = min(1.0, pbar + z * sp), max(0.0, pbar - z * sp)
    out = _flag(p, ucl, lcl)
    return dict(p=p, pbar=pbar, sp=sp, ucl=ucl, lcl=lcl, outIdx=out, nOut=len(out))

@ref('c-chart')
def _cch(v):
    c = float(np.mean(v['counts']))
    s = math.sqrt(c)
    ucl, lcl = c + v['z'] * s, max(0.0, c - v['z'] * s)
    out = _flag(v['counts'], ucl, lcl)
    return dict(cbar=c, s=s, ucl=ucl, lcl=lcl, outIdx=out, nOut=len(out))

@ref('process-capability')
def _cap(v):
    u, l, m, s = v['usl'], v['lsl'], v['mean'], v['sigma']
    cpu, cpl = (u - m) / (3 * s), (m - l) / (3 * s)
    pout = float(norm.sf((u - m) / s) + norm.cdf((l - m) / s))
    return dict(cp=(u - l) / (6 * s), cpu=cpu, cpl=cpl, cpk=min(cpu, cpl), ppm=pout * 1e6, yieldPct=(1 - pout) * 100)

@ref('dpmo-sigma')
def _dpmo(v):
    dpo = v['defects'] / (v['units'] * v['opps'])
    return dict(dpo=dpo, dpmo=dpo * 1e6, dpu=v['defects'] / v['units'], yieldPct=(1 - dpo) * 100, sigma=float(norm.ppf(1 - dpo)) + float(v.get('shift', 1.5)))

@ref('cost-of-quality')
def _coq(v):
    good, bad = v['prevention'] + v['appraisal'], v['internal'] + v['external']
    return dict(total=good + bad, conformance=good, failure=bad, pctSales=(good + bad) / v['sales'] * 100, failShare=bad / (good + bad) * 100 if good + bad > 0 else 0)

@ref('taguchi-loss')
def _tag(v):
    k = v['C'] / v['tol'] ** 2
    return dict(k=k, L=k * (v['x'] - v['T']) ** 2, EL=k * (v['sigma'] ** 2 + (v['mu'] - v['T']) ** 2))

# ================================================================ planning and MRP
def _plan(gross, on_hand, rule, Q=1, P=1, S=0.0, h=0.0, ss=0.0, sched=None):
    n = len(gross)
    sched = [(sched[i] if sched and i < len(sched) else 0) for i in range(n)]
    # lot-for-lot net requirements
    need, inv = [], on_hand
    for t in range(n):
        avail = inv + sched[t]
        x = max(0.0, gross[t] + ss - avail)
        need.append(x); inv = avail + x - gross[t]
    rec = [0.0] * n
    if rule == 'l4l': rec = list(need)
    elif rule == 'foq':
        inv = on_hand
        for t in range(n):
            avail = inv + sched[t]
            short = gross[t] + ss - avail
            if short > 1e-9: rec[t] = math.ceil(short / Q - 1e-9) * Q
            inv = avail + rec[t] - gross[t]
    elif rule == 'poq':
        t = 0
        while t < n:
            if need[t] > 1e-9: rec[t] = sum(need[t:t + P]); t += P
            else: t += 1
    else:  # part-period balancing
        epp = S / max(h, 1e-12)
        t = 0
        while t < n:
            if need[t] <= 1e-9: t += 1; continue
            end, diff, pp = t, abs(0 - epp), 0.0
            for k in range(t + 1, n):
                pp += need[k] * (k - t)
                if abs(pp - epp) < diff - 1e-9: diff, end = abs(pp - epp), k
                if pp > epp: break
            rec[t] = sum(need[t:end + 1]); t = end + 1
    inv, end_inv, net, orders, held, units = on_hand, [], [], 0, 0.0, 0.0
    for t in range(n):
        avail = inv + sched[t]
        net.append(max(0.0, gross[t] + ss - avail))
        inv = avail + rec[t] - gross[t]
        end_inv.append(inv)
        if rec[t] > 1e-9: orders += 1; units += rec[t]
        held += max(0.0, inv)
    return dict(net=net, receipts=rec, end=end_inv, orders=orders, setupCost=orders * S, holdCost=held * h, total=orders * S + held * h, units=units)

@ref('mrp-gross-to-net')
def _g2n(v):
    pl = _plan(v['gross'], v['onHand'], v['rule'], Q=v.get('Q', 1), P=int(js_round(v.get('P', 1))) if v.get('P') else 1, ss=v.get('ss', 0), sched=v.get('sched'))
    L = int(v['lead'])
    rel, past = [0.0] * len(v['gross']), 0.0
    for t, q in enumerate(pl['receipts']):
        if q <= 0: continue
        if t - L < 0: past += q
        else: rel[t - L] += q
    first = next((i + 1 for i, x in enumerate(rel) if x > 0), 0)
    return dict(net=pl['net'], receipts=pl['receipts'], end=pl['end'], rel=rel, pastDue=past, orders=pl['orders'], totalNet=sum(pl['net']), firstRelease=first, ending=pl['end'][-1])

@ref('lot-for-lot')
def _l4l(v): return _plan(v['gross'], v['onHand'], 'l4l', S=v['S'], h=v['h'])
@ref('fixed-order-quantity')
def _foq(v):
    avg = float(np.mean(v['gross']))
    Q = v['Q'] if v.get('qMode') == 'given' else max(1, js_round(math.sqrt(2 * avg * v['S'] / max(v['h'], 1e-12))))
    o = _plan(v['gross'], v['onHand'], 'foq', Q=Q, S=v['S'], h=v['h']); o['Qused'] = Q; return o
@ref('poq-lot-sizing')
def _poq(v):
    avg = float(np.mean(v['gross']))
    eoq = math.sqrt(2 * avg * v['S'] / max(v['h'], 1e-12))
    P = int(v['P']) if v.get('pMode') == 'given' else max(1, js_round(eoq / max(avg, 1e-12)))
    o = _plan(v['gross'], v['onHand'], 'poq', P=P, S=v['S'], h=v['h']); o['Pused'] = P; o['eoq'] = eoq; return o
@ref('part-period-balancing')
def _ppb(v):
    o = _plan(v['gross'], v['onHand'], 'ppb', S=v['S'], h=v['h']); o['epp'] = v['S'] / max(v['h'], 1e-12); return o

@ref('aggregate-planning')
def _agg(v):
    dem = [float(x) for x in v['demand']]
    days = [float(v['days'][i]) if i < len(v['days']) and v['days'][i] > 0 else 1.0 for i in range(len(dem))]
    hrs, wage, hire, fire, hold, back, sub, beg = v['hrs'], v['wage'], v['hire'], v['fire'], v['hold'], v.get('back', 0) or 0, v['subCost'], v.get('begInv', 0) or 0
    rnd = v.get('roundRates') != 'no'
    # level
    rate = (sum(dem) - beg) / sum(days)
    inv, lh, lb, units = beg, 0.0, 0.0, 0.0
    for d, dy in zip(dem, days):
        p = rate * dy; units += p; inv += p - d
        if abs(inv) < 1e-9: inv = 0.0
        if inv > 0: lh += inv * hold
        else: lb += -inv * back
    level_labor = units * hrs * wage
    level = level_labor + lh + lb
    # chase
    inv, hc, fc, units, prev = beg, 0.0, 0.0, 0.0, None
    for d, dy in zip(dem, days):
        p = max(0.0, d - inv); inv = inv + p - d; units += p
        r = js_round(p / dy) if rnd else p / dy
        if prev is not None:
            if r > prev: hc += (r - prev) * hire
            else: fc += (prev - r) * fire
        prev = r
    chase_labor = units * hrs * wage
    chase = chase_labor + hc + fc
    # hybrid
    mn = min(d / dy for d, dy in zip(dem, days))
    base = math.floor(mn + 1e-9) if rnd else mn
    inv, hh, subu, units = beg, 0.0, 0.0, 0.0
    for d, dy in zip(dem, days):
        p = base * dy; units += p
        short = max(0.0, d - p - inv); subu += short
        inv = inv + p + short - d
        if abs(inv) < 1e-9: inv = 0.0
        hh += inv * hold
    hybrid_labor = units * hrs * wage
    hybrid = hybrid_labor + subu * sub + hh
    costs = [level, chase, hybrid]
    return dict(level=level, chase=chase, hybrid=hybrid, best=min(costs), bestIdx=costs.index(min(costs)) + 1, levelHold=lh, levelBack=lb, levelLabor=level_labor, chaseChange=hc + fc, chaseLabor=chase_labor, hybridSub=subu * sub, hybridLabor=hybrid_labor, hybridHold=hh)

# ================================================================ logistics and sourcing
@ref('landed-cost')
def _landed(v):
    prod = v['price'] * v['units']
    duty = v['duty'] / 100 * (prod + v['freight'] + v['insurance'] if v.get('dutyBase') == 'cif' else prod)
    tot = prod + v['freight'] + v['insurance'] + duty + v['fees'] + v['other']
    return dict(product=prod, dutyAmt=duty, total=tot, perUnit=tot / v['units'], uplift=(tot - prod) / prod * 100 if prod > 0 else 0)

@ref('center-of-gravity')
def _cog(v):
    P = v['points']
    w = np.array([p['w'] for p in P], dtype=float); x = np.array([p['x'] for p in P], dtype=float); y = np.array([p['y'] for p in P], dtype=float)
    cx, cy = float((x * w).sum() / w.sum()), float((y * w).sum() / w.sum())
    return dict(cx=cx, cy=cy, totalW=float(w.sum()), ld=float((w * np.hypot(x - cx, y - cy)).sum()))

@ref('load-distance')
def _ld(v):
    def dist(p, s): return math.hypot(p['x'] - s['x'], p['y'] - s['y']) if v['metric'] == 'euclid' else abs(p['x'] - s['x']) + abs(p['y'] - s['y'])
    sc = [sum(p['w'] * dist(p, s) for p in v['points']) for s in v['sites']]
    return dict(scores=sc, bestScore=min(sc), bestIdx=sc.index(min(sc)) + 1, worstScore=max(sc))

def _rating(rows):
    W = sum(r['weight'] for r in rows)
    use_c = any(r.get('c') not in (0, None) for r in rows)
    sc = [sum(r['weight'] * (r.get(k) or 0) for r in rows) for k in (('a', 'b', 'c') if use_c else ('a', 'b'))]
    best = max(sc)
    return dict(scoreA=sc[0], scoreB=sc[1], scoreC=sc[2] if use_c else 0, W=W, normA=sc[0] / W, normB=sc[1] / W, normC=sc[2] / W if use_c else 0, best=best, bestIdx=sc.index(best) + 1, nOpt=len(sc))
@ref('factor-rating')
def _frate(v): return _rating(v['rows'])
@ref('supplier-scorecard')
def _score(v):
    o = _rating(v['rows']); o['bestNorm'] = o['best'] / o['W']; return o

@ref('location-break-even')
def _lbe(v):
    S = v['sites']
    costs = [s['fixed'] + s['variable'] * v['volume'] for s in S]
    cross = []
    for i in range(len(S)):
        for j in range(i + 1, len(S)):
            dv = S[i]['variable'] - S[j]['variable']
            x = (S[j]['fixed'] - S[i]['fixed']) / dv if dv != 0 else -1
            cross.append(x if x > 0 else -1)
    return dict(costs=costs, bestCost=min(costs), bestIdx=costs.index(min(costs)) + 1, worstCost=max(costs), cross=cross)

@ref('freight-cost')
def _freight(v):
    base = v['weight'] / 100 * v['rate']
    line = max(v.get('minCharge', 0) or 0, base)
    tot = line * (1 + (v.get('fuel', 0) or 0) / 100) + (v.get('acc', 0) or 0)
    return dict(base=base, line=line, total=tot, perUnit=tot / v['units'], perCwt=tot / (v['weight'] / 100), perLb=tot / v['weight'], minApplied=1 if (v.get('minCharge', 0) or 0) > base else 0)

@ref('cube-utilization')
def _cube(v):
    f = lambda a, b: math.floor(a / b + 1e-9)
    space = f(v['L'], v['l']) * f(v['W'], v['w']) * f(v['H'], v['h'])
    wt = f(v['limit'], v['cw'])
    n = min(space, wt)
    return dict(bySpace=space, byWeight=wt, loaded=n, cubePct=n * v['l'] * v['w'] * v['h'] / (v['L'] * v['W'] * v['H']) * 100, weightPct=n * v['cw'] / v['limit'] * 100, cubesOut=1 if space <= wt else 0)

@ref('in-transit-inventory')
def _transit(v):
    h = v['i'] / 100 * v['C']
    def mode(r, t, q): return r * v['D'], h * v['D'] * t / 365, h * q / 2
    fa, ta, ca = mode(v['rA'], v['tA'], v['qA']); fb, tb, cb = mode(v['rB'], v['tB'], v['qB'])
    A, B = fa + ta + ca, fb + tb + cb
    return dict(h=h, freightA=fa, transitA=ta, cycleA=ca, freightB=fb, transitB=tb, cycleB=cb, totalA=A, totalB=B, best=min(A, B), bestIdx=1 if A <= B else 2, savings=abs(A - B), pipeA=v['D'] * v['tA'] / 365, pipeB=v['D'] * v['tB'] / 365)

@ref('total-cost-of-ownership')
def _tco(v):
    vol, hold = v['volume'], v['hold'] / 100
    tot = []
    for s in v['suppliers']:
        buy = s['price'] * vol
        tot.append(buy + s['freight'] * vol + s['duty'] / 100 * buy + s['defect'] / 100 * vol * s['defectCost'] + hold * s['price'] * vol * s['lead'] / 365 + s['admin'])
    b = min(tot)
    return dict(totals=tot, bestTco=b, bestIdx=tot.index(b) + 1, bestPerUnit=b / vol, gap=max(tot) - b, perUnit=[t / vol for t in tot])

@ref('make-vs-buy')
def _mvb(v):
    fb = v.get('Fb', 0) or 0
    make, buy = v['Fm'] + v['Vm'] * v['volume'], fb + v['Pb'] * v['volume']
    return dict(make=make, buy=buy, best=min(make, buy), decision=1 if make <= buy else 2, indiff=(v['Fm'] - fb) / (v['Pb'] - v['Vm']), savings=abs(make - buy))

@ref('price-break-analysis')
def _pba(v):
    tiers = sorted(((max(0.0, b['min']), b['price']) for b in v['breaks']), key=lambda t: t[0])
    need, lo = v['need'], (v.get('leftover', 0) or 0) / 100
    cur = max(i for i, (mn, _) in enumerate(tiers) if need >= mn) if any(need >= mn for mn, _ in tiers) else 0
    exact = need * tiers[cur][1]
    opts = [(need, exact, exact)] + [(mn, mn * pr, mn * pr - (mn - need) * pr * lo) for mn, pr in tiers[cur + 1:]]
    b = 0
    for i, o in enumerate(opts):
        if o[2] < opts[b][2] - 1e-9: b = i
    return dict(exactCost=exact, bestCost=opts[b][2], buyQty=opts[b][0], savings=exact - opts[b][2], orderUp=tiers[cur + 1][0] * tiers[cur + 1][1] / tiers[cur][1] if cur + 1 < len(tiers) else 0, optQty=[o[0] for o in opts], optCost=[o[1] for o in opts], optNet=[o[2] for o in opts], curTier=cur + 1)

# ================================================================ finance and metrics
@ref('cash-to-cash')
def _c2c(v):
    d = v.get('daysInYear', 365) or 365
    if v.get('mode') == 'days': dio, dso, dpo, tied = v['dio'], v['dso'], v['dpo'], 0
    else: dio, dso, dpo, tied = v['inv'] / (v['cogs'] / d), v['ar'] / (v['revenue'] / d), v['ap'] / (v['cogs'] / d), v['inv'] + v['ar'] - v['ap']
    return dict(DIO=dio, DSO=dso, DPO=dpo, c2c=dio + dso - dpo, cashTied=tied)
@ref('dso')
def _dso(v):
    daily = v['revenue'] / (v.get('daysInYear', 365) or 365)
    return dict(daily=daily, DSO=v['ar'] / daily, turns=v['revenue'] / v['ar'])
@ref('dpo')
def _dpo(v):
    daily = v['cogs'] / (v.get('daysInYear', 365) or 365)
    return dict(daily=daily, DPO=v['ap'] / daily, turns=v['cogs'] / v['ap'])
@ref('dupont-roa')
def _roa(v):
    profit = v['sales'] - v['cogs'] - v['opex']
    assets = v['inv'] + v['ar'] + v['otherCA'] + v['fixed']
    return dict(profit=profit, assets=assets, margin=profit / v['sales'] * 100, turnover=v['sales'] / assets, roa=profit / assets * 100)
@ref('perfect-order')
def _po(v):
    p = v['onTime'] / 100 * v['complete'] / 100 * v['damageFree'] / 100 * v['docs'] / 100
    return dict(perfect=p * 100, imperfect=(1 - p) * 100, weakest=min(v['onTime'], v['complete'], v['damageFree'], v['docs']))
@ref('otif')
def _otif(v): return dict(otif=v['both'] / v['total'] * 100, otPct=v['onTime'] / v['total'] * 100, ifPct=v['inFull'] / v['total'] * 100, failed=v['total'] - v['both'])
@ref('order-fill-rate')
def _ofr(v): return dict(orderFill=v['ordersFilled'] / v['orders'] * 100, lineFill=v['linesFilled'] / v['lines'] * 100, unitFill=v['unitsFilled'] / v['units'] * 100)
@ref('bullwhip-ratio')
def _bw(v):
    d, o = np.array(v['demand'], dtype=float), np.array(v['orders'], dtype=float)
    vd, vo = float(d.var(ddof=1)), float(o.var(ddof=1))
    return dict(varD=vd, varO=vo, ratio=vo / vd, sdRatio=math.sqrt(vo) / math.sqrt(vd), cvD=math.sqrt(vd) / float(d.mean()), cvO=math.sqrt(vo) / float(o.mean()))

# ================================================================ project management
def _network(rows, durs):
    ids = [str(r.get('id', '')).strip() or f'A{i + 1}' for i, r in enumerate(rows)]
    preds = [[ids.index(p) for p in _parse_preds(r.get('preds'))] for r in rows]
    n = len(ids)
    succ = [[j for j in range(n) if i in preds[j]] for i in range(n)]
    @lru_cache(None)
    def ef(i): return (max((ef(p) for p in preds[i]), default=0.0)) + durs[i]
    dur = max((ef(i) for i in range(n)), default=0.0)
    @lru_cache(None)
    def lf(i): return min((lf(j) - durs[j] for j in succ[i]), default=dur)
    es = [ef(i) - durs[i] for i in range(n)]; EF = [ef(i) for i in range(n)]; LF = [lf(i) for i in range(n)]; ls = [LF[i] - durs[i] for i in range(n)]
    slack = [ls[i] - es[i] for i in range(n)]
    tol = 1e-9 * max(1.0, dur)
    return dict(ids=ids, preds=preds, succ=succ, es=es, ef=EF, ls=ls, lf=LF, slack=slack, crit=[1 if abs(s) <= tol else 0 for s in slack], duration=dur, tol=tol)

def _paths(net, durs):
    """Every start-to-finish path as a list of activity indexes."""
    n = len(durs); out = []
    def walk(i, path):
        path = path + [i]
        if not net['succ'][i]: out.append(path)
        for j in net['succ'][i]: walk(j, path)
    for i in range(n):
        if not net['preds'][i]: walk(i, [])
    return out

@ref('cpm')
def _cpm(v):
    durs = [float(r['dur']) for r in v['acts']]
    net = _network(v['acts'], durs)
    return dict(duration=net['duration'], es=net['es'], ef=net['ef'], ls=net['ls'], lf=net['lf'], slack=net['slack'], crit=net['crit'], nCritical=sum(net['crit']), totalSlack=sum(net['slack']))

@ref('pert')
def _pert(v):
    te = [(r['a'] + 4 * r['m'] + r['b']) / 6 for r in v['acts']]
    var = [((r['b'] - r['a']) / 6) ** 2 for r in v['acts']]
    net = _network(v['acts'], te)
    best = 0.0
    for p in _paths(net, te):
        if abs(sum(te[i] for i in p) - net['duration']) <= net['tol'] * 10: best = max(best, sum(var[i] for i in p))
    return dict(te=te, vars=var, T=net['duration'], variance=best, sd=math.sqrt(best), es=net['es'], ef=net['ef'], ls=net['ls'], lf=net['lf'], slack=net['slack'], crit=net['crit'], nCritical=sum(net['crit']))

@ref('pert-probability')
def _pp(v):
    sd = math.sqrt(v['variance'])
    z = (v['deadline'] - v['T']) / sd
    return dict(sd=sd, z=z, prob=float(norm.cdf(z)) * 100, dueFor=v['T'] + float(norm.ppf(v['target'] / 100)) * sd)

@ref('crashing')
def _crash(v):
    rows = v['acts']; n = len(rows)
    nd = [float(r['dur']) for r in rows]; cd = [float(r['crashDur']) for r in rows]
    normal = _network(rows, nd); fastest = _network(rows, cd)
    maxy = [max(0.0, nd[i] - cd[i]) for i in range(n)]
    slope = [(rows[i]['crashCost'] - rows[i]['normalCost']) / maxy[i] if maxy[i] > 0 else 0.0 for i in range(n)]
    target = v['target']
    if target >= normal['duration'] - 1e-9: cost = 0.0
    else:
        # variables: y (crash amount), s (start time), T (finish)
        nv = 2 * n + 1; c = np.zeros(nv); c[:n] = slope
        A, b = [], []
        for i in range(n):
            for p in normal['preds'][i]:
                row = np.zeros(nv); row[n + i] = -1; row[n + p] = 1; row[p] = -1; A.append(row); b.append(-nd[p])      # s_i >= s_p + d_p - y_p
            row = np.zeros(nv); row[2 * n] = -1; row[n + i] = 1; row[i] = -1; A.append(row); b.append(-nd[i])            # T >= s_i + d_i - y_i
        row = np.zeros(nv); row[2 * n] = 1; A.append(row); b.append(target)
        res = linprog(c, A_ub=np.array(A), b_ub=np.array(b), bounds=[(0, m) for m in maxy] + [(0, None)] * (n + 1), method='highs')
        cost = float(res.fun)
    return dict(normalDuration=normal['duration'], minDuration=fastest['duration'], newDuration=min(target, normal['duration']), crashCost=cost, slope=slope, totalCost=sum(r['normalCost'] for r in rows) + cost)

# ================================================================ decision analysis
def _matrix(v):
    k = int(v['nStates'])
    return np.array([[r['s1'], r['s2'], r['s3'], r['s4']][:k] for r in v['payoffs']], dtype=float), (-1 if v.get('sense') == 'min' else 1)

def _ev(v):
    m, s = _matrix(v)
    p = np.array(v['probs'], dtype=float)
    emv = [float(sum(x * q for x, q in zip(row, p))) for row in m]
    b = first_best(emv, s)
    col_best = [s * max(s * m[i][j] for i in range(len(m))) for j in range(m.shape[1])]
    evwpi = float(sum(x * q for x, q in zip(col_best, p)))
    return dict(emv=emv, bestIdx=b + 1, best=emv[b], colBest=col_best, evwpi=evwpi, evpi=abs(evwpi - emv[b]))
REF['expected-value'] = _ev
REF['evpi'] = _ev

@ref('decision-criteria')
def _dc(v):
    m, s = _matrix(v)
    rb = [float(s * max(s * x for x in row)) for row in m]; rw = [float(s * min(s * x for x in row)) for row in m]; avg = [float(sum(row) / len(row)) for row in m]
    cb = [s * max(s * m[i][j] for i in range(len(m))) for j in range(m.shape[1])]
    reg = [[float(s * (cb[j] - row[j])) for j in range(len(row))] for row in m]; mr = [max(r) for r in reg]
    hur = [v['alpha'] * rb[i] + (1 - v['alpha']) * rw[i] for i in range(len(m))]
    a, b, l, h, g = first_best(rb, s), first_best(rw, s), first_best(avg, s), first_best(hur, s), first_best(mr, -1)
    return dict(rowBest=rb, rowWorst=rw, avg=avg, maxReg=mr, hur=hur, regret=reg, maximaxIdx=a + 1, maximaxVal=rb[a], maximinIdx=b + 1, maximinVal=rw[b], laplaceIdx=l + 1, laplaceVal=avg[l], hurwiczIdx=h + 1, hurwiczVal=hur[h], regretIdx=g + 1, regretVal=mr[g])

def tree_value(node, s=1):
    cost = node.get('cost') or 0
    kids = node.get('children') or []
    if node['type'] == 'end' or not kids: return (node.get('payoff') or 0) - cost
    vals = [tree_value(k, s) for k in kids]
    if node['type'] == 'chance': return sum((k.get('prob') or 0) * x for k, x in zip(kids, vals)) - cost
    return vals[first_best(vals, s)] - cost

@ref('decision-tree')
def _dt(v):
    s = -1 if v.get('sense') == 'min' else 1
    root = v['tree']
    count = lambda n: 1 + sum(count(k) for k in (n.get('children') or []))
    kids = [tree_value(k, s) for k in root['children']] if root['type'] == 'decision' else []
    return dict(emv=tree_value(root, s), bestIdx=first_best(kids, s) + 1 if kids else 0, nodes=count(root))
