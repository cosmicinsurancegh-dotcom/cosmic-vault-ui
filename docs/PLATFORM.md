# Cosmic Vault — Insurance Management Platform

Implementation notes for the insurance platform built on the existing Cosmic Vault
site (Vite + React + TypeScript + Tailwind/shadcn, Convex backend, Convex Auth).

The public landing page, its branding, components and auth flow are unchanged.
All new work happens inside `/dashboard`, with backend logic in `src/convex`.

---

## 1. Architecture

| Layer | Technology | Location |
| --- | --- | --- |
| Frontend | React 18, React Router, Tailwind + shadcn/ui, Framer Motion | `src/pages`, `src/components` |
| Backend | Convex queries/mutations/actions, scheduled crons | `src/convex` |
| Auth | Convex Auth (email/password + Freebuff federated JWT) | `src/convex/auth.ts`, `src/convex/auth.config.ts` |
| Documents | Convex file storage for uploads; generated text documents stored in-database | `src/convex/documents.ts`, `src/convex/lib/files.ts` |
| Email | Platform integration gateway (`@vly-ai/integrations`) with recorded delivery state | `src/convex/email.ts` |

Money is stored as **integer minor units** plus an explicit ISO currency code.
Timestamps are stored in UTC milliseconds and rendered with the user's locale.

### Backend modules

`users`, `customers`, `brokers`, `products`, `quotations`, `applications`,
`policies`, `claims`, `payments`, `documents`, `notifications`, `tickets`,
`reports`, `audit`, `staff`, `settings`, `setup`, `maintenance`, `crons`,
`email`, plus shared helpers in `src/convex/lib/`
(`authz`, `access`, `audit`, `files`, `notify`, `people`, `pricing`, `refs`, `settings`).

### Dashboard routes

| Route | Access |
| --- | --- |
| `/dashboard` | Any signed-in user (role-specific overview) |
| `/dashboard/catalogue`, `quotes`, `applications`, `policies`, `profile` | Customer + broker |
| `/dashboard/claims` | Customer only |
| `/dashboard/payments`, `documents`, `support` | Any signed-in user (scoped rows) |
| `/dashboard/broker/customers`, `broker/reports` | Broker only |
| `/dashboard/admin/*` | Staff, additionally gated per permission |

`RequireAuth` preserves the requested path in `/auth?returnTo=…`; staff routes are
wrapped in `StaffOnly` + `RequirePermission`, broker routes in `RequireRole`.

---

## 2. Roles and permissions

Roles: `super_admin`, `admin`, `broker`, `customer` (`user`/`member` resolve to customer).

Granular staff permissions (`src/convex/lib/authz.ts`):

`customers.view`, `customers.manage`, `products.manage`, `applications.review`,
`policies.manage`, `claims.review`, `claims.decide`, `payments.view`,
`payments.manage`, `refunds.approve`, `brokers.manage`, `reports.view`,
`audit.view`, `settings.manage`, `staff.manage`.

- Super admins implicitly hold every permission.
- New admins receive a conservative default set (no refunds, payments management,
  settings, audit or staff administration).
- Every mutation resolves the caller server-side; the frontend never supplies a role.
- Customer rows are filtered by `viewer.user._id`.
- Broker rows are filtered by active `brokerAssignments` and `policy.brokerUserId`.
- Suspended accounts are rejected by `requireViewer` (read of own data still allowed).

**Founding super admin:** `setup.bootstrap` promotes the first signed-in user to
super admin only while no super admin exists. The dashboard shows a one-time
"claim founding access" action. Once any super admin exists the path is inert.

---

## 3. Data model (Convex tables)

`users`, `customerProfiles`, `brokerProfiles`, `brokerAssignments`,
`countries`, `currencies`, `categories`, `products` (versioned, status
draft/published/archived), `quotations`, `applications`, `applicationEvents`,
`policies`, `policyRequests`, `claims`, `claimEvents`, `transactions`,
`documents`, `notifications`, `tickets`, `ticketMessages`, `auditEvents`,
`settings`, plus Convex Auth tables.

Policies and quotations snapshot the product version, wording version, premium,
currency, coverage, excess and exclusions that applied when they were created, so
later product edits cannot rewrite history. Published product versions are
immutable; changes are saved as a new draft version and publishing archives the
previous version.

Indexes cover the hot paths used by the UI: customer policies/applications/claims,
policy and claim lookups, product by code/status, transaction idempotency keys,
notification dedupe keys, audit by entity.

---

## 4. Workflows (all manual decisions)

**Product publication** — `products.saveDraft` validates category, active
countries, allowed currency, wording and rating factors; `products.publish`
re-checks coverage/premium/countries/wording and archives prior versions.
Unpublished or archived products are rejected by both `products.quote` and
`quotations.create`.

**Quote → application → policy** — `quotations.create` prices from configured
rating factors (`lib/pricing`), snapshots the product version, then creates a
draft application. `applications.submit` requires terms acceptance, required
documents and (for brokers) recorded customer consent. Staff decide with
`applications.decide` (approve / decline / refer / request information).
`applications.issuePolicy` requires an approved application, a confirmed premium
transaction, and issues policy documents (schedule, certificate, wording) and
notifications. A confirmation page alone never activates a policy.

**Servicing and renewal** — customers/brokers raise `policyRequests`
(endorsement, cancellation, renewal, suspension). Staff decide; approval patches
the policy, appends an endorsement record and issues an endorsement document. A
renewal creates a pending renewal premium rather than duplicating the policy.

**Claims** — `claims.submit` validates policy ownership, active status, incident
date inside the policy term, amount ≤ coverage limit and requires evidence.
Staff assign, note, request information, decide (`claims.decide`) and record
settlement separately (`payments.recordSettlement`). Decision and settlement are
distinct states; `claims.close` only accepts paid or declined claims.

**Payments** — `payments.initiatePremium` creates a pending transaction with an
idempotency key; `payments.confirm` is staff-only, records a provider reference and
marks `providerVerified`. Refunds require `refunds.approve`, are idempotent per
transaction, and cannot exceed the original amount. No card data is stored.

**Brokers** — broker accounts are created/updated by staff; assignments are
explicit (`customers.assignBroker`) and revocable. Brokers see only assigned
customers, their policies and their own activity report.

**Notifications** — `lib/notify` writes an in-app notification with a dedupe key,
then schedules `email.deliver`. Delivery results (`queued`, `sent`, `failed`,
`skipped`) and errors are stored on the notification; staff can review and retry
(`notifications.deliveryIssues`, `notifications.retryEmail`).

**Audit** — `lib/audit.writeAudit` records actor, role, action, entity, before/after
values, reason and timestamp for application decisions, policy issuance and
status changes, claim decisions and settlements, refunds, product changes,
broker assignments, staff/permission changes and settings updates.

**Cron** — `crons.ts` schedules maintenance: expiry/renewal reminders, overdue
premium marking and stale draft cleanup (`maintenance.ts`).

---

## 5. Internationalisation

- Countries and currencies are configurable tables seeded with 11 markets and 7
  currencies; products declare supported countries and are blocked elsewhere.
- All amounts carry a currency code and are formatted with `Intl.NumberFormat`.
- Dates use UTC storage and locale-aware rendering (`src/lib/format.ts`).
- Customer profiles store country, timezone, language and preferred currency.
- Settings hold default currency, allowed currencies and company/support details.
- Policy wording and disclosures are per product version, so market-specific
  wording is configurable. Local legal review per market remains a business task.

---

## 6. Environment and integrations

| Variable | Used by | Notes |
| --- | --- | --- |
| `VITE_CONVEX_URL` | Frontend | Provided by the platform |
| `CONVEX_SITE_URL` | Auth config | Provided by the platform |
| `CONVEX_DEPLOYMENT` | Convex CLI | Provided by the platform |
| `VLY_INTEGRATION_KEY` | `convex/email.ts` | Platform integration gateway for email |

Email is the only outbound integration wired today. If the key is missing,
notifications are still created and delivery is recorded as `skipped`; provider
errors are recorded as `failed` with the provider message. The provider sandbox
rejects placeholder recipients such as `@example.com`, so live addresses are
needed to see `sent`.

No card processor is configured. Premiums use a controlled manual/bank-transfer
flow: a customer initiates a payment, staff verify the bank receipt and confirm
the transaction. Swapping in a card gateway requires implementing a signed
webhook handler that calls the same idempotent confirm path.

---

## 7. Verification performed

Run against a live Convex deployment with three test identities (customer, broker,
administrator) created through the app's own mutations.

| Check | Result |
| --- | --- |
| Typecheck (`bunx tsc -b --noEmit`) | passes |
| Convex codegen + deploy (`bunx convex dev --once`) | passes |
| Quote → application → approve → confirm payment → issue policy | policy `POL-QQ4SE8JBD` issued, 3 documents generated, notifications queued |
| Customer sees policy, documents, notifications | scoped correctly |
| Claim submit → note → partial approval → settlement → close | `CLM-S35HW2UV7` ended `paid`, then `closed`; settlement transaction `SET-SPTFRP6AP` |
| Duplicate claim decision | rejected: "A claim decision has already been recorded." |
| Duplicate refund | rejected: "A refund has already been recorded for this transaction." |
| Customer calls staff-only `claims.decide` / `claims.queue` | rejected: "This action is restricted to staff." |
| Broker reads unassigned customer policy | rejected: "You do not have access to this policy." |
| Broker lists staff customer directory | rejected: "This action is restricted to staff." |
| Broker after assignment | sees assigned customer and their policy only |
| Admin without `refunds.approve` issues refund | rejected: "You do not have permission to perform this action." |
| Customer quotes a draft product | rejected: "This product is not available for sale." |
| Customer quotes a published product outside supported country | rejected |
| Published product pricing | base 4500 × 1.6 = 7200 (minor units) |
| Archived product quoted | rejected |
| Fresh quote → application → documents → submit → information request → customer reply → decline | `QTE-0W7NUKXXF` → `APP-0WXM8WCM8` declined; issuance then rejected: "Only approved applications can be issued." |
| Duplicate application submit | rejected: "This application has already been submitted." |
| Policy endorsement request → staff approval | policy history shows the endorsement; endorsement document issued |
| Duplicate servicing request of the same type | rejected while one is pending |
| Broker revoke → access denied → re-assign | access restored only after a new active assignment |
| Broker reads a customer's claim directly | rejected (claims remain customer/staff only) |
| Support: customer creates, staff replies, staff resolves | ticket history and status updated |
| Settings save (`settings.update`) | persisted (`claimSlaDays` 10 → 11 → 10) |
| Reports (customers, policies, claims, premiums) | totals match underlying records; per-currency separation (GBP 442 premium, GBP 900 approved) |
| Admin overview metrics | live counts (1 customer, 1 active policy, 1 decided claim, 1 paid claim) |
| Audit trail | records product, application, policy, payment, claim, settlement, broker assignment events |
| Support ticket create + staff queue | ticket `SUP-VAU7QHS52` visible to staff |
| Email delivery state | attempts recorded as `failed` with provider reason (sandbox recipient), proving the adapter path |
| Marketing quote request (`quotes.requestQuote`) from the landing `QuoteDialog` | stored as `CV-JLB3KN2`: name/email trimmed, email lower-cased, `status: in_review`, no `userId` for a signed-out visitor |
| Quote request with a 1-character name / an invalid email | rejected: "Please add your full name." / "Please add a valid email address." |
| Quote request with an unsupported coverage value | rejected by argument validation |
| Signed-in quote request | stored with `userId`, immediately listed by `quotes.myQuotes` |
| Landing lead whose email matches a member who signs in later | appears in that member's `quotes.myQuotes` even though the lead has no `userId` |
| `quotes.myQuotes` for a signed-out visitor | `[]` (no leak of other members' leads) |
| ESLint on the landing, auth and quote modules | passes |
| Vite transforms for every landing section, the quote dialog, the auth page and the vault pages | 200, no transform errors |

The marketing landing page (`/`), `/auth`, `/login`, `/signup` and the vault
routes all render; the landing page's quote dialog posts to
`quotes.requestQuote`, which is the only write path for public traffic.

### Known limitations

- Card acquiring is not connected; payments are verified manually by staff.
- Email requires the integration key and non-placeholder recipient domains.
- SMS/push channels are not implemented (in-app + email only).
- Staff roles are assigned by an existing super admin (or the founding claim);
  there is no public staff sign-up by design.
- Country-specific legal wording is configurable per product version but the
  regulatory content itself needs review per market.
- The dev deployment contains records created during verification
  (`qa.*@example.com`, `POL-QQ4SE8JBD`, `CLM-S35HW2UV7`); remove them before
  going live if a clean dataset is preferred. (Landing-page leads created while
  testing `quotes.requestQuote` were deleted again.)
- Landing-page quote requests are stored and matched to a member by email, but
  no dashboard screen lists them yet: the member vault's `/dashboard/quotes`
  shows catalogue quotations (`quotations.mine`), and staff have no lead inbox.
  Add a `quotes.myQuotes` panel or a staff lead list before running the funnel
  for real — the data is already captured and scoped correctly.
- `src/pages/Dashboard.tsx` is an orphaned earlier draft of the member vault
  (it still queries `quotes.myQuotes`); nothing routes to it.
