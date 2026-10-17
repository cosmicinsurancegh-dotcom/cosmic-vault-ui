# Demonstration dataset (`insureflow-demo-v1`)

Protected, additive demo data for the existing insurance platform. It does not
replace the app, add a second data model, or introduce another auth provider.

## 1. What the existing app already provides

Discovered before writing any seed code:

| Concern | Existing implementation |
| --- | --- |
| Identity | Convex Auth with **email OTP** + anonymous guest only (`src/convex/auth.ts`, `auth/emailOtp.ts`). No password provider, no invitation flow. |
| Roles | `users.role` (`super_admin`, `admin`, `customer`, `broker`, legacy `user`/`member`) + `users.permissions[]`; resolved server-side in `lib/authz.ts`. |
| Customer/broker profiles | `customerProfiles`, `brokerProfiles`, `brokerAssignments` (assignment is per customer, revocable). |
| Insurance model | `products` (versioned) → `quotations` → `applications` (+ `applicationEvents`) → `policies` → `claims` (+ `claimEvents`) → `transactions`; plus `documents`, `notifications`, `auditLogs`, `tickets`. |
| Money | Integer minor units + ISO currency. No card processor; premiums are manual bank transfers confirmed by staff. |
| Decisions | Manual only. `applications.decide` / `claims.decide`; policy issuance requires an approved application and a confirmed premium. |
| Dashboards | `reports.overview` (admin/customer/broker), `reports.generate`, and the staff queues in `applications`, `policies`, `claims`, `payments`, `brokers`, `products`. |
| Supabase | Second data plane for Storage/Realtime only. **Not used by this seed**; no table, RLS or credential changes. |
| Migrations | None required: the seed only adds optional provenance fields to existing tables. |

## 2. Accounts and the sign-in constraint (read this first)

Requested demo identities:

| Role | Email |
| --- | --- |
| Admin | `admin@insureflow.demo` |
| Customer | `customer@insureflow.demo` |
| Broker 1 | `broker@insureflow.demo` |
| Broker 2 | `broker2@insureflow.demo` |

Supporting identities created to make the books realistic and broker-scoped:
`customer2@insureflow.demo` (Tomas Berg) and `customer3@insureflow.demo`
(Priya Raman).

**The demo emails are not sign-in capable by themselves.** Convex Auth only
supports email OTP here, and `@insureflow.demo` cannot receive mail, so no
verification code can be delivered. This seed therefore never invents auth
accounts, verification codes or sessions, and never exposes credentials.

Two supported ways to complete the accounts:

1. **Preferred:** use deliverable inboxes for the same six identities. Sign in
   once at `/auth` with each address and the emailed six-digit code. Convex Auth
   creates the real account; then run the seed in `existing-auth-users-only`
   mode (default) so records link to those account ids. Use
   `identityEmails: { "admin": "...", "customer-a": "...", ... }` if the
   inboxes differ from the canonical addresses.
2. **Sandbox only:** `allowDataOnlyIdentities: true` creates clearly marked
   `users` rows with **no** auth account. They populate admin views but cannot
   sign in. This is what the current dev deployment uses.

When a data-only identity later signs in with email OTP, Convex Auth creates a
*separate* user (same email, different `_id`). To avoid splits, clean the demo
batch first, sign in, then re-seed in existing-user mode:

```bash
bunx convex run demoSeed:cleanupPreview
bunx convex run demoSeed:cleanup '{"confirm":"delete:insureflow-demo-v1","planHash":"<from preview>"}'
# sign in with each real inbox, then:
bunx convex run demoSeed:preview
bunx convex run demoSeed:apply '{"confirm":"insureflow-demo-v1","planHash":"<from preview>"}'
```

## 3. What gets created

Stable marker on every seeded row: `isDemo: true`, `seedBatch:
"insureflow-demo-v1"`, `seededAt`, and a unique `demoKey`. `demoKey` is what
makes re-runs idempotent; `seedBatch` is what scopes cleanup. No authorisation
logic reads these fields.

| Entity | Count | Notes |
| --- | --- | --- |
| Demo identities | 6 | Admin (role `admin`), 3 customers, 2 brokers. |
| Customer profiles | 3 | Fictional GB/IE addresses, verified status, demo note. |
| Broker profiles | 2 | Reyes & Co Insurance (12.5%), Nordic Cover Partners (10%). |
| Broker assignments | 3 | Broker 1 → customers A + B; Broker 2 → customer C. |
| Products | 5 | Motor, home, travel, life, business; published, GBP, demonstrative pricing. |
| Applications | 12 | 8 approved, 1 declined, 1 draft, 1 submitted, 1 under review. |
| Application events | 43 | Creation, submission, assignment, decision. |
| Policies | 8 | 5 active, 2 expired, 1 cancelled; issued only from approved applications. |
| Claims | 6 | submitted, under review, approved, partially approved, declined, paid. |
| Claim events | 16 | Submission, assignment, decision, settlement. |
| Transactions | 11 | 8 confirmed premiums, 1 pending renewal, 1 failed attempt, 1 claim settlement. |
| Documents | 36 | 24 policy docs, 8 receipts, 4 claim decision letters (text bodies only). |
| Notifications | 17 | Per-role activity; `emailStatus: "skipped"`, no scheduler call. |
| Audit logs | 40 | Product, application, policy, payment, claim, assignment and seed-run history. |

**Total: 208 documents**, all additive.

The demo admin uses the conservative `DEFAULT_ADMIN_PERMISSIONS` plus
`products.manage` and `audit.view` (needed for the admin screens). It
deliberately does **not** take the `super_admin` seat, so the app's
founding-super-admin claim stays available.

## 4. Safety properties

- All functions are `internalQuery` / `internalMutation`, so `api.demoSeed.*`
  does not exist and the browser cannot call them. CLI/admin-key access only.
- Writes require `DEMO_SEED_ENABLED=1`, the exact `confirm` phrase **and** the
  `planHash` from a fresh dry run. A stale hash aborts before any write.
- Collision guards refuse to reuse a product code, application/policy/claim
  reference, transaction idempotency key or notification dedupe key owned by a
  non-demo record.
- Existing users are only touched if their email is a configured demo identity,
  their current role is customer-like, and they have no business data. Names,
  emails, credentials and existing profiles are never overwritten.
- Seeded notifications are inserted directly with `emailStatus: "skipped"`; the
  email adapter is never scheduled. No payment provider, webhook, claim
  processor or Supabase call is made.
- Cleanup is batch-scoped and refuses to run if a demo user has a Convex Auth
  account, if a demo user owns records outside the batch, or if a demo
  product/policy is referenced by non-demo records.
- `deactivate` is the non-destructive alternative: suspends demo users and
  archives demo products, preserving history.
- No Supabase keys, service-role credentials or secrets are read or logged.

## 5. Commands

```bash
# Production runs must target prod explicitly (after written approval):
#   bunx convex run --prod demoSeed:preview
#   bunx convex run --prod demoSeed:apply '{...}'

# Target label (used only for reporting) and write gate
bunx convex env set DEMO_SEED_ENVIRONMENT development
bunx convex env set DEMO_SEED_ENABLED 1

# 1. Read-only dry run (no writes)
bunx convex run demoSeed:preview
# sandbox without real inboxes:
bunx convex run demoSeed:preview '{"allowDataOnlyIdentities":true}'

# 2. Apply the exact previewed plan
bunx convex run demoSeed:apply '{"confirm":"insureflow-demo-v1","planHash":"<hash>"}'

# 3. Re-run idempotently: preview again (new hash) then apply; created = {}

# 4. Read-only verification
bunx convex run demoSeed:verify

# Targeted in-memory tests (preview, apply, idempotency, guards, cleanup,
# deactivate, role-conflict protection) against the real functions
bun run test

# 5. Cleanup (destructive, manual only)
bunx convex run demoSeed:cleanupPreview
bunx convex run demoSeed:cleanup '{"confirm":"delete:insureflow-demo-v1","planHash":"<hash>"}'

# Non-destructive alternative
bunx convex run demoSeed:deactivate '{"confirm":"deactivate:insureflow-demo-v1"}'

# Disable writes again when finished
bunx convex env remove DEMO_SEED_ENABLED
```

Environment variables: `DEMO_SEED_ENABLED` (write gate) and
`DEMO_SEED_ENVIRONMENT` (target label). No new secrets. `VITE_CONVEX_URL`,
`CONVEX_DEPLOYMENT`, `VLY_INTEGRATION_KEY` and the Supabase variables are
unchanged and not required by the seed.

## 6. Dry-run report (actual, dev deployment `grateful-pony-619`)

Mode `sandbox-data-only`, zero blockers, hash `fnv1a-a981ae26`:

| Table | Planned | To create |
| --- | --- | --- |
| users | 6 | 6 |
| customerProfiles | 3 | 3 |
| brokerProfiles | 2 | 2 |
| brokerAssignments | 3 | 3 |
| products | 5 | 5 |
| applications | 12 | 12 |
| applicationEvents | 43 | 43 |
| policies | 8 | 8 |
| claims | 6 | 6 |
| claimEvents | 16 | 16 |
| transactions | 11 | 11 |
| documents | 36 | 36 |
| notifications | 17 | 17 |
| auditLogs | 40 | 40 |

## 7. Verification results (actual, dev deployment)

| Check | Result |
| --- | --- |
| `bunx convex dev --once` (codegen) | passed |
| `bunx tsc -b --noEmit` | passed |
| `bun run build` | passed (Vite production build) |
| Targeted tests (`bun run test`, 11 tests) | passed — preview, apply counts, idempotency, stale-hash/flag/role-conflict guards, non-demo preservation, cleanup (incl. auth-account refusal), deactivate |
| ESLint on `demoSeed.ts` and `schema.ts` | passed |
| `bun run lint` (repo-wide) | fails on **pre-existing** errors in untouched files (`ProfilePage.tsx`, `main.tsx`, UI components, `setup.ts`, `tickets.ts`); none in changed files |
| First apply | 208 records created, 0 skipped |
| Second apply (fresh preview, new hash) | 0 created, 202 skipped, verification counts unchanged (6 identities already ready) |
| Stale hash attempt | rejected before any write |
| Approved apps with policy | 8 |
| Declined apps with policy | 0 |
| Policies from non-approved applications | 0 |
| Claims outside policy term / over limit | 0 / 0 |
| Decided claims missing decider/time | 0 |
| Dangling document references | 0 |
| Seeded notifications queued for email | 0 |
| Auth accounts created by seed | 0 |
| Policies with exactly one premium receipt | 8 / 8 |
| Duplicate policy numbers / idempotency keys | 0 / 0 |
| Non-demo records before → after | users 4→4, products 8→8, applications 2→2, policies 1→1, claims 1→1, transactions 3→3, documents 11→11, notifications 30→30, audit 24→24 |
| Broker 1 workload | 2 assigned customers, 8 applications, 3 active policies |
| Broker 2 workload | 1 assigned customer, 4 applications, 2 active policies |
| Broker isolation | Broker 1's customers (A, B) and broker 2's customer (C) are disjoint; existing queries gate rows by assignment/`brokerUserId` |

Money (GBP minor units, demonstration only): confirmed premiums 388,913;
pending 49,680; failed 5,000; claim settlement 96,000.

## 8. Deviations and known limitations

- **Accounts are not sign-in capable yet** (email-OTP-only auth + `.demo`
  addresses). Six marked data identities exist; zero auth accounts exist. See
  §2 for the supported activation path.
- **Six identities instead of four** (two extra customers) so each broker has a
  disjoint, realistic book. Required accounts are unchanged.
- **Five demo products added alongside the six existing starter products**; the
  catalogue now holds 13 products (11 published, 2 archived QA products).
  Demo products are clearly labelled in their wording/disclosures.
- **No trend charts** are wired into the active dashboard (`Charts.tsx` is only
  used by the orphaned `src/pages/Dashboard.tsx`), so no chart values were
  hardcoded or invented. Existing lists, queues and metric tiles are
  database-derived.
- **Commission display stays disabled** because global
  `settings.commissionEnabled` is false. Broker commission rates are seeded and
  the estimate is visible in `demoSeed.verify`/reports, but the broker panel
  correctly shows the global setting.
- **No quotations seeded** (applications reference no quotation), so the broker
  "open quotations" metric is 0; the 12 applications and 8 policies are the
  demo book.
- **Dashboard rendering was not verified in a browser** because no auth account
  exists to sign in with on this deployment. Verification is at the data and
  query-contract level (`demoSeed.verify` checks the same fields the dashboards
  read); the app compiles and the production build succeeds.
- **Cleanup and deactivate were exercised in the in-memory test suite but were
  not executed against the dev deployment** (only the read-only cleanup preview
  was run there). The batch is intact.
- Supabase is untouched: no Postgres tables, storage objects, RLS policies or
  service-role keys were used.
