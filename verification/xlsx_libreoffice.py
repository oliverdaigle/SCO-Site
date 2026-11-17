"""Independent check of the Plan Builder Excel export in a real spreadsheet application.

For each sample dataset: write the .xlsx exactly as the app does, delete every cached formula result from the file
(so nothing can be read back without calculating), open it in LibreOffice, let LibreOffice calculate every formula,
export each sheet, and compare every formula cell with the value the app shows.

Usage: python3 verification/xlsx_libreoffice.py      (needs LibreOffice: soffice on the PATH)
"""
import csv, json, os, re, shutil, subprocess, sys, tempfile, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAMPLES = ['coffee-shop', 'sneaker-resale', 'small-manufacturer']

def strip_cached(src, dst):
    """Copy an .xlsx, removing the <v> cached value of every formula cell."""
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename.startswith('xl/worksheets/sheet'):
                data = re.sub(rb'(</f>)<v>[^<]*</v>', rb'\1', data)
            zout.writestr(item, data)

def col_name(c):
    s = ''; c += 1
    while c: c, r = divmod(c - 1, 26); s = chr(65 + r) + s
    return s

def check(sample, work):
    xlsx, exp_json = os.path.join(work, sample + '.xlsx'), os.path.join(work, sample + '.json')
    subprocess.run(['npx', 'tsx', 'scripts/write-plan-xlsx.ts', sample, xlsx, exp_json], cwd=ROOT, check=True, capture_output=True)
    bare = os.path.join(work, sample + '-bare.xlsx'); strip_cached(xlsx, bare)
    out = os.path.join(work, sample + '-out'); os.makedirs(out, exist_ok=True)
    # Sheet index -1 exports every sheet to its own CSV; full precision, formulas calculated by LibreOffice.
    flt = 'csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,-1'
    subprocess.run(['soffice', '--headless', '--calc', '--convert-to', flt, '--outdir', out, bare], check=True, capture_output=True, timeout=180)
    expected = json.load(open(exp_json)); checked, bad = 0, []
    for sheet in expected:
        path = os.path.join(out, f'{sample}-bare-{sheet["name"]}.csv')
        rows = list(csv.reader(open(path, encoding='utf-8')))
        for cell in sheet['cells']:
            got = rows[cell['r']][cell['c']] if cell['r'] < len(rows) and cell['c'] < len(rows[cell['r']]) else ''
            want = cell['v']; checked += 1
            if isinstance(want, (int, float)) and not isinstance(want, bool):
                try: ok = abs(float(got.replace(',', '').replace('$', '').replace('%', '')) * (0.01 if got.endswith('%') else 1) - want) <= 1e-6 * max(1, abs(want))
                except ValueError: ok = False
            else: ok = str(got) == str(want if want is not None else '')
            if not ok and len(bad) < 8: bad.append(f'{sheet["name"]}!{col_name(cell["c"])}{cell["r"] + 1}: LibreOffice {got!r}, app {want!r}  ({cell["f"][:60]})')
    return checked, bad

def main():
    if not shutil.which('soffice'): print('LibreOffice (soffice) not found; skipping.'); return 0
    work = tempfile.mkdtemp(prefix='lotwise-xlsx-'); failed = False
    for s in SAMPLES:
        n, bad = check(s, work)
        print(f'{"PASS" if not bad else "FAIL"}  {s}: {n} formula cells recalculated by LibreOffice' + ('' if not bad else '\n    ' + '\n    '.join(bad)))
        failed |= bool(bad)
    shutil.rmtree(work, ignore_errors=True); return 1 if failed else 0

if __name__ == '__main__': sys.exit(main())
