# Dashboard Blueprint - Cosmic Vault Command Centre

A staff-facing insurance dashboard built on the existing platform. The design
target is a calm underwriting desk, not a generic analytics template: porcelain
surfaces, ink-navy type, electric blue as the single action colour, mint and
halo gold reserved for signal.

Implementation lives in:

| Concern | File |
| --- | --- |
| Role-aware page composition | `src/pages/dashboard/Home.tsx` |
| Command Centre layout, KPI cards, plans, alerts, recent claims | `src/components/dashboard/CommandCentre.tsx` |
| Animated charts, gauge and claims mix | `src/components/dashboard/BoardCharts.tsx` |
| Empty-state system | `src/components/dashboard/ChartEmptyState.tsx` |
| Matching loading skeletons | `src/components/dashboard/DashboardSkeleton.tsx` |
| Collapsible rail, command palette, top bar | `src/pages/dashboard/DashboardLayout.tsx` |
| Live, currency-scoped data contract | `src/convex/reports.ts` (`board`) |

The board query is **staff-only**. Brokers and customers keep their existing
overviews, but inherit the new shell. Claims and monetary detail are never
exposed to roles that cannot already see them.

---

## 1. Layout blueprint

### The shell

- 272px rail expanded, 82px collapsed, sticky for the viewport height.
- 56px sticky top bar: breadcrumb + search trigger + theme, notifications and
  account.
- 1320px content cap, 16-24px page gutters, 16px grid gap.
- 1.35rem (21.6px) card radius; 20-24px card padding; 1px `--line` borders.
- One page title, one primary action, one range control. Everything else is
  subordinate.

### The fold

```
rail  |  top bar: workspace / page        search   theme  bell  account
      |
      |  Command centre · date · live book                  [6M|12M] [Review underwriting]
      |  Good morning, Iris.
      |  What this page is, in one sentence.
      |
      |  [ Premium in force ] [ Loss ratio ] [ New business ] [ Renewals due ]   <- pulse tape
      |
      |  [ Motor ] [ Home ] [ Life ] [ Travel ]                                  <- line cards
      |
      |  [ Portfolio state                                ] [ Active plans      ]
      |  [ premium in force + claims incurred             ] [ renewal dates     ]
      |  [ Loss ratio gauge        ] [ Claims mix donut    ] [ Needs attention  ]
      |  [ Recent claims                                   ]
      |
      |  Reporting currency · sync time
```

### Grid rules

- Pulse tape: 4 equal cells, 1px dividers, no card nesting.
- Line cards: 4 across at 1280px+, 2 across at 640-1279px, 1 below 640px.
- Main split: `minmax(0, 1.95fr) / minmax(0, 1fr)` at 1280px+. The right rail
  stacks under the charts below that.
- Lower split: 1.12fr / 0.88fr so the loss gauge is wider than the claims
  donut.
- Tables become stacked records below 640px; no horizontal scrolling.
- No fixed chart heights below 290px for the portfolio chart. The smaller
  charts use 236px, with the gauge and donut free to stretch.

### Hierarchy rules

1. Name the book, then the greeting, then the promise. The date and live state
   are metadata, not a headline.
2. Numbers get the largest type after the page title. Labels are 0.56-0.62rem,
   uppercase, tracked, muted. Never two competing 2rem numbers in one card.
3. Tinted line cards use a 17% radial wash of one colour, not a solid pastel
   block. The colour is a wayfinding cue, not decoration.
4. The primary action appears once in the header. Empty states may repeat it
   because they are dead ends otherwise.
5. Every card has a footer or a final meta line. It stops the eye and makes the
   card feel finished.

---

## 2. Data visualisation style

### Recommended metrics

| Metric | Definition | Why it earns a place |
| --- | --- | --- |
| Premium in force | Annualised premium on active/renewal-pending policies, reporting currency only | The size of the book in one number |
| Loss ratio | Claims incurred in the window ÷ earned premium in the window | The health of underwriting, not just volume |
| New business | Annualised premium on policies started in the window, with change vs the prior window | Direction of travel |
| Renewals due | Active policies ending inside the configured notice window | The next operational action |
| Line premium share | Premium in force by product category | Tells you what the book actually is |
| Claims incurred | Approved amount once decided, claimed amount while open, zero when declined | Honest incurred cost, not paid-only |
| Claims mix | Settled / in review / declined counts | Load and outcome at a glance |
| Active plans | Next renewals with policy number, customer, premium, end date | Makes the dashboard operational |

Deliberately excluded from the hero: registered users, page views, policy
count without premium, and any metric that only goes up. Loss ratio is shown
even when it is uncomfortable; the demo dataset produces an elevated value,
and the UI labels it "Above target" rather than hiding it.

### Chart grammar

- **Portfolio state** - a `ComposedChart`: a 2.4px monotone area for premium in
  force with a 30%-to-2% gradient, and 26%-opacity bars for claims incurred
  with a 42% outline. One shared money scale. This answers "is the book
  growing faster than claims?"
- **Loss ratio** - a 180-degree gauge capped at 100% with an explicit 70%
  benchmark notch. If the ratio exceeds 100%, the arc is full and destructive
  red; the exact value is always shown. This avoids a line chart whose axis is
  destroyed by one bad month.
- **Claims mix** - a donut only because it has three honest parts. Centre shows
  the total claim count. The legend carries label + percentage + count, so
  colour is never the only encoding.
- **Mini claims bars** - 46px high, no axes, tooltip only. A texture under the
  gauge, not a second chart to read.
- Axes: 11px muted labels, horizontal dashed grid only, no axis lines, no
  vertical grid. Tooltips show exact currency values.
- Currency integrity: the query filters to the reporting currency. Other
  currencies are counted and disclosed, never summed in.
- Numbers use `tabular-nums` wherever they can change width.
- Chart containers carry `role="img"` and an `aria-label` with the metric,
  range and currency.

### Motion

- Recharts entrance: 900-1000ms, ease-out; bars start after the area.
- Line cards: 450ms, 55ms stagger; share bars grow 250ms later.
- Gauge: 1100ms path draw, 200ms delay.
- Hover: 140-200ms colour/translate only. No spring on data points.
- `prefers-reduced-motion`: all chart animation off, path animation off,
  width/rotation transitions reduced to near-zero.
- Range switch: previous data stays mounted while the next range loads, so the
  chart morphs instead of flashing the skeleton.

---

## 3. Collapsible sidebar

### The interaction

- 272px -> 82px on a spring (`stiffness: 250`, `damping: 32`, `mass: 0.9`).
  The rail width is the only layout property being animated.
- Labels are **not unmounted**. They animate width, opacity and a 4px x-shift
  together over 200ms. This is why the collapse feels like one object rather
  than a stack of pop-ins.
- Collapsed items become 56px icon targets with 180ms-delayed tooltips on the
  right. Active item keeps the filled primary treatment, so orientation is
  never lost.
- Group labels become 1px dividers in the rail, preserving rhythm without
  shouting section names.
- The footer keeps a support shortcut and the account row. In the rail, both
  become icon buttons with the same tooltip language.
- State persists in `localStorage` under
  `cosmic-vault-dashboard-rail`.
- `Ctrl/Cmd + B` toggles the rail. `Ctrl/Cmd + K` opens the command palette.
  The search trigger is present in both rail states.
- Below `lg`, the rail is replaced by a left sheet. The sheet uses the same
  `SidebarBody`, so there is no second navigation implementation to drift.
- Focus: every control has a visible `ring-primary/40` focus ring. Active nav
  links get React Router's `aria-current="page"`.
- The palette groups the same nav items plus theme and sign-out actions, so the
  information architecture is consistent in three surfaces.

### Why it feels smooth

The width animation is spring-driven, but the label transition is a short,
linear-ish opacity/transform pair. Mixing a long spring with a long label fade
is what makes most sidebars feel clunky. Here the labels are gone before the
rail finishes moving, and back only as it settles. The rail never reflows the
page content mid-transition because the main column is `min-w-0` and the rail
is a flex sibling.

---

## 4. Empty states

An empty chart is not an error. It is a promise about what will appear, plus a
single next action. The treatment is a ghost plot: dashed baselines, a faint
curve that draws itself once, and a highlighted "first data point" ring. It
reads as "waiting", not "failed".

### Copy

| Surface | Title | Description | Action |
| --- | --- | --- | --- |
| Portfolio state | The first chapter hasn't been plotted. | Premium and claims draw themselves here as soon as the first policy is issued. No estimates, no placeholder numbers. | Open underwriting |
| Loss ratio | The good kind of empty. | No claims have been reported in this window. The moment one is, its value and the rolling loss ratio plot here. | View claims |
| Claims mix | All quiet on claims. | Your claims mix appears with the first report. Until then there is nothing to divide, and that is a good place to be. | Open claims desk |
| Active plans | No plans in force yet. | Active policies and their renewal dates land here as soon as cover is issued. | primary role action |
| Recent claims | No claims on the record. | When a claim is reported it appears here with its reference, amount, and current decision state. | primary role action |
| Whole book | The book starts with one policy. | Publish a product and issue the first policy. Premium, claims, and loss ratio will draw themselves from live records - no sample data. | Review underwriting |
| Restricted money | Financial detail is restricted. | Your staff role does not include the payments.view permission, so premium and claims amounts stay hidden here. Ask a super admin to grant it. | none |

### Visual treatment

- Dashed 1px outer border, very light ice wash, faint blueprint grid.
- 11px icon in a bordered circular chip with one soft shadow.
- 14px semibold title; 12px/20px description capped at 24rem.
- One filled pill action; one uppercase footnote with a 4px dot.
- Ghost plot drawn in `--primary` at 25-55% opacity, never competing with copy.
- No oversized illustration, no sad-face icon, no red.

---

## 5. Skeleton loading

The skeleton mirrors the real geometry, so the page does not jump when data
arrives. There is no spinner and no generic grey page.

- `CommandCentreSkeleton` mirrors: header, pulse tape, four line cards, the
  318px portfolio chart, the lower 236px cards, the right rail and the claims
  list.
- Chart skeletons use 12 staggered bar blocks plus two horizontal guide lines,
  which reads as "a chart is coming" rather than "a grey box".
- Stagger is 80ms per block; the pulse is the existing shadcn `animate-pulse`.
- `aria-busy="true"` and an accessible label are set on the shell.
- The member dashboard uses the matching `DashboardSkeleton` instead of a
  centred spinner.
- On a range change, the previous board data is retained and the chart morphs;
  the skeleton only appears on the first load.

---

## 6. The honest 30-minute build map

The 30-minute promise is real only if the data contract already exists. In this
repository it did not: the original dashboard had metric tiles and lists, but no
monthly series, no line mix, and no claims ratios. The plan below includes the
minimum backend work, not just pixels.

| Minute | Move | Output |
| --- | --- | --- |
| 0-2 | Pick one screen and one role. Confirm the data fields you already have. | Staff Command Centre, not a multi-role redesign |
| 2-5 | Lock the shell: rail widths, top bar height, content cap, card radius, one accent. | A page that already feels intentional before charts |
| 5-9 | Build the collapsible rail with persisted state and tooltips. | The navigation interaction works and feels native |
| 9-12 | Add the top bar, breadcrumb, search trigger and account menu. | The page stops looking like a demo route |
| 12-16 | Add the smallest monthly/line/claims query the charts need. Currency-scope it on the server. | Real numbers, not hardcoded shapes |
| 16-20 | Build two charts and one gauge. Stop at three visualisations. | The visual centrepiece |
| 20-23 | Write the empty state copy and ghost plot for each chart. | The screen survives a new deployment |
| 23-26 | Mirror the layout in a skeleton; keep previous data on range change. | No blank screen, no spinner, no jump |
| 26-29 | Check 390 / 768 / 1024 / 1600px, light and dark, keyboard focus and reduced motion. | A responsive, theme-safe pass |
| 29-30 | Run typecheck, Convex push, console check. | A shippable first pass |

### What 30 minutes actually buys

A credible premium first pass: the shell, one strong composition, real data, two
or three animated charts, intentional empty states, and skeletons. It does not
buy a $30,000 bespoke product. The difference between this and a $30k build is
not more animation; it is the unglamorous work:

- a design-system audit and token cleanup across every legacy dashboard screen;
- real product decisions about which metric is the north star;
- data quality checks, currency/reporting rules and backfill;
- editorial review of every label, empty state and error message;
- accessibility testing with keyboard, zoom, screen readers and reduced motion;
- performance work on a large book (pagination/aggregation instead of 500-row
  scans);
- usability testing with actual underwriters and claims handlers;
- states for loading errors, permission changes, stale data and partial outages.

If the clock is truly 30 minutes, cut the command palette, the gauge, and the
third chart before cutting the empty states or the responsive pass. A dashboard
with one honest chart and excellent states beats four charts that break on a
phone.

### Definition of done used here

- `bun tsc -b --noEmit` passes.
- `bun convex dev --once` deploys the board query.
- The board returns the same currency-scoped book for staff, and rejects
  non-staff callers.
- Headless checks at 1600, 1280, 1024, 768 and 390px show no horizontal page
  overflow, no runtime console errors, and non-zero chart/SVG dimensions.
- The rail collapses to 82px, persists across reloads, and the palette opens on
  `Cmd/Ctrl+K`.
- Light and dark screenshots render without missing background or clipping.
- Demo data is disclosed honestly: the seeded claims produce an elevated loss
  ratio, which the dashboard labels "Above target" instead of masking.
