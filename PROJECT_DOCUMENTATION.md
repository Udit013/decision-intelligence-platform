# CoreSight IQ — Project Documentation

**A complete technical handbook for the CoreSight IQ decision-intelligence platform.**

This document is the single source of truth for understanding this repository —
from "what does this app do" to "what does line 244 of `forecast/index.ts` do
and why." It is written to serve four audiences at once: you preparing for a
technical interview, a recruiter skimming for signal, a new engineer onboarding
onto the codebase, and a curious reader with zero programming background.

Everything in this document describes **code that actually exists in this
repository** as of this writing. Nothing here is aspirational or assumed.

---

## Table of Contents

1. [The Story: What This Project Is](#1-the-story-what-this-project-is)
2. [What Happens When a User Opens the App](#2-what-happens-when-a-user-opens-the-app)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Folder Structure](#4-folder-structure)
5. [The `/core` Engine — File by File](#5-the-core-engine--file-by-file)
6. [The Domains — File by File](#6-the-domains--file-by-file)
7. [The App Router (`/src/app`) — File by File](#7-the-app-router-srcapp--file-by-file)
8. [The Data Workspace (Upload Feature) — Deep Dive](#8-the-data-workspace-upload-feature--deep-dive)
9. [The UI Component Library (`/src/ui`)](#9-the-ui-component-library-srcui)
10. [The Database](#10-the-database)
11. [Every API Endpoint](#11-every-api-endpoint)
12. [Authentication (and Why There Isn't Any)](#12-authentication-and-why-there-isnt-any)
13. [State Management](#13-state-management)
14. [Every Important Library, Explained](#14-every-important-library-explained)
15. [Every Configuration File, Explained](#15-every-configuration-file-explained)
16. [Complete Execution Traces (User Actions Step by Step)](#16-complete-execution-traces-user-actions-step-by-step)
17. [Deep Technical Concepts, Explained Twice](#17-deep-technical-concepts-explained-twice)
18. [Testing Strategy](#18-testing-strategy)
19. [Deployment & CI/CD](#19-deployment--cicd)
20. [Design System](#20-design-system)
21. [Interview Preparation — Full Q&A Bank](#21-interview-preparation--full-qa-bank)
22. [Common Follow-Up / "What If" Questions](#22-common-follow-up-what-if-questions)
23. [Glossary](#23-glossary)
24. [Complete Start-to-Finish Walkthrough](#24-complete-start-to-finish-walkthrough)

---

## 1. The Story: What This Project Is

### 1.1 The problem, explained like you've never touched a computer

Imagine three different business people, each holding a stack of spreadsheets:

- A **retail operations manager** wants to know: *how much will we sell next
  month, which customers are about to leave us, and which products need
  reordering?*
- A **market-expansion strategist** wants to know: *which of 120 countries
  should we expand into next, and how risky is each one?*
- A **product manager** wants to know: *which feature should engineering build
  next, and is our new onboarding flow actually working?*

All three are asking a version of the same question: **"Given this data, what
should I do next, and how confident should I be?"** All three currently solve
this by staring at spreadsheets, building slide decks, and guessing.

**CoreSight IQ answers that question directly.** You give it data (real or
uploaded), and it produces a ranked list of recommended actions, each with a
confidence score, a plain-English reason, and an expected outcome — plus a
one-click PDF report and an AI assistant you can ask follow-up questions.

### 1.2 Who it's built for

Three "modules" (the app calls them **domains**), each aimed at a different
job title:

| Module | Audience | Question it answers |
|---|---|---|
| **Operations** | Retail/e-commerce ops manager | What should we do about revenue, inventory, pricing, and customers? |
| **Market** | Corporate strategist | Which country should we expand into, and how? |
| **Product** | Product manager | What should engineering build next, and did our last experiment work? |

### 1.3 The origin story (why the architecture looks the way it does)

This platform is a **merger of three previously separate applications**. The
person who built it had already shipped a product-analytics app, a retail-ops
app, and a market-expansion app — three different codebases. They noticed all
three did *the same five things* with different nouns:

```
ingest data → score it → rank recommendations → export a PDF → answer questions with AI
```

Rather than keep three separate copies of "score things and rank them" (with
subtle bugs diverging between copies — the documentation history in this repo
notes a statistical function, `normalCDF`, was literally implemented twice with
different rounding), the three apps were merged into **one platform with a
shared engine** (`/src/core`) and three thin "domain" plug-ins
(`/src/domains/{operations,market,product}`) that configure that engine instead
of re-implementing it.

**Analogy:** think of `/core` as a commercial kitchen's shared equipment — one
oven, one mixer, one set of knives — and each domain as a different restaurant
menu that uses the same equipment to cook completely different dishes. The
equipment doesn't care whether it's making a cake or a curry; it just does its
one job well and lets the menu (the domain) decide what to make with it.

### 1.4 What makes this project's story distinctive: honesty about accuracy

Most portfolio analytics projects show impressive-looking made-up numbers. This
one deliberately does the opposite. It ships a **validation harness**
(`src/core/validation/index.ts`) that measures forecast accuracy the hard way
(walk-forward backtesting — explained in [§17](#17-deep-technical-concepts-explained-twice))
and prints the *real*, unflattering result: on the real UCI Online Retail II
dataset, the weekly revenue forecast has an out-of-sample R² of about **0.07**
— barely better than guessing the average. The landing page states this
number, in large text, on purpose. This is a real, considered design decision
covered in [§17.9](#179-r²-and-honest-accuracy-reporting) and is one of the
best interview talking points in this codebase.

---

## 2. What Happens When a User Opens the App

Let's trace it end-to-end before diving into code, entirely in plain English.

1. **The user types `coresightiq.vercel.app` into a browser.**
   Their browser sends an HTTP GET request across the internet to Vercel's edge
   network (Vercel is the company hosting this app).

2. **Vercel finds the matching Next.js route and runs it on a server.**
   This app is built with **Next.js** (a framework built on **React**) using
   its **App Router**. The root page lives at `src/app/page.tsx`. Because this
   file has no `'use client'` directive at the top, it is a **React Server
   Component** — meaning its code runs on Vercel's server, not in the user's
   browser. It returns a description of HTML (JSX), which Next.js converts to
   real HTML text.

3. **That HTML is sent back to the browser and painted on screen** — the
   landing page: a hero statement ("Ranked decisions, with the accuracy
   printed on them"), a numbered list of the three modules (Operations,
   Market, Product), and a strip of real published numbers (like the honest
   R² above).

4. **The browser then downloads a small JavaScript bundle** that "hydrates"
   the page — attaches event listeners so buttons and links become
   interactive (explained fully in [§17.13](#1713-hydration)).

5. **The user clicks "Operations."** Next.js's client-side router intercepts
   the click (no full page reload) and requests `/operations`.

6. **That route is handled by `src/app/[domain]/page.tsx`.** This is a
   **dynamic route** — the `[domain]` folder name means Next.js will match
   `/operations`, `/market`, or `/product` and pass whichever word was typed
   as a parameter into the page function.

7. **The page looks up "operations" in the domain registry**
   (`src/core/registry.ts`), finds the `OPERATIONS` domain object, and asks
   `resolvePage('operations', '')` (from `src/domains/pages.ts`) which
   component renders the Operations home page. The answer is
   `DecisionCenter` (`src/domains/operations/pages/DecisionCenter.tsx`).

8. **`DecisionCenter` is itself an `async` Server Component.** It calls
   `buildSnapshot()` (`src/domains/operations/snapshot.ts`), which:
   - Sends four SQL queries to a **Neon Postgres database** (in parallel,
     using `Promise.all`) to fetch revenue KPIs, a weekly revenue time
     series, per-customer purchase history, and category comparisons.
   - Runs a **statistical forecasting algorithm** (`src/core/forecast`) on the
     revenue series in plain TypeScript — no external ML service.
   - Runs **RFM customer segmentation** (`src/core/segmentation`) on the
     purchase history.
   - Feeds all of that into a **recommendation synthesizer**
     (`src/core/recommend`) that ranks a list of business decisions by
     "impact × confidence."

9. **The ranked decisions, KPIs, and forecast come back as a plain JavaScript
   object.** `DecisionCenter` turns that into JSX (a `Docket` list, a `KpiGrid`
   strip) and returns it. Next.js renders that to HTML on the server and
   streams it to the browser.

10. **The browser paints the final Decision Center page**: real revenue
    figures, a ranked list of business recommendations like "Protect 2,530
    VIP customers," each with a confidence bar, all computed from real data
    that was queried and processed in the seconds between the click and the
    page appearing.

That whole round trip — click → route match → SQL queries → statistics →
ranking → HTML → paint — typically completes in well under a second because
the database queries are **cached** (explained in
[§17.11](#1711-caching-and-unstable_cache)).

---

## 3. High-Level Architecture

### 3.1 Architecture diagram

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  BROWSER (client)                                                       │
│  React components hydrate; client components (forms, chat, uploads)     │
│  hold local state with useState; everything else is static HTML         │
│  produced on the server.                                                │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │  HTTPS
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  VERCEL EDGE / SERVERLESS (Next.js 16, App Router)                      │
│                                                                          │
│  ┌────────────────────────┐   ┌───────────────────────────────────┐    │
│  │  PAGES (Server          │   │  API ROUTES (Route Handlers)      │    │
│  │  Components)            │   │  src/app/api/**/route.ts          │    │
│  │  src/app/**/page.tsx    │   │  - /api/data/*      (workspace)   │    │
│  │  - fetch data async     │   │  - /api/*/advisor   (AI chat)     │    │
│  │  - render JSX → HTML    │   │  - /api/operations/health         │    │
│  └───────────┬─────────────┘   └───────────────┬───────────────────┘    │
│              │                                  │                       │
│              ▼                                  ▼                       │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │  /src/domains  (domain-specific glue: config, data adapters,   │     │
│  │  advisor wiring, page components) — ONE PER MODULE:            │     │
│  │  operations/ (real DB)   market/ (in-memory)   product/ (in-memory) │
│  └───────────┬───────────────────────────────────────────────────┘     │
│              │ calls into                                               │
│              ▼                                                          │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │  /src/core  (shared, domain-agnostic analytics engine)          │     │
│  │  stats · forecast · scoring · recommend · segmentation ·        │     │
│  │  cohort · validation · report (PDF) · advisor (AI) · workspace  │     │
│  │  — pure TypeScript functions, fully unit-tested, no I/O          │     │
│  └───────────┬─────────────────────────────────┬───────────────────┘     │
│              │                                  │                       │
└──────────────┼──────────────────────────────────┼───────────────────────┘
               ▼                                  ▼
  ┌─────────────────────────┐        ┌─────────────────────────────┐
  │  Neon Postgres           │        │  Ollama (optional, local)    │
  │  (serverless HTTP driver)│        │  http://localhost:11434      │
  │  - operations_* tables   │        │  - Local LLM for AI Advisor  │
  │  - market_*, product_*   │        │  - NOT reachable in prod →   │
  │    tables (schema only;  │        │    deterministic fallback    │
  │    unused at runtime)    │        │    kicks in automatically    │
  │  - workspace_files table │        └─────────────────────────────┘
  └─────────────────────────┘
```

### 3.2 The three-layer mental model

The whole codebase is organized around one idea: **separate "what never
changes" from "what changes per domain."**

```text
┌─────────────────────────────────────────────────────────┐
│  LAYER 3 — Presentation (per domain)                     │
│  src/domains/{operations,market,product}/pages/*.tsx     │
│  React components that render KPIs, charts, tables       │
├─────────────────────────────────────────────────────────┤
│  LAYER 2 — Domain glue (per domain)                       │
│  src/domains/{operations,market,product}/*.ts            │
│  Data adapters, scoring configs, advisor personas —        │
│  translates domain data into the shapes /core expects     │
├─────────────────────────────────────────────────────────┤
│  LAYER 1 — Core engine (shared, ONE implementation)        │
│  src/core/{stats,forecast,scoring,recommend,...}          │
│  Pure functions: given numbers in, numbers/decisions out   │
└─────────────────────────────────────────────────────────┘
```

If you want to know "is this logic shared or domain-specific," the folder it
lives in answers the question: `/core` = shared, `/domains/X` = specific to
domain X.

### 3.3 Deployment architecture

- **Hosting:** Vercel (serverless functions + static assets + edge network).
- **Database:** Neon (serverless Postgres — a Postgres database that "wakes
  up" on demand rather than running 24/7 on a dedicated server).
- **AI:** Ollama, a *local* LLM runtime. In production (Vercel), Ollama is
  unreachable (Vercel has no `localhost:11434`), so the app **always**
  degrades gracefully to a deterministic, rule-based answer engine. This is
  intentional, not a bug — see [§12](#12-authentication-and-why-there-isnt-any)-adjacent
  discussion in [§6.1](#61-the-advisor-pattern-shared-across-all-three-domains).
- **CI:** GitHub Actions — lints, type-checks, tests, and builds the app on
  every push to `main` (see [§19](#19-deployment--cicd)).
- **No queues, no WebSockets, no background job runner.** Every request is
  answered synchronously within a single HTTP request/response cycle. The
  slowest operation (Operations' first, uncached database query) takes a few
  seconds; that stays within Vercel's serverless function time limit (raised
  to 30–60s via `export const maxDuration` in the relevant route files).

---

## 4. Folder Structure

```text
decision-intelligence-platform/
├── src/
│   ├── app/                     # Next.js App Router — URLs map to folders here
│   │   ├── layout.tsx           # Root HTML shell, loads fonts, wraps every page
│   │   ├── page.tsx             # Landing page ("/")
│   │   ├── globals.css          # The entire design system (CSS variables, utility classes)
│   │   ├── icon.svg             # Favicon
│   │   ├── not-found.tsx        # Custom 404 page
│   │   ├── [domain]/            # Dynamic route: /operations, /market, /product
│   │   │   ├── layout.tsx       # Shared masthead/nav wrapper for all module pages
│   │   │   ├── page.tsx         # Module home (e.g. /operations)
│   │   │   ├── loading.tsx      # Automatic loading skeleton (Next.js convention)
│   │   │   ├── error.tsx        # Automatic error boundary (Next.js convention)
│   │   │   ├── DomainNav.tsx    # Left-hand page index component
│   │   │   ├── Placeholder.tsx  # Fallback for not-yet-built sub-pages
│   │   │   └── [...slug]/       # Catch-all: /operations/forecasting, etc.
│   │   │       └── page.tsx
│   │   ├── data/                # The shared "Data Manager" upload UI
│   │   │   ├── page.tsx
│   │   │   └── DataManager.tsx  # Client component: drag-drop, table, modal
│   │   └── api/                 # Backend HTTP endpoints (Route Handlers)
│   │       ├── data/            # Upload / list / rename / delete / ingest files
│   │       ├── operations/      # Operations AI advisor + health check
│   │       ├── market/          # Market AI advisor
│   │       └── product/         # Product AI advisor
│   │
│   ├── core/                    # THE SHARED ENGINE — domain-agnostic, pure TS
│   │   ├── stats/                # Descriptive stats, regression, A/B testing
│   │   ├── forecast/              # Time-series forecasting (Holt-Winters etc.)
│   │   ├── scoring/                # Generic weighted multi-criteria scorer
│   │   ├── recommend/               # Turns "signals" into ranked recommendations
│   │   ├── segmentation/             # RFM / quantile-based customer segmentation
│   │   ├── cohort/                    # Retention-cohort matrix builder
│   │   ├── validation/                 # Walk-forward backtesting + calibration
│   │   ├── report/                      # PDF executive-report builder (jsPDF)
│   │   ├── advisor/                      # Ollama client + deterministic fallback
│   │   ├── workspace/                     # File upload parsing (CSV/XLSX/JSON/...)
│   │   └── registry.ts                     # The list of domains + their metadata
│   │
│   ├── domains/                 # ONE FOLDER PER MODULE — glue code, not the engine
│   │   ├── operations/           # Real-data module (UCI Online Retail II)
│   │   │   ├── data.ts            # ALL SQL queries for this domain live here
│   │   │   ├── snapshot.ts         # Orchestrates data.ts + core/* into one object
│   │   │   ├── decisions.ts         # Builds "signals" for core/recommend
│   │   │   ├── customers.ts          # RFM/CLV wrapper around core/segmentation
│   │   │   ├── inventory.ts           # Reorder-point / safety-stock math
│   │   │   ├── pricing.ts              # Price-elasticity simulator
│   │   │   ├── rootcause.ts             # "why did revenue change" decomposition
│   │   │   ├── ingest.ts                 # Maps uploaded CSV columns → DB schema
│   │   │   ├── assumptions.ts             # Labeled cost/category assumptions
│   │   │   ├── advisor.ts                  # AI persona + rules for this domain
│   │   │   ├── config.ts                    # Metadata, honest-numbers comment block
│   │   │   ├── format.ts                     # £ currency formatter
│   │   │   └── pages/                         # React components for each sub-page
│   │   ├── market/               # Synthetic-data module (120 modeled countries)
│   │   └── product/              # Synthetic-data module (3,000 modeled SaaS users)
│   │   └── pages.ts               # Maps domainId + slug → the right page component
│   │
│   ├── db/
│   │   ├── schema.ts             # The ENTIRE database schema (Drizzle ORM tables)
│   │   └── index.ts               # The database client singleton
│   │
│   └── ui/                      # Reusable, domain-agnostic React components
│       ├── components/           # Card, Badge, Kpi, Docket, AdvisorChat, Logo, ...
│       ├── charts/                # ECharts wrapper + shared color theme
│       ├── accents.ts              # Maps a domain's accent color to a CSS variable
│       └── cn.ts                    # Tiny className-merging helper
│
├── scripts/                     # One-off Node scripts run from the terminal (not the web app)
│   ├── etl-operations.ts         # Bulk-loads the full ~1M-row dataset into Postgres
│   ├── operations-metrics.ts      # Recomputes the "honest numbers" printed in docs
│   ├── product-metrics.ts          # Same, for the Product module
│   ├── harness-demo.ts              # Proves the validation harness can report failure
│   └── lib/load-retail.ts            # Shared Excel-parsing + data-quality profiler
│
├── data/                        # Local-only: the downloaded UCI dataset (gitignored)
├── public/                      # Static assets served as-is
├── drizzle.config.ts            # Tells drizzle-kit where the schema and DB URL are
├── next.config.ts                # Next.js build config + HTTP security headers
├── vitest.config.ts               # Test runner config
├── eslint.config.mjs               # Linter rules
├── tsconfig.json                    # TypeScript compiler settings + the "@/" import alias
├── package.json                      # Dependencies + npm scripts
├── vercel.json                        # Tells Vercel this is a Next.js app
└── .github/workflows/ci.yml            # GitHub Actions: lint, typecheck, test, build
```

### Why organized this way

- **`/core` vs `/domains` is the single most important structural decision in
  this repo.** It exists to make one architectural claim testable: "the same
  five-stage pipeline (ingest → score → recommend → report → advise) can serve
  three genuinely different business problems." If domain logic leaked into
  `/core`, or if `/core` logic were duplicated per domain, that claim would be
  false. The tests in `src/core/*/index.test.ts` and `src/domains/*/*.test.ts`
  enforce this boundary by testing `/core` with zero knowledge of any domain.
- **`src/app` mirrors URLs.** This is a Next.js App Router convention: a file
  at `src/app/data/page.tsx` is reachable at `/data`; a folder named
  `[domain]` creates a URL parameter. There is no separate "router
  configuration file" the way older frameworks (Express, React Router)
  require — the file system *is* the router.
- **`src/domains/X/pages/` holds React components, but `src/domains/X/*.ts`
  (no `pages/`) holds plain logic.** This separates "how do I compute this"
  from "how do I display this," so the computation is unit-testable without a
  browser or a rendering engine.
- **`scripts/` is deliberately outside `src/`.** These are one-time or
  operator-run Node scripts (bulk ETL, printing honest metrics) — they are
  never imported by the running web app and never bundled into it.

---

## 5. The `/core` Engine — File by File

Every file below is **pure TypeScript with no side effects except where noted**
(the advisor's `fetch` calls, and the report builder's PDF generation). "Pure"
means: same input always produces the same output, and calling the function
doesn't change anything outside itself. This is *why* they're so easy to unit
test — no mocking, no database, no network.

### 5.1 `src/core/stats/index.ts`

**Purpose:** the statistical toolbox every other `/core` module builds on top
of. Descriptive statistics, linear regression, the normal distribution, and a
two-proportion A/B significance test.

**Why it exists:** the two original source apps each had their own,
*different*, statistics file. One had `normalCDF` implemented with one
polynomial approximation; the other had a second, slightly different
approximation. Merging them into one canonical file eliminates that class of
bug (two "correct" implementations that disagree at the third decimal place)
and gives every domain the exact same math.

**Key exports and what they do:**

| Function | What it computes | Used by |
|---|---|---|
| `mean`, `std`, `variance`, `median`, `percentile` | Standard descriptive statistics | `forecast`, `segmentation`, `validation` |
| `linearRegression(ys, xs?)` | Ordinary least-squares regression; returns slope, intercept, R², and a `predict(x)` closure | `forecast`'s "Linear trend" candidate model |
| `normalCdf(z)` | The cumulative distribution function of the standard normal distribution (Abramowitz & Stegun polynomial approximation) | `zForConfidence`, `twoTailedPValue` |
| `normalQuantile(p)` | The *inverse* of `normalCdf` — "what z-score corresponds to this percentile" | Sample-size calculations |
| `calculateABTest(...)` | A full two-proportion z-test: lift, p-value, significance, confidence interval, verdict (`winner`/`loser`/`inconclusive`), and required sample size | Product's Experiments page |
| `meanConfidenceInterval` | 95%-style CI around a sample mean | Available for any domain that needs it |

**Section-by-section walkthrough of `calculateABTest`:**

```ts
export function calculateABTest(
  controlConversions: number, controlSamples: number,
  treatmentConversions: number, treatmentSamples: number,
  opts: { alpha?: number; power?: number; minDetectableEffect?: number } = {},
): ABTestResult {
```

1. **Compute raw conversion rates** for control and treatment
   (`conversions / samples`).
2. **Pool the two groups** into one combined conversion rate (`pooled`) — this
   is standard practice for a two-proportion test because, under the null
   hypothesis ("there is no real difference"), both groups are assumed to be
   drawn from the *same* underlying rate.
3. **Compute the standard error** of the difference using the pooled rate.
4. **Compute the z-statistic**: `(treatmentRate - controlRate) / standardError`
   — "how many standard errors apart are these two rates?"
5. **Convert the z-statistic to a p-value** via `twoTailedPValue`, which calls
   `normalCdf`. The p-value answers: *"if there were truly no difference, how
   likely is it we'd see a gap this large by chance alone?"*
6. **Classify significance** (`pValue < alpha`, default `alpha = 0.05` = 5%).
7. **Compute a confidence interval** on the lift using the treatment group's
   own standard error.
8. **Compute the required sample size per arm** for a target minimum
   detectable effect, using the standard power-analysis formula involving
   both a z-value for confidence and a z-value for statistical power.

**Time complexity:** O(1) — every operation here is constant-time arithmetic
on scalar inputs (no loops over the raw event data — the caller has already
reduced events down to a count and a total).

### 5.2 `src/core/forecast/index.ts`

**Purpose:** predict future values of a time series (e.g., weekly revenue)
using classical statistical forecasting — no external ML API, no Python.

**Why it exists:** promoted from the retail app's original forecasting code,
which was the *only* forecasting capability across the three merged apps.
Generalized here to work on *any* numeric series, not just revenue.

**The algorithm, explained for a beginner first:**

Imagine you have the last two years of weekly sales numbers and want to guess
next week's number. There are a few common strategies:
- **"Just use last week's number"** (a "drift" model — the simplest possible
  guess, adjusted for the recent trend).
- **"Draw a straight line through the data and extend it"** (linear
  regression).
- **"Notice sales spike every December, and account for both the trend AND
  the repeating yearly pattern"** (Holt-Winters, a more sophisticated model
  that tracks a level, a trend, and a repeating seasonal pattern
  simultaneously).

This module builds **all three candidate models**, and then — critically —
picks a winner using a technique described below rather than picking whichever
model happens to fit the *historical* data best (which would be cheating; a
model can always fit history perfectly by memorizing it, but that tells you
nothing about tomorrow).

**Technical explanation of Holt-Winters** (function `holtWinters`):

Holt-Winters triple exponential smoothing tracks three numbers that update
every time step:
- `level` — the "de-seasonalized" current value.
- `trend` — how fast the level is rising or falling.
- `season[i]` — one number per position in the seasonal cycle (e.g., one per
  day of week, or one per month) representing how much that position
  typically deviates from the level.

Each of these three is updated with an *exponential smoothing* formula (a
weighted average between "what we predicted" and "what actually happened,"
controlled by a smoothing parameter α, β, or γ between 0 and 1). The code grid
-searches over a small set of candidate α/β/γ values (`[0.1, 0.3, 0.5, 0.8]`
etc.) and keeps whichever combination minimizes in-sample error:

```ts
for (const a of [0.1, 0.3, 0.5, 0.8]) {
  for (const b of [0.01, 0.05, 0.2]) {
    for (const g of [0.05, 0.2, 0.5]) {
      const err = rmse(vals.slice(1), holtWinters(vals, m, a, b, g).fitted.slice(1))
      if (err < bestErr) { bestErr = err; best = { a, b, g } }
    }
  }
}
```

**The critical design decision — a nested holdout split (`selectModelType`):**

This is the single most interview-worthy function in this codebase. The naive
approach to "which model is best" is: fit all three models on all the data,
measure which one has the lowest error, and report that error as "accuracy."
This is **wrong** and produces optimistic, misleading numbers, because the
model was allowed to see the very data it's being scored against.

The correct approach — implemented here — is:

1. Split the series into an outer **training set** and an outer **holdout**
   (the last ~20% of points).
2. **Within the training set only**, carve out a *second*, inner holdout.
   Select whichever model type does best on that *inner* holdout —
   `selectModelType` never looks at the outer holdout while making this
   choice.
3. Refit the *chosen* model type on the *full* training set.
4. Only now, score that model against the outer holdout, and report *that* as
   the honest, out-of-sample accuracy (`backtest` field).

```ts
if (n - vK >= 4) {
  const train = values.slice(0, n - vK)
  const holdout = values.slice(n - vK)
  const name = selectModelType(train, m)       // inner split inside train ONLY
  const fittedModel = fitSelected(train, m, name)
  const preds = holdout.map((_, i) => fittedModel.project(i + 1))
  backtest = { mape: ..., rmse: ..., periods: vK }
}
```

The in-source comment states the intent directly: *"No selection-on-test
optimism; defensible without a footnote."* This nested-split design was added
specifically in response to the question "how do I know your backtest wasn't
cheating by picking the model that happens to fit the holdout?" — and the
answer is architecturally baked in, not just asserted.

**Return shape (`ForecastResult`):**

```ts
{
  model: string              // e.g. "Holt-Winters (seasonal)" or "Linear trend"
  trendPerStep: number
  metrics: { mape, rmse, r2 }    // IN-SAMPLE — optimistic, labeled as such
  backtest: { mape, rmse, periods } | null   // OUT-OF-SAMPLE — the honest number
  series: ForecastPoint[]     // history + future points, each with lower/upper CI bounds
}
```

The confidence interval band widens with the square root of the forecast
horizon (`band = z * resStd * Math.sqrt(h)`) — a standard result: uncertainty
compounds the further into the future you predict.

**Interview questions — Forecasting**

- *Beginner:* "What is a time series?" — A sequence of numbers measured at
  regular time intervals (e.g., weekly revenue). Order matters; you can't
  shuffle it.
- *Intermediate:* "Why can't you just pick the model with the lowest error on
  all your data?" — Because that model may simply be **overfit**: it memorized
  the noise in the data you already have, rather than learning the underlying
  pattern, so it will perform worse on genuinely new data. You need a fair
  test on data the model never saw.
- *Advanced:* "What's the difference between the `metrics` field and the
  `backtest` field in this codebase's `ForecastResult`, and why does it
  matter?" — `metrics` is in-sample (computed against the same data used to
  fit the model — always looks better than reality). `backtest` is
  out-of-sample via a nested holdout split (never touches the data used for
  model *selection*). Reporting `metrics` as "accuracy" would be statistically
  dishonest; this codebase deliberately keeps them separate fields and labels
  `metrics` as "IN-SAMPLE (optimistic — do not report as accuracy)" in a code
  comment.

### 5.3 `src/core/scoring/index.ts` — `scoreAndClassify`

**Purpose:** the single generic "rank a list of things by multiple weighted
criteria, then bucket them into named tiers" function. This is one of the two
"centerpiece" primitives of the whole merge (the code literally marks it with
a ⭐ in its own comments).

**Why it exists:** all three original apps independently invented "rank and
classify" logic:
- Market: an if/else chain deciding whether a country is `Expand` /
  `Investigate` / `Monitor` / `Avoid`.
- Product: RICE / ICE / WSJF prioritization scores.

Both are *literally the same algorithm* — weight several numeric criteria,
normalize them onto a common 0–100 scale, sum them, sort, and classify into
named tiers by threshold. `scoreAndClassify` is written once and used by both.

**The algorithm, step by step:**

```ts
export function scoreAndClassify<T>(items: T[], config: ScoreConfig<T>): ScoredItem<T>[] {
```

1. **For each criterion**, determine a normalization range — either a fixed
   `[min, max]` supplied by the caller, or derived automatically from the
   actual spread of values in the current list (`Math.min`/`Math.max` across
   items).
2. **For each item**, and for each criterion:
   - Compute the raw value (`c.value(item)`).
   - Normalize it into 0–1 using min-max scaling:
     `(raw - lo) / (hi - lo)`.
   - If the criterion's `direction` is `'lower'` (i.e., lower is better, like
     risk), flip it: `norm = 1 - norm`.
   - Multiply by the criterion's weight (as a fraction of the total weight
     across all criteria) to get that criterion's contribution to the final
     score, then multiply by 100 to express it on a 0–100 scale.
3. **Sum all contributions** into a single composite score per item.
4. **If bucket thresholds were supplied**, classify each item into the
   highest bucket whose `min` the score meets or exceeds.
5. **Sort all items** by score descending and assign 1-based ranks.
6. **Return, per item**, not just the score but the *individual per-criterion
   contributions* — so a user can see *why* something scored the way it did
   (this powers the "▲ Opportunity +24 · Ease of entry +18" driver labels on
   the Market Expansion Center page).

**Example config, from the Market domain** (`src/domains/market/scoring.ts`):

```ts
const decisionConfig: ScoreConfig<Market> = {
  criteria: [
    { key: 'opportunity', weight: 0.4, direction: 'higher', value: (m) => m.opportunityScore, range: [0, 100] },
    { key: 'easeOfEntry',  weight: 0.3, direction: 'higher', value: (m) => m.easeOfEntry,      range: [0, 100] },
    { key: 'risk',         weight: 0.2, direction: 'lower',  value: (m) => m.riskScore,        range: [0, 100] },
    { key: 'gdpGrowth',    weight: 0.1, direction: 'higher', value: (m) => m.gdpGrowth,         range: [-3, 13] },
  ],
  buckets: [
    { label: 'Expand',      min: 62 },
    { label: 'Investigate', min: 48 },
    { label: 'Monitor',     min: 34 },
    { label: 'Avoid',       min: 0  },
  ],
}
```

The *exact same function* also powers Product's RICE/ICE/WSJF ranking, just
with a single criterion whose accessor is swapped based on which scoring model
the user picked (`src/domains/product/prioritization.ts`):

```ts
const accessor = (x) => (model === 'rice' ? x.rice : model === 'ice' ? x.ice : x.wsjf)
const ranked = scoreAndClassify(withScores, {
  criteria: [{ key: model, weight: 1, direction: 'higher', value: accessor }],
  buckets: TIERS, // Now / Next / Later / Backlog
})
```

**Time complexity:** O(n × c) where n = number of items and c = number of
criteria — one pass to compute per-item scores, one sort (O(n log n)), which
dominates for large n.

**Interview questions — Scoring**

- *Beginner:* "What does 'normalize' mean here?" — Turning different-scale
  numbers (a risk score 0–100, a growth rate -3% to 13%) into the same 0–1
  scale so they can be fairly weighted and summed. Without normalization, a
  criterion measured in the thousands would dominate one measured in single
  digits regardless of its assigned weight.
- *Intermediate:* "Why does the function return per-criterion
  `contributions`, not just the final score?" — Explainability. A user
  looking at a ranked list wants to know *why* item A beat item B, not just
  that it did. This is directly used in the UI (the "▲ Opportunity +24" tags).
- *Advanced:* "This uses min-max normalization derived from the current
  list's own spread by default. What's the failure mode of that, and how does
  the code let a caller opt out?" — If you score two *different* lists at
  different times (e.g., this month's cohort vs. last month's), the same raw
  value could normalize to different scores because the min/max of the list
  changed — scores aren't comparable across calls. The `range` field on each
  `Criterion` lets a caller supply a **fixed** range instead, making scores
  stable and comparable over time (which is exactly what Market's config does
  by hardcoding `range: [0, 100]`).

### 5.4 `src/core/recommend/index.ts` — `synthesize`

**Purpose:** the second "centerpiece" primitive. Takes a flat list of domain
`Signal`s (a forecast trend, a churn risk, an inventory shortfall...) from *any*
domain and turns them into a single ranked list of `Recommendation`s.

**The core idea, in one line:** `priority = |impact| × confidence`, sorted
descending.

```ts
const defaultScore = (s: Signal) => Math.abs(s.impact) * s.confidence

export function synthesize(signals: Signal[], opts: SynthesizeOptions = {}): Recommendation[] {
  const { score = defaultScore, minConfidence = 0, minImpact = 0, limit } = opts
  const ranked = signals
    .filter((s) => s.confidence >= minConfidence && Math.abs(s.impact) >= minImpact)
    .map((s) => ({ ...s, priorityScore: score(s), priority: 0 }))
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((r, i) => ({ ...r, priority: i + 1 }))
  return typeof limit === 'number' ? ranked.slice(0, limit) : ranked
}
```

**Why this design:** it deliberately ranks a *dollar-value* signal (e.g., "at
risk customers worth £200K, 70% confidence" → priority score 140,000) above a
*percentage* signal (e.g., "8% return rate, 60% confidence" — but returns are
worth a much smaller total dollar figure) *only if* the dollar impact wins out
after multiplying by confidence. A low-confidence forecast for a huge number
can still be correctly out-ranked by a smaller, higher-confidence signal — this
exact scenario is asserted in a unit test
(`src/domains/operations/operations.test.ts`): a forecast worth £50,000 at 10%
confidence (priority score 5,000) is correctly ranked *below* firmer customer
and returns signals worth hundreds of thousands.

**Why a plain "impact" field and not, say, a fixed severity enum
(low/medium/high)?** Using a continuous number lets *heterogeneous* signals
from completely different domains compete fairly on the same list, without
each domain needing to agree in advance on what "high" means.

### 5.5 `src/core/segmentation/index.ts` — RFM & Quantiles

**Purpose:** rank a population into quantile bins (1 through N, evenly sized)
along one or more dimensions, then classify entities into named segments.

**RFM, simple explanation:** "RFM" stands for **R**ecency, **F**requency,
**M**onetary — a classic retail-analytics technique. It scores every customer
on three questions: *How recently did they buy? How often do they buy? How
much do they spend?* Each customer gets a 1–5 score on each dimension (5 =
best), and the combination places them into a segment like "Champions"
(high on all three) or "Hibernating" (low on all three).

**Technical explanation of `assignQuantiles`:**

```ts
export function assignQuantiles(values: number[], bins = 5, direction: QuantileDirection = 'higher'): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const rank = new Array(n)
  order.forEach((o, pos) => (rank[o.i] = pos))
  return values.map((_, i) => {
    const q = rank[i] / (n - 1)
    let score = Math.min(bins, Math.floor(q * bins) + 1)
    if (direction === 'lower') score = bins + 1 - score
    return score
  })
}
```

Rather than dividing by fixed value thresholds (which produces uneven bin
sizes if the data is skewed — very common in retail, where a small number of
customers spend far more than the median), this **sorts every value and
assigns quantile position by rank**, guaranteeing (up to tie-breaking) that
each of the 5 bins has roughly `n/5` members. "Recency" uses `direction:
'lower'` because a *smaller* number of days-since-last-purchase is *better*.

**Default segment grid (`defaultRfmSegment`):** a lookup table mapping (R
score, average of F/M scores) pairs to human labels — Champions, Loyal, New,
Promising, At Risk, Needs Attention, Hibernating, Monitor. Any domain can
override this with its own labeling function via the optional `segmentOf`
parameter to `computeRfm`.

### 5.6 `src/core/cohort/index.ts` — Retention Matrix

**Purpose:** compute a **retention matrix** — for each signup cohort (e.g.,
"users who joined in March 2024"), what fraction of them were still active
1, 7, 14, 30, 60, and 90 days later.

**Simple explanation:** picture a spreadsheet. Each row is a group of people
who all joined in the same week. Each column is "how many days later." Each
cell says what percentage of that group was still around by that column's day
count. This is the classic SaaS "cohort retention heatmap."

**How it's computed:** the caller supplies a flat list of `CohortEntry {
entityId, cohortKey, periodOffset }` — one row per "this user was active this
many days after joining." The function groups these by cohort, de-duplicates
per (cohort, offset) using a `Set` (so a user active twice in the same period
only counts once), and divides each offset's active count by the cohort's
total size (measured at offset 0) to get a retention rate.

```ts
export function buildRetentionMatrix(entries: CohortEntry[], offsets?: number[]): CohortRow[] {
  const byCohort = new Map<string, Map<number, Set<string | number>>>()
  // ... populate byCohort[cohortKey][periodOffset] = Set of entityIds active then
  for (const [cohortKey, offMap] of byCohort) {
    const size = offMap.get(0)?.size ?? /* fallback */
    const cells = reportOffsets.map((offset) => {
      const count = offMap.get(offset)?.size ?? 0
      return { offset, count, rate: size > 0 ? count / size : 0 }
    })
    rows.push({ cohortKey, size, cells })
  }
}
```

Product's D1–D90 retention numbers displayed in the UI (e.g., "D30 35.6%") are
the *direct, measured output* of this function run over the synthetic event
generator's output — they are not hardcoded strings; they are computed live
on every request, which is asserted by a unit test that checks D0 is always
100% and retention only ever decreases.

### 5.7 `src/core/validation/index.ts` — The Validation Harness

**Purpose:** this is the module the project's README calls "the genuinely new
capability, present in none of the three source repos." It does two distinct
jobs:

**Job 1 — Walk-forward backtesting (`walkForwardBacktest`).** A stricter
alternative to the single train/holdout split used inline inside `forecast()`.
Instead of one split, it walks an "origin" point forward through the series
many times, each time training only on data *before* that origin and scoring
the next `horizon` points:

```ts
for (let t = minTrain; t + 1 <= n; t += step) {
  const train = values.slice(0, t)
  const preds = forecaster(train, k).slice(0, k)
  const actuals = values.slice(t, t + k)
  pooledActual.push(...actuals); pooledPred.push(...preds)
  origins++
}
```

This simulates "if you had been running this forecaster in production every
week for the past two years, how accurate would it actually have been, on
average, across every one of those weeks?" — a much more realistic accuracy
estimate than a single lucky (or unlucky) train/test split.

**Job 2 — Confidence calibration (`calibration`).** Answers: "when this system
says it's 70% confident, is it actually right about 70% of the time?" Given a
list of `{ confidence, correct }` samples, it buckets them into 10 confidence
bins (0–10%, 10–20%, ..., 90–100%), and for each bin compares the *average
stated confidence* against the *actual observed correctness rate*. Two summary
numbers:
- **Brier score**: mean squared error between confidence and outcome (0 =
  perfect, 1 = worst possible). `brier += (c - outcome) ** 2`.
- **Expected Calibration Error (ECE)**: the size-weighted average gap between
  stated confidence and observed accuracy across bins.

**Proof this harness can actually fail** (`scripts/harness-demo.ts`): this
project ships a standalone script specifically to demonstrate the harness is
not rigged to always report good news. Running it against a synthetic
white-noise series produces a walk-forward **R² of −0.235** (worse than
predicting the mean every time) and an overconfident classifier example
produces an **ECE of ~0.77**. This script is referenced from the README as
proof of intellectual honesty — a validation harness that can only ever say
"great job" isn't validating anything.

### 5.8 `src/core/report/index.ts` — `buildReportPdf`

**Purpose:** one shared PDF generator (via the `jsPDF` library) used by all
three domains' "Executive Reports" pages. Given a `ReportDoc` object (brand
name, title, accent color, and a list of typed sections — KPIs, tables,
bullet lists, or ranked recommendations), it lays out a multi-page A4 PDF with
a branded header band, automatic page breaks (`ensureSpace`), and a footer
that repeats an honest "data note" (e.g., *"Real data: UCI Online Retail II"*)
on every page.

**Why one shared builder instead of three:** all three original apps had a
near-identical "boardroom report" PDF layout hand-coded independently. Here,
each domain differs only in *what data it passes in* — the brand color, the
section content — never in *how the PDF is laid out*. This is the same
architectural pattern as `scoreAndClassify` and `synthesize`: shared mechanism,
per-domain configuration.

### 5.9 `src/core/advisor/index.ts` — The AI Advisor Engine

**Purpose:** power the "Ask the AI Advisor" chat box in every domain, using a
local LLM (Ollama) when available, and a rule-based deterministic fallback
always. Covered in detail with the full request flow in
[§6.1](#61-the-advisor-pattern-shared-across-all-three-domains) and
[§16.3](#163-trace-asking-the-ai-advisor-a-question).

### 5.10 `src/core/workspace/index.ts` — File Upload Core

**Purpose:** all format detection, size validation, and file *parsing* logic
for the shared Data Manager upload feature (covered fully in
[§8](#8-the-data-workspace-upload-feature--deep-dive)).

### 5.11 `src/core/registry.ts` — The Domain Registry

**Purpose:** the single list of "what domains exist and what does each one
need to render its shell" — id, label, tagline, accent color, data provenance
(`'real'` vs `'demo'`), a human-readable data-source string, and the list of
sub-pages (`nav`) each domain exposes.

```ts
export const OPERATIONS: DomainModule = {
  id: 'operations', label: 'Operations', accent: 'cyan',
  provenance: 'real', dataSource: 'UCI Online Retail II (real transactions)',
  nav: [ { slug: '', label: 'Decision Center' }, { slug: 'forecasting', label: 'Forecasting' }, ... ],
}
export const DOMAINS: DomainModule[] = [OPERATIONS, MARKET, PRODUCT]
export function getDomain(id: string) { return DOMAINS.find((d) => d.id === id) }
```

Every page that needs to know "what domains exist" or "what does this domain's
left-nav look like" imports from here — the module switcher, the domain
layout, and the landing page's numbered contents list all read from this one
array, so adding a fourth domain to the platform is (mostly) a matter of
adding a fourth entry here plus its own `/domains/<name>` folder.

---

## 6. The Domains — File by File

Each domain follows the identical internal shape, differing only in content.
This section documents the pattern once in depth using **Operations** (the
richest domain, backed by a real database), then calls out what differs in
Market and Product.

### 6.0 The domain's job, restated

A domain's entire responsibility is to **translate its data into the generic
shapes `/core` understands**, and translate `/core`'s generic outputs back into
domain-specific UI. It never re-implements ranking, scoring, forecasting, or
PDF layout — those live once, in `/core`.

### 6.1 `src/domains/operations/data.ts` — The Only File That Talks SQL

**Purpose:** the single, centralized place where this domain issues SQL. Every
other file in `operations/` that needs revenue, customers, or product data
calls one of these functions — none of them writes SQL directly. This is
deliberate: if a query needs to change, there is exactly one place to change
it, and every consumer (the Decision Center, the Reports page, the AI advisor)
automatically stays in sync.

**Six exported query functions**, each wrapped in Next.js's `unstable_cache`:

```ts
const CACHE = { revalidate: 3600, tags: ['operations'] }
export const getKpis = unstable_cache(getKpisImpl, ['ops:kpis'], CACHE)
export const getRevenueSeries = unstable_cache(getRevenueSeriesImpl, ['ops:revenue-series'], CACHE)
export const getCustomerRows = unstable_cache(getCustomerRowsImpl, ['ops:customers'], CACHE)
export const getDemandRows = unstable_cache(getDemandRowsImpl, ['ops:demand'], CACHE)
export const getCategoryComparison = unstable_cache(getCategoryComparisonImpl, ['ops:category-cmp'], CACHE)
export const getTopProducts = unstable_cache(getTopProductsImpl, ['ops:top-products'], CACHE)
```

Each `*Impl` function is the "real" implementation (does the SQL query); the
exported name wraps it in a **1-hour cache**, tagged `'operations'`. Because
the underlying dataset (once loaded) never changes on its own, caching is safe
and turns the ~4–5 second first query into a ~15-millisecond cache hit on every
subsequent request within the hour. Uploading and ingesting a new file calls
`revalidateTag('operations', 'max')` (in the ingest API route) to invalidate
this cache immediately, so newly ingested data shows up right away rather than
waiting up to an hour.

**Example: `getKpisImpl`** — computes headline numbers with one SQL query,
run in parallel with a second query for customer count:

```sql
SELECT
  COALESCE(SUM(CASE WHEN quantity > 0 AND unit_price > 0 THEN line_revenue END), 0) AS revenue,
  COUNT(DISTINCT CASE WHEN quantity > 0 AND unit_price > 0 THEN invoice END) AS orders,
  MIN(invoice_date)::date AS date_min,
  MAX(invoice_date)::date AS date_max,
  COALESCE(SUM(CASE WHEN line_revenue < 0 OR quantity < 0 THEN ABS(line_revenue) END), 0) AS returns_value
FROM operations_invoice_lines
```

This one query does five aggregations in a single database round trip
(`SUM`, `COUNT DISTINCT`, `MIN`, `MAX` — all in one `SELECT`), which is far
more efficient than five separate queries. Note the deliberate distinction
between **clean sale lines** (`quantity > 0 AND unit_price > 0`) used for
revenue/orders, and **all lines including negatives** used for the returns
figure — a design choice that keeps "returns" honest (credit notes and
negative-quantity rows genuinely represent returns) without letting them
pollute the revenue total.

**`getKpis` calls `Promise.all`** for its two component queries rather than
awaiting them one after another — this is a real, measured performance fix
documented in a code comment: the *unparallelized* version of the whole
snapshot build took ~5.6 seconds and risked exceeding Vercel's serverless
timeout on a cold start; parallelizing brought it to ~3.6 seconds.

### 6.2 `src/domains/operations/snapshot.ts` — The Orchestrator

**Purpose:** `buildSnapshot()` is the single function that assembles
*everything* the Operations Decision Center, Reports page, and AI advisor all
need, so all three surfaces agree with each other (no risk of the advisor
citing a different revenue number than the dashboard shows).

**Step by step:**

```ts
export async function buildSnapshot() {
  try {
    const [kpis, rev, custRows, cats] = await Promise.all([
      getKpis(), getRevenueSeries('week'), getCustomerRows(), getCategoryComparison(90),
    ])
    if (!kpis.orders) return null   // genuinely unseeded database

    const fc = forecast(rev.values, rev.dates, 'week', 8)
    const projectedTotal = fc.series.filter((p) => p.actual === null).reduce((s, p) => s + (p.forecast ?? 0), 0)
    const backtestAccuracy = fc.backtest ? clamp(1 - fc.backtest.mape / 100, 0, 1) : 0.3

    const { summary } = computeCustomers(custRows, kpis.observedDays)
    const rc = assembleRootCause({ metricLabel: 'Revenue', categories: cats })
    const decisions = buildOperationsDecisions({ forecast: {...}, customers: summary, returns, rootCause: rc })

    return { kpis, fc, projectedTotal, ..., decisions }
  } catch {
    return null   // any failure (DB unreachable, etc.) degrades to "no data" UI, never a crash
  }
}
```

1. Fetch the four independent datasets **in parallel**.
2. If `kpis.orders` is zero, the database genuinely has no data — return
   `null` so the UI can show a friendly "upload data" empty state instead of
   crashing on missing numbers.
3. Run the forecast, and convert its MAPE (mean absolute percentage error)
   into a 0–1 "confidence" number (`1 - mape/100`, clamped) — a low MAPE
   (accurate forecast) becomes high confidence.
4. Run RFM customer segmentation and root-cause decomposition.
5. Feed everything into `buildOperationsDecisions` (see next section), which
   returns the final ranked list.
6. **Any exception anywhere in this chain is caught and converted to
   `null`.** This means a database hiccup shows the same graceful empty state
   as "database never seeded" — the user never sees a raw stack trace.

### 6.3 `src/domains/operations/decisions.ts` — Building Signals

**Purpose:** convert domain facts (forecast trend, at-risk customer value,
return rate, root-cause driver) into the generic `Signal[]` shape
`core/recommend`'s `synthesize()` expects, then call `synthesize()`.

This file contains **zero ranking or sorting logic** — that's the point. It
only describes *what the signals are* (title, expected result, confidence,
impact-in-dollars, plain-English reasoning) and hands the list to `/core`:

```ts
signals.push({
  id: 'forecast-trend',
  category: growing ? 'Growth' : 'Risk',
  title: growing ? 'Capitalize on projected revenue growth' : 'Mitigate projected revenue decline',
  confidence: f.backtestAccuracy,   // the MEASURED backtest accuracy, not a guess
  impact: Math.abs(f.projectedTotal),
  reasoning: `${f.model}; measured out-of-sample accuracy ${Math.round(f.backtestAccuracy * 100)}% ...`,
})
// ... more signals for at-risk customers, VIP customers, returns, root-cause
return synthesize(signals)
```

Notice `confidence: f.backtestAccuracy` — the confidence shown to the user for
the forecast-based recommendation is *literally the measured out-of-sample
accuracy number from `/core/forecast`*, not an arbitrary constant. This is why,
on the real dataset, the forecast-trend recommendation ranks *below* firmer
signals like VIP-customer value — its honestly low measured accuracy pulls its
confidence down, which pulls its priority score down (`impact × confidence`).

### 6.4 Other Operations domain files (brief)

| File | What it does |
|---|---|
| `customers.ts` | Wraps `core/segmentation`'s `computeRfm` with a 12-month predicted-value projection and a churn-risk heuristic (`recency / (expectedInterval × 1.5)`, clamped to 0–1) |
| `inventory.ts` | Computes safety stock and reorder points from per-product demand mean/std, using the classic formula `safetyStock = z × σ_demand × √(leadTime)` |
| `pricing.ts` | A constant-elasticity price simulator: `newDemand = baseDemand × (newPrice/basePrice)^elasticity` |
| `rootcause.ts` | Decomposes a revenue change into per-category contributions, ranked by absolute dollar change |
| `assumptions.ts` | The single source of truth for **derived, non-measured** assumptions (product category inferred from description text; a cost-as-fraction-of-price ratio per category) — deliberately isolated so every place that uses an assumption is traceable to one file, and every UI surface that shows a number built on it is labeled "≈ est" |
| `ingest.ts` | Maps arbitrary uploaded spreadsheet columns onto the fixed database schema (full walkthrough in [§8](#8-the-data-workspace-upload-feature--deep-dive)) |
| `advisor.ts` | The Operations-specific AI persona, context builder, and deterministic intent rules |
| `config.ts` | Branding metadata *and* a long code comment documenting the exact, reproducible "honest numbers" for this domain (real dataset row counts, measured forecast R²/MAPE, the returns rate) |

### 6.5 Market domain — what's different

**Data source:** entirely **synthetic and in-memory** — no database calls at
all. `src/domains/market/generator.ts` hardcodes a table of 121 real-world
country economic indicators (GDP, population, internet penetration, etc.) as
raw editorial data, then *derives* opportunity/risk/ease-of-entry scores from
formulas applied to those indicators. On import, the generator **deduplicates**
by market code/name (`generateMarkets()` builds a `Set` of seen keys) — a
duplicate "Pakistan" entry present in the original 121-row source table is
caught and removed, so the true, tested count is **120 distinct markets**, not
121. A unit test in `src/domains/market/market.test.ts` explicitly asserts
`MARKET_COUNT === 120` and `!== 121`, encoding this fixed data-quality bug
directly into the test suite as a regression guard.

**Every score is "modeled," not measured**, and this is stated explicitly and
repeatedly: the config's weights (`MARKET_DECISION_WEIGHTS`) are editorial
choices, not fit to real outcome data, and the `DemoBanner` UI component
appears at the top of every Market page.

**The Scenario Simulator** (`src/domains/market/pages/ScenarioSimulator.tsx`,
a client component) is the one genuinely interactive calculator in this
domain: sliders for budget, team size, and pricing strategy feed
`simulateExpansion()` (in `scoring.ts`), which projects 24 months of revenue
and profit and renders the result as an ECharts bar+line combo chart, entirely
client-side (no network request per slider move — the whole computation is a
synchronous function call inside a `useMemo`).

### 6.6 Product domain — what's different

**Also entirely synthetic and in-memory**, but with one important nuance:
while the *underlying users are synthetic*, the retention/funnel/experiment
**numbers displayed are genuinely measured from that synthetic data**, not
hand-typed constants. `src/domains/product/generator.ts` deterministically
generates 3,000 synthetic users (fixed random seed via a custom `mulberry32`
pseudo-random generator, so the numbers are stable across runs/deployments)
with signup dates, feature usage, and simulated retention events. Then
`src/domains/product/analytics.ts`'s `buildRetention()` feeds that generated
activity through the real `core/cohort` module to compute the D1–D90
percentages shown on screen — the same code path that would run on real
production event data. This distinction (synthetic *inputs*, but real
*computation*) is stated in the domain's config comment block and asserted by
tests (`product.test.ts` checks D0 = 100% and monotonic decay, not a specific
hardcoded percentage).

---

## 7. The App Router (`src/app`) — File by File

### 7.1 `src/app/layout.tsx` — The Root Shell

Every page in the app is wrapped by this file. It:
1. Loads three Google Fonts via `next/font/google` (`Space_Grotesk`,
   `Hanken_Grotesk`, `IBM_Plex_Mono`) as CSS custom properties, so every
   descendant component can reference `var(--font-grotesk)` etc. without a
   flash-of-unstyled-text.
2. Sets page `<title>` / `<meta description>` defaults via Next.js's
   `Metadata` export.
3. Renders `<html><body>{children}</body></html>` — nothing more. No global
   navigation lives here (that's the domain layout's job); the root layout is
   deliberately minimal because both the marketing landing page and the
   module shell have very different headers.

### 7.2 `src/app/page.tsx` — The Landing Page

A single Server Component with no data fetching (everything on this page is
static content defined in the file itself as arrays — `FIGURES`, `PIPELINE`,
`DATA_DOCS`, `STEPS`). It renders:
- A hero statement and two call-to-action links (`<Link>` to `/operations` and
  `/data`).
- A "Contents" list built by mapping over `DOMAINS` from the registry —
  meaning if a fourth domain were added to `registry.ts`, it would
  automatically appear here with zero changes to this file.
- A published-figures strip (real numbers, including the honest R²).
- A "Method" section explaining the five-stage pipeline.
- A pull-quote from the validation harness.

### 7.3 `src/app/[domain]/layout.tsx` — The Module Shell

Wraps every page under `/operations/*`, `/market/*`, `/product/*`. Responsible
for:
1. **Looking up the domain** from the URL parameter via `getDomain(domain)`;
   calling Next.js's `notFound()` if the segment doesn't match a real domain
   (e.g., `/nonsense` renders the custom 404 page).
2. **Setting a CSS custom property** (`--accent`) on a wrapping `<div>` based
   on the domain's accent color, so every child component that uses
   `var(--accent)` in its Tailwind classes automatically picks up the correct
   module color without prop-drilling a color value through every component.
3. **Rendering the masthead** (logo, module switcher tabs, "Upload / manage
   data" link, provenance badge).
4. **Rendering the dataset statusline** — wrapped in React's `<Suspense>`, so
   it streams in *after* the main page content rather than blocking the whole
   page on one more database query (a graceful-degradation pattern explained
   in [§17.14](#1714-suspense-and-streaming)).
5. **Rendering the left-hand page index** (`DomainNav`) and the page content
   (`{children}`) side by side.

### 7.4 `src/app/[domain]/page.tsx` and `[...slug]/page.tsx` — The Dynamic Router

`page.tsx` handles the module's home URL (e.g., `/operations`); `[...slug]/
page.tsx` handles every sub-page (`/operations/forecasting`, `/market/
scenarios`, etc.) using a Next.js **catch-all route** (`[...slug]` captures
one or more path segments as an array).

Both files follow the same three-step pattern:
```ts
const mod = getDomain(domain)                 // 1. look up the domain
if (!mod) notFound()
const page = resolvePage(mod.id, slug)         // 2. look up the page component
if (page) return createElement(page)           // 3. render it, or fall back
return <Placeholder .../>
```

`resolvePage` (from `src/domains/pages.ts`) is a simple two-level lookup:
`DOMAIN_PAGES[domainId][slug]`. This indirection means the router files
themselves never import a single domain's components directly — they're
generic dispatchers. Adding a new sub-page to a domain is: add the component,
register it in that domain's `pages/index.ts`, add the nav entry to
`registry.ts`. No router file changes.

Both files also export `generateMetadata`, an async Next.js convention that
lets a page compute its own `<title>` dynamically (e.g., "Forecasting ·
Operations · CoreSight IQ") based on the URL parameters, and both export
`maxDuration = 30` — raising the default 10-second Vercel serverless function
timeout, because Operations' first (uncached) database query can take several
seconds.

### 7.5 `src/app/[domain]/loading.tsx` and `error.tsx` — Automatic Boundaries

These are **Next.js file-system conventions**, not manually wired components.
When any Server Component under `[domain]/` is still fetching data,
`loading.tsx`'s export is automatically shown; if any Server Component throws,
`error.tsx`'s export is automatically shown instead of a blank white screen or
raw stack trace.

- `loading.tsx` renders a static skeleton shaped exactly like the real
  Decision Center layout (a KPI-strip skeleton, then a card skeleton with
  pulsing gray bars) — so the loading state doesn't cause a layout jump when
  the real content arrives.
- `error.tsx` is a **Client Component** (`'use client'`) because Next.js error
  boundaries must run in the browser to catch rendering errors; it receives
  the thrown `error` object and a `reset()` function, and renders a "Try
  again" button that calls `reset()` to re-attempt rendering the segment.

### 7.6 `src/app/not-found.tsx`

A custom branded 404 page (Next.js convention: any file named `not-found.tsx`
at any level is used automatically when `notFound()` is called or a route
genuinely doesn't match anything).

---

## 8. The Data Workspace (Upload Feature) — Deep Dive

This is the most feature-rich single subsystem in the app and deserves its own
section. It lets a user drag-and-drop files that become available across all
three modules, and — uniquely for CSV/XLSX/JSON files describing order lines —
lets a user load their own data straight into the real Operations analytics
with one click.

### 8.1 The data model

One database table, `workspace_files` (defined in `src/db/schema.ts`), stores
everything: the file's display name, its original filename, detected format,
size, a `scope` (`'shared'` visible everywhere, or `'operations'`/`'market'`/
`'product'` visible to just one module), a `status` (`'ready'` or `'error'`),
parsed metadata (`columns`, `rowCount`, a `sampleRows` preview, or a
`textPreview` for plain-text files), and — critically — the **raw file bytes,
stored as base64-encoded text** (`rawBase64`).

**Why base64 text instead of a native binary column?** A code comment in
`schema.ts` explains: the Neon serverless driver used by this project (`neon-
http`) ships query parameters as JSON, and JSON has no binary type — so a real
Postgres `bytea` column would require extra encode/decode plumbing to work
with this particular driver. Storing base64 text sidesteps that entirely at
the (small, files are capped at 4 MB) cost of ~33% larger storage. This is
explicitly a trade-off made for driver compatibility, not a "best practice" —
a good example of a decision an interviewer might probe.

### 8.2 The parsing core (`src/core/workspace/index.ts`)

Format handling is **honest about what actually happens to each file type** —
this is stated directly in the UI, not buried:

| Format | What happens |
|---|---|
| CSV | Parsed via **PapaParse** into columns + rows; previewable; can be ingested into Operations |
| XLSX | Parsed via the **`xlsx` (SheetJS)** library — first sheet only — into columns + rows; previewable; ingestible |
| JSON | Must be a top-level array of objects; parsed into a column/row shape by unioning all keys across objects |
| TXT | Stored with the **first 2,000 characters** as a preview string — no tabular processing |
| PDF, DOCX | Stored as a reference document only — **not parsed at all** |

`parseBuffer()` never throws — every branch, including malformed input,
returns a `{ error: string }` value instead of an exception, so the calling
API route never needs a defensive try/catch around parsing specifically (it
still wraps the whole handler for database errors).

`validateUpload()` runs *before* any parsing: checks the file extension is
recognized, the file isn't empty, and it's under the 4 MB cap (chosen because
it sits safely under Vercel's request body size limit).

**Defences for untrusted input** (the upload API is unauthenticated):

| Limit | Value | Why |
|---|---|---|
| `MAX_FILE_BYTES` | 4 MB | Under Vercel's request cap |
| `MAX_PARSE_ROWS` | 100,000 | A 4 MB `.xlsx` is a ZIP that can expand to millions of cells |
| Excel read options | `sheets: 0`, `sheetRows: cap + 2`, no formulas/HTML/styles | Decode only what's used; stop expanding as soon as the cap is passed |
| `MAX_WORKSPACE_FILES` / `MAX_WORKSPACE_BYTES` | 200 files / 100 MB | Bounds total storage so repeated uploads can't fill the free-tier database (`quotaError`, HTTP `413`) |
| `MAX_NAME_LENGTH` | 200 chars | Shared by upload and rename |

SheetJS is installed from the vendor's patched release (`xlsx` 0.20.3 tarball
from `cdn.sheetjs.com`, Apache-2.0, sha512 pinned in the lockfile). The npm
registry copy stopped at 0.18.5, which carries prototype-pollution and ReDoS
advisories — relevant precisely because this code parses files from strangers.

### 8.3 The five API routes

| Method & route | Purpose |
|---|---|
| `POST /api/data/upload` | Accepts one multipart file + a `scope`; validates, parses, stores it; returns `201` with the new file's metadata |
| `GET /api/data/files` | Lists all files (optionally filtered by `?scope=`), newest first |
| `GET/PATCH/DELETE /api/data/files/[id]` | Fetch one file's metadata; rename and/or re-scope it; or delete it |
| `POST /api/data/files/[id]/reprocess` | Re-parses the *already-stored* bytes (e.g., after a parser bug fix); if a new file is attached in the request body, this doubles as **Replace** |
| `POST /api/data/files/[id]/ingest-operations` | The one route with real side effects on the live analytics — see below |

### 8.4 The ingest pipeline — the most complex single request in the app

`POST /api/data/files/[id]/ingest-operations` is a genuine multi-step
pipeline with several deliberate guard rails:

1. **Look up the file**; 404 if it doesn't exist.
2. **Guard: must be tabular** (not PDF/DOCX/TXT) — return a `400` with a
   specific error message otherwise.
3. **Guard: must be in `'ready'` status** — a file that failed to parse can't
   be ingested until fixed.
4. **Guard: must not already be ingested** — `file.ingestedAt` is checked; if
   set, ingesting again would silently double every downstream metric (every
   row would be inserted twice). The API refuses and tells the user to
   replace the file instead.
5. **Re-parse the stored bytes** (not the original `sampleRows` preview,
   which is capped at 100 rows — the full parse gets every row).
6. **Guard: row count ≤ `INGEST_ROW_LIMIT` (25,000)** — bigger loads are
   directed to the CLI ETL script instead, which has no such limit and is
   designed for the full ~1M-row dataset.
7. **Column mapping** (`mapColumns`, in `src/domains/operations/ingest.ts`):
   a **heuristic alias table** maps arbitrary header names (case- and
   punctuation-insensitive) onto the five required fields (invoice number,
   stock code, quantity, unit price, date) plus three optional ones
   (description, customer ID, country). If any required field can't be
   mapped, the route returns a `400` listing exactly which fields are
   missing and which headers *were* found, so the user can rename a column
   and retry.
8. **`buildRecords()`** walks every row, validating each one individually
   (non-numeric quantity/price, unparseable date, or a blank key → the row is
   *skipped*, not the whole upload rejected) and normalizes the surviving
   rows into four separate record sets matching the four Postgres tables
   (`customers`, `products`, `invoices`, `lines`) — building `Map`s keyed by
   natural ID so duplicate invoice/customer/product rows across many lines
   collapse into one record each, with `firstSeen`/`lastSeen` widened
   appropriately.
9. **Atomically claim the file** — `UPDATE workspace_files SET ingested_at =
   now() WHERE id = $1 AND ingested_at IS NULL RETURNING id`. Guard #4 alone is
   a check-then-act race (two concurrent requests could both pass it); only one
   request can win this update, and the loser gets `409`.
10. **Insert everything in one transaction** — rows are split into chunks of
    1,000 (Postgres caps parameters per statement), and every chunk plus the
    ETL-log row go through a single `db.batch([...])`. The Neon HTTP driver has
    no interactive transactions, but `batch()` is sent as one non-interactive
    transaction, so a failure leaves **no partial rows**.
11. **Release the claim on failure** — if the batch throws, `ingested_at` is
    reset to `NULL` so the user can retry without double-counting.
12. **`revalidateTag('operations', 'max')`** — invalidates the 1-hour data
    cache from [§6.1](#61-the-advisor-pattern-shared-across-all-three-domains)
    immediately, so the very next page load of the Decision Center reflects
    the newly ingested rows instead of waiting up to an hour.
13. **Return a summary** — how many lines/invoices/customers/products were
    inserted and how many rows were skipped, which the UI surfaces as a
    success notice.

### 8.5 `DataManager.tsx` — the client-side experience

A **Client Component** (`'use client'`) because it needs `useState` and DOM
event handlers (drag-and-drop, file pickers), which cannot run inside a Server
Component. Key implementation details:

- **Real upload progress**, not a fake spinner. `fetch()` has no native
  upload-progress event, so the component uses `XMLHttpRequest` directly
  (`uploadWithProgress`) specifically to listen to `xhr.upload.onprogress` and
  update a percentage in React state as bytes actually leave the browser.
- **Multiple files upload sequentially** (a `for...of` loop with `await`
  inside), not in parallel — this keeps the per-file progress bars accurate
  and avoids overwhelming the serverless function with concurrent large
  uploads.
- **Drag-and-drop** is implemented with native HTML5 drag events
  (`onDragOver`, `onDragLeave`, `onDrop`) plus `role="button"` and a
  `onKeyDown` handler so the same dropzone is fully keyboard-accessible
  (Enter/Space triggers the file picker) — not just a mouse-only drag target.
- **A preview modal** renders either a data table (first 25 of up to 100
  cached sample rows) or a plain-text preview or an "unparseable" message,
  depending on what the file actually is.

---

## 9. The UI Component Library (`src/ui`)

Small, focused, reusable pieces — none of them domain-aware (they take data
and render it; they never fetch data or know about "Operations" vs "Market").

| Component | File | Purpose |
|---|---|---|
| `Card`, `CardHeader`, `CardTitle`, `CardBody` | `components/Card.tsx` | The one panel/container primitive used everywhere |
| `Badge`, `ProvenanceBadge` | `components/Badge.tsx` | Small dot-plus-text status tags; `ProvenanceBadge` specifically renders "Real data" vs "Demo data" |
| `Kpi`, `KpiGrid`, `PageHeader`, `EmptyState` | `components/Kpi.tsx` | The headline-figures strip, a shared page-title block, and the "no data yet, upload something" empty state |
| `Docket` | `components/Docket.tsx` | Renders a `Recommendation[]` (from `core/recommend`) as a ranked list with an inline animated confidence bar |
| `AdvisorChat` | `components/AdvisorChat.tsx` | The reusable AI-chat transcript UI, shared by all three domains — takes only an `endpoint` URL and a list of `suggestions` as props |
| `DomainSwitcher`, `DatasetStatus` | `components/*.tsx` | The masthead module tabs and the dataset statusline |
| `Logo` | `components/Logo.tsx` | The brand mark (inline SVG + wordmark) |
| `ReportButton` | `components/ReportButton.tsx` | A button that calls `buildReportPdf()` and triggers a browser download, entirely client-side |
| `Chart` | `charts/Chart.tsx` | A thin wrapper around **Apache ECharts** that applies the app's shared color theme to every chart in the app |
| `cn()` | `cn.ts` | A tiny helper combining `clsx` + `tailwind-merge` (explained in [§14](#14-every-important-library-explained)) |
| `ACCENT_HEX` | `accents.ts` | A single lookup table mapping a domain's abstract accent name (`'cyan'`/`'violet'`/`'lime'`) to its actual CSS variable — deduplicated so this mapping exists in exactly one place instead of being copy-pasted into every component that needed a domain color |

**Why these exist instead of writing the JSX inline everywhere:** every one of
these renders identically across three domains and 20+ pages. Centralizing
them means a single visual-design change (e.g., changing what a Card's border
looks like) is a one-file edit that instantly propagates everywhere, and any
component-level bug fix (e.g., the `AdvisorChat`'s upload progress handling)
only needs fixing once.

---

## 10. The Database

### 10.1 Choice of database and why

**Neon Postgres**, accessed through Drizzle ORM's `neon-http` driver. Neon is
a "serverless Postgres" provider — a real, standard Postgres database, but one
that connects over plain HTTP requests rather than a persistent TCP
connection, which matters because Vercel serverless functions are short-lived
and don't play well with traditional connection pools.

```ts
// src/db/index.ts
export function getDb() {
  if (_db) return _db
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set...')
  _db = drizzle(neon(url), { schema })
  return _db
}
```

The client is a **lazy singleton**: the actual connection object is only
created the first time `getDb()` is called, and cached in the module-level
`_db` variable for reuse within that server instance's lifetime. If
`DATABASE_URL` is missing, the error is thrown *only when a route tries to use
the database* — meaning Market and Product (which never call `getDb()`) work
perfectly with **zero database configuration**, and Operations degrades
gracefully to its "no data" empty state rather than crashing the whole app at
startup.

### 10.2 Schema management: push-based, not migration-based

There is **no `/drizzle` migrations folder** committed to this repository.
Schema changes are applied with `npx drizzle-kit push`, which directly
diffs the TypeScript schema against the live database and applies the
difference — no versioned `.sql` migration files are generated or tracked.
This is a deliberate trade-off appropriate for a single-developer project at
this stage: faster iteration, at the cost of no audit trail of schema history
and no safe rollback path (a production team with multiple contributors would
typically switch to `drizzle-kit generate` + tracked migrations).

### 10.3 Every table, and why it exists

**Operations tables** (four transactional + one log table):

| Table | Primary key | Purpose |
|---|---|---|
| `operations_customers` | `customer_id` (natural key from the source data) | One row per customer; `first_seen`/`last_seen` for lifetime span |
| `operations_products` | `stock_code` (natural key) | One row per SKU; carries the **derived, labeled** `category` and `assumed_cost_ratio` columns |
| `operations_invoices` | `invoice` (natural key) | One row per order; `is_return` flags credit-note / negative-quantity orders |
| `operations_invoice_lines` | `id` (random UUID) | One row per line item — the fact table everything else aggregates from; indexed on `invoice`, `stock_code`, and `invoice_date` for the query patterns in `data.ts` |
| `operations_etl_logs` | `id` (random UUID) | An audit trail of every bulk load — source, total/inserted/skipped row counts, freeform notes |

**Market and Product tables** (`market_markets`, `market_competitive`,
`market_opportunities`, `market_scenarios`, `product_users`, `product_events`,
`product_features`, `product_experiments`, `product_experiment_results`,
`product_opportunities`, `product_initiatives`, `product_roadmap_items`,
`product_goals`): these tables **exist in the schema but are not queried by
the running application** — Market and Product currently compute everything
in-memory from the synthetic generators. They are a preserved artifact of the
original architecture (an earlier phase persisted synthetic data to Postgres)
and represent a natural next step if either domain moves to storing real,
user-uploaded data the way Operations now does.

**Workspace table:** `workspace_files` (documented fully in
[§8.1](#81-the-data-model)).

### 10.4 Relationships, indexes, and why

There are **no foreign-key relationships between domain schemas** — an
explicit design choice stated in a `schema.ts` comment ("No cross-domain
foreign keys"), because the three domains are meant to be independently
addable/removable modules, not a tightly coupled relational graph. Within
Operations, `product_events.user_id` and the product-domain tables *do* use
Postgres foreign keys (`.references(() => productUsers.id)`) since those
tables model one coherent relational dataset (even though unused at runtime
today).

Indexes are placed exactly on the columns the real query patterns in
`data.ts` filter/group/join by: `operations_invoice_lines` is indexed on
`invoice`, `stock_code`, and `invoice_date` because every aggregate query
either joins on the first two or filters/groups by date range on the third.

### 10.5 CRUD, illustrated with the workspace-file lifecycle

- **Create:** `POST /api/data/upload` → `db.insert(workspaceFiles).values({...}).returning()`.
- **Read:** `GET /api/data/files` (list, optionally filtered) and `GET /api/data/files/[id]` (one row).
- **Update:** `PATCH /api/data/files/[id]` (rename/re-scope) and the reprocess/ingest routes (both update parsed metadata or the `ingestedAt` timestamp).
- **Delete:** `DELETE /api/data/files/[id]` → `db.delete(workspaceFiles).where(eq(workspaceFiles.id, id)).returning({ id: ... })` — returning the deleted row's id lets the route distinguish "deleted successfully" from "nothing matched that id" (404) using one round trip.

### 10.6 Drizzle ORM — what it is and why

**Simple explanation:** Drizzle lets you describe your database tables as
TypeScript objects, and then write queries as TypeScript function calls
(`db.select().from(table).where(...)`) instead of writing raw SQL strings by
hand every time — while still letting you drop into raw SQL (via the `sql`
tagged template) whenever the ORM's query builder can't express what you need.

**Why Drizzle specifically, over an alternative like Prisma:** Drizzle
compiles to close-to-the-metal SQL with no separate code-generation step or
runtime query engine binary, and it lets this codebase mix its query style
freely — most of `operations/data.ts` uses raw `sql` template literals for
full aggregation control (`SUM(CASE WHEN ...)`), while the workspace-file CRUD
routes use Drizzle's fluent query builder (`db.select().from(workspaceFiles)`)
for simplicity where raw SQL adds no value. This project uses both styles
side by side, choosing whichever is clearer for a given query — a legitimate,
observable trade-off if asked about in an interview.

---

## 11. Every API Endpoint

All endpoints are Next.js **Route Handlers** — files named exactly
`route.ts` inside `src/app/api/**`, each exporting functions named after HTTP
methods (`GET`, `POST`, `PATCH`, `DELETE`). There is no separate Express
server; Next.js *is* the backend here.

### `POST /api/data/upload`

| | |
|---|---|
| **Request** | `multipart/form-data`: `file` (required), `scope` (optional, default `'shared'`) |
| **Validation** | Format allow-list + 4 MB size cap (`validateUpload`); scope must be one of `shared`/`operations`/`market`/`product` |
| **Processing** | Parses the file (if tabular/text), base64-encodes the raw bytes, inserts one `workspace_files` row |
| **Success response** | `201 { file: WorkspaceFileDto }` |
| **Errors** | `400` bad field/format/size/scope; `413` workspace quota exceeded; `503` if the database fails (generic message — details are logged server-side, never returned) |
| **Files involved** | `route.ts` → `core/workspace` (validate + parse) → `db/schema.ts` (insert) → `api/data/_lib.ts` (`toDto`, response helpers) |

### `GET /api/data/files`

Lists workspace files, optional `?scope=` filter, newest first. `200 { files:
WorkspaceFileDto[] }`. Uses `export const dynamic = 'force-dynamic'` to
guarantee it's never served from Next.js's route cache — the file list must
always reflect the current database state.

### `GET / PATCH / DELETE /api/data/files/[id]`

Standard single-resource CRUD. All three validate the `id` path parameter is
a well-formed UUID *before* querying (a regex check, `/^[0-9a-f-]{36}$/i`) —
cheap enough to reject a malformed ID with a `404` without ever touching the
database.

### `POST /api/data/files/[id]/reprocess`

No body → re-parses stored bytes. Multipart body with a new `file` → replaces
the stored bytes and re-parses (this is how the UI implements "Replace").
**Only Replace resets `ingestedAt`.** Re-parsing identical bytes keeps the flag
— otherwise Reprocess → Ingest would load the same rows twice (an earlier
version had exactly this bug). Replace is also checked against the workspace
byte quota using the size delta (`413` if exceeded).

### `POST /api/data/files/[id]/ingest-operations`

Fully documented in [§8.4](#84-the-ingest-pipeline--the-most-complex-single-request-in-the-app).
Example success response:
```json
{ "ingested": { "lines": 1067371, "invoices": 53628, "customers": 5942, "products": 5304, "skipped": 25793 } }
```
Example error response (missing required column):
```json
{ "error": "Missing required column(s): quantity. Found: Order ID, SKU, Price, Date. Headers like \"Invoice/Order ID\", ... are auto-detected." }
```

### `GET /api/operations/health`

A read-only diagnostic endpoint — no request body. Runs one lightweight
`COUNT(*)` query across the four Operations tables and returns
`{ status: 'ok' | 'empty' | 'error', counts, latencyMs }`, `200` if data is
present, `503` otherwise. Explicitly `force-dynamic` and uncached, because its
entire purpose is to report the *live* state of the deployed database — e.g.
to answer "is production actually connected to a seeded database right now?"
without going through the app's own 1-hour analytics cache.

### `POST /api/operations/advisor`, `/api/market/advisor`, `/api/product/advisor`

All three share one shape and one underlying orchestrator
(`core/advisor.answer`); full request/response trace is in
[§16.3](#163-trace-asking-the-ai-advisor-a-question).

| | |
|---|---|
| **Request** | `{ "question": string }` |
| **Validation** | `sanitizeQuestion` — must be a non-empty string, max 500 characters |
| **Processing** | Builds a fresh domain snapshot, tries the local Ollama model grounded in that snapshot, falls back to a deterministic keyword-matched answer if Ollama is unreachable or times out |
| **Success response** | `200 { text: string, source: 'ollama' | 'deterministic' }` |
| **Errors** | `400` if the question is missing/empty/too long |
| **Example request** | `{"question": "How is our retention?"}` |
| **Example response** | `{"text": "Measured retention: D1 65.8%, D7 57.9%, D30 35.6%, D90 10.2%...", "source": "deterministic"}` |

---

## 12. Authentication (and Why There Isn't Any)

**This is documented honestly rather than glossed over, because the
instructions for this document require explaining only what actually
exists.**

There is **no login, no signup, no sessions, no JWTs, no cookies, no OAuth, no
protected routes, and no role checking anywhere in this codebase.** This is a
deliberate, stated project decision, written directly into a code comment at
the top of the database schema:

```ts
// src/db/schema.ts
/**
 * ...
 * Auth is intentionally omitted — the platform ships open (per project decision).
 */
```

**Why:** this is a portfolio / demo product. Every page, every API route, and
every dataset is meant to be viewable by anyone who has the URL — there is no
concept of "my data" vs "someone else's data" to protect. Adding
authentication with nothing behind it to protect would add real complexity
(session storage, password hashing, CSRF protection, login UI) for zero actual
security benefit in this context.

**If authentication were required, how would it plug into this
architecture?** This is a fair and common interview follow-up, and the honest
answer given this codebase's structure:
1. Add a `users` table to `src/db/schema.ts` and a session/JWT mechanism
   (e.g., NextAuth.js, or a hand-rolled signed httpOnly cookie).
2. Add **Next.js Middleware** (`src/middleware.ts`, a file convention that
   runs before any route handler or page) to check for a valid session cookie
   and redirect unauthenticated requests to a login page.
3. Scope every query in `src/domains/*/data.ts` (and the workspace-file
   queries) by the authenticated user's ID, so "shared" data becomes
   "shared among *this account's* uploads" rather than global.
4. The `/core` engine itself would need **zero changes** — it is pure,
   stateless, and has no concept of "who is asking." Authorization is
   entirely an app/domain-layer concern in this architecture, which is a
   genuine benefit of keeping `/core` free of I/O.

---

## 13. State Management

### 13.1 The honest inventory

There is **no global client-side state library** in this project — no Redux,
no Zustand, no React Query / TanStack Query, no Context-based global store.
State management here is deliberately minimal and falls into exactly two
categories:

**1. Server state, fetched fresh per request (the default, and most common
pattern).** Every domain page is an `async` **Server Component**. It calls a
data function (e.g., `buildSnapshot()`) directly inside the component body,
`await`s the result, and renders it. There is no client-side fetch, no
loading spinner managed in JavaScript state, and no cache-invalidation logic
to write by hand — Next.js's own request lifecycle and the `unstable_cache`
wrapper (see [§17.11](#1711-caching-and-unstable_cache)) handle freshness.

**2. Local component state via `useState`, confined to individual Client
Components that need interactivity.** Every use of `useState` in this
codebase is scoped to exactly the component that needs it — never lifted to a
shared context or a global store:

| Component | What it holds in `useState` |
|---|---|
| `DataManager.tsx` | The file list, in-flight upload progress items, the currently-open preview file, a busy/loading id, a transient success/error notice |
| `AdvisorChat.tsx` | The chat transcript array, the current input text, a busy flag |
| `Prioritization.tsx` (Product) | Which scoring model (RICE/ICE/WSJF) is currently selected |
| `ScenarioSimulator.tsx` (Market) | Budget, team size, pricing strategy slider values |

**Why this is the right choice here, not a shortcut:** every one of these
pieces of state is genuinely local — no other component in the app needs to
know what text is currently typed into the advisor chat box, or which
scoring model is selected on the Prioritization page. Reaching for Redux or
Context to share state that nothing else needs would be pure overhead with no
benefit. This is a legitimate, defensible architectural choice, not an
oversight — and it's a good interview answer to "why didn't you use Redux/
Zustand here?"

**Re-rendering:** because state is local, a re-render triggered by, say,
typing in the advisor's input box only re-renders that one chat component's
subtree — React's default behavior (a component re-renders when its own state
changes, or when a prop it receives changes) is sufficient here without any
memoization tricks, because the component trees involved are small.

### 13.2 Why not React Query / TanStack Query?

React Query exists to solve problems that arise when **client components**
fetch data: caching fetched data across component remounts, deduplicating
simultaneous requests, background refetching, and optimistic updates. This
app's primary data flow is almost entirely **server-side** (Server Components
`await` data directly, before any HTML is even sent to the browser) — there is
no client-side data-fetching-and-caching problem to solve for the dashboard
pages. The one place genuine client-side fetching happens (`DataManager`'s
file list, `AdvisorChat`'s chat messages) is simple enough — a handful of
`fetch()` calls triggered by explicit user actions — that a dedicated caching
library would add more ceremony than it would save.

---

## 14. Every Important Library, Explained

| Library | Why it's here | Which files use it | Simpler alternative | Trade-off |
|---|---|---|---|---|
| **Next.js 16** | The framework: file-system routing, Server Components, Route Handlers, built-in caching (`unstable_cache`), image/font optimization, and a one-command Vercel deploy story | Everything under `src/app` | A plain Vite + Express SPA | Next.js couples you to its conventions and its (fast-moving) App Router API, but removes the need to hand-build routing, SSR, and an API layer separately |
| **React 19** | The UI library Next.js is built on — component model, hooks, JSX | Every `.tsx` file | — | — |
| **TypeScript** | Static types across the whole stack — the database schema, the API contracts, and the UI props are all type-checked together | Every `.ts`/`.tsx` file | Plain JavaScript | Slower to write initially; catches an entire category of bugs (wrong shape passed between layers) before runtime |
| **Drizzle ORM** | Type-safe schema definitions + query building, direct SQL escape hatch | `src/db/*`, every domain's data-access file | Prisma, raw `pg` client | Drizzle has less "magic"/codegen than Prisma but a less polished migration story (this project uses push, not migrations — see [§10.2](#102-schema-management-push-based-not-migration-based)) |
| **`@neondatabase/serverless`** | The HTTP-based Postgres driver compatible with Vercel's serverless (non-persistent-connection) execution model | `src/db/index.ts` | A traditional `pg` connection pool | Traditional pooled connections don't survive serverless cold starts well; the trade-off here is one HTTP round trip per query instead of a kept-open TCP socket |
| **Apache ECharts** (`echarts`, `echarts-for-react`) | The single charting library used for every visualization in the app (line/bar/scatter/heatmap) | `src/ui/charts/Chart.tsx` and every page with a chart | Recharts, Chart.js | The project's own history notes it *consolidated* to ECharts and dropped Recharts/Chart.js, which two of the three original apps used separately — one charting library, one visual language, smaller bundle |
| **jsPDF** | Generates the executive-report PDFs entirely client-side, no PDF-generation server needed | `src/core/report/index.ts` | A server-side PDF service (Puppeteer, a hosted API) | jsPDF's drawing API is low-level (you position text/rectangles by pixel coordinates yourself) — more code, but zero external dependency or cost |
| **PapaParse** | Robust CSV parsing (handles quoted commas, embedded newlines, malformed rows) | `src/core/workspace/index.ts` | Hand-written `.split(',')` | A hand-rolled CSV splitter breaks on quoted fields containing commas — a real, common failure mode PapaParse handles correctly |
| **`xlsx` (SheetJS 0.20.3)** | Parses `.xlsx` Excel workbooks into JavaScript arrays | `src/core/workspace/index.ts`, `scripts/lib/load-retail.ts` | ExcelJS (MIT, on npm) | Installed from the vendor's tarball because npm's copy (0.18.5) has unfixed advisories; this keeps the same API and zero code churn, at the cost of one dependency not resolved from the npm registry (integrity-pinned in the lockfile) |
| **`class-variance-authority` (cva)** | Defines component style *variants* (e.g., a `Badge`'s tone: `good`/`warn`/`bad`/`neutral`) as a typed, composable API | `src/ui/components/Badge.tsx` | Manual `className` string concatenation with `if` statements | cva keeps variant logic declarative and type-checked instead of a growing pile of conditional string concatenation |
| **`clsx` + `tailwind-merge`** (combined in `src/ui/cn.ts`) | `clsx` conditionally joins class name strings; `tailwind-merge` then resolves conflicting Tailwind utility classes (e.g., if both `px-2` and `px-4` end up in the same string, it keeps only the last one) so a component's default classes can be safely overridden by a caller-supplied `className` prop | Every UI component | Plain template-string concatenation | Without `tailwind-merge`, passing an overriding `className` prop can silently produce broken, conflicting CSS instead of the intended override |
| **`date-fns`** | Date arithmetic for the forecasting module (adding days/weeks/months, formatting ISO dates) | `src/core/forecast/index.ts` | The native `Date` object directly | Native `Date` math (especially month/week arithmetic across month boundaries) is notoriously error-prone; `date-fns` provides correct, well-tested functions |
| **Vitest** | The test runner | `vitest.config.ts`, every `*.test.ts` file | Jest | Vitest shares Vite's fast dev-server transform pipeline, so tests start and re-run near-instantly; this project's 111 tests across 14 files run in about one second |
| **ESLint** (`eslint-config-next`) | Lints for correctness and Next.js-specific pitfalls | Every source file, enforced in CI | — | — |
| **Tailwind CSS v4** | Utility-first CSS — the entire design system's spacing/color/typography scale is defined as CSS custom properties in `globals.css` and consumed via Tailwind utility classes | Every `.tsx` file's `className` | Hand-written CSS modules / styled-components | Utility classes keep styling co-located with markup and avoid a separate stylesheet per component, at the cost of longer `className` strings |
| **Ollama** (accessed via plain `fetch`, no SDK) | A local LLM runtime the AI Advisor talks to when available | `src/core/advisor/index.ts` | A hosted API like OpenAI/Anthropic | Zero API cost and no vendor API key required, but genuinely unavailable in production (no `localhost` on Vercel) — hence the mandatory deterministic fallback |

---

## 15. Every Configuration File, Explained

### `package.json`

Defines the npm scripts (`dev`, `build`, `start`, `lint`, `typecheck`, `test`,
`db:push`) and pins every dependency version. Notably, `xlsx` is listed as a
runtime dependency (not a dev dependency) because it's used inside an API
route (`ingest-operations`) that runs on the server at request time, not just
during local scripts.

### `tsconfig.json`

Standard Next.js TypeScript config with one important custom addition — the
`@/*` path alias:
```json
"paths": { "@/*": ["./src/*"] }
```
This is why every import in the codebase reads `import { getDb } from '@/db'`
instead of a fragile relative path like `../../../db`. It also sets
`"strict": true`, enabling TypeScript's full strict-null-checking mode — one
reason functions throughout `/core` explicitly handle `null`/`undefined`
cases rather than assuming values are always present.

### `next.config.ts`

Two responsibilities: `transpilePackages: ['echarts', 'echarts-for-react',
'zrender']` (tells Next.js's bundler to process these charting packages
through its own transform pipeline rather than treating them as pre-built,
because ECharts ships in a form that benefits from it), and a `headers()`
function that attaches baseline HTTP security headers
(`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`) to
*every* response. A code comment explicitly notes a stricter Content-Security-
Policy was deliberately deferred as future work, not forgotten — it would
require nonce-based script tagging that conflicts with how Next.js currently
inlines its own bootstrap script.

### `eslint.config.mjs`

Extends `eslint-config-next`'s two rule sets (`core-web-vitals` and
`typescript`) with no custom overrides, and ignores build output directories.
Runs in CI on every push.

### `vitest.config.ts`

Points the `@` alias at `src/` (mirroring `tsconfig.json`) and scopes test
discovery to exactly `src/core/**/*.test.ts` and `src/domains/**/*.test.ts` —
**UI components are deliberately excluded from the automated test suite**; the
project's own documentation states UI/app correctness is instead validated by
the production build succeeding and manual browser verification, reserving
automated tests for the parts of the codebase that are pure logic and cheap to
test exhaustively.

### `drizzle.config.ts`

Tells `drizzle-kit` where the schema file lives (`./src/db/schema.ts`), what
database dialect to target (`postgresql`), and reads `DATABASE_URL` from the
environment (via `dotenv/config`) to know which database to push schema
changes to.

### `vercel.json`

Minimal — `{ "framework": "nextjs" }`. Vercel auto-detects almost everything
else about a Next.js project; this file exists mainly to be explicit.

### `.env.example` / `.env` / `.env.local`

Documents the environment variables the app reads:
- `DATABASE_URL` — required only for Operations; everything else works
  without it.
- `OLLAMA_URL` (default `http://localhost:11434`) and `OLLAMA_MODEL`
  (default `llama3.2`) — optional; the AI advisor falls back gracefully if
  unset or unreachable.

`.env` and `.env.local` are git-ignored (never committed) — `.env.example` is
the only one checked into version control, serving as documentation of what
variables exist without leaking any real credentials.

### `.npmrc`

One line: `legacy-peer-deps=true` — relaxes npm's peer-dependency resolution
strictness, needed because some of this project's dependencies haven't yet
published updated peer-dependency ranges for React 19.

### `.github/workflows/ci.yml`

A GitHub Actions workflow triggered on every push and pull request to `main`.
Four sequential steps on a fresh Ubuntu runner: install dependencies
(`npm ci`), lint, type-check, run the Vitest suite, then run a full production
build — all four must pass for the workflow to succeed. Notably, **no
`DATABASE_URL` secret is configured for CI**, and a code comment explains why
that's fine: every database-backed route is marked dynamic (server-rendered
on demand), so `next build` never actually executes a database query at build
time — the build only needs the *code* to compile and type-check correctly.

---

## 16. Complete Execution Traces (User Actions Step by Step)

### 16.1 Trace: A user uploads a CSV file and ingests it into Operations

```text
User selects/drops a CSV file on the /data page
 ↓
DataManager.tsx: handleFiles() is called with the FileList
 ↓
For the file: create an XMLHttpRequest, build a FormData with
  the file + selected scope, call uploadWithProgress()
 ↓
xhr.upload.onprogress fires repeatedly as bytes leave the browser →
  React state updates → the progress bar animates in real time
 ↓
POST /api/data/upload (multipart/form-data) reaches the server
 ↓
Route handler: form.get('file') → validateUpload(name, size)
  → detectFormat() → 'csv'
 ↓
core/workspace.parseBuffer('csv', bytes) → PapaParse parses the
  text into { columns, rowCount, sampleRows, rows }
 ↓
db.insert(workspaceFiles).values({ ...metadata, rawBase64 }).returning()
  → Neon Postgres INSERT
 ↓
201 response with the new file's metadata (never the raw bytes)
 ↓
DataManager: upload item removed from the in-flight list; refresh()
  re-fetches GET /api/data/files → the new file appears in the table
 ↓
User clicks the "Load into Operations" icon on that row
 ↓
window.confirm() asks for explicit confirmation (row count shown)
 ↓
POST /api/data/files/[id]/ingest-operations
 ↓
Route: fetch file row → guard checks (tabular? ready? not already
  ingested? under 25,000 rows?) → parseBuffer() the FULL stored bytes
 ↓
mapColumns(columns) → heuristic header matching → { mapping, missing }
  (if required fields are missing, 400 with a specific message)
 ↓
buildRecords(rows, mapping) → validates every row individually,
  builds deduplicated customer/product/invoice Maps + a lines array
 ↓
chunkInsert() in batches of 1,000 → four separate bulk INSERTs
  into operations_customers / _products / _invoices / _invoice_lines
 ↓
INSERT into operations_etl_logs (audit trail)
 ↓
UPDATE workspace_files SET ingested_at = now()
 ↓
revalidateTag('operations', 'max') → the 1-hour analytics cache
  is invalidated immediately
 ↓
200 response: { ingested: { lines, invoices, customers, products, skipped } }
 ↓
DataManager: flash() shows a success notice with the exact counts
 ↓
Next time ANY Operations page is opened, buildSnapshot() re-queries
  Postgres (cache miss) and the new data is reflected everywhere —
  Decision Center, Forecasting, Reports, and the AI Advisor all agree
```

### 16.2 Trace: A user opens the Operations Decision Center

```text
Browser: click "Operations" tab (client-side navigation, no full reload)
 ↓
Next.js router matches src/app/[domain]/page.tsx with domain="operations"
 ↓
[domain]/layout.tsx (Server Component) runs first:
  getDomain('operations') → the OPERATIONS registry object
  → sets --accent CSS var to the cyan token
  → renders masthead + <Suspense><DatasetStatus/></Suspense> + <DomainNav/>
 ↓
[domain]/page.tsx runs: resolvePage('operations', '') → DecisionCenter
 ↓
DecisionCenter (async Server Component) calls buildSnapshot()
 ↓
buildSnapshot(): Promise.all([getKpis(), getRevenueSeries('week'),
  getCustomerRows(), getCategoryComparison(90)])
 ↓
   Each is an unstable_cache-wrapped function:
   → cache HIT (within the last hour)?  → return cached result instantly
   → cache MISS?  → run the real SQL query against Neon Postgres,
     cache the result for future requests, then return it
 ↓
forecast(revenueValues, dates, 'week', 8)  — pure TS, no I/O
  → builds Holt-Winters / linear / drift candidates
  → nested-holdout model selection → honest backtest MAPE/R²
 ↓
computeCustomers(customerRows, observedDays)
  → core/segmentation.computeRfm() → RFM segment per customer
  → 12-month predicted value + churn-risk heuristic per customer
 ↓
assembleRootCause({ categories })  → category-level revenue deltas, ranked
 ↓
buildOperationsDecisions({ forecast, customers, returns, rootCause })
  → builds a Signal[] describing each business fact
  → core/recommend.synthesize(signals)
    → priorityScore = |impact| × confidence, sorted descending
 ↓
buildSnapshot() returns one object: { kpis, fc, decisions, ... }
 ↓
DecisionCenter renders: <KpiGrid> (4 headline figures), a Badge showing
  measured forecast accuracy, and <Docket decisions={decisions}/>
  (each decision: rank numeral, title, confidence bar, reasoning text)
 ↓
Next.js serializes the resulting React tree to HTML on the server
 ↓
HTML streams to the browser; the Suspense-wrapped <DatasetStatus/>
  arrives slightly later once its own lightweight query resolves,
  filling in the statusline without blocking the rest of the page
 ↓
Browser paints the final page; React hydrates interactive elements
  (nav links, the accent-colored underline on the active tab)
```

### 16.3 Trace: Asking the AI Advisor a question

```text
User types "How is our retention?" in the AdvisorChat input, hits Enter
 ↓
AdvisorChat.tsx: ask(question) → setMessages() appends the user's message
  (optimistic UI update, before any network response)
 ↓
fetch('/api/product/advisor', { method: 'POST', body: JSON.stringify({question}) })
 ↓
Route handler: sanitizeQuestion(body?.question)
  → trims whitespace, checks non-empty, checks ≤ 500 chars
  → if invalid: 400 { error: "question required (1–500 chars)" }
 ↓
buildRetention() + buildFunnel() + rankInitiatives() + getExperiments()
  are called fresh — pure functions over the deterministic synthetic
  generator, no caching needed (they're already fast, in-memory)
 ↓
A typed ProductAdvisorSnapshot object is assembled (userCount, retention
  array, worst funnel step, top initiative, list of experiment winners)
 ↓
core/advisor.answer({ persona, question, context, ruleContext, rules, fallback })
 ↓
   isAvailable() — a fetch to OLLAMA_URL + '/api/tags' with an 800ms timeout
   ↓
   Reachable? (only true if Ollama is running locally — false on Vercel)
   ├─ YES → build a grounded prompt (persona + context + question),
   │        POST to OLLAMA_URL + '/api/generate' (45s timeout)
   │        → got a real response? return { text, source: 'ollama' }
   │        → timed out / errored? fall through to deterministic ↓
   └─ NO  → routeDeterministic(question, ruleContext, rules, fallback)
            → lowercase the question, check each IntentRule's keyword
              list in order (e.g. ['retention','retain','churn','d1',
              'd7','d30','d90','sticky'])
            → first matching rule's answer(ctx) function runs, returning
              a template string built from the REAL measured numbers:
              "Measured retention: D1 65.8%, D7 57.9%, D30 35.6%,
               D90 10.2%. The steepest fall is early..."
            → no rule matched? call the domain's fallback() function
            → return { text, source: 'deterministic' }
 ↓
200 response: { text, source }
 ↓
AdvisorChat: setMessages() appends the assistant's reply, tagged with
  a Badge showing "Local model" or "Deterministic" depending on source
 ↓
Browser re-renders the transcript; the new message fades in
```

### 16.4 Trace: Downloading an executive PDF report

```text
User clicks "Download PDF ↓" on the Operations Reports page
 ↓
Reports.tsx already built a ReportDoc object during server rendering
  (brand, title, accent RGB, KPI section, ranked-decisions section,
  a bullets section documenting measured forecast accuracy) and
  passed it as a prop to <ReportButton doc={...} filename="..."/>
 ↓
ReportButton (Client Component) onClick handler fires — entirely
  in the browser, ZERO network request
 ↓
core/report.buildReportPdf(doc) runs synchronously in the browser:
  - draws a branded header band, KPI cards, table rows, or ranked
    recommendation blocks per section, tracking a running y-coordinate
  - calls ensureSpace() before each block; if it would overflow the
    page, calls pdf.addPage() and resets y
  - writes a footer with the honest data-provenance note + page
    number on every page
 ↓
pdf.save(filename) — jsPDF triggers a native browser file download
 ↓
The PDF appears in the user's downloads folder, containing the exact
  same numbers currently on screen (both were built from the same
  buildSnapshot() call during that page's server render)
```

---

## 17. Deep Technical Concepts, Explained Twice

Each concept below is explained first in plain language, then technically,
with an analogy and a pointer to where it's used in this actual codebase.

### 17.1 React State

**Simple:** imagine a whiteboard on the wall of a component's own little room.
Only that component can write on its whiteboard. Whenever it changes what's
written, the component redraws itself using the new value.

**Technical:** `useState` returns a value and a setter function. Calling the
setter schedules a re-render; React re-invokes the component function with the
new state value, computes a new virtual-DOM tree, diffs it against the
previous one, and applies only the minimal set of real DOM changes.

**In this codebase:** `DataManager.tsx`'s `const [files, setFiles] =
useState<WorkspaceFileDto[] | null>(null)`.

### 17.2 Promises and Async/Await

**Simple:** a promise is a claim ticket you get when you order food — it's not
the food, it's a receipt saying "your food will be ready eventually, or
something will go wrong and I'll tell you." `await` means "wait right here
until this specific ticket is fulfilled before continuing."

**Technical:** a `Promise` represents an eventual value or failure of an
asynchronous operation. `async function`s implicitly return a Promise, and
`await` pauses execution of that function (without blocking the whole
JavaScript thread) until the awaited Promise settles.

**In this codebase:** essentially every database call
(`await getDb().execute(sql...)`) and every `fetch()` to Ollama.

### 17.3 REST APIs

**Simple:** a shared vocabulary of verbs (GET = "show me," POST = "create
this," PATCH = "change part of this," DELETE = "remove this") applied to
"nouns" identified by a URL, so a client and server can agree on how to talk
without a custom protocol per feature.

**Technical:** this codebase's `/api/data/files` family is a textbook REST
resource: `GET /api/data/files` lists the collection, `GET .../[id]` reads
one, `PATCH .../[id]` partially updates one, `DELETE .../[id]` removes one.
The `/reprocess` and `/ingest-operations` sub-routes are **actions**, not
pure resources — a common, pragmatic deviation from strict REST purity when
an operation is a verb ("re-process this file") rather than a state
replacement.

### 17.4 Server Components vs. Client Components

**Simple:** a Server Component is like a chef who prepares a finished dish in
the kitchen and sends it out to your table — you never see the kitchen, just
the result. A Client Component is like a build-your-own-taco station at your
table — you (the browser) need the raw ingredients (JavaScript) delivered to
you so you can assemble and interact with it yourself.

**Technical:** by default, every component under Next.js's App Router is a
**Server Component** — its code runs only on the server, its output is
serialized to HTML (and a compact serialized description for React to
reconcile with), and *none* of its own source code is sent to the browser.
Adding `'use client'` at the top of a file marks it (and everything it
imports) as a **Client Component** — its code is bundled and shipped to the
browser, and it's allowed to use `useState`, `useEffect`, event handlers, and
browser-only APIs, none of which are available in a Server Component.

**In this codebase:** `DecisionCenter.tsx`, `Forecasting.tsx`, and nearly
every page component are Server Components — they `await` data directly.
`DataManager.tsx`, `AdvisorChat.tsx`, `ScenarioSimulator.tsx`,
`Prioritization.tsx`, and `error.tsx` are Client Components (each has
`'use client'` at the top) because each needs interactivity.

### 17.5 SSR (Server-Side Rendering)

**Simple:** instead of sending the browser an empty page and a pile of
JavaScript that builds the page after the fact, the server does that work
first and sends a fully-formed page.

**Technical:** Next.js renders the React component tree to an HTML string
(or stream) on the server for every request to a dynamic page in this app
(none of the domain pages are statically pre-rendered at build time, because
they depend on live database data or per-request randomness isn't involved
but the data is still fetched at request time — they're marked dynamic via
`maxDuration`/`force-dynamic` exports or simply by using uncached, per-request
`fetch`/database calls).

### 17.6 CSR (Client-Side Rendering)

**Simple:** the opposite of SSR — the browser downloads a nearly-blank page
plus a JavaScript bundle, and JavaScript builds the visible page after the
fact, entirely in the browser.

**Technical:** the interactive *islands* within this app's otherwise
server-rendered pages (the chat transcript building up as messages arrive,
the Data Manager's file table updating after an upload) are client-rendered —
`setMessages`/`setFiles` trigger a client-side re-render with no full page
navigation involved.

### 17.7 Hydration

**Simple:** the server sends a finished-looking page, but it's initially just
a picture — buttons don't do anything yet. Hydration is the moment JavaScript
"wakes up" that picture and attaches real event listeners so it becomes truly
interactive.

**Technical:** React "hydrates" server-rendered HTML by re-running the
component tree in the browser, reusing the existing DOM nodes rather than
tearing them down and rebuilding them, and attaching event handlers to those
existing nodes. Until hydration completes, clicks/typing on interactive
elements won't do anything yet (usually imperceptibly fast on this app given
its component tree size).

### 17.8 Caching

**Simple:** if a question was asked and answered a minute ago and nothing has
changed since, just repeat the same answer instead of redoing all the work.

**Technical, and see [§17.11](#1711-caching-and-unstable_cache) for the
implementation used here.**

### 17.9 R² and honest accuracy reporting

**Simple:** R² (pronounced "r-squared") answers: "compared to just always
guessing the average, how much better is this model actually doing?" An R² of
1.0 means perfect predictions. An R² of 0 means the model is doing no better
than always guessing the average. A *negative* R² means the model is doing
*worse* than that naive guess.

**Technical:** `R² = 1 - (SS_res / SS_tot)`, where `SS_res` is the sum of
squared errors between predictions and actuals, and `SS_tot` is the sum of
squared deviations of actuals from their own mean. Implemented in
`src/core/validation/index.ts`'s `errorMetrics` and inline in
`src/core/forecast/index.ts`'s `r2()`.

**Why this matters in this codebase specifically:** the honest, out-of-sample
walk-forward R² for the Operations weekly-revenue forecast is around **0.07**
— nearly zero, meaning the model barely beats guessing the historical
average. The project deliberately publishes this number on its own landing
page instead of hiding it, and explicitly retired an older, unverified claim
of "0.90 R²" from a predecessor project that was never actually reproduced.
This is the single strongest, most specific interview talking point in the
entire codebase: it demonstrates rigor about model evaluation over
appearance.

### 17.10 A/B Testing and Statistical Significance

**Simple:** you show two different groups of users two different versions of
something, count how many people in each group did the thing you wanted, and
then ask a statistics question: "is the difference between these two groups
big enough that it's probably real, or is it small enough that it could
easily have happened by random chance even if the two versions are actually
equally good?"

**Technical:** implemented as a two-proportion z-test in
`core/stats.calculateABTest` — see the full walkthrough in
[§5.1](#51-srccorestatsindexts).

### 17.11 Caching and `unstable_cache`

**Simple:** the first person to ask a question pays the full cost of finding
the answer; everyone who asks the same question in the next hour gets the
cached answer for free.

**Technical:** Next.js's `unstable_cache(fn, keyParts, options)` wraps a data-
fetching function so its result is memoized (cached) across requests and
server instances, keyed by the function's `keyParts` plus its actual call
arguments, and expired either after `options.revalidate` seconds or on-demand
via `revalidateTag(tag)`. `src/domains/operations/data.ts` wraps every SQL
query function this way with `revalidate: 3600` (1 hour), and the ingest API
route calls `revalidateTag('operations', 'max')` to force-invalidate that
cache the instant new data is loaded, rather than waiting up to an hour for
stale data to expire naturally.

### 17.12 Middleware

**Simple:** a checkpoint every request passes through before it reaches its
actual destination — useful for things every request needs (like checking a
login cookie), so you don't repeat that logic in every single page.

**Technical:** Next.js Middleware is a special file (`src/middleware.ts`) that
runs on the Edge before a route is matched. **This project has no middleware
file** — there is no cross-cutting request-interception logic to apply,
because there's no authentication or rate-limiting to gate every request
through. See [§12](#12-authentication-and-why-there-isnt-any) for how this
would be added if needed.

### 17.13 Hydration, revisited with an analogy

**Analogy — a stage play:** SSR is like the stage crew setting the whole set
before the curtain rises — the audience sees a fully-dressed scene
immediately. Hydration is the moment the actors (JavaScript) step into their
already-placed positions on the set and start actually responding to the
audience (event handlers). If you clapped before the actors "hydrated" into
position, nothing would happen yet — but visually, the set already looked
complete.

### 17.14 Suspense and Streaming

**Simple:** instead of waiting for *every* part of a page to be ready before
showing *any* of it, show the parts that are ready right away and fill in the
slow part once it catches up — like a restaurant bringing your appetizer out
while the kitchen finishes your entrée, instead of holding everything until
the whole meal is plated.

**Technical:** React's `<Suspense fallback={...}>` boundary lets a subtree
that's still `await`-ing data render a fallback immediately, while the rest of
the page's HTML streams to the browser without waiting on it; the real
content for that boundary streams in afterward and swaps in. **In this
codebase:** `src/app/[domain]/layout.tsx` wraps `<DatasetStatus domain={...}
/>` (which runs its own lightweight database query) in `<Suspense>`, so a slow
statusline query never blocks the rest of the module shell or the main page
content from appearing.

### 17.15 Database Transactions

**Simple:** either the whole set of changes happens, or none of them do — like
a bank transfer, where money leaving one account and arriving in another must
both succeed or both fail; you can never end up with money vanishing partway
through.

**Technical:** the multi-table ingest (products → customers → invoices →
invoice_lines → ETL log) in `ingest-operations/route.ts` runs as **one
transaction**. The Neon HTTP driver cannot run *interactive* transactions
(`db.transaction(async (tx) => …)` throws "No transactions support in neon-http
driver"), so the route uses `db.batch([...])` instead, which Drizzle sends as a
single non-interactive Neon transaction: every chunked insert commits together
or none do.

Concurrency is handled separately with an **atomic claim** before the batch:
`UPDATE workspace_files SET ingested_at = now() WHERE id = $1 AND ingested_at IS
NULL RETURNING id`. Only one request can win that update, so a double-click or
retry gets `409` instead of inserting the lines twice. If the batch fails, the
claim is released (`ingested_at = NULL`) so the user can retry cleanly.

**Analogy:** the claim is taking the only key to a room; the batch is moving all
the furniture in one trip, so the room is never left half-furnished.

### 17.16 REST vs. RPC-style Actions

Already covered under [§17.3](#173-rest-apis) — the `/reprocess` and
`/ingest-operations` endpoints are pragmatic action-style routes layered on
top of an otherwise resource-oriented API.

### 17.17 What This Codebase Does *Not* Use (and why that's worth knowing)

To be precise about scope, it's worth explicitly naming the concepts this
project does **not** implement, since they're common in "advanced concepts"
lists but genuinely absent here:
- **Embeddings / vector databases / RAG (Retrieval-Augmented Generation) in
  the strict sense:** the AI Advisor's "grounding" is *not* embedding-based
  semantic search over a vector store — it's a much simpler and cheaper
  pattern: build a short, structured text summary of the live analytics
  snapshot every time, and inject that whole summary directly into the LLM
  prompt. This works well here because each domain's "knowledge base" is
  small (a handful of numbers), not a large document corpus that would need
  retrieval.
- **WebSockets / real-time push:** every interaction is a normal HTTP
  request/response; nothing in this app needs live server-push updates.
- **Background job queues:** the one potentially slow operation (bulk CSV
  ingest) is capped at 25,000 rows specifically so it can complete
  synchronously within a single serverless function's request/response
  cycle (up to `maxDuration = 60` seconds) rather than needing a queue.

---

## 18. Testing Strategy

**111 tests across 14 files**, run with `npm test` (Vitest), covering
`src/core/**` and `src/domains/**` exclusively — deliberately **not** UI
components, per the scoping decision in `vitest.config.ts` discussed in
[§15](#15-every-configuration-file-explained).

**What's tested and why it's the right scope:** every `/core` module has its
own `index.test.ts` asserting the pure-math behavior directly — e.g.
`forecast/index.test.ts` checks that the reported confidence-interval band
widens with the forecast horizon, and that a forecast against a series with a
sudden regime shift (a value that jumps to a very different level) is *not*
suspiciously well-predicted (proving the nested holdout split genuinely
prevents the model from "seeing" the shift in advance). `scoring/index.test.ts`
checks `scoreAndClassify`'s composite score correctly matches a
hand-calculated expected value for a known input. Domain-level tests
(`operations.test.ts`, `market.test.ts`, `product.test.ts`) assert
domain-specific invariants: the exact 120-market count (not 121),
that D0 retention is always 100% and never increases with time, and that a
low-confidence forecast signal is correctly outranked by higher-confidence
customer signals in the synthesized decision list.

**Example test — proving the nested-holdout split isn't cheating**
(`src/core/forecast/index.test.ts`, quoted exactly):
```ts
it('backtest is unbiased: a regime shift in the holdout is NOT fitted away', () => {
  // Train is cleanly linear (selection will favor a trend model); the holdout
  // drops to a flat low level. An unbiased backtest cannot have "cheated" by
  // picking the model that happens to fit the holdout, so the error must be large.
  const train = Array.from({ length: 50 }, (_, i) => 100 + 5 * i) // 100..345
  const holdout = Array.from({ length: 10 }, () => 40) // sudden crash
  const values = [...train, ...holdout]
  const res = forecast(values, dailyDates(values.length), 'day', 10)
  expect(res.backtest).not.toBeNull()
  expect(res.backtest!.mape).toBeGreaterThan(50) // trend vs flat 40 ⇒ massive miss
})
```

**Why UI is excluded from automated tests:** rendering, styling, and
interaction correctness for a small, low-logic-density component library is
validated more efficiently by running the app and looking at it (documented
manual verification, plus TypeScript catching prop-shape mismatches at
compile time) than by writing brittle snapshot/DOM tests that would need
constant maintenance as the design system evolved through several redesign
passes documented in this project's git history.

---

## 19. Deployment & CI/CD

### 19.1 The pipeline

```text
git push origin main
 ↓
GitHub Actions (.github/workflows/ci.yml) runs on a fresh Ubuntu VM:
  npm ci → eslint → tsc --noEmit → vitest run → next build
 ↓ (independently, triggered by the same push)
Vercel's Git integration detects the push, builds the app on its own
  infrastructure, and — if the build succeeds — promotes it to production
```

GitHub Actions and Vercel's build are **two separate, parallel pipelines**
watching the same branch — CI is a code-quality gate (and shows up as a
pass/fail check on the commit/PR), while Vercel's build is what actually
serves the live site. A failing CI run does **not** currently block Vercel
from deploying (they're independent), so CI here functions as a safety net
and visibility signal, not a hard deployment gate — a nuance worth being able
to explain if asked "does a broken test block deployment?"

### 19.2 Environment configuration at each stage

| Stage | `DATABASE_URL` | `OLLAMA_URL` |
|---|---|---|
| Local dev | `.env`/`.env.local`, points at a real Neon instance | Optional, points at `localhost:11434` if Ollama is installed |
| CI (GitHub Actions) | **Not set** — fine, because the build never queries the DB (see [§15](#15-every-configuration-file-explained)) | Not set |
| Vercel production | Set via Vercel's environment-variable dashboard | Not set (Ollama isn't reachable from Vercel; the app relies entirely on its deterministic fallback in production) |

### 19.3 Serverless function limits, and how this codebase works around them

Vercel serverless functions default to a 10-second execution timeout on many
plans. Two routes explicitly override this:
- `src/app/[domain]/page.tsx` and `[...slug]/page.tsx` export `maxDuration =
  30` because Operations' first, uncached page load can take several seconds
  querying ~1M rows.
- `ingest-operations/route.ts` exports `maxDuration = 60` because bulk-
  inserting up to 25,000 rows in batches of 1,000 needs more headroom.

---

### 19.4 Security posture and audit history

A full audit (dependency scan, write-path review, failure-path testing against
an unreachable database) produced these changes:

| Finding | Fix |
|---|---|
| `next@16.2.9` carried a batch of critical advisories | Upgraded to `16.3.8` (with `eslint-config-next`) |
| `xlsx@0.18.5` (npm) had prototype-pollution / ReDoS advisories on a parser of public uploads | Vendor-patched SheetJS `0.20.3`, plus first-sheet-only, row-capped, formula-free parsing |
| Reprocess cleared the ingest guard, so the same file could be ingested twice | Only Replace (new bytes) resets `ingestedAt` |
| Ingest was non-atomic and check-then-act | Atomic claim + single-transaction `db.batch()` ([§8.4](#84-the-ingest-pipeline--the-most-complex-single-request-in-the-app)) |
| Raw database errors (containing SQL text) were returned to clients | Generic `503`; details logged server-side |
| Unbounded storage behind an unauthenticated upload API | 200-file / 100 MB workspace quota (`413`) |
| 8 unused `@radix-ui/*` packages; a stale duplicate `ReportButton` | Removed; Operations uses the shared component |

`npm audit --omit=dev` reports 0 vulnerabilities after these changes (the
remaining dev-only advisories come through `drizzle-kit`'s bundled `esbuild` and
never ship).

**Still open, by priority:** (1) tag invoice lines with their source workspace
file so overlapping uploads can be de-duplicated and undone per file — a schema
change; (2) authentication or an admin token for write routes, plus rate
limiting; (3) a nonce-based Content-Security-Policy; (4) integration tests for
the data routes against a disposable Neon branch.

---

## 20. Design System

The visual language went through several deliberate iterations documented in
this project's history — starting from a generic dark "SaaS dashboard" look,
through an editorial "ledger" concept, to the current system: a light,
porcelain-and-graphite palette with restrained, module-specific accent colors
(pine/teal for Operations, iris/violet for Market, moss/green for Product),
Space Grotesk for display type, Hanken Grotesk for UI text, and IBM Plex Mono
for data labels and statuslines. The entire palette and spacing scale is
defined once as CSS custom properties in `src/app/globals.css` and consumed
everywhere via Tailwind utility classes — a change to a color token there
propagates through all 20+ pages instantly, because no component hardcodes a
raw color value; they reference `var(--accent)`, `var(--color-good)`, etc.

The distinctive move here, worth naming in an interview: **charts and PDFs use
their own copies of the same palette** (`src/ui/charts/theme.ts`,
inline RGB values in each domain's `config.ts` for the PDF accent), because
ECharts renders to a `<canvas>` element and jsPDF renders to a binary PDF
stream — neither can read a CSS custom property at render time, so the same
color values are deliberately duplicated (not derived) into two additional
plain-JavaScript constant files, with comments explaining why.

---

## 21. Interview Preparation — Full Q&A Bank

### Architecture

- **Q (Beginner): What is this project, in one sentence?**
  A: A Next.js platform that turns business data (real retail transactions, or
  modeled market/product data) into ranked, confidence-scored recommendations,
  using one shared analytics engine reused across three different business
  domains.

- **Q (Intermediate): Why is the codebase split into `/core` and `/domains`
  instead of just having three separate apps or one big undifferentiated
  app?**
  A: To make an architectural claim testable and enforceable: the same
  five-stage pipeline (ingest → score → recommend → report → advise) can serve
  genuinely different problems. `/core` contains zero domain knowledge and is
  unit-tested in complete isolation; `/domains` contains zero scoring/ranking/
  PDF-layout logic, only configuration and glue. This is verified by the fact
  that `/core`'s tests never import anything from `/domains`.

- **Q (Advanced): What would you have to change to add a fourth domain
  (say, "Finance")?**
  A: Add a `FINANCE` entry to `src/core/registry.ts` (id, label, accent,
  provenance, nav array); create `src/domains/finance/` with a data source
  (real or synthetic), a scoring/decisions file that builds `Signal[]` for
  `core/recommend.synthesize`, an advisor persona + rules, a config file, and
  page components; register those pages in a new `src/domains/finance/pages/
  index.ts`; add that map to `src/domains/pages.ts`'s `DOMAIN_PAGES` object.
  No router file, no `/core` file, and no other domain's file would need to
  change.

### Forecasting / Statistics

- **Q (Beginner): What does "out-of-sample" mean?**
  A: Testing a model against data it never saw while being built/tuned —
  the only fair way to estimate how it will perform on genuinely new data.

- **Q (Intermediate): Walk me through what happens when you call
  `forecast(values, dates, 'week', 8)`.**
  A: See the full walkthrough in [§5.2](#52-srccoreforecastindexts) — briefly:
  build Holt-Winters/linear/drift candidates, select the model type via a
  nested inner-holdout split (never touching the outer/reported holdout),
  refit that type on the full training data, score it against the outer
  holdout for the honest `backtest` numbers, then refit on *all* the data one
  final time to produce the actual future predictions with widening
  confidence bands.

- **Q (Advanced): Why is the R² on this project's real dataset so low
  (~0.07), and why does the project show that number prominently instead of
  hiding it?**
  A: The real weekly revenue series is genuinely spiky/lumpy (wholesale-style
  order patterns, not smooth consumer demand), so a classical statistical
  model can't capture much beyond the mean. Showing the real number — instead
  of a nicer-looking but unverified number carried over from a predecessor
  project — is a deliberate statement about the project's values: a
  validation harness that can only ever report good news isn't validating
  anything, and the project ships a standalone script
  (`scripts/harness-demo.ts`) specifically to prove the harness can and does
  report bad scores on adversarial input.

### Database

- **Q (Beginner): What is an ORM?**
  A: A library that lets you interact with a database using your programming
  language's own objects/functions instead of writing raw SQL strings by
  hand for every query.

- **Q (Intermediate): Why does this project use raw SQL template literals in
  some files and Drizzle's query builder in others?**
  A: Raw `sql` templates are used where a query needs full control over
  aggregation (`SUM(CASE WHEN...)`, multi-CTE queries) that the query builder
  either can't express cleanly or would make harder to read; the query
  builder is used for straightforward single-table CRUD (the workspace-file
  routes) where it's clearer and safer (fully typed, no string interpolation
  risk).

- **Q (Advanced): This project caches Operations queries for an hour via
  `unstable_cache`. What could go wrong with that, and how does the app
  handle it?**
  A: Stale data — a user who just ingested new data would see old numbers for
  up to an hour if nothing else were done. The app specifically calls
  `revalidateTag('operations', 'max')` immediately after a successful ingest,
  invalidating the cache on-demand rather than relying purely on the time-
  based expiry, so newly loaded data is visible on the very next page load.

### AI / Advisor

- **Q (Beginner): What happens if the AI Advisor can't reach the AI model?**
  A: It automatically answers using a rule-based, keyword-matching system
  that pulls from the exact same real numbers the AI would have used — the
  user always gets a grounded answer, just not from an LLM.

- **Q (Intermediate): Why does this app use a local model (Ollama) instead of
  a hosted API like OpenAI?**
  A: Zero cost, no API key, no vendor dependency, and no per-request billing
  risk for a demo/portfolio project. The explicit trade-off, stated directly
  in the code, is that Ollama simply isn't reachable from Vercel's production
  servers (`localhost` has no meaning there), so the deterministic fallback
  isn't a backup for edge cases — it's the primary answer path in production,
  by design.

- **Q (Advanced): Is this Retrieval-Augmented Generation (RAG)?**
  A: Not in the strict, embeddings-plus-vector-search sense. It's a simpler
  "context injection" pattern: build a compact structured text summary of the
  live analytics snapshot on every request and put that whole summary
  directly into the prompt. This works because each domain's relevant
  "knowledge" is small (a handful of numbers), so there's no large document
  corpus that would benefit from semantic retrieval.

### Data Upload / Ingest

- **Q (Intermediate): What happens if I try to ingest the same file twice?**
  A: The second attempt is rejected with a `400` error, because the route
  checks `file.ingestedAt` before touching the database — re-ingesting the
  same rows would silently double every downstream metric (revenue, order
  counts, etc.), so the guard exists specifically to make that impossible.

- **Q (Advanced): Is the multi-table ingest insert atomic?**
  A: Yes. Because neon-http has no interactive transactions, all inserts go
  through one `db.batch([...])`, which executes as a single transaction, and an
  atomic `UPDATE … WHERE ingested_at IS NULL RETURNING` claim stops two
  concurrent requests from both ingesting (see
  [§17.15](#1715-database-transactions)). Remaining gap: invoice lines are not
  tagged with their source file, so two *different* files with overlapping
  rows can still double-count, and ingested rows cannot be rolled back per file.

### State / Frontend

- **Q (Beginner): What's the difference between a Server Component and a
  Client Component in this app?**
  A: A Server Component's code runs only on the server and is never sent to
  the browser — it can `await` a database call directly. A Client Component
  (marked `'use client'`) ships its JavaScript to the browser and can use
  `useState`/event handlers, but cannot directly `await` a database call.

- **Q (Intermediate): Why doesn't this project use Redux or React Query?**
  A: There's no genuinely shared client state to manage — every `useState` in
  this codebase is local to the one component that needs it, and almost all
  data-fetching happens server-side inside Server Components before any HTML
  reaches the browser, so there's no client-side fetch-caching problem for a
  library like React Query to solve.

---

## 22. Common Follow-Up / "What If" Questions

**"What if the database goes down?"**
Every database-touching function that can fail (`buildSnapshot`,
`getKpis`, the workspace routes) is wrapped in a try/catch that returns
`null` or a `503` JSON error rather than crashing. Operations pages show
their existing `EmptyState` ("no data yet, upload something") component — the
exact same UI shown when the database is simply unseeded — so a user sees a
calm, actionable state rather than a stack trace either way. The `503` body
is deliberately generic: Drizzle's error messages include the full failed SQL
statement, so `dbUnavailable()` logs the real error server-side and returns
only "temporarily unavailable". This was verified by running the production
build against an unreachable database: every page still returned 200. Market
and Product are entirely unaffected, since neither touches a database at all.

**"How would you scale this to a million users?"**
The heaviest current bottleneck is Operations' cold, uncached database
queries (~4–5 seconds against ~1M rows). At real scale: (1) the existing
1-hour cache already absorbs most read traffic; (2) move from ad-hoc
aggregate `SELECT`s to pre-computed materialized views or a nightly
rollup table for the KPI/forecast inputs so per-request queries become O(1)
lookups instead of full-table scans; (3) Market/Product's in-memory synthetic
generation is already effectively free to scale (pure CPU, no I/O) but could
be pre-computed once and cached the same way if user counts grew; (4) the
serverless architecture (Vercel + Neon) already scales horizontally by
default — the constraint is query efficiency, not server capacity.

**"How would you add authentication?"**
Answered in full in [§12](#12-authentication-and-why-there-isnt-any).

**"Why this architecture over a simpler single-app design?"**
Because the entire point of this project is demonstrating that a shared
engine *can* serve genuinely different problems — a simpler, undifferentiated
design would erase the thing the project exists to prove. For a from-scratch
single-domain product, the `/core` vs `/domains` split would be premature
abstraction; here it's the deliberate subject of the project.

**"What would you build next if you had another week?"**
Three honest candidates, each already implicitly flagged in the codebase
itself: (1) tag invoice lines with their source workspace file so ingests can
be de-duplicated and undone per file ([§17.15](#1715-database-transactions)); (2) let Market and Product persist
user-uploaded data the way Operations now does, using their already-defined
but currently-unused database tables; (3) add a strict Content-Security-
Policy, explicitly deferred in `next.config.ts`'s own comments.

**"How do you know the validation harness isn't just rigged to look
rigorous?"**
`scripts/harness-demo.ts` runs the exact same harness code against
adversarial synthetic inputs (pure white noise, an intentionally
overconfident classifier) and it correctly reports bad scores (R² ≈ −0.235,
ECE ≈ 0.77) — proof the measurement machinery isn't hardcoded to always
report success.

---

## 23. Glossary

| Term | Definition |
|---|---|
| **App Router** | Next.js's file-system-based routing convention, where folder structure under `src/app` directly determines URL structure |
| **Backtest** | Testing a forecasting model against historical data it wasn't trained on, to estimate real-world accuracy |
| **Client Component** | A React component whose code is shipped to and executed in the browser (marked with `'use client'`) |
| **Cohort** | A group of users who all share a starting point in time (e.g., all signed up the same week), tracked together over time |
| **CRUD** | Create, Read, Update, Delete — the four basic data operations |
| **Domain (in this codebase)** | One of the three business modules: Operations, Market, or Product |
| **Drizzle ORM** | The TypeScript library this project uses to define its database schema and build queries |
| **Hydration** | The process of React attaching interactive event handlers to already-rendered server HTML in the browser |
| **Neon** | The serverless Postgres database provider this project uses |
| **Ollama** | Software that runs large language models locally on your own machine |
| **ORM** | Object-Relational Mapper — a library that lets you work with a database using your programming language's objects instead of raw SQL |
| **R²** | A statistic measuring how much better a model's predictions are than simply guessing the average every time |
| **RFM** | Recency, Frequency, Monetary — a customer-segmentation technique |
| **Route Handler** | A Next.js file (`route.ts`) that implements a backend API endpoint |
| **Server Component** | A React component whose code runs only on the server; its own source is never sent to the browser |
| **`unstable_cache`** | A Next.js function that memoizes the result of an async function across requests, with time- or tag-based invalidation |
| **Vercel** | The cloud platform this app is deployed to |
| **Walk-forward backtest** | Testing a forecaster repeatedly across many rolling time origins, rather than a single train/test split, for a more realistic accuracy estimate |
| **Workspace file** | A user-uploaded file stored in the shared `workspace_files` table, available across one or all three modules |

---

## 24. Complete Start-to-Finish Walkthrough

This final section narrates one continuous session using the app, touching
every major feature, exactly as it happens.

**1. Landing.** A visitor opens `coresightiq.vercel.app`. The server renders
`src/app/page.tsx` — a static hero, a numbered list of the three modules
pulled live from `core/registry.ts`, and a strip of real published figures.
No database call happens on this page at all.

**2. Entering Operations.** The visitor clicks "Operations." Next.js's client
router swaps in `/operations` without a full page reload. The domain layout
(`[domain]/layout.tsx`) resolves the `operations` registry entry, sets the
module's accent color as a CSS variable, and renders the masthead while a
`<Suspense>`-wrapped statusline streams in separately. `[domain]/page.tsx`
resolves to `DecisionCenter`, which calls `buildSnapshot()`: four SQL queries
run in parallel against Neon Postgres (cached for an hour), a forecasting
model is fit and honestly backtested, RFM customer segments are computed, a
root-cause revenue decomposition runs, and everything feeds into
`core/recommend.synthesize()` to produce a ranked list of business decisions.
The visitor sees real revenue figures and a ranked `Docket` — e.g., "Protect
2,530 VIP customers," with a 75% confidence bar, right above a
lower-confidence forecast-based recommendation, correctly outranked because
its honestly-measured accuracy pulled its priority score down.

**3. Drilling into Forecasting.** The visitor clicks "Forecasting" in the
left index. The page prominently displays the *honest* out-of-sample R²
(around 0.07) above an ECharts line chart showing actual vs. forecast revenue
with a widening confidence band, explicitly stating this is far below an
older, unverified claim carried over from a predecessor project.

**4. Uploading their own data.** The visitor navigates to `/data`. They drag a
CSV of their own order data onto the dropzone. `DataManager.tsx` uses a raw
`XMLHttpRequest` to get real upload-progress percentages, `POST`s to
`/api/data/upload`, which validates the file, parses it with PapaParse, and
stores it (base64-encoded) in the `workspace_files` table. The file appears
in the table. The visitor clicks the ingest icon; after a confirmation
prompt, `POST /api/data/files/[id]/ingest-operations` runs the full guarded
pipeline (format check → already-ingested check → row-limit check → heuristic
column mapping → per-row validation → chunked bulk insert → cache
invalidation) and returns exact insert/skip counts. The Data Manager shows a
success notice. The next time the visitor opens the Decision Center, the
newly ingested rows are already reflected — the 1-hour cache was force-
invalidated the moment ingestion succeeded.

**5. Asking the AI Advisor.** The visitor opens the Operations Advisor page
and types "How bad are returns?" `AdvisorChat` posts the question to
`/api/operations/advisor`. The server rebuilds a fresh snapshot, tries Ollama
(unreachable in production), and falls through to the deterministic intent
router, which matches a returns-related keyword rule and replies with the
real measured returns rate and dollar value, tagged "Deterministic" in the
UI so the visitor knows exactly which answer path produced it.

**6. Downloading a report.** The visitor clicks "Download PDF" on the Reports
page. Entirely in the browser — no network call — `core/report.buildReportPdf`
lays out a branded, paginated PDF from the same `ReportDoc` object the page
was already rendered from, and the browser downloads it.

**7. Exploring Market.** The visitor switches to the Market module via the
masthead tabs. Everything here is computed in-memory from a deterministic
synthetic generator of 120 (not 121 — a duplicate was found and removed)
countries; a `DemoBanner` states this plainly at the top of every page. The
Expansion Center ranks all 120 markets using `core/scoreAndClassify` — the
exact same generic function used elsewhere in the app for a completely
different purpose (Product's RICE/ICE ranking) — into Expand / Investigate /
Monitor / Avoid tiers, and each row shows its top contributing criteria (e.g.
"▲ Opportunity +24 · Ease of entry +18") pulled directly from that function's
per-criterion contribution output. The visitor opens the Scenario Simulator
and drags budget/team-size sliders; each drag recomputes a 24-month revenue
projection synchronously, client-side, with zero network requests, and an
ECharts bar-plus-line chart updates instantly.

**8. Exploring Product.** The visitor switches to Product. Retention numbers
(D1 65.8% ... D90 10.2%) are computed live from the synthetic event
generator's output run through the real `core/cohort` module — the same
computation that would run against genuine event data. The Prioritization
page lets the visitor toggle between RICE, ICE, and WSJF scoring models; each
toggle re-runs `core/scoreAndClassify` with a different single-criterion
accessor, instantly re-ranking and re-tiering the same list of initiatives
into Now / Next / Later / Backlog.

Every step above — every number on every screen — traces back to a specific,
readable function in this repository. That traceability, and the project's
insistence on reporting honest (sometimes unflattering) numbers rather than
impressive-looking fake ones, is the throughline of the entire codebase.
