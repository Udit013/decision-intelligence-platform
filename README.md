# CoreSight IQ

> Decision intelligence, not dashboards. One analytics engine, three domains.

**Live:** [coresightiq.vercel.app](https://coresightiq.vercel.app) ·
**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind v4 · Apache ECharts ·
Drizzle + Neon Postgres · jsPDF · Ollama (optional)

CoreSight IQ is a single Next.js + TypeScript platform where three business
domains — **Operations**, **Market expansion**, and **Product** — run on one
shared analytics engine. Every domain follows the same pipeline:
**ingest → score → recommend → report → advise.**

---

## The architecture story

I had built three separate full-stack apps —
[productlab](https://github.com/Udit013/productlab) (product analytics),
[retail-analytics-platform](https://github.com/Udit013/retail-analytics-platform)
(retail operations), and [geostrategy](https://github.com/Udit013/geostrategy)
(market expansion) — and noticed I had written the **same pipeline three times
with different nouns**: ingest domain data → score it on multiple criteria →
synthesize ranked, confidence-scored recommendations → export an executive PDF →
answer questions with a local-AI advisor. The duplication was structural, not
cosmetic (`normalCDF` implemented twice, three near-identical Ollama clients,
three hand-rolled "rank-and-bucket" classifiers). So I extracted that skeleton
into a reusable **`/core`** engine and turned the three apps into thin
**`/domains`** that configure it. The merge is only credible if the abstraction
holds across genuinely different problems — so this repo proves each core
primitive across multiple domains, and adds a **validation harness** (new, in
none of the originals) that backtests forecasts and reports honest accuracy.

---

## What `/core` does

Every primitive is domain-agnostic, pure TypeScript, and unit-tested. The last
column shows which domains exercise it — the proof the abstraction generalizes.

| Primitive | What it does | Proven across |
|---|---|---|
| [`stats`](src/core/stats/index.ts) | descriptive stats, OLS regression, normal CDF/quantile, **A/B two-proportion test** + CIs | Product (experiments), Operations (regression); **one canonical `normalCdf`** |
| [`forecast`](src/core/forecast/index.ts) | Holt-Winters / linear / drift, model picked by a **leakage-free nested backtest** | Operations |
| [`validation`](src/core/validation/index.ts) | **walk-forward backtest** + **confidence calibration** (Brier, ECE) — *new* | Operations; failure-proof in [`harness-demo`](scripts/harness-demo.ts) |
| [`scoring`](src/core/scoring/index.ts) | weighted score → 0–100 → **bucket classifier**, with per-criterion contributions | Market (Expand/Investigate/Monitor/Avoid **+** entry strategy), Product (RICE/ICE/WSJF → Now/Next/Later/Backlog) |
| [`recommend`](src/core/recommend/index.ts) | `Signal[]` → ranked recommendations (priority = impact × confidence) | **All three** decision centers |
| [`segmentation`](src/core/segmentation/index.ts) | quantile binning + RFM helper | Operations (customer RFM), Product (engagement quintiles) |
| [`cohort`](src/core/cohort/index.ts) | retention-matrix aggregator | Product (D1–D90 retention) |
| [`report`](src/core/report/index.ts) | executive PDF builder | **All three** |
| [`advisor`](src/core/advisor/index.ts) | one Ollama client + RAG context + deterministic router | **All three** advisors |

A domain plugs in by registering with [`core/registry.ts`](src/core/registry.ts)
and supplying a data adapter + scoring config + advisor wiring — never by
re-implementing the engine.

---

## Using the platform

1. **Pick a module.** From the landing page cards or the **switcher in the
   top-left header**, choose Operations, Market, or Product.
2. **Explore.** Each module opens on its **Decision Center** (ranked,
   confidence-scored decisions). Use the **left nav** to drill in:
   - **Operations** — Forecasting, Customer Intelligence (RFM/CLV), Inventory
     planning, Pricing & Promo simulation, Root Cause, Executive Reports, AI Advisor.
   - **Market** — Market Intelligence (opportunity/risk matrix), Competitive
     Intel, Opportunities, an interactive **Scenario Simulator**, Entry Strategy,
     Boardroom Reports, AI Advisor.
   - **Product** — Opportunities, **Prioritization** (RICE/ICE/WSJF with a live
     model switcher), Funnels & Cohorts (D1–D90 retention heatmap), Experiments
     (A/B significance), Roadmap, Executive Reports, AI Advisor.
3. **Export or ask.** Hit **Download PDF** on any Reports page for a board-ready
   summary, or open the **AI Advisor** and ask in plain English — it answers
   grounded in the live numbers (local Ollama if available, deterministic
   otherwise).

Every page shows an honest **data-provenance badge** (REAL vs DEMO) and modules
on synthetic data lead with a clear banner.

### Adding / refreshing data

- **Operations (your own retail data):** map your transactions to the
  `operations_*` schema and run the ETL (below). The ETL prints a
  **data-quality report before it writes anything**, so you can see exactly what
  is being loaded. Margin/profit are estimated (the source has no cost) — see
  [`assumptions.ts`](src/domains/operations/assumptions.ts).
- **Market / Product:** data is generated deterministically in-memory. Adjust
  the generators ([market](src/domains/market/generator.ts),
  [product](src/domains/product/generator.ts)) — e.g. user count, seed, market
  list — and the whole module (scores, funnels, retention) recomputes.

---

## Datasets

| Module | Source | Provenance | How to load |
|---|---|---|---|
| **Operations** | [UCI “Online Retail II”](https://archive.ics.uci.edu/dataset/502/online+retail+ii) — ~1.07M real UK e-commerce transactions, Dec 2009–Dec 2011 | **Real** | One-time ETL into Postgres (see Setup). Normalized into `operations_{customers,products,invoices,invoice_lines}`. |
| **Market** | 120 synthetic countries with realistic 2023–24-style indicators (GDP, growth, digital adoption, PPI, risk) | **Demo / modeled** | Zero setup — in-memory, deterministic. |
| **Product** | 3,000 synthetic SaaS users with signup cohorts, sessions, funnel & feature events | **Demo / measured** | Zero setup — in-memory, deterministic. |

> **Honest provenance note:** Operations is the only module on real data. Market
> figures are modeled from editorial weights; Product is synthetic but its
> retention/funnel numbers are **measured from the generated data**, not invented.

---

## What the validation harness actually found

Nothing here is carried over from the old READMEs unless a new backtest
reproduced it (it didn't).

**Operations forecast accuracy** — real data, measured out-of-sample (walk-forward):

| Series / horizon | MAPE | R² |
|---|---|---|
| Weekly revenue, 1-step | 30.3% | **0.072** |
| Weekly revenue, 4-step | 31.2% | **−0.026** |
| Daily revenue, 7-step | 61.3% | **−0.088** |

On this spiky real retail series, **Holt-Winters barely beats a naive mean** —
R² hovers near zero and goes negative at multi-step horizons. The old retail
README's "0.90 R²" was never reproduced on real data and is **not** used. The
Forecasting page leads with this caveat above the chart.
↳ `npx tsx --max-old-space-size=4096 scripts/operations-metrics.ts`

**Market — the Pakistan duplicate.** The old geostrategy README claimed "121
markets"; the source listed Pakistan twice (`PK`/`PK2`) and deduped only by code.
The real distinct count is **120**; a test asserts `!== 121`.
↳ `npm test`

**Product — experiments aren't cherry-picked.** Of 5 synthetic A/B tests, only
**2 reach significance** (3 inconclusive), with real p-values from the shared
`core/stats` z-test.
↳ `npx tsx scripts/product-metrics.ts`

**Product retention is measured, not asserted.** D1–D90 via `core/cohort`:
**D1 65.8% · D7 57.9% · D30 35.6% · D90 10.2%** — computed live, no hardcoded
constant.
↳ `npx tsx scripts/product-metrics.ts`

**The harness can fail — proof included.** [`scripts/harness-demo.ts`](scripts/harness-demo.ts)
runs the real harness on adversarial inputs: white-noise forecast **MAPE ~68%,
R² −0.17**; structural-break **MAPE ~109%**; an overconfident classifier **ECE
0.77, Brier 0.74**. A harness that ships with a reproducible proof it can fail is
more credible than one that only claims to work.
↳ `npx tsx scripts/harness-demo.ts`

---

## Setup

```bash
npm install            # .npmrc sets legacy-peer-deps for React 19
npm run dev            # http://localhost:3000
```

**Market** and **Product** are **zero-setup** — they render with no database and
no AI service.

**Operations** runs on the real UCI dataset and needs a one-time ETL:

```bash
cp .env.example .env    # set DATABASE_URL (a free Neon instance works)
npm run db:push         # create the unified schema
# downloads ~45MB, prints data-quality stats PRE-SEED, then loads ~1M rows:
npx tsx --max-old-space-size=4096 scripts/etl-operations.ts
```

Before the ETL runs, Operations pages render a graceful "run the ETL" state
rather than crashing.

### Environment variables

| Var | Required | Used by |
|---|---|---|
| `DATABASE_URL` | Operations only | Neon Postgres (serverless driver) |
| `OLLAMA_URL` | optional | AI Advisor (default `http://localhost:11434`) |
| `OLLAMA_MODEL` | optional | AI Advisor (default `llama3.2`) |

---

## Scripts

| Command | What |
|---|---|
| `npm run dev` / `build` / `start` | Next app |
| `npm test` | core + domain unit tests (vitest) — 85 tests |
| `npm run typecheck` / `lint` | static checks |
| `npm run db:push` | push the unified Drizzle schema |
| `npx tsx scripts/harness-demo.ts` | validation-harness failure proof |
| `npx tsx scripts/operations-metrics.ts` | recompute honest Operations metrics |
| `npx tsx scripts/product-metrics.ts` | recompute measured Product metrics |
| `npx tsx scripts/etl-operations.ts` | ETL the real dataset into Postgres |

---

## Deployment (Vercel)

Deployed at [coresightiq.vercel.app](https://coresightiq.vercel.app). Framework is
auto-detected as Next.js; `.npmrc` handles peer deps. Set `DATABASE_URL` (and
optional `OLLAMA_*`) in the Vercel project — Market and Product work even without
it. Every push to `main` redeploys. Seed Operations by running the ETL locally
against the same `DATABASE_URL` (loading ~1M rows exceeds a serverless function's
time limit).

## License

MIT.
