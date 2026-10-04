# CoreSight IQ

> Decision intelligence, not dashboards. One analytics engine, three domains.

**Live:** [coresightiq.vercel.app](https://coresightiq.vercel.app) ·
**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind v4 · Apache ECharts ·
Drizzle + Neon Postgres · SheetJS · PapaParse · jsPDF · Ollama (optional)

CoreSight IQ is a single Next.js + TypeScript platform where three business
domains — **Operations**, **Market expansion**, and **Product** — run on one
shared analytics engine. Every domain follows the same pipeline:
**ingest → score → recommend → report → advise.**

**Bring your own data.** Upload CSV, Excel or JSON into a private workspace,
import it as order lines, market indicators, competitor shares, product events,
experiment results or a backlog, and the matching module switches from its
sample to your numbers. Every import is validated row by row, de-duplicated
against what you already loaded, written in one transaction, and undoable.
The samples stay one click away for exploring. Hosting cost: **$0** (Vercel +
Neon free tiers).

---

## The architecture story

I had built three separate full-stack apps — a product-analytics platform
(*ProductLab*), a retail-operations platform (*RetailNexa*), and a
market-expansion platform (*GeoStrategy*), since retired in favor of this merge —
and noticed I had written the **same pipeline three times
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
| [`scoring`](src/core/scoring/index.ts) | weighted score → 0–100 → **bucket classifier**, with per-criterion contributions; missing criteria are skipped and reported as coverage | Market (Expand/Investigate/Monitor/Avoid **+** entry strategy), Product (RICE/ICE/WSJF → Now/Next/Later/Backlog) |
| [`recommend`](src/core/recommend/index.ts) | `Signal[]` → ranked recommendations (priority = impact × confidence) | **All three** decision centers |
| [`segmentation`](src/core/segmentation/index.ts) | quantile binning + RFM helper | Operations (customer RFM), Product (engagement quintiles) |
| [`cohort`](src/core/cohort/index.ts) | retention-matrix aggregator | Product (D1–D90 retention) |
| [`report`](src/core/report/index.ts) | executive PDF builder | **All three** |
| [`imports`](src/core/imports/index.ts) | header → field mapping, typed parsing (numbers, dates), range checks, row-numbered issue report, content keys for de-dup | **All six** import types across the three modules |
| [`workspace`](src/core/workspace/index.ts) | upload validation, safe CSV/XLSX/JSON parsing, quotas | Data Manager |
| [`advisor`](src/core/advisor/index.ts) | one Ollama client + RAG context + deterministic router | **All three** advisors |

A domain plugs in by registering with [`core/registry.ts`](src/core/registry.ts)
and supplying a data adapter + scoring config + advisor wiring — never by
re-implementing the engine.

---

## Using the platform

1. **Bring data (optional).** Open the **Data Manager** (`/data`), upload a
   file, press **Import**, confirm the column mapping and the data check. Or
   skip this and explore the samples.
2. **Pick a module.** From the landing page or the module tabs in the header.
   The **statusline** under the header says what you're looking at — *Your
   data* or the sample — and switches between them.
3. **Explore.** Each module opens on its **Decision Center** (ranked,
   confidence-scored decisions). Use the **left nav** to drill in:
   - **Operations** — Forecasting, Customer Intelligence (RFM/CLV), Inventory
     planning, Pricing & Promo simulation, Root Cause, Executive Reports, AI Advisor.
   - **Market** — Market Intelligence (opportunity/risk matrix), Competitive
     Intel, Opportunities, an interactive **Scenario Simulator**, Entry Strategy,
     Boardroom Reports, AI Advisor.
   - **Product** — Opportunities, **Prioritization** (RICE/ICE/WSJF with a live
     model switcher), Funnels & Cohorts (D1–D90 retention heatmap), Experiments
     (A/B significance), Roadmap, Executive Reports, AI Advisor.
4. **Export or ask.** Hit **Download PDF** on any Reports page for a board-ready
   summary, or open the **AI Advisor** and ask in plain English — it answers
   grounded in the live numbers (local Ollama if available, deterministic
   otherwise).

Sample data is always labeled (statusline + banner); your own data never is
mixed with it.

### Bring your own data

| Import type | Module | Required columns (auto-detected) | Enables |
|---|---|---|---|
| **Order lines** | Operations | order ID, product code, quantity, unit price, date (+ product name, customer, country) | revenue, forecasting, RFM customers, inventory, pricing, root cause |
| **Market indicators** | Market | market name + ≥ 3 of GDP, growth, population, income, internet %, purchasing power, ease of business, tax, inflation, currency stability | scoring, Expand/Investigate/Monitor/Avoid, entry strategy, scenarios |
| **Competitor shares** | Market | market, competitor, share % | HHI concentration, saturation, entry difficulty |
| **Product events** | Product | user ID, event name, timestamp (+ plan, country) | D1–D90 retention cohorts, ordered funnels, adoption, engagement tiers |
| **Experiment results** | Product | experiment, variant, users, conversions | two-proportion significance per treatment vs control |
| **Backlog initiatives** | Product | initiative, reach, impact, confidence, effort (+ WSJF inputs) | RICE / ICE / WSJF ranking, roadmap tiers |

Each type has a downloadable template in [`public/templates`](public/templates).

**How an import works**

1. **Upload** — CSV, XLSX (first sheet) or JSON, up to 4 MB and 100,000 parsed
   rows. Files are stored in your workspace; preview, rename, replace, delete.
2. **Map & check** — pick the import type (suggested from the columns), adjust
   the column mapping, and see a dry run: rows that will import, duplicates
   (in the file and already in your workspace), and every rejected value with
   its row number and reason. Nothing is written yet.
3. **Import** — one database transaction, up to 25,000 rows per file. Bad
   required values skip their row; bad optional values are stored as blank,
   never guessed.
4. **Undo** — Import history lists every import; undo removes exactly the rows
   it added (Operations also drops customers/products/invoices no other import
   still uses).

**De-duplication.** Rows without a natural ID (order lines, events) get a
content key: a hash of the row plus its occurrence number within the file, so
re-importing an overlapping export skips the overlap while genuine repeated
rows are kept. Markets, competitors, experiments and backlog items de-duplicate
on their natural key. The same file can't be imported twice as the same type.

**Missing data is never imputed.** Market scores are weighted sums over the
indicators you provide, with weights renormalized — complete rows score exactly
like the sample formula; partial rows show their input coverage. Projections
that need a specific input (e.g. scenario revenue needs GDP) say so instead of
guessing. Product retention only counts users once their full D-n window is
inside your data (right-censoring). Money from uploaded files is shown without
a currency symbol (files don't state one).

**Private workspaces.** There are no accounts: each browser gets an anonymous
workspace (a random 256-bit token in an httpOnly cookie; the database only sees
its SHA-256). Nobody else can see your files or results. *Copy recovery link*
opens the workspace on another device; *Delete all my data* erases it.

**CLI bulk load.** The full ~1M-row UCI dataset seeds the shared, read-only
sample workspace via the ETL below (it prints a data-quality report before
writing). Margin/profit remain estimates (see
[`assumptions.ts`](src/domains/operations/assumptions.ts)).

---

## Datasets

Sample datasets (shown until you import your own, and any time you switch to *Sample*):

| Module | Sample | Provenance | How it loads |
|---|---|---|---|
| **Operations** | [UCI “Online Retail II”](https://archive.ics.uci.edu/dataset/502/online+retail+ii) — ~1.07M real UK e-commerce transactions, Dec 2009–Dec 2011 | **Real** | One-time ETL into the read-only sample workspace (see Setup). |
| **Market** | 120 synthetic countries with realistic 2023–24-style indicators | **Demo / modeled** | In-memory, deterministic. |
| **Product** | 3,000 synthetic SaaS users with cohorts, sessions, funnel & feature events | **Demo / measured** | In-memory, deterministic. |

> **Honest provenance note:** the Operations sample is real data. Market sample
> figures are modeled from editorial weights; the Product sample is synthetic but
> its retention/funnel numbers are **measured from the generated data**. Your own
> imports run through exactly the same engines.

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
runs the real harness on adversarial inputs: white-noise forecast (5-fold
walk-forward) **MAPE 66.9%, R² −0.235**; structural-break **MAPE 86.1%**; an
overconfident classifier **ECE 0.77, Brier 0.74**. A harness that ships with a reproducible proof it can fail is
more credible than one that only claims to work.
↳ `npx tsx scripts/harness-demo.ts`

---

## Security & data integrity

There are no accounts, so isolation and the write path are hardened instead:

- **Workspace isolation** — every row carries a `workspace_id` derived from the
  visitor's secret cookie; every query and mutation filters on it. Another
  workspace's file or import id behaves exactly like a missing one (404).
- **CSRF** — state-changing API calls must come from the app's own origin
  (checked in [`src/proxy.ts`](src/proxy.ts)); cookies are `SameSite=Lax`,
  `HttpOnly`, `Secure`. The recovery link carries its token in the URL
  *fragment*, which browsers never send to servers.
- **Untrusted files** — size, format and row caps; Excel parsing decodes only
  the first sheet and skips formulas/HTML/styles. SheetJS comes from its
  vendor's patched release (`xlsx` 0.20.3, Apache-2.0; the npm copy 0.18.5 has
  unfixed advisories), sha512-pinned in the lockfile.
- **Import integrity** — a partial unique index on the import ledger admits one
  live import per (workspace, type, file content), so double-clicks and retries
  can't double-load; all rows plus the ledger update commit in one transaction
  (`db.batch()` on Neon, `BEGIN … COMMIT` elsewhere). Database `CHECK`
  constraints mirror the validator's ranges as a second line of defense.
- **Capacity on a free tier** — per-workspace caps (50 files / 25 MB of uploads,
  250k order lines or events, smaller caps for the rest) and deployment-wide
  caps (60 MB of uploads, 1M imported rows) keep the database inside Neon's free
  512 MB no matter how many anonymous workspaces exist.
- **No internal detail in responses** — database errors are logged server-side;
  clients get a generic 503.
- **Headers** — HSTS, `X-Frame-Options: DENY`, `nosniff`, strict referrer
  policy, locked-down `Permissions-Policy`.
- `npm audit --omit=dev` reports **0** production vulnerabilities.

Known limits: no rate limiting (bounded by the caps above), no
Content-Security-Policy yet, a lost cookie without a saved recovery link means
a lost workspace, and inactive workspaces are not yet expired automatically.

---

## Setup

```bash
npm install            # .npmrc sets legacy-peer-deps for React 19
npm run dev            # http://localhost:3000
```

The **Market** and **Product** samples render with no database. Uploads,
imports and the Operations sample need Postgres:

```bash
cp .env.example .env    # set DATABASE_URL — a free Neon database, or any Postgres 14+
npm run db:migrate      # apply db/migrations (versioned SQL, one transaction each)
# optional — seed the Operations sample (downloads ~45MB, prints data quality first):
npx tsx --max-old-space-size=4096 scripts/etl-operations.ts
```

`DATABASE_URL` pointing at `*.neon.tech` uses the serverless HTTP driver; any
other Postgres (e.g. `postgresql://postgres@localhost:5432/csiq`) uses
node-postgres — handy for local development and self-hosting. The ETL only ever
touches the sample workspace and refuses to seed over existing sample data
unless `--force`. `GET /api/operations/health` reports the sample's row counts
and query latency.

### Schema changes

Schema lives in [`db/migrations`](db/migrations) as reviewed SQL with a matching
`.down.sql`; [`src/db/schema.ts`](src/db/schema.ts) mirrors it for typed
queries. Don't use `drizzle-kit push` — it would drop the `CHECK` constraints
that exist only in SQL.

```bash
npm run db:status                                   # applied / pending
npm run db:migrate                                  # apply pending
npx tsx scripts/db-migrate.ts --down 0001_workspaces_imports   # roll back (deletes visitor data)
```

### Environment variables

| Var | Required | Used by |
|---|---|---|
| `DATABASE_URL` | for uploads, imports, Operations sample | Neon (HTTP driver) or any Postgres (node-postgres) |
| `OLLAMA_URL` | optional | AI Advisor (default `http://localhost:11434`) |
| `OLLAMA_MODEL` | optional | AI Advisor (default `llama3.2`) |

---

## Scripts

| Command | What |
|---|---|
| `npm run dev` / `build` / `start` | Next app |
| `npm test` | core + domain unit tests (vitest) — 137 tests |
| `npm run typecheck` / `lint` | static checks |
| `npm run db:migrate` / `db:status` | apply / list SQL migrations |
| `npx tsx scripts/harness-demo.ts` | validation-harness failure proof |
| `npx tsx scripts/operations-metrics.ts` | recompute honest Operations metrics |
| `npx tsx scripts/product-metrics.ts` | recompute measured Product metrics |
| `npx tsx scripts/etl-operations.ts` | ETL the UCI sample into the sample workspace (`--force` to reload it) |

CI (GitHub Actions) runs lint, typecheck, all tests, and a production build on
every push and pull request to `main`.

---

## Deployment (Vercel)

Deployed at [coresightiq.vercel.app](https://coresightiq.vercel.app). Framework is
auto-detected as Next.js; `.npmrc` handles peer deps. Set `DATABASE_URL` (and
optional `OLLAMA_*`) in the Vercel project. Every push to `main` redeploys.

**Release order for schema changes:** back up (`pg_dump`, or a Neon branch),
run `npm run db:migrate` against production, then push. Migrations are written
expand-first so the previous deployment keeps serving reads while the new one
builds. Roll back code with Vercel's instant rollback; roll back schema with the
migration's `--down`. Seed the Operations sample by running the ETL locally
against the same `DATABASE_URL` (~1M rows exceeds a serverless time limit).

## License

MIT.
