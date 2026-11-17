// Runs the TypeScript engine on a JSON list of { id, v } requests from stdin. Used by the Python simulation harness.
import { byId, run } from '../packages/engine/src';
let buf = '';
process.stdin.on('data', (d) => (buf += d));
process.stdin.on('end', () => {
  const reqs: { id: string; v: any }[] = JSON.parse(buf);
  const out = reqs.map((q) => { const r = run(byId[q.id], q.v ?? {}); return { ok: r.ok, errors: r.errors, o: r.o }; });
  process.stdout.write(JSON.stringify(out, (_k, x) => (typeof x === 'number' && !Number.isFinite(x) ? String(x) : x)));
});
