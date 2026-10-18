# Load and abuse tests (k6)

These scripts measure the Convex API layer that the Vite app talks to. They are
**opt-in**: nothing in CI runs them, and they never start unless you pass an
explicit `CONVEX_URL`.

| Script | Purpose | Writes data |
| --- | --- | --- |
| `public-read.js` | Ramping read profiles (baseline / expected / peak / spike / recovery) with acceptance thresholds | No |
| `quote-rate-limit.js` | Proves the public lead form allows three requests per email then rejects the rest | Up to 3 throwaway leads |

## Safety rules

- Point these at a **staging** Convex deployment with representative test data.
- Do not run peak, spike or recovery profiles against production without an
  agreed window, monitoring, a rollback plan and named stop conditions.
- `quote-rate-limit.js` writes leads with `loadtest+...@example.com` addresses.
  They are inert, but clean them from the deployment before going live.
- Load tests consume Convex function-call and database I/O allowances. Check the
  plan before running long profiles.
- Stop immediately if error rate exceeds 1%, p95 exceeds 500 ms for sustained
  periods, the Convex dashboard shows resource saturation, or a critical
  workflow (sign-in, policy read) fails.

## Install k6

```bash
# macOS
brew install k6
# Debian/Ubuntu (see the k6 docs for signed packages)
sudo apt-get install k6
# or grab a release binary
curl -sL https://github.com/grafana/k6/releases/latest | grep linux-amd64
```

## Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `CONVEX_URL` | yes | `https://<deployment>.convex.cloud` |
| `AUTH_TOKEN` | for dashboard traffic | A real member's Convex Auth JWT. Treat it as a secret: never commit it, never reuse a production user. |
| `PROFILE` | no | `baseline` (default), `expected`, `peak`, `spike`, `recovery` |

Without `AUTH_TOKEN`, `public-read.js` measures only the unauthenticated query
path and says so in its output. That is a sanity check, not the capacity target.

To get a token for staging, sign in with a dedicated test account and copy the
`__convexAuthJWT*` value from the browser's local storage for the app origin.

## Commands

```bash
# Read profile (uses the stages defined in the script)
CONVEX_URL=https://staging-xyz.convex.cloud PROFILE=baseline \
  k6 run loadtest/public-read.js

# Peak target: 100 VUs for 10 minutes after ramp-up
CONVEX_URL=https://staging-xyz.convex.cloud \
AUTH_TOKEN="$STAGING_MEMBER_JWT" PROFILE=peak \
  k6 run loadtest/public-read.js

# Quick smoke while changing the script (20s at 5 VUs)
CONVEX_URL=https://staging-xyz.convex.cloud \
  k6 run --vus 5 --duration 20s loadtest/public-read.js

# Abuse / rate-limit verification
CONVEX_URL=https://staging-xyz.convex.cloud \
  k6 run loadtest/quote-rate-limit.js
```

## Thresholds

`public-read.js` fails the run when any of these is breached:

- `http_req_failed < 1%`
- `function_errors < 1%` (Convex returns HTTP 200 for function errors, so this
  metric inspects the body's `status` field)
- `http_req_duration p(95) < 500 ms`, `p(99) < 1500 ms`
- `checks > 99%`

`quote-rate-limit.js` requires every check to pass: three accepted requests,
two user-facing rejections that mention the limit, and a different address
unaffected.

## Workload assumptions

- 60/40 read-heavy traffic: the member mix round-robins the queries a dashboard
  session subscribes to (`customers:me`, `setup:referenceData`, `policies:mine`,
  `applications:mine`, `claims:mine`, `payments:mine`, `documents:mine`,
  `notifications:unreadCount`, `tickets:mine`).
- Each virtual user makes one query roughly every 1-2 seconds, which is faster
  than a real reader and therefore conservative.
- Writes, uploads and payment flows are deliberately excluded from the load
  profile: they mutate data and have their own idempotency tests in
  `tests/security.test.ts` and `tests/demoSeed.test.ts`.

## Last measured results

Recorded on 18 Oct 2026 against the sandbox development deployment
(`grateful-pony-619.convex.cloud`), **unauthenticated public query only**, k6
v2.3.0. See `docs/PRODUCTION_READINESS.md` for the full report and caveats.

| Run | Requests | Error rate | p95 | p99 |
| --- | ---: | ---: | ---: | ---: |
| 5 VUs, 20 s | 72 | 0% | 116 ms | 168 ms |
| 50 VUs, 20 s | 689 | 0% | 218 ms | 305 ms |
| 100 VUs, 30 s | 2,044 | 0% | 126 ms | 273 ms |

Rate limit check: 3 accepted, 2 rejected with "Too many requests", a different
email accepted, 0 transport failures.
