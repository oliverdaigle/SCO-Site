// Builds the standalone demo: dist-demo/index.html (styles inlined) + dist-demo/app.js.
// Usage: npm run demo:build
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist-demo'); const tmp = path.join(root, 'demo', '.generated');
mkdirSync(out, { recursive: true }); mkdirSync(tmp, { recursive: true });

// 1. Sample datasets inlined, so the demo needs no file server.
const samples = Object.fromEntries(readdirSync(path.join(root, 'public/samples')).filter((f) => f.endsWith('.csv')).map((f) => [f.replace(/\.csv$/, ''), readFileSync(path.join(root, 'public/samples', f), 'utf8')]));
writeFileSync(path.join(tmp, 'samples.artifact.ts'), `export { SAMPLES } from '@/data/samples';\nconst DATA: Record<string, string> = ${JSON.stringify(samples)};\nexport async function loadSample(id: string): Promise<string> { const d = DATA[id]; if (!d) throw new Error('Could not load the sample file.'); return d; }\n`);

// 2. JavaScript bundle.
const alias = (from, to) => ({ filter: new RegExp('^' + from.replace(/[/@.]/g, '\\$&') + '$'), to: path.join(root, to) });
const swaps = [alias('@/platform/nav', 'src/platform/nav.hash.tsx'), alias('@/platform/samples', 'demo/.generated/samples.artifact.ts'), alias('@/lib/supabase/client', 'demo/supabase-stub.ts'), alias('./supabase/client', 'demo/supabase-stub.ts'), alias('@lotwise/engine', 'packages/engine/src/index.ts')];
const exts = ['.tsx', '.ts', '.json', '/index.ts', ''];
const resolvePlugin = { name: 'lotwise-paths', setup(b) {
  for (const s of swaps) b.onResolve({ filter: s.filter }, () => ({ path: s.to }));
  b.onResolve({ filter: /^@\// }, (a) => { const base = path.join(root, 'src', a.path.slice(2)); for (const e of exts) { try { if (statSync(base + e).isFile()) return { path: base + e }; } catch { /* next */ } } return null; });
} };
await build({
  entryPoints: [path.join(root, 'demo/main.tsx')], outfile: path.join(out, 'app.js'), bundle: true, minify: true, format: 'iife', platform: 'browser', target: 'es2020', jsx: 'automatic', legalComments: 'none', logLevel: 'warning',
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_TARGET': '"artifact"', 'process.env.NEXT_PUBLIC_SUPABASE_URL': '""', 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': '""', 'process.env.NEXT_PUBLIC_SITE_URL': '""', 'process.env': '{}', global: 'globalThis' },
  plugins: [resolvePlugin],
});

// 3. Styles: the same Tailwind stylesheet as the app, plus a few rules the demo host expects.
const cssIn = path.join(tmp, 'demo.css');
writeFileSync(cssIn, `@import "../../src/app/globals.css";\n@source "../../src";\n@source "../main.tsx";\n`);
execFileSync(path.join(root, 'node_modules/.bin/tailwindcss'), ['-i', cssIn, '-o', path.join(tmp, 'app.css'), '--minify'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
const hostCss = `
/* Demo host: keep the sticky header and the page clear of a phone's system bars. */
header.sticky{top:env(safe-area-inset-top,0px)}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:45;background:var(--bg)}
`;
const css = readFileSync(path.join(tmp, 'app.css'), 'utf8') + hostCss;
const html = `<title>Lotwise Demo</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Geist:wght@300..800&family=Geist+Mono:wght@400..600&display=swap">
<style>${css}</style>
<div id="lotwise-root"><noscript>The Lotwise demo needs JavaScript.</noscript></div>
<script src="app.js"></script>
`;
writeFileSync(path.join(out, 'index.html'), html);
const kb = (f) => (statSync(path.join(out, f)).size / 1024).toFixed(0) + ' KB';
console.log(`demo built: index.html ${kb('index.html')}, app.js ${kb('app.js')}`);
