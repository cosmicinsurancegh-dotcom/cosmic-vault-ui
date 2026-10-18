# Production Readiness Review - Cosmic Vault

Date: 18 October 2026
Scope: the Vite/React application in this repository, its Convex backend and
authentication, and the Supabase integration that exists as a secondary data
plane. No production deployment, migration or destructive operation was
performed during this review.

---

## A. Audit report

### A.1 Architecture as found (and one correction to the brief)

The brief describes React + Supabase + Vercel. The repository is React + Vite +
**Convex**, with Supabase wired as an optional second data plane. That changes
where security and capacity controls must live:

| Layer | What it actually is | Where |
| --- | --- | --- |
| Frontend | React 19 + React Router 7 + Tailwind 4 + shadcn/ui, Vite 7 | `src/pages`, `src/components` |
| Hosting | Vercel **static** SPA (no serverless functions, no Edge middleware) | `vercel.json`, `dist/` |
| Backend / database | **Convex** queries, mutations, actions, crons, file storage | `src/convex` |
| Auth | **Convex Auth** - email one-time code, password, anonymous guest, plus a Freebuff federated JWT | `src/convex/auth.ts`, `src/convex/auth.config.ts` |
| Authorisation | Server-side role + permission guards and per-row ownership checks | `src/convex/lib/authz.ts`, `src/convex/lib/access.ts` |
| Supabase | Browser client for RLS-bound calls; service-role access only inside Convex Node actions | `src/lib/supabase.ts`, `src/convex/supabase.ts` |
| Email | Freebuff integrations gateway; delivery state stored on notifications | `src/convex/auth/emailOtp.ts`, `src/convex/email.ts` |
| Observability | Convex dashboard logs; client error boundary that reports to the platform | `src/instrumentation.tsx` |

Installed versions after this review: `convex 1.42.1`, `@convex-dev/auth 0.0.96`,
`@auth/core 0.41.3`, `react-router 7.18.4`, `axios 1.20.0`, `hono 4.13.13`,
`vite 7.3.6`, `typescript 5.9.3`, `@supabase/supabase-js 2.118.0`.

Consequences of the actual architecture:

- There is no Vercel serverless runtime to tune: function timeout, memory and
  concurrency limits **do not apply**. Vercel only serves the built static
  bundle and applies `vercel.json` headers.
- Supabase does **not** hold the application schema. The repository contains no
  Supabase migrations, tables, RLS policies, database functions or triggers to
  audit - only a browser client, a health check and two staff-only Node actions
  (`supabase.status`, `supabase.signedUrl`). RLS verification is therefore
  **blocked / not applicable in this repository** (see F14 and section F).
- Row-level isolation is implemented in Convex query/mutation code. That code is
  the equivalent of RLS here and was the focus of the authorisation review.

### A.2 Baseline checks (before changes)

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `bunx tsc -b --noEmit` | **Pass** (exit 0) |
| Unit/integration | `bun run test` (vitest) | **Pass** - 11/11 (demoSeed only) |
| Browser E2E | `bunx playwright test` | **Pass** - 28/28 |
| E2E typecheck | `bun run test:e2e:types` | **Pass** (exit 0) |
| Production build | `bun run build` | **Pass** (exit 0), `dist` 5.2 MB |
| Lint | `bunx eslint .` | **Fail** - 26 errors, 26 warnings, all pre-existing (see F13) |
| Dependency audit | `bun audit` | **Fail** - 46 advisories incl. 1 critical, 27 high; 4 direct/runtime packages affected (see F1-F2) |

Build output notes: `index-*.js` 606 kB (187 kB gzip), `charts-*.js` 443 kB
(117 kB gzip), framer-motion 144 kB. Vite reports one empty chunk
(`convex-vendor`). No build warnings indicating broken chunks.

### A.3 Findings

Severity uses the brief's scale. "Fixed" means the change is in this working
tree and covered by the checks in section C; it is **not** deployed to
production.

| ID | Sev | Area | Finding (evidence) | Status |
| --- | --- | --- | --- | --- |
| F1 | **Critical** | Dependencies / auth | `@auth/core 0.37.4` carried a critical email-normalisation bypass (GHSA-7rqj-j65f-68wh) reachable from the sign-in normalisation path, plus two high advisories. Pinned transitively by `@convex-dev/auth 0.0.90`. | **Fixed** - upgraded to `@convex-dev/auth 0.0.96` (peer `@auth/core ^0.41.1`) + explicit `@auth/core 0.41.3` |
| F2 | **High** | Dependencies / email | `axios 1.18.1` (direct, used in the OTP send path) had high-severity ReDoS/SSRF/prototype-pollution advisories. `react-router 7.18.1` and `hono 4.12.27` were also in advisory ranges. | **Fixed** - `axios 1.20.0`, `react-router 7.18.4`, `hono 4.13.13` |
| F3 | **High** | Abuse / public API | `quotes.requestQuote` is callable by signed-out visitors, had no rate limit and only trimmed strings - no length caps on `name`, `plan`, `message` (up to document/argument limits). Unbounded lead spam and database growth. | **Fixed** - server-side caps + per-email, per-user and deployment-wide limits |
| F4 | **High** | Authorisation | `setup.status` / `setup.bootstrap` decided whether the founding super-admin seat was open with `users.take(200)`. With more than 200 users, a real super admin outside that window is invisible and **any signed-in user could promote themselves**. Guest (anonymous) sessions could also claim it. | **Fixed** - indexed `by_role` lookup; anonymous sessions refused |
| F5 | **High** | Auth abuse | Convex Auth's email-code send has no built-in per-address throttle, and the provider callback receives no `ctx`, so the app cannot count sends in the database. Unlimited OTP emails to arbitrary addresses (cost + mail-bombing) is possible. | **Outstanding** - blocked by provider API; needs gateway/dashboard control (section F) |
| F6 | **Medium** | Storage abuse | `documents.generateUploadUrl` could be called without limit by any signed-in member. `attach` validates type/size, but unattached uploads still cost storage. | **Fixed** - 60 upload URLs per member per hour |
| F7 | **Medium** | HTTP security headers | `vercel.json` lacked HSTS, clickjacking protection, a permissions policy, and cache directives for authenticated routes. | **Fixed (partial)** - headers added; full script CSP deferred (section A.4) |
| F8 | **Medium** | External service reliability | OTP email `axios.post` had no timeout and followed redirects. A stalled gateway holds the sign-in request until the platform kills it. | **Fixed** - 10 s timeout, `maxRedirects: 0` |
| F9 | **Medium** | Information disclosure | `payments.mineByReference` threw a distinct error for another member's reference, turning it into an existence oracle. | **Fixed** - returns `null`, same as an unknown reference |
| F10 | **Medium** | Query performance | Several staff screens load a fixed window and paginate in memory: `customers.directory` (`take(500)` profiles + users), `payments.listStaff` (`take(600)`), `reports.overview` (~13 tables, up to ~4,000 docs per call). Correct below the caps, approximate above them; reports.overview is the heaviest request in the app. | **Documented** - fits the <100-user target; see D.4 |
| F11 | **Medium** | Scheduled job capacity | `maintenance.daily` scanned 1,000 policies regardless of status, so expired/no-op rows consumed the budget and policies beyond 1,000 were never processed. | **Improved** - reads the `by_status` index for active policies (still capped at 1,000 per run); documented |
| F12 | **Low** | Data integrity | Quote references use time + `Math.random`, with no uniqueness index; collisions are possible but cosmetic. | **Open** - low impact |
| F13 | **Low** | Static analysis | 26 pre-existing ESLint errors: 17 `@typescript-eslint/no-unused-vars`, 5 `react-hooks/set-state-in-effect` (ProfilePage, admin screens), plus generated-toolbar lint. They predate this work and are unrelated to the security fixes. | **Open** - baseline recorded, not suppressed |
| F14 | **Info** | Supabase | No Supabase schema, migrations, RLS policies or table access exist in the repository. Only the health check and two staff-only actions are implemented. | **Blocked** - needs dashboard access to the actual project (if any) |
| F15 | **Info** | Observability | Client runtime errors are reported to the platform (`src/instrumentation.tsx`). There is no server-side 5xx alerting, latency SLO alert or rate-limit event alert. | **Open** - runbook relies on Convex/Vercel dashboards |
| F16 | **Info** | Info disclosure | Convex returns uncaught error messages with stack frames to direct API callers (observed for a bad password: `InvalidAccountId` plus stack). The React UI reduces these to readable text. | **Open** - platform behaviour; do not show raw errors in UI |
| F17 | **Info** | Frontend performance | Main bundle 606 kB raw / 187 kB gzip, charts chunk 443 kB. Routes are already code-split per page. No Core Web Vitals were measured (no representative browser/profile available). | **Open** - measure in the field |

### A.4 Deliberately deferred: full Content-Security-Policy

A restrictive `script-src` CSP was **not** added. The app loads fonts from
`fonts.googleapis.com`/`fonts.gstatic.com`, embeds inline styles from
Framer Motion/Radix, and runs inside the Freebuff preview shell. Shipping an
untested script policy would risk a blank production preview - a worse outcome
than the marginal gain, since React escapes rendered content and no user input
reaches `dangerouslySetInnerHTML` (the only use is shadcn's constant chart
theme). The applied CSP restricts `frame-ancestors`, `base-uri`, `object-src`
and `form-action` only. A full policy is a follow-up with a preview window and
the exact directive list in section F.

---

## B. Implementation report

### B.1 Dependency remediation (F1, F2)

- **Files:** `package.json`, `bun.lock`
- **Change:** `@convex-dev/auth ^0.0.96` (peer `@auth/core ^0.41.1`), explicit
  `@auth/core ^0.41.3`, `axios ^1.20.0`, `react-router ^7.18.2` (resolved
  7.18.4), `hono ^4.13.13`.
- **Why:** closes the critical Auth.js advisory and the runtime axios/router/hono
  advisories without changing application code. `Password({ verify, reset })`
  options and `Email()` send callback remain in the 0.0.96 API - verified in the
  installed type definitions and by typecheck.
- **Impact:** removes the only critical advisory and all runtime-package
  advisories; `bun audit` no longer reports axios, react-router, hono or
  `@auth/core`. The remaining 22 advisories are dev/build tooling that is not
  shipped in `dist`.
- **Test coverage:** typecheck, both Vitest files, Playwright suite, live auth
  endpoint returns the expected `InvalidAccountId` for a wrong password (proving
  the upgraded provider is registered and dispatching).

### B.2 Public lead form hardening (F3)

- **Files:** `src/convex/quotes.ts`, `src/convex/schema.ts`,
  `src/convex/lib/rateLimit.ts` (new), `src/convex/maintenance.ts`
- **Change:**
  - `name` max 120, `email` max 254 and validated, `plan` max 80, `message` max
    2,000, `monthlyEstimate` must be finite and within 0-100,000,000 minor units.
  - Rate limits stored in the new `rateLimits` table: 3 per email per 10
    minutes, 10 per signed-in member per 10 minutes, 240 deployment-wide per 10
    minutes. Rejections are a single user-facing message with the retry window.
  - `maintenance.daily` prunes rate-limit rows older than 7 days (index
    `by_windowStart`), so the table cannot grow without bound.
- **Why the database:** Convex mutations are serialisable transactions, so a
  read-modify-write counter is enforced across every backend instance. In-memory
  counters would reset per instance and would not be a security boundary.
- **Impact:** spam cannot fill the leads table; a rejected request rolls back
  with no partial write; normal visitors are unaffected (a person does not ask
  for three quotes in ten minutes).
- **Tests:** `tests/security.test.ts` - normalisation, input caps, 3-then-reject
  behaviour, window recovery, separate buckets for a different email and for a
  signed-in member.

### B.3 Founding super-admin check (F4)

- **Files:** `src/convex/schema.ts`, `src/convex/setup.ts`
- **Change:** `users` gains a `by_role` index; `setup.status` and
  `setup.bootstrap` read it with `.first()`. `bootstrap` refuses anonymous
  sessions with "Sign in with your email address to claim founding access."
- **Why:** the previous `take(200)` made authorisation depend on table size; a
  super admin beyond row 200 left the seat open to any signed-in user. The guest
  check stops a disposable anonymous session from taking over a fresh
  deployment.
- **Impact:** the founding claim is now O(1) and cannot be won by a guest. After
  a super admin exists the mutation is inert, as before.
- **Tests:** `tests/security.test.ts` - 250 filler users + super admin at the
  end still closes the seat; a guest is refused; the genuine first claim still
  promotes, and a second user cannot.

### B.4 Upload URL rate limit (F6)

- **Files:** `src/convex/documents.ts`
- **Change:** `generateUploadUrl` consumes a 60-per-hour-per-member budget.
- **Impact:** caps storage-abuse cost while leaving normal claim/application
  evidence uploads unaffected.

### B.5 Security headers and private-route caching (F7)

- **Files:** `vercel.json`
- **Change:** added `Strict-Transport-Security`, `X-Frame-Options: DENY`,
  `X-Permitted-Cross-Domain-Policies: none`, `Permissions-Policy` (camera,
  microphone, geolocation, payment, usb disabled), and a CSP limited to
  `frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'`.
  `/dashboard/*` and `/auth` now send `Cache-Control: no-store, must-revalidate`
  and `X-Robots-Tag: noindex, nofollow`.
- **Why:** prevents framing/clickjacking, stops shared caches or search engines
  from storing authenticated shells, and keeps existing static-asset caching
  (`/assets` immutable, `/index.html` revalidate) intact.
- **Note:** the CSP deliberately omits `script-src` (see A.4). Because CSP
  headers combine by intersection, a later stricter policy can be added without
  editing these directives.

### B.6 Email gateway timeout (F8)

- **Files:** `src/convex/auth/emailOtp.ts`
- **Change:** 10 s timeout and no redirects on the OTP `axios.post`.
- **Impact:** a stalled gateway now fails fast with the existing readable error
  instead of consuming the function's execution budget.

### B.7 Transaction reference oracle (F9)

- **Files:** `src/convex/payments.ts`
- **Change:** `mineByReference` returns `null` when the row belongs to someone
  else.
- **Impact:** no cross-member reference existence signal. No UI calls this query,
  so no workflow changes.
- **Tests:** `tests/security.test.ts`.

### B.8 Request lifecycle controls reviewed (Phases 6 and 9)

| Area | Finding |
| --- | --- |
| Injection | Not applicable in the SQL sense: the data store is Convex, and every read/write goes through typed query/mutation functions with argument validators. No string-built queries exist. |
| XSS | React escapes rendered text; the only `dangerouslySetInnerHTML` is shadcn's constant chart-theme CSS (`src/components/ui/chart.tsx`), not user input. No user-supplied HTML/URLs are rendered as markup. |
| CSRF | App queries/mutations carry a Convex Auth JWT minted for this deployment; there is no ambient cookie credential for data access, so classic cross-site form posts cannot act as the user. The one-time code is required for sign-in and password/reset flows. (Convex Auth's own HTTP routes may set cookies for its flow; they are not used as the authorisation credential for function calls.) |
| CORS | Convex applies permissive CORS to its HTTP API, but every function re-authenticates the caller and enforces role/ownership server-side, so CORS is not the access boundary. The Supabase browser client uses the anon key and would depend on RLS for any table it touched; the service role key is only read inside `"use node"` actions. |
| Open redirects | `resolveRedirectAfterAuth` accepts only same-origin paths that start with `/` and rejects `//`; Playwright covers `//evil.example/steal` and `https://evil.example` (`tests/e2e/auth-redirect.spec.ts`). |
| Uploads | Convex uploads are checked after upload for MIME type (PDF, PNG/JPEG/WebP, DOCX, plain text) and a 10 MB cap (`src/convex/lib/files.ts`), and attachment targets must belong to the caller (`documents.attach`). Upload URLs are now rate-limited. Supabase signed URLs default to 300 s. |
| Secrets | Only `VITE_*` values reach the bundle. `VLY_INTEGRATION_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are read from `process.env` inside Convex and never returned to a client. `supabase.status` reports key *presence*, not values. |
| Session handling | Convex validates the JWT on every call and resolves the user server-side; roles and permissions are never accepted from the request body. Suspended accounts are rejected by `requireViewer` for writes. |
| Error disclosure | UI errors are reduced to readable text (`readableAuthError`). Direct API callers can receive stack frames from uncaught library errors (F16) - documented, not exposed in the interface. |
| Caching | `dist/assets/*` is immutable for a year, `index.html` revalidates, and `/dashboard/*` + `/auth` are `no-store` with `noindex`. Convex query results are per-subscription and authenticated; no shared server cache exists, and none was added. |

---

## C. Test report

All commands were run in this workspace on 18 Oct 2026.

| Check | Command | Result |
| --- | --- | --- |
| Unit/integration | `bun run test` | **Pass** - 21/21 (11 demoSeed + 10 security) |
| Typecheck | `bunx tsc -b --noEmit` | **Pass** |
| Convex codegen/deploy (dev) | `bunx convex dev --once` | **Pass** - "Convex functions ready" |
| Production build | `bun run build` | **Pass** - exit 0, `dist` built |
| E2E typecheck | `bun run test:e2e:types` | **Pass** |
| Browser E2E | `bunx playwright test` (per spec file) | **Pass** - 28/28 |
| Lint | `bunx eslint .` | **Fail** - 26 errors, all pre-existing (F13). Not suppressed. |
| Dependency audit | `bun audit` | **Improved, not clean** - was 46 vulnerabilities (1 critical, 27 high, 17 moderate, 1 low); now 22 (18 high, 4 moderate) across 8 dev/build-tooling packages (playwright, eslint/js-yaml/brace-expansion, vite/postcss/nanoid/source-map-js, browserslist). No runtime package is reported. |
| Rate-limit live check | `k6 run loadtest/quote-rate-limit.js` | **Pass** - 3 accepted, 2 rejected with the user-facing limit message, other email unaffected, 0 transport failures |
| Read load (public path) | k6, see D.3 | **Pass** against thresholds; see caveats |
| Database integrity | `tests/security.test.ts`, `tests/demoSeed.test.ts` | **Pass** - rejected writes leave no rows; demo seed verifies duplicate policy numbers/transaction keys = 0 |
| Auth endpoint smoke | `POST /api/action auth:signIn` with a wrong password | **Pass** - expected `InvalidAccountId`, provider registered after upgrade |

Not run / blocked:

- Successful email-code or password **sign-in through the upgraded library** was
  not re-executed end to end: it needs a deliverable inbox for the six-digit
  code. The provider wiring and error path were verified live; a staging sign-in
  smoke test is a pre-deploy action (section F).
- Authenticated peak load: no staging credentials were available, so the
  100-VU run covers the public query path only (D.3).
- Lighthouse / Core Web Vitals: no representative browser profile or field data
  in this environment.
- Supabase RLS / database checks: no schema or migrations in the repository and
  no project credentials (F14).

---

## D. Capacity report

### D.1 Convex (the only request-serving backend)

Official limits ([docs.convex.dev/production/state/limits](https://docs.convex.dev/production/state/limits)):

| Resource | Limit |
| --- | --- |
| Query / mutation user-code execution | **1 second** (database work excluded) |
| Action execution | 10 minutes (Node), 30 minutes (Convex runtime); docs are inconsistent - verify |
| Document size | 1 MiB |
| Function arguments / return values | 16 MiB (Node actions: 5 MiB arguments) |
| Per-transaction reads / writes | 16 MiB read, 16 MiB written |
| Documents scanned / written per transaction | 32,000 scanned, 16,000 written |
| Concurrent execution, **S16** (Free/Starter) | 16 queries, 16 mutations, 64 runtime actions, 64 Node actions, 8 scheduled jobs |
| Concurrent execution, **S256** (Professional and above) | 256 queries, 256 mutations, 512 runtime actions, 256 Node actions, 256 scheduled jobs |
| Concurrent sessions | 1,000 (S16) / 10,000 (S256) |

The deployment's plan/class was **not accessible** from this workspace; check
Project Settings → Settings in the Convex dashboard. The observed 100-VU run
(2,044 requests, 0 failures) shows the class in use can absorb that read rate,
but the run was unauthenticated and read-only.

Convex does **not** rate-limit per user by default - its documentation
recommends a rate-limiter component. This project now implements the equivalent
in `src/convex/lib/rateLimit.ts` for the operations that needed it.

### D.2 Vercel (static SPA only)

No functions, so no execution time, memory or concurrency limits apply. The
bundle is served from the CDN; Hobby includes 100 GB fast data transfer and
1 million CDN requests per month ([Vercel Hobby](https://vercel.com/docs/plans/hobby)).
At 100 concurrent users the constraint is bandwidth/request allowance, not
compute. Monitor the Vercel usage page; a marketing spike (not app traffic) is
the realistic risk.

### D.3 Measured load (staging-equivalent: sandbox development deployment)

Tool: k6 v2.3.0. Target: `https://grateful-pony-619.convex.cloud`, public query
`quotes:myQuotes` (unauthenticated read path), pacing 0.8-2.0 s per virtual
user. No writes, no auth, no dashboard queries.

| VUs | Duration | Requests | Error rate | p95 | p99 | Max |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 5 | 20 s | 72 | 0% | 116 ms | 168 ms | 285 ms |
| 50 | 20 s | 689 | 0% | 218 ms | 305 ms | 548 ms |
| 100 | 30 s | 2,044 | 0% | 126 ms | 273 ms | 536 ms |

Rate-limit check (6 writes): 3 accepted, 3 rejected as designed, p95 344 ms.

Interpretation: the transport and Convex API layers comfortably meet the
p95 ≤ 500 ms target at the agreed peak **for this workload**. It is not evidence
that an authenticated dashboard session at 100 users meets the target, because
dashboard queries read 100-500 rows each and the heaviest staff queries (F10)
were not exercised.

### D.4 Known capacity limitations

1. `reports.overview` reads up to ~4,000 documents per call across 13 tables.
   Within the 32,000-documents-per-transaction ceiling and the 1 s user-code
   budget at current data sizes, but it will be the first query to breach either
   as data grows. Mitigation when needed: pre-aggregated daily counters or a
   cached report snapshot, not a bigger `take()`.
2. `customers.directory` and `payments.listStaff` paginate in memory after a
   500/600-row window. Above that, totals and later pages are approximate.
3. `maintenance.daily` processes at most 1,000 active policies per run (~each
   with notification writes). Beyond that, run it more often or split by
   `endDate` range.
4. Convex S16 allows 16 concurrent mutations; a 100-user burst of writes (for
   example every user submitting a claim at once) queues rather than fails.
   Reads dominate this app, so the observed read headroom is the relevant number.
5. The email gateway is a third-party dependency with unknown rate limits; it is
   not covered by the k6 profiles.

---

## E. Operating runbook

### E.1 Run the checks safely

```bash
bunx tsc -b --noEmit          # types
bun run test                  # vitest: demoSeed + security regression suites
bun run build                 # production bundle
bunx playwright test          # browser suite (starts its own Vite on 4174)
bunx eslint .                 # expected: pre-existing errors, see F13
CONVEX_URL=https://staging.convex.cloud \
  k6 run loadtest/public-read.js   # opt-in, staging only
```

Load tests: start with `PROFILE=baseline`, watch Convex and Vercel dashboards,
then `expected`, `peak`, `spike`, `recovery`. Stop if error rate > 1%, p95
> 500 ms sustained, or critical workflows fail.

### E.2 Monitor

- **Convex dashboard:** function errors/logs, execution time percentiles,
  database I/O, subscriptions, scheduled-job failures. Watch for
  `Too many requests` growth (rate limiting is working) and for
  `maintenance.daily` failures.
- **Vercel dashboard:** deployment status, CDN requests/bandwidth, build
  failures. No function metrics apply.
- **Email:** `notifications.deliveryIssues` (staff console) and Convex action
  logs for `email.deliver` failures.
- **Auth:** Convex logs for `auth:signIn` errors. Client errors arrive through
  `src/instrumentation.tsx`.
- **Signals to alert on:** any 5xx, p95 > 500 ms, error rate > 1%, failed
  scheduled job, `rateLimits` growth without pruning, failed email deliveries.

### E.3 Investigate performance degradation

1. Identify the function from Convex logs (query name, p95, failures).
2. Check whether it is one of the known heavy queries (F10) and whether the
   failure is latency (1 s user-code) or document-scan limits.
3. Check data volume for the table involved; look for a missing index before
   raising any `take()` cap.
4. Reproduce with `k6` against staging using the same query mix.
5. Resume only after thresholds pass again.

### E.4 Respond to rate limiting and provider failures

- Client sees "Too many requests. Please try again in about N minutes." The
  window is fixed; legitimate users recover automatically when it rolls over.
- If a legitimate marketing burst is throttled, the **deployment-wide** quote
  bucket (240 / 10 min) is the likely cause. Raise it deliberately in
  `RATE_LIMITS.quoteGlobal`, with a matching review of lead-spam exposure.
- Email provider down: notifications are recorded `failed` with the provider
  message; staff can retry from Notifications. Sign-in codes fail fast after
  10 s and the user can retry. No business flow is blocked.
- If the email gateway starts rejecting (401/429), rotate `VLY_INTEGRATION_KEY`
  in the Keys tab and redeploy Convex functions.

### E.5 Restore service after an incident

1. Check Vercel deployment status and Convex status page.
2. If the frontend is the problem, roll back in Vercel (Deployments → previous →
   Promote) - no database change is involved.
3. If a Convex function is the problem, deploy the last known-good commit:
   `bunx convex deploy` from that commit.
4. If credentials leaked, rotate: Convex Auth keys, `VLY_INTEGRATION_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`; redeploy; revoke sessions.
5. Verify: sign-in, dashboard read, one quote submission against staging.

### E.6 Verify database recovery

- Confirm the Convex plan's backup/restore capability in the dashboard (the
  availability of point-in-time restore depends on the plan; this workspace could
  not inspect it).
- Export a snapshot and prove restoration in a non-production deployment:
  `bunx convex export --path ./backup.zip` from the source deployment, then
  `bunx convex import --path ./backup.zip` into a staging deployment. A backup's
  existence is not proof; the import must be verified with a row count and a
  known record.
- For Supabase (if the project is used for storage), verify object storage backup
  and signed-URL access in the Supabase dashboard.

---

## F. Outstanding risks and manual actions

| # | Risk / action | Sev | Needs |
| --- | --- | --- | --- |
| 1 | OTP email send has no per-address throttle (F5). Configure a limit at the Freebuff email gateway or a per-email cooldown in the platform; alternatively front sign-in with a provider that supports it. | High | Gateway/provider access |
| 2 | Re-run a **staging sign-in smoke test** (email code + password + reset) after the `@convex-dev/auth` upgrade before promoting to production. | High | Staging + inbox |
| 3 | Authenticated peak-load run (`PROFILE=peak` with `AUTH_TOKEN`) was not possible; the 100-VU figure covers the public read path only. | High (evidence) | Staging credentials |
| 4 | Add a full CSP (`script-src`, `style-src`, `connect-src`, `img-src`, `font-src`) and verify it in a preview deployment. Template in this document's follow-up: `connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site https://*.supabase.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; script-src 'self'`. | Medium | Preview window + platform toolbar check |
| 5 | Confirm the Convex plan/class (S16 vs S256), function-call allowance and backup/PITR availability. | Medium | Convex dashboard |
| 6 | Confirm the Vercel plan limits and usage alerts; enable spend/usage notifications. | Medium | Vercel dashboard |
| 7 | Supabase RLS cannot be validated from the repository (no schema/migrations). If the project has tables or buckets, enable RLS, add policies and test cross-user access. | Medium | Supabase dashboard |
| 8 | No server-side alerting (F15). Configure Convex log alerts or an uptime/error monitor. | Medium | Provider/dashboard |
| 9 | Fix the 26 pre-existing lint errors, then make `bunx eslint .` a required check. | Low | None (code only) |
| 10 | `reports.overview` performance beyond current data sizes (D.4). Revisit when admin data grows. | Low | None until trigger |
| 11 | Core Web Vitals not measured (F17). Measure with field data or Lighthouse against the deployed URL. | Low | Deployed URL |
| 12 | Quote reference collisions (F12); consider a unique index or a stronger reference generator. | Low | None |

No production deployment, Supabase migration, mass update, credential change or
destructive operation was performed. No secret values were read, printed or
committed. The service-role key remains server-side only (`src/convex/supabase.ts`
in a `"use node"` action); the browser only ever sees `VITE_*` keys.

---

## G. Release-readiness decision

**Ready with documented risks.**

Rationale:

- The only critical finding (F1) and the exploitable runtime dependency
  advisories (F2) are fixed, and the upgraded auth package typechecks and
  dispatches correctly.
- The concrete authorisation flaw in the founding-admin check (F4) is fixed and
  regression-tested, including the larger-table case and guest sessions.
- The public write path now has server-side validation and distributed rate
  limiting, verified both in unit tests and against the live deployment.
- Typecheck, unit/integration tests (21), browser E2E (28), Convex codegen and
  the production build all pass. Load tests at 5/50/100 VUs show 0% error rate
  and p95 well under 500 ms for the public read path.
- Remaining risks are documented, none are newly introduced, and the highest
  ones (OTP email throttle, staging sign-in smoke test, authenticated peak run)
  are operational actions outside this workspace's access.

Conditions before promoting to production:

1. Run the staging sign-in smoke test (email code, password, reset) after the
   auth upgrade.
2. Confirm or configure an OTP send limit at the email gateway.
3. Run `PROFILE=baseline` then `PROFILE=peak` with a staging member token and
   record the result.
4. Deploy the Convex functions (`bunx convex deploy`) and the Vercel build
   together; the schema additions (`rateLimits`, `users.by_role`) are additive
   and need no data migration.

Rollback: Vercel → previous deployment; Convex → deploy the previous commit.
The new table/index are unused by older code, so a rollback leaves no broken
state (rate-limit rows simply stop being written; the daily cron still ignores
the table on an older deployment).
