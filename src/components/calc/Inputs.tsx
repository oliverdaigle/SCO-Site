'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { sym as resolveSym, type CalcDef, type InputDef, type Mode, type NotationId, type TimeUnit, type Vals, type TreeNode } from '@lotwise/engine';
import { Tex } from '../Tex';
import { Icon } from '../icons';
import { Tip, cx } from '../ui';

export function parseNum(s: string): number { const t = s.replace(/[$,%\s]/g, ''); if (t === '' || t === '-' || t === '.') return NaN; const n = Number(t); return Number.isFinite(n) ? n : NaN; }
export function parseSeries(s: string): number[] { return s.split(/[\s,;\t\n]+/).map((x) => x.replace(/[$,%]/g, '')).filter((x) => x !== '').map(Number); }
const show = (n: number) => (Number.isFinite(n) ? String(+n.toPrecision(12)) : '');

function NumberField({ inp, value, unit, onChange, onUnit, mode, nota }: { inp: InputDef; value: number; unit?: TimeUnit; onChange: (v: number) => void; onUnit: (u: TimeUnit) => void; mode: Mode; nota: NotationId }) {
  const id = useId(); const [text, setText] = useState(show(value)); const focused = useRef(false);
  useEffect(() => { if (!focused.current || parseNum(text) !== value) { if (!(focused.current && Number.isNaN(parseNum(text)) && Number.isNaN(value))) setText(show(value)); } }, [value]); // eslint-disable-line
  const invalid = !Number.isFinite(value) || (inp.min !== undefined && value < inp.min) || (inp.max !== undefined && value > inp.max);
  const prefix = inp.kind === 'money' ? '$' : null; const suffix = inp.kind === 'percent' ? '%' : inp.unit && inp.unit !== '$' && inp.unit !== '%' && !inp.time ? inp.unit : null;
  const role = inp.time?.role;
  return (
    <div className="flex h-full flex-col justify-end">
      <FieldLabel inp={inp} mode={mode} nota={nota} htmlFor={id} />
      <div className="mt-1.5 flex gap-2">
        <div className="relative min-w-0 flex-1">
          {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">{prefix}</span>}
          <input id={id} className="input num" style={{ paddingLeft: prefix ? 24 : undefined, paddingRight: suffix ? Math.min(80, 16 + suffix.length * 8) : undefined }} inputMode="decimal" autoComplete="off" value={text} aria-invalid={invalid}
            onFocus={() => (focused.current = true)} onBlur={() => { focused.current = false; setText(show(value)); }}
            onChange={(e) => { setText(e.target.value); onChange(parseNum(e.target.value)); }} />
          {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">{suffix}</span>}
        </div>
        {inp.time && (
          <select aria-label={`${inp.label} time unit`} className="input w-[7.2rem] shrink-0 text-sm" value={unit ?? inp.time.unit} onChange={(e) => onUnit(e.target.value as TimeUnit)}>
            {(['day', 'week', 'month', 'year'] as TimeUnit[]).map((u) => <option key={u} value={u}>{role === 'dur' ? u + 's' : 'per ' + u}</option>)}
          </select>)}
      </div>
    </div>
  );
}

function FieldLabel({ inp, mode, nota, htmlFor }: { inp: InputDef; mode: Mode; nota: NotationId; htmlFor?: string }) {
  const s = resolveSym(inp.sym, nota); const text = mode === 'business' ? inp.blabel ?? inp.label : inp.label;
  return (
    <label htmlFor={htmlFor} className="label flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {mode === 'learner' && s && <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-accent"><Tex>{s}</Tex></span>}
      <span>{text}</span>
      {inp.help && <Tip text={inp.help}><Icon name="info" size={14} className="text-faint" /><span className="sr-only">Definition</span></Tip>}
    </label>
  );
}

function SeriesField({ inp, value, onChange, mode, nota }: { inp: InputDef; value: number[]; onChange: (v: number[]) => void; mode: Mode; nota: NotationId }) {
  const id = useId(); const [text, setText] = useState((value ?? []).join(', ')); const last = useRef(JSON.stringify(value));
  useEffect(() => { const j = JSON.stringify(value); if (j !== last.current) { last.current = j; setText((value ?? []).join(', ')); } }, [value]);
  const bad = (value ?? []).some((x) => !Number.isFinite(x));
  return (
    <div>
      <FieldLabel inp={inp} mode={mode} nota={nota} htmlFor={id} />
      <textarea id={id} className="input num mt-1.5 min-h-[72px] resize-y text-sm" rows={Math.min(5, Math.max(2, Math.ceil(text.length / 44)))} value={text} aria-invalid={bad} spellCheck={false}
        placeholder="Type or paste numbers: 120, 135, 128 …" onChange={(e) => { setText(e.target.value); const v = parseSeries(e.target.value); last.current = JSON.stringify(v); onChange(v); }} />
      <div className="mt-1 flex justify-between text-xs text-faint"><span>{(value ?? []).length} value{(value ?? []).length === 1 ? '' : 's'}{bad && <span className="text-bad"> · contains something that is not a number</span>}</span><span>Paste a column from a spreadsheet</span></div>
    </div>
  );
}

function parseGrid(text: string): string[][] { return text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '').map((l) => (l.includes('\t') ? l.split('\t') : l.split(',')).map((c) => c.trim().replace(/^"|"$/g, ''))); }
function TableField({ inp, value, onChange, mode, nota }: { inp: InputDef; value: any[]; onChange: (v: any[]) => void; mode: Mode; nota: NotationId }) {
  const cols = inp.columns!; const rows = Array.isArray(value) ? value : []; const file = useRef<HTMLInputElement>(null);
  const load = (grid: string[][]) => {
    if (!grid.length) return; const numCols = cols.map((c, i) => (c.kind === 'number' ? i : -1)).filter((i) => i >= 0);
    const header = numCols.some((i) => grid[0][i] !== undefined && Number.isNaN(parseNum(grid[0][i] ?? '')) && (grid[0][i] ?? '') !== '');
    const body = header ? grid.slice(1) : grid;
    onChange(body.map((r) => Object.fromEntries(cols.map((c, i) => [c.id, c.kind === 'number' ? (Number.isNaN(parseNum(r[i] ?? '')) ? 0 : parseNum(r[i] ?? '')) : r[i] ?? '']))));
  };
  const set = (ri: number, cid: string, v: any) => onChange(rows.map((r, i) => (i === ri ? { ...r, [cid]: v } : r)));
  return (
    <div onPaste={(e) => { const t = e.clipboardData.getData('text'); if (t.includes('\n') || t.includes('\t')) { e.preventDefault(); load(parseGrid(t)); } }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldLabel inp={inp} mode={mode} nota={nota} />
        <div className="flex gap-1.5">
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => file.current?.click()}><Icon name="upload" size={13} />CSV</button>
          <input ref={file} type="file" accept=".csv,.tsv,.txt,text/csv" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) load(parseGrid(await f.text())); e.target.value = ''; }} />
        </div>
      </div>
      <div className="scroll-x mt-1.5 rounded-[10px] border border-line-strong bg-sunken">
        <table className="w-full text-sm">
          <thead><tr>{cols.map((c) => <th key={c.id} scope="col" className="whitespace-nowrap border-b border-line px-2 py-1.5 text-left text-[11px] font-medium text-muted">{c.label}</th>)}<th className="w-8 border-b border-line"><span className="sr-only">Remove</span></th></tr></thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-b border-line last:border-0">
                {cols.map((c) => (<td key={c.id} className="p-0"><Cell kind={c.kind} value={r?.[c.id]} label={`${c.label}, row ${ri + 1}`} onChange={(v) => set(ri, c.id, v)} /></td>))}
                <td className="p-0 text-center"><button type="button" aria-label={`Remove row ${ri + 1}`} className="p-1.5 text-faint hover:text-bad" onClick={() => onChange(rows.filter((_, i) => i !== ri))}><Icon name="x" size={13} /></button></td>
              </tr>))}
          </tbody>
        </table>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-faint">
        <button type="button" className="btn btn-sm" onClick={() => onChange([...rows, Object.fromEntries(cols.map((c) => [c.id, c.kind === 'number' ? 0 : c.id === cols[0].id ? `${rows.length + 1}` : '']))])}><Icon name="plus" size={13} />Add row</button>
        <span>Paste rows straight from a spreadsheet</span>
      </div>
    </div>
  );
}
function Cell({ kind, value, onChange, label }: { kind: 'text' | 'number'; value: any; onChange: (v: any) => void; label: string }) {
  const [text, setText] = useState(kind === 'number' ? show(Number(value)) : String(value ?? '')); const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(kind === 'number' ? show(Number(value)) : String(value ?? '')); }, [value, kind]);
  return <input aria-label={label} className={cx('h-9 w-full min-w-[4.5rem] bg-transparent px-2 outline-none focus:bg-accent-soft', kind === 'number' && 'num')} inputMode={kind === 'number' ? 'decimal' : 'text'} value={text} onFocus={() => (focused.current = true)} onBlur={() => { focused.current = false; }}
    onChange={(e) => { setText(e.target.value); onChange(kind === 'number' ? parseNum(e.target.value) : e.target.value); }} />;
}

let uid = 0; const nid = () => `n${Date.now().toString(36)}${uid++}`;
function TreeEditor({ node, onChange, onRemove, parentType, depth }: { node: TreeNode; onChange: (n: TreeNode) => void; onRemove?: () => void; parentType?: string; depth: number }) {
  const kids = node.children ?? [];
  const add = (type: TreeNode['type']) => onChange({ ...node, children: [...kids, type === 'end' ? { id: nid(), type, label: 'Outcome', payoff: 0, prob: node.type === 'chance' ? 0 : undefined } : { id: nid(), type, label: type === 'chance' ? 'Uncertain event' : 'Choice', prob: node.type === 'chance' ? 0 : undefined, children: [] }] });
  return (
    <div className={cx(depth > 0 && 'ml-3 border-l border-line pl-3 sm:ml-5')}>
      <div className="flex flex-wrap items-center gap-1.5 py-1">
        <select aria-label="Node type" className="input h-8 w-[6.6rem] text-xs" value={node.type} onChange={(e) => { const t = e.target.value as TreeNode['type']; onChange(t === 'end' ? { id: node.id, type: t, label: node.label, prob: node.prob, cost: node.cost, payoff: node.payoff ?? 0 } : { ...node, type: t, children: kids }); }}>
          <option value="decision">□ Decision</option><option value="chance">○ Chance</option><option value="end">◁ Outcome</option>
        </select>
        <input aria-label="Label" className="input h-8 min-w-[7rem] flex-1 text-sm" value={node.label} onChange={(e) => onChange({ ...node, label: e.target.value })} />
        {parentType === 'chance' && (<label className="flex items-center gap-1 text-xs text-muted">P<input aria-label="Probability" className="input num h-8 w-16 text-sm" inputMode="decimal" defaultValue={node.prob ?? 0} key={`p${node.id}`} onChange={(e) => onChange({ ...node, prob: parseNum(e.target.value) })} /></label>)}
        {node.type === 'end' ? (<label className="flex items-center gap-1 text-xs text-muted">Payoff<input aria-label="Payoff" className="input num h-8 w-24 text-sm" inputMode="decimal" defaultValue={node.payoff ?? 0} key={`v${node.id}`} onChange={(e) => onChange({ ...node, payoff: parseNum(e.target.value) })} /></label>)
          : (<label className="flex items-center gap-1 text-xs text-muted">Cost<input aria-label="Cost" className="input num h-8 w-20 text-sm" inputMode="decimal" defaultValue={node.cost ?? 0} key={`c${node.id}`} onChange={(e) => onChange({ ...node, cost: parseNum(e.target.value) || 0 })} /></label>)}
        {onRemove && <button type="button" aria-label={`Remove ${node.label}`} className="p-1.5 text-faint hover:text-bad" onClick={onRemove}><Icon name="trash" size={14} /></button>}
      </div>
      {node.type !== 'end' && (<>
        {kids.map((k, i) => <TreeEditor key={k.id} node={k} depth={depth + 1} parentType={node.type} onChange={(n) => onChange({ ...node, children: kids.map((x, j) => (j === i ? n : x)) })} onRemove={() => onChange({ ...node, children: kids.filter((_, j) => j !== i) })} />)}
        <div className="ml-3 flex flex-wrap gap-1.5 py-1 pl-3 sm:ml-5">
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => add('end')}><Icon name="plus" size={12} />Outcome</button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => add('chance')}><Icon name="plus" size={12} />Chance</button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => add('decision')}><Icon name="plus" size={12} />Decision</button>
        </div></>)}
    </div>
  );
}

export function InputPanel({ def, values, onChange, mode, nota }: { def: CalcDef; values: Vals; onChange: (patch: Vals) => void; mode: Mode; nota: NotationId }) {
  const visible = def.inputs.filter((i) => (!i.show || i.show(values)) && !(mode === 'business' && i.learnerOnly));
  const main = visible.filter((i) => !i.adv), adv = visible.filter((i) => i.adv); const [open, setOpen] = useState(false);
  const field = (i: InputDef) => {
    if (i.kind === 'select') { return (<div key={i.id} className="flex h-full flex-col justify-end"><FieldLabel inp={i} mode={mode} nota={nota} htmlFor={`f-${def.id}-${i.id}`} /><select id={`f-${def.id}-${i.id}`} className="input mt-1.5" value={values[i.id]} onChange={(e) => onChange({ [i.id]: e.target.value })}>{i.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>); }
    if (i.kind === 'series') return <SeriesField key={i.id} inp={i} value={values[i.id]} onChange={(v) => onChange({ [i.id]: v })} mode={mode} nota={nota} />;
    if (i.kind === 'table') return <TableField key={i.id} inp={i} value={values[i.id]} onChange={(v) => onChange({ [i.id]: v })} mode={mode} nota={nota} />;
    if (i.kind === 'tree') return (<div key={i.id}><FieldLabel inp={i} mode={mode} nota={nota} /><div className="scroll-x mt-1.5 rounded-[10px] border border-line-strong bg-sunken p-2"><div className="min-w-[30rem]"><TreeEditor node={values[i.id]} depth={0} onChange={(n) => onChange({ [i.id]: n })} /></div></div></div>);
    const off = i.time?.unless && values[i.time.unless[0]] === i.time.unless[1]; // the unit picker is hidden when the number is used as entered
    return <NumberField key={i.id} inp={off ? { ...i, time: undefined } : i} value={values[i.id]} unit={values[i.id + '_u']} onChange={(v) => onChange({ [i.id]: v })} onUnit={(u) => onChange({ [i.id + '_u']: u })} mode={mode} nota={nota} />;
  };
  const wide = (i: InputDef) => i.kind === 'table' || i.kind === 'series' || i.kind === 'tree';
  return (
    <form className="space-y-4" onSubmit={(e) => e.preventDefault()} aria-label={`${def.name} inputs`}>
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{main.map((i) => <div key={i.id} className={wide(i) || main.length === 1 ? 'sm:col-span-2 lg:col-span-1 xl:col-span-2' : ''}>{field(i)}</div>)}</div>
      {adv.length > 0 && (
        <div className="border-t border-line pt-3">
          <button type="button" className="flex w-full items-center justify-between text-sm font-medium text-muted hover:text-fg" aria-expanded={open} onClick={() => setOpen(!open)}><span>{mode === 'learner' ? 'Conventions and options' : 'More options'}</span><Icon name="chevronDown" className={cx('transition-transform', open && 'rotate-180')} /></button>
          {open && <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{adv.map((i) => <div key={i.id} className={wide(i) ? 'sm:col-span-2 lg:col-span-1 xl:col-span-2' : ''}>{field(i)}</div>)}</div>}
        </div>)}
    </form>
  );
}
