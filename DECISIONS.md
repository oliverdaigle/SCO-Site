# Decisions

This file records every judgment call made while building Lotwise, so you can see why things are the way they are and change them with confidence. It is organized from the outside in: name and brand, product, architecture, math conventions, verification, quality checks, and known limits.

## 1. Name

**Brainstormed (15):** Sawtooth, Takt, Lotwise, Opsolve, Reorderly, Flowmath, Bullwhip, Cyclestock, Leadtime Lab, Stockwise, Chainwise, Throughline, Supplymath, Kanbanly, Restock IQ.

**Shortlist (5) and why each did or did not win:**

| Name | For | Against |
|---|---|---|
| **Lotwise** (chosen) | "Lot" is the core unit of inventory and lot sizing; "wise" says judgment, not just arithmetic. Two syllables, easy to spell after hearing it once, works for a shop owner and a student alike. No product with this name turned up in searches. | Not self-explanatory on first sight, which the tagline fixes. |
| Sawtooth | The inventory curve itself, instantly meaningful to anyone who has taken an ops class, and a great logo. | Too obscure for business owners, and an existing word that is crowded in software. |
| Takt | Short and loved by lean practitioners. | Narrow: says manufacturing, not inventory, forecasting, or students. |
| Throughline | Elegant, suggests flow. | Abstract, and says nothing about supply chain. |
| Flowmath | Literal and friendly. | Generic, sounds like a math tutoring app. |

Reorderly and Stockwise were cut early because products with those names already exist.

**Domain:** live domain lookups were blocked from the build environment, so availability could not be confirmed. The code uses `lotwise.io` as the default. Check these at a registrar, in this order, and set `NEXT_PUBLIC_SITE_URL` to whichever you buy: `lotwise.io`, `lotwise.app`, `lotwise.co`, `getlotwise.com`, `uselotwise.com`, `lotwise.com` (likely premium if taken).

## 2. Brand

**Tagline:** "Supply chain math, made obvious."

**Logo:** the inventory sawtooth (stock drawn down, then refilled) as a single stroke on a rounded tile with a blue to orange gradient. The two colors are the two modes. It stays legible at 16 px (favicon) because it is one bold stroke with no text. Files: `public/icon.svg` and the `LogoMark` component in `src/components/icons.tsx`.

**Color system** (tokens in `src/app/globals.css`):

| Token | Dark (default) | Light | Use |
|---|---|---|---|
| Business accent | `#8e9bff` periwinkle | `#3b49df` | Calm, premium, crisp |
| Learner accent | `#ffa35c` apricot | `#9c3c07` | Warmer and brighter, friendlier |
| Background | `#090b10` | `#f6f7fb` | Neutrals carry a slight blue bias so they read as chosen, not default grey |
| Good / warn / bad | `#4ade80` / `#fbbf24` / `#f87171` | `#166534` / `#92400e` / `#a61d1d` | Status only, never decoration |

Dark is the default (the Linear and Stripe reference), with a fully designed light theme. Both modes share every token except the accent, so switching modes changes the mood without changing the product. Every text color passes WCAG AA (4.5:1) on every surface it appears on, including the tinted badge backgrounds; the light Learner accent and a few light-theme status colors were darkened during the accessibility audit to get there.

**Type:** Geist for interface text, Bricolage Grotesque for display headings (characterful, slightly quirky, used sparingly), Geist Mono for numbers and answers so digits line up, and a serif math stack (STIX Two, Cambria Math, Latin Modern) for formulas so they look like a textbook. Fonts are self-hosted through Fontsource, so there is no third-party font request.

**Icons:** one hand-drawn set on a 24 px grid with 1.6 px round strokes and no fills (`src/components/icons.tsx`). No emoji anywhere in the interface.

## 3. Product decisions

**Two modes, one engine.** Business and Learner are views over the same calculation. Business uses everyday labels ("How much sales swing"), converts units automatically, and leads with a one-sentence answer, what it means in dollars and time, and two or three actions, with the math collapsed. Learner uses textbook symbols, shows every substitution and table lookup, lists exam traps, and offers an "Explain like I'm new" toggle with an everyday analogy.

**Mode choice.** First visitors to `/start` see two large panels ("I'm running a business" / "I'm learning"). The choice is remembered in the browser and, when signed in, on the profile. A toggle in the header switches at any time and keeps you on the same calculator.

**Routing.** Four ways to the right calculator: guided wizards in each mode (every calculator is reachable, and a test enforces that), the command bar (Ctrl K or Cmd K, also "/"), which searches names, synonyms, symptoms ("I keep running out of stock"), and symbols, browsing by category (Business) or chapter (Learner), and related calculators drawn from the formula dependency graph.

**Pricing.**

| Plan | Price | What it adds |
|---|---|---|
| Free | $0 | Every calculator, answer, chart, worked example, share link, the Formula Map, embeds. Learners see the answer, the formula, and the first step, and get 3 practice problems a day. |
| Business Pro | $12 a month | What-if sliders, saved scenario comparison, PDF summaries, the full Plan Builder (all SKUs, your own CSV, live-formula Excel export), all Wrapped cards. |
| Learner Pro | $5 a month, or $15 one-time for 5 months | Every step of every solution, unlimited practice, Exam Review, Paste Your Problem solving, formula sheet PDFs. |

The semester pass is a one-time payment rather than a subscription because students forget to cancel and resent it; a pass that simply ends is easier to say yes to. Five months covers a full term plus finals.

**Upgrade prompts** appear only where the locked feature would be, written in that mode's voice, never as pop-ups. Each one logs an `upgrade_view` event so the dashboard funnel shows which prompts work.

**Demo mode.** With no keys configured the site runs fully: sign-in and checkout are simulated, a banner says so, and a switch in the banner turns Pro on or off. Pro starts on so the whole product can be explored.

**Paste Your Problem** uses Claude when `ANTHROPIC_API_KEY` is set and a rule-based reader otherwise. Both always show what was extracted (model, each number, its unit, and the phrase it came from) and let the user correct anything before solving. When accounts are live, the AI reader only answers signed-in Learner Pro users, so nobody else can spend your API budget.

**Analytics** are first-party and privacy-friendly: events go to your own database with a random per-tab id, no cookies, no IP addresses, no third-party scripts. Searches that find nothing are logged so the owner dashboard can show what people looked for and did not find.

## 4. Architecture

- **Calculation engine** (`packages/engine`): pure TypeScript with zero dependencies and no UI code. Each of the 93 calculators is a declarative definition: inputs (with units, ranges, help, and parser cues), outputs, the compute function, explanatory steps, the business summary, the chart spec, traps, an analogy, its stated convention, worked examples, and a practice generator. `run()` applies defaults, validates, converts units, checks, computes, and builds the explanation. The same engine runs in the browser, in tests, in the verification harness, and in the Excel model.
- **App:** Next.js (App Router) with TypeScript and Tailwind. All 186 calculator pages (93 per mode) plus practice pages are generated at build time, so they load as static HTML with structured data. Interactive parts hydrate on top.
- **State:** a small persisted store (Zustand) for mode, theme, notation, practice streaks, and saved scenarios. Writes to browser storage are blocked until the saved state has loaded, which prevents a newly opened page from overwriting it with defaults (a bug the end-to-end tests caught). When signed in, the same state syncs to the user's profile.
- **Accounts:** Supabase Auth with email magic links and Google. Database tables use Row Level Security: users can read only their own profile and subscriptions, can update only their own name, mode, notation, and synced state, and cannot touch billing fields. Analytics events have no policies at all, so only the server can read or write them.
- **Payments:** Stripe Checkout for subscriptions and the one-time pass, the Stripe customer portal for billing changes, and a signed webhook as the only thing that grants or removes Pro. If you do not create Prices in Stripe, the checkout describes the three prices inline, so there is nothing to set up in Stripe beyond keys and the webhook.
- **Embeds:** `/embed/[calculator]` renders a themed widget (mode, light or dark, any accent color) with a "Powered by Lotwise" link. `public/embed.js` turns tagged elements into iframes that resize to fit. The embed builder has a live preview and copy buttons.
- **Share links** carry only the inputs that differ from defaults, encoded in the URL, and get an automatic preview image showing the actual answer (`/api/og`).
- **Formula Map:** a Three.js scene of all 93 calculators and their 97 dependencies, with category filters and lit-up learning paths. It falls back to a 2D map when the visitor prefers reduced motion, on low-memory devices, when WebGL is drawn in software (no graphics acceleration), or automatically if the 3D view runs below about 20 frames a second.
- **Standalone demo:** the same screens also build into a single-page bundle with hash routing (`npm run demo:build`). UI code imports navigation from one adapter, which the demo build swaps out. This is what powers the hosted demo link.

## 5. Math conventions

Where textbooks agree, Lotwise uses the common form. Where they disagree, it uses the most common one by default, offers the alternative as a setting, and says which is in use on the page.

| Topic | Default | Alternative offered |
|---|---|---|
| Holding cost | $ per unit per period | % of unit cost (H = I × C) |
| z for a service level | Exact inverse normal (95% gives 1.6449) | Printed-table z (closest 4-decimal area, ties to the larger z, so 95% gives 1.65), and Cachon's round-up rule |
| Combined safety stock | z × √(L·σd² + d̄²·σL²), all inputs converted to one time unit first | |
| Fill rate | ESC = σL × G(z), fill rate = 1 − ESC/Q, never below 0% | Solve for the safety stock that hits a target fill rate |
| Newsvendor | Critical ratio Cu / (Cu + Co), normal demand | Costs as price, cost, and salvage, or Cu and Co directly |
| Tracking signal | RSFE / MAD with error = actual − forecast | Forecast − actual (flips the sign) |
| PERT | te = (a + 4m + b)/6, variance ((b − a)/6)², largest path variance when paths tie | |
| Capability | Cp = (USL − LSL)/6σ, Cpk = min of the two one-sided ratios | |
| Control charts | Range-based A2, D3, D4 factors (published values) | |
| M/M/s staffing cost | Waiting cost charged on everyone in the system (Ls) | Charged only on customers in line (Lq), as in Heizer's worked example |
| Kingman | Cachon and Terwiesch form for m servers | |
| Learning curve | Unit (Crawford) model, cumulative time as the exact sum | |
| Holt-Winters start | First two cycles (most software) | Deseasonalized regression (Chopra and Meindl) |
| Aggregate planning | Level plan never runs short when no backorder cost is given (rate raised to cover cumulative demand) | Enter a backorder cost to allow shortages at the average rate |
| Quantity discounts | All-units; savings measured against the best order at the base price | Holding cost as a fixed $ per unit |
| Line balancing | Longest task time first, ties to most following tasks | |
| ABC | A = first 80% of value, B = next 15%, C = last 5% | Cutoffs editable |
| Time units | Weeks per year 52 and 7 days per week in a calendar year; in a working-day year, 5 days per week (6 for 280 to 329 days) and weeks = days ÷ days per week, so 250 days is 50 weeks | |

Standard deviations scale with the square root of time, rates scale linearly, and durations convert directly. When inputs arrive in mixed units, the page says what it converted. A routine textbook mix (daily demand with an annual holding cost) gets a neutral note; a mix the user created gets a warning.

Line balancing and part-period balancing are heuristics, and their pages say so. The simulation suite reports how close they get: line balancing finds the true minimum number of stations on 95% of small random lines (never more than one station over), and part-period balancing averages 11% above the optimal Wagner-Whitin plan.

## 6. Verification

Every calculator passes three layers before it gets a Verified badge, and the public Verified page is generated from the same test run as `VERIFICATION-REPORT.md`.

1. **Worked examples:** at least two textbook-style problems per calculator, matched to the precision the expected answer is written with (16.5 must match to one decimal; 200 must match exactly).
2. **Independent reference:** a separate Python implementation (NumPy, SciPy, statsmodels), written from the textbook formulas rather than translated from the TypeScript, compared on 2,000 randomized inputs per calculator with randomized time units and options. Tolerance is one part in a billion, except two iterative solvers (fill rate 1e-7, crashing 1e-6). Tolerances were never loosened to make a test pass; the harness was itself checked by planting errors of one part in a million, which it caught.
3. **Simulation:** 30 suites (Monte Carlo, discrete-event simulation, brute-force search) for every calculator whose formula claims something about the real world, for example that a 95% safety stock avoids stockouts in 95% of cycles. Simulations never use the formula under test.

Property tests cover monotonicity, limits, identities, unit consistency, and edge cases such as zero variance, zero lead time, a 100% service level, and malformed data. The Plan Builder's Excel export is checked separately: every cached result is deleted from the file and LibreOffice recalculates the workbook from the raw sales history, and all 5,992 formula cells across the three sample workbooks must match the app.

Run everything with `npm run verify`. Latest result: 93 of 93 calculators verified, 187 of 187 examples, 2,348,859 values compared with zero mismatches, 514 of 514 property tests, 30 of 30 simulation suites (146.5 million trials).

## 7. Independent review

As the brief required, a separate reviewer that had not written the code audited 36 calculators (24 chosen at random with a fixed seed, plus the ones with the most convention risk) against the textbooks, computing its own answers independently. It confirmed every convention listed in section 5 and found these problems, all fixed and covered by new regression tests (`packages/engine/test/review.test.ts`):

| Finding | Fix |
|---|---|
| Aggregate planning: the level plan let inventory go negative for free when no backorder cost was entered, so it could look cheapest when it was not. | Without a backorder cost the level rate is raised to the lowest rate that never runs short; with one, shortages are priced. The practice problems now say "no shortages allowed". |
| Safety stock (variable demand): a standard deviation stated "for the whole lead time" was still rescaled if its unit selector differed. | That input is now used exactly as entered and its unit picker is hidden. |
| Week to day conversion was inconsistent in working-day years (1 week became 4.81 days in a 250-day year). | A working-day year now uses 5-day weeks throughout. |
| M/M/s cost basis was an unstated choice. | It is now a stated, switchable setting. |
| Holt-Winters only supported one starting method, so Chopra and Meindl students could not match their book. | Added the regression start, with the Tahoe Salt example as a worked example. |
| Quantity discount "savings vs base price" compared against the wrong baseline in some cases. | Savings now compare with the best order you could place at the base price. Holding cost can also be a fixed dollar amount. |
| Smaller items: critical path slack wording double-counted shared slack, fill rate could show below 0%, the loss function could dip a hair below zero far in the tail, and a unit note appeared as a warning on default inputs. | All fixed. |

## 8. Quality checks and what they caught

| Check | Result | Bugs it caught (all fixed) |
|---|---|---|
| End-to-end tests (Playwright), desktop and phone | 86 tests pass, including every calculator in both modes at phone width | Saved state was being overwritten on calculator pages; the Excel export failed because "History" is a reserved sheet name; two table editors pushed pages wider than a phone screen; unit notes were announced as alerts |
| Excel in a real spreadsheet (LibreOffice) | 5,992 of 5,992 formula cells match | `NORM.S.INV` needed the `_xlfn.` prefix that Excel itself writes, or Excel and LibreOffice show `#NAME?` |
| Accessibility (axe-core, WCAG 2.1 A and AA) | 0 violations on 29 pages in both themes | Search button name, status icon labels, a scrollable code box without keyboard focus, and light-theme contrast on tinted badges |
| Lighthouse (performance, accessibility, best practices, SEO) | 90 or above in every category on every audited page, mobile and desktop | Landing page blocking time (fixed by loading chart code when needed and skipping layout for off-screen sections) and the 3D map on machines without graphics acceleration (fixed by the 2D fallback) |

Scores from this build machine vary by a few points between runs because it is shared; calculator pages measured 94 to 98 on mobile and 98 to 100 on desktop in the final run.

## 9. Known limits

- **Live integrations were built but could not be exercised end to end** without accounts: Supabase sign-in, Stripe checkout and webhooks, and the Claude-powered problem reader. The code type-checks, builds, and follows each provider's documented API, and demo mode exercises every screen around them. Work through the test-mode checklist in `GO-LIVE.md` before taking real payments; it covers each of these paths.
- **Supabase's built-in email** sends only a couple of messages an hour and only to your own team, so magic-link sign-in needs a custom email provider before launch. `GO-LIVE.md` walks through it.
- **Legal pages** (Terms, Privacy, Disclaimer) are plain-language templates with bracketed placeholders. Have them reviewed before launch.
- **Social proof** on the landing page is three clearly marked placeholders in `src/data/socialProof.ts`. Replace them with real quotes, with permission, as you get them.
- **The hosted demo** (https://claude.ai/artifact/K3M3mYzHbSdyXmGmL3BA6z) runs in demo mode with every Pro feature unlocked and sample data loaded. It is a single-page build of the same screens, so share links it copies point at the future live domain, and file downloads go through the host page's save prompt.
