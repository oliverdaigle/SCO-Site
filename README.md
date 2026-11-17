# Lotwise

Supply chain math, made obvious. 93 verified supply chain and operations calculators with two ways to use them: **Business mode** gives a plain-language answer, what it means in dollars and time, and what to do next; **Learner mode** shows every step in your textbook's notation, with practice problems and exam review.

Every calculator is checked three ways before it ships: textbook worked examples, randomized comparison against an independently written Python implementation, and simulation of the real-world claim it makes. See `VERIFICATION-REPORT.md` or the `/verified` page.

| Document | What it is for |
|---|---|
| `GO-LIVE.md` | Step-by-step launch guide for a non-developer: accounts, keys, deploy, test, live payments, costs |
| `DECISIONS.md` | Every product, design, and math decision, and why |
| `VERIFICATION-REPORT.md` | The latest verification run, calculator by calculator |
| `launch-kit/` | Launch posts, video script, classmate email, demo video, screenshots |

## Run it

Requires Node 20+ (22 recommended). Python 3.11+ with NumPy, SciPy, and statsmodels is needed only for `npm run verify`.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. With no `.env.local` the site runs in demo mode: sign-in and payments are simulated and Pro can be switched on from the banner. Copy `.env.example` to `.env.local` and fill in keys to use real services.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` then `npm start` | Production build and server |
| `npm run typecheck` | TypeScript check |
| `npm test` | Engine and unit tests (Vitest): worked examples, properties, catalog, Plan Builder, Excel export |
| `npm run test:e2e` | Browser tests (Playwright) on desktop and phone; builds and starts the app unless `E2E_BASE_URL` is set |
| `npm run verify` | Full math verification: all three layers plus the Excel recalculation check. Rewrites `verification/report.json`, `src/data/verified-summary.json`, and `VERIFICATION-REPORT.md` |
| `npm run verify:excel` | Only the LibreOffice recalculation check of the Excel export |
| `npm run a11y` | axe-core accessibility audit (WCAG 2.1 A/AA) of the main pages in both themes, against a running production build |
| `npm run lighthouse` | Lighthouse audit of the landing and calculator pages, mobile and desktop |
| `npm run demo:build` | Builds the standalone single-page demo into `dist-demo/` |

## How the code is organized

```
packages/engine/        Pure TypeScript calculation engine, no UI and no dependencies
  src/calcs/            The 93 calculators, grouped by topic (inventory, service, forecasting, queuing, ...)
  src/math/             Shared math: normal distribution and loss function, forecasting, queues, MRP, simplex, networks
  src/run.ts            Defaults, validation, unit conversion, compute, and explanation for any calculator
  src/units.ts          Time-unit conversion and mismatch notes
  src/notation.ts       Symbols for Heizer, Chopra, Cachon, and Jacobs notation
  src/catalog.ts        Categories, chapters, dependency graph, learning paths
  src/search.ts         Command bar search over names, synonyms, symptoms, and symbols
  src/wizard.ts         Guided wizards for both modes
  src/practice.ts       Practice problem generation and answer checking
  src/parser.ts         Rule-based reader for pasted problems, and the catalog given to the AI reader
  src/planbuilder.ts    CSV parsing, per-SKU forecasting, and inventory policy for the Plan Builder
  test/                 Worked examples, property tests, catalog tests, review regression tests
src/
  app/                  Next.js routes (pages and API routes)
  screens/              Full-page screens shared by the Next.js app and the standalone demo
  components/calc/      Calculator page: inputs, results, steps, what-if, sharing, Pro gates
  components/viz/       Live charts and simulations (XY charts, queue simulation, networks, maps, trees)
  components/map/       3D Formula Map
  components/shell/     Header, command bar, footer, demo banner
  lib/                  State, sharing, analytics, auth and checkout actions, Excel and PDF export, Supabase and Stripe helpers
  platform/             Build-target adapters (navigation, environment, sample data)
supabase/migrations/    Database schema with Row Level Security
verification/           Independent Python reference, randomized cross-check, simulations, Excel check, report
scripts/                Verification export, demo build, audits, launch screenshots and video
tests/                  Unit tests and Playwright end-to-end tests
demo/                   Entry point for the standalone demo bundle
```

## Adding or changing a calculator

1. Edit or add its definition in `packages/engine/src/calcs/`. Give it at least two worked examples with expected answers, a stated `convention` where textbooks differ, and a `claim` if it promises something about the real world.
2. Add the matching independent implementation to `verification/reference.py` (written from the textbook, not translated from the TypeScript), and a simulation in `verification/simulate.py` if it has a claim.
3. Run `npm test` and `npm run verify`. A calculator that fails any layer loses its Verified badge until it is fixed.
