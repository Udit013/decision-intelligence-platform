# Decision Intelligence Platform

> One engine. Three domains. Decisions, not dashboards.

A single Next.js + TypeScript platform where three business domains —
**Operations**, **Market expansion**, and **Product** — run on one shared
analytics engine. Each domain follows the same pipeline: **ingest → score →
recommend → report → advise.**

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
cosmetic (e.g. `normalCDF` was implemented twice, three near-identical Ollama
clients, three hand-rolled "rank-and-bucket" classifiers). So I extracted that
skeleton into a reusable **`/core`** engine and turned the three apps into thin
**`/domains`** that configure it. The merge is only credible if the abstraction
actually holds across genuinely different problems — so this repo proves each
core primitive against multiple domains, and adds a **validation harness** (new,
in none of the originals) that backtests forecasts and reports honest accuracy.

---

## What `/core` does

Every primitive is domain-agnostic, pure TypeScript, and unit-tested. The last
column shows which domains exercise it — the proof the abstraction generalizes.

| Primitive | What it does | Proven across |
|---|---|---|
| [`stats`](src/core/stats/index.ts) | descriptive stats, OLS regression, normal CDF/quantile, **A/B two-proportion test** + CIs | Product (experiments), Operations (regression in forecast); **one canonical `normalCdf`** |
| [`forecast`](src/core/forecast/index.ts) | Holt-Winters / linear / drift, model picked by a **leakage-free nested backtest**, CI bands | Operations (the only real time series) |
| [`validation`](src/core/validation/index.ts) | **walk-forward forecast backtest** + **confidence calibration** (Brier, ECE) — *new* | Operations; failure-proof in [`harness-demo`](scripts/harness-demo.ts) |
| [`scoring`](src/core/scoring/index.ts) | generic weighted score → 0–100 → **bucket classifier**, with per-criterion contributions | Market (Expand/Investigate/Monitor/Avoid **+** entry-strategy ranking), Product (RICE/ICE/WSJF → Now/Next/Later/Backlog) |
| [`recommend`](src/core/recommend/index.ts) | `Signal[]` → ranked recommendations (priority = impact × confidence) | **All three** decision centers |
| [`segmentation`](src/core/segmentation/index.ts) | quantile binning + RFM helper | Operations (customer RFM), Product (engagement quintiles) |
| [`cohort`](src/core/cohort/index.ts) | retention-matrix aggregator | Product (D1–D90 retention) |
| [`report`](src/core/report/index.ts) | executive PDF builder (KPIs / tables / recommendations) | **All three** |
| [`advisor`](src/core/advisor/index.ts) | one Ollama client + RAG context + deterministic intent router | **All three** advisors |

A domain plugs in by registering with [`core/registry.ts`](src/core/registry.ts)
and supplying a data adapter + metric/scoring config + advisor wiring — never by
re-implementing the engine.

---

## What the validation harness actually found

The whole point of the harness is that it reports the real numbers, including
unflattering ones. Nothing here is carried over from the old READMEs unless a new
backtest reproduced it (it didn't).

**Operations forecast accuracy** — real UCI Online Retail II, measured
out-of-sample (walk-forward):

| Series / horizon | MAPE | R² |
|---|---|---|
| Weekly revenue, 1-step | 30.3% | **0.072** |
| Weekly revenue, 4-step | 31.2% | **−0.026** |
| Daily revenue, 7-step | 61.3% | **−0.088** |

On this spiky real retail series (huge Nov/Dec peaks, lumpy wholesale orders)
**Holt-Winters barely beats a naive mean** — R² hovers near zero and goes
negative at multi-step horizons. The old retail README advertised "0.90 R² /
86% accuracy"; that was never reproduced on real data and is **not** used here.
The Forecasting page leads with this caveat above the chart.
↳ reproduce: `npx tsx --max-old-space-size=4096 scripts/operations-metrics.ts`

**Market — the Pakistan duplicate.** The old geostrategy README claimed "121
markets". The source array listed Pakistan twice (codes `PK` and `PK2`) and
deduped only by code, so both survived. The real distinct count is **120**; a
test asserts it (`!== 121`).
↳ reproduce: `npm test -- market`

**Product — experiments aren't cherry-picked.** Of 5 synthetic A/B tests, only
**2 reach significance** (the other 3 are inconclusive), with real p-values from
the shared `core/stats` two-proportion z-test.
↳ reproduce: `npx tsx scripts/product-metrics.ts`

**Product retention is measured, not asserted.** D1–D90 is computed live from the
generated data via `core/cohort`: **D1 65.8% · D7 57.9% · D30 35.6% · D90 10.2%**.
No flattering constant is hardcoded.
↳ reproduce: `npx tsx scripts/product-metrics.ts`

**The harness can fail — proof included.** [`scripts/harness-demo.ts`](scripts/harness-demo.ts)
runs the real harness on adversarial inputs and prints genuinely bad scores:
white-noise forecast **MAPE ~68%, R² −0.17**; structural-break **MAPE ~109%**;
an overconfident classifier **ECE 0.77, Brier 0.74**. A validation harness that
ships with a reproducible proof it can fail is more credible than one that only
claims to work.
↳ reproduce: `npx tsx scripts/harness-demo.ts`

---

## Setup

```bash
npm install            # .npmrc sets legacy-peer-deps for React 19
npm run dev            # http://localhost:3000
```

**Market** and **Product** are **zero-setup** — both run on deterministic
in-memory synthetic generators (clearly labeled *demo data* in-UI). They render
with no database and no AI service.

**Operations** runs on the **real UCI Online Retail II** dataset and needs a
one-time ETL into Postgres:

```bash
cp .env.example .env    # set DATABASE_URL (a free Neon instance works)
npm run db:push         # create the unified schema
# downloads ~45MB, prints data-quality stats PRE-SEED, then loads ~1M rows:
npx tsx --max-old-space-size=4096 scripts/etl-operations.ts
```

Before the ETL runs, Operations pages render a graceful "run the ETL" state
rather than crashing. The **AI Advisor** is local-first: it uses a local
[Ollama](https://ollama.com) model if `OLLAMA_URL` is reachable, and always
falls back to a deterministic engine (no key required).

### Environment variables

| Var | Required | Used by |
|---|---|---|
| `DATABASE_URL` | Operations only | Neon Postgres (serverless driver) |
| `OLLAMA_URL` | optional | AI Advisor (default `http://localhost:11434`) |
| `OLLAMA_MODEL` | optional | AI Advisor (default `llama3.2`) |
| `NEXT_PUBLIC_APP_URL` | optional | absolute URLs |

---

## Scripts

| Command | What |
|---|---|
| `npm run dev` / `build` / `start` | Next app |
| `npm test` | core + domain unit tests (vitest) |
| `npm run typecheck` / `lint` | static checks |
| `npm run db:push` | push the unified Drizzle schema |
| `npx tsx scripts/harness-demo.ts` | validation-harness failure proof |
| `npx tsx scripts/operations-metrics.ts` | recompute honest Operations metrics |
| `npx tsx scripts/product-metrics.ts` | recompute measured Product metrics |
| `npx tsx scripts/etl-operations.ts` | ETL the real dataset into Postgres |

---

## Tech

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · **Apache ECharts**
(one charting library) · Drizzle ORM + Neon Postgres · jsPDF · Ollama (local,
optional). Single deployable app, single Postgres schema, push-to-deploy on
Vercel.

## Deployment (Vercel)

1. Import the repo at [vercel.com/new](https://vercel.com/new) (framework
   auto-detected as Next.js; `.npmrc` handles peer deps).
2. Add `DATABASE_URL` (and optional `OLLAMA_*`) in the project's environment
   variables. Market and Product work even without `DATABASE_URL`.
3. Every push to `main` redeploys. To seed Operations, run the ETL locally
   against the same `DATABASE_URL` (seeding ~1M rows exceeds a serverless
   function's time limit).

## License

MIT.
