import { ImageResponse } from 'next/og';
import { byId, catById, run, F, type OutputDef } from '@lotwise/engine';
import { decodeValues } from '@/lib/share';

export const dynamic = 'force-dynamic';
const fmt = (o: OutputDef, x: number) => (o.fmt === 'money' ? F.money(x, o.dp) : o.fmt === 'pct' ? F.pct(x, o.dp) : o.fmt === 'int' ? F.int(x) : F.num(x, o.dp) + (o.unit && o.unit !== '$' && o.unit !== '%' ? ' ' + o.unit : ''));

/** Social preview image. With ?v= it shows the shared result, so a pasted link previews the actual answer. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams; const def = byId[q.get('c') ?? '']; const learner = q.get('m') === 'learner';
  const accent = learner ? '#FFA35C' : '#8E9BFF'; let title = 'Supply chain math, made obvious.'; let sub = '93 verified calculators for people who run operations and people who study them.'; let stats: { k: string; v: string }[] = []; let eyebrow = 'LOTWISE';
  if (def) {
    title = learner ? def.name : def.bq; eyebrow = catById[def.cat].name.toUpperCase(); sub = def.blurb;
    const vals = decodeValues(def.id, q.get('v')); const r = run(def, vals ?? def.examples[0].v);
    if (r.ok) {
      const outs = def.outputs.filter((o) => typeof r.o[o.id] === 'number' && (!o.show || o.show(r.v, r.o))); const prim = outs.filter((o) => o.primary);
      stats = [...prim, ...outs.filter((o) => !o.primary)].slice(0, 3).map((o) => ({ k: (learner ? o.label : o.blabel ?? o.label).slice(0, 34), v: fmt(o, r.o[o.id] as number) }));
      if (vals && !learner && r.biz?.headline) sub = r.biz.headline.replace(/\*\*/g, '');
    }
  }
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#090B10', color: '#EDEFF5', padding: 64, fontFamily: 'sans-serif', position: 'relative' }}>
        <div style={{ position: 'absolute', top: -220, right: -160, width: 620, height: 620, borderRadius: 620, background: accent, opacity: 0.16, display: 'flex' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <svg width="56" height="56" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8E9BFF" /><stop offset="1" stopColor="#FFA35C" /></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#g)" /><path d="M6.5 22.5V10l9 12.5V10l9 12.5" fill="none" stroke="#0A0C14" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div style={{ marginLeft: 16, fontSize: 38, fontWeight: 700, letterSpacing: -1.5 }}>Lotwise</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 22, color: '#4ADE80', border: '2px solid rgba(74,222,128,0.4)', borderRadius: 999, padding: '8px 20px' }}>Verified math</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 22, letterSpacing: 3, color: accent, display: 'flex' }}>{eyebrow}</div>
          <div style={{ fontSize: title.length > 48 ? 56 : 68, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2, marginTop: 14, display: 'flex' }}>{title}</div>
          <div style={{ fontSize: 27, lineHeight: 1.35, color: '#A3ABBD', marginTop: 18, display: 'flex' }}>{sub.length > 150 ? sub.slice(0, 147) + '...' : sub}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex' }}>
            {stats.map((s, i) => (<div key={i} style={{ display: 'flex', flexDirection: 'column', marginRight: 52 }}><div style={{ fontSize: 20, color: '#7D869A', display: 'flex' }}>{s.k}</div><div style={{ fontSize: 46, fontWeight: 700, color: i === 0 ? accent : '#EDEFF5', display: 'flex' }}>{s.v}</div></div>))}
          </div>
          <div style={{ fontSize: 24, color: '#7D869A', display: 'flex' }}>lotwise.io</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { 'cache-control': 'public, max-age=86400, s-maxage=604800' } },
  );
}
