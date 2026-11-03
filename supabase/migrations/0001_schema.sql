-- 0001_schema.sql
--
-- The Postgres mirror of `src/convex/schema.ts`: 30 tables, their indexes and
-- foreign keys. Convex stays authoritative until a domain is flipped onto
-- Supabase, so this migration has to describe the *existing* records exactly
-- enough that they can be copied in and read back unchanged.
--
-- Conventions, applied uniformly so the importer in
-- `scripts/supabase/migrate.mjs` can be mechanical:
--
--   * `id text primary key` - Convex document ids are opaque strings such as
--     "jd7f3k2m...". Keeping the same text value means every `Id<"users">`
--     stored in another column, every foreign key and every id the frontend
--     already holds stays valid through the move. New rows fall back to a
--     UUID rendered as text.
--   * `convex_creation_time_ms` - Convex stamps every document with
--     `_creationTime`. It is kept as epoch milliseconds (`double precision`)
--     so ordering and "newest first" lists behave identically after the copy.
--   * `v.number()` columns - always `double precision`. Convex numbers are
--     IEEE doubles; money is stored in minor units, so nothing needs a
--     narrower type and nothing can be rounded on the way in. Epoch-ms fields
--     get an `_ms` suffix (`created_at_ms`) to keep them distinct from the
--     real `timestamptz` bookkeeping columns.
--   * `v.boolean()` -> `boolean`, `v.string()` -> `text`, `v.array(v.string())`
--     -> `text[]`, objects/arrays of objects/`v.any()` -> `jsonb`.
--   * union validators -> `text` with a CHECK, not a Postgres enum. Enums are
--     painful to extend and a new literal in `schema.ts` should not require a
--     type rewrite while the two planes run side by side.
--   * `updated_at timestamptz` on every table is row bookkeeping maintained by
--     `set_updated_at()`. It is *not* the app's `updatedAt` field, which stays
--     `updated_at_ms`.
--
-- Timestamps that Convex stores as numbers are never converted here: the copy
-- is lossless, so a policy issued at 1717171717123 ms is still 1717171717123.

begin;

create extension if not exists pgcrypto;

-- Identity -------------------------------------------------------------------
--
-- `users` is the Convex users table (the one `authTables` merges in) plus the
-- role/permission columns the app added. `auth_user_id` is the bridge to
-- Supabase Auth: once Phase 2 lands, a signed-in Supabase user is the row whose
-- `auth_user_id` equals `auth.uid()`. It is nullable because every imported
-- Convex account exists before that link is made, and `on delete set null`
-- because deleting an auth user must never delete the policy, claim and payment
-- records that point at this row.
create table public.users (
  id text primary key default gen_random_uuid()::text,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  name text,
  image text,
  email text,
  email_verification_time_ms double precision,
  is_anonymous boolean not null default false,

  role text check (role in ('super_admin', 'admin', 'customer', 'broker', 'user', 'member')),
  permissions text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  suspended_reason text,
  last_role_change_at_ms double precision,
  closed_at_ms double precision,

  is_demo boolean not null default false,
  seed_batch text,
  seeded_at_ms double precision,
  demo_key text
);

create index users_email_idx on public.users (email);
create index users_by_role_idx on public.users (role);
create index users_auth_user_id_idx on public.users (auth_user_id);

-- Readable alias for the identity lookups in 0002. RLS helper functions resolve
-- the signed-in Supabase user through this view rather than trusting a JWT
-- claim, which would go stale the moment a role changes.
create view public.app_users as
  select * from public.users where auth_user_id is not null;

-- Leads ----------------------------------------------------------------------
create table public.quotes (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  user_id text references public.users (id),
  reference text not null,
  name text not null,
  email text not null,
  coverage text not null check (coverage in ('health', 'home', 'auto', 'life')),
  plan text,
  message text,
  status text not null check (status in ('in_review', 'quoted', 'active')),
  monthly_estimate double precision
);

create index quotes_by_user_idx on public.quotes (user_id);
create index quotes_by_email_idx on public.quotes (email);
create index quotes_reference_idx on public.quotes (reference);

-- Fixed-window counters. No client role may read or write these; the RPCs that
-- consume them are SECURITY DEFINER.
create table public.rate_limits (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  key text not null,
  window_start_ms double precision not null,
  count double precision not null default 0
);

create index rate_limits_by_key_idx on public.rate_limits (key);
create index rate_limits_by_window_start_idx on public.rate_limits (window_start_ms);

-- Reference data -------------------------------------------------------------
create table public.countries (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  code text not null,
  name text not null,
  currency text not null,
  region text not null,
  dial_code text,
  active boolean not null default true
);

create index countries_by_code_idx on public.countries (code);
create index countries_by_active_idx on public.countries (active);

create table public.currencies (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  code text not null,
  name text not null,
  symbol text not null,
  minor_units double precision not null default 2,
  active boolean not null default true
);

create index currencies_by_code_idx on public.currencies (code);

create table public.categories (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  key text not null,
  name text not null,
  description text not null default '',
  sort_order double precision not null default 0,
  active boolean not null default true
);

create index categories_by_key_idx on public.categories (key);

-- Settings hold bank details and email templates, so they are staff-only; the
-- public subset is served by an RPC in Phase 1 rather than a permissive policy.
create table public.settings (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  key text not null,
  company_name text not null,
  support_email text not null,
  email_from_address text,
  default_currency text not null,
  commission_enabled boolean not null default false,
  renewal_notice_days double precision not null default 30,
  claim_sla_days double precision not null default 5,
  support_response_hours double precision,
  premium_payment_term_days double precision,
  bank_account_name text,
  bank_iban text,
  bank_sort_code text,
  bank_swift text,
  allowed_currencies text[] not null default '{}',
  email_templates jsonb not null default '[]'::jsonb,
  updated_at_ms double precision not null default 0,
  updated_by text references public.users (id)
);

create index settings_by_key_idx on public.settings (key);

-- People ---------------------------------------------------------------------
create table public.customer_profiles (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  user_id text not null references public.users (id),
  reference text not null,
  full_name text not null,
  email text not null,
  phone text,
  date_of_birth text,
  country text not null,
  city text,
  address_line text,
  postal_code text,
  currency text not null,
  locale text not null default 'en',
  timezone text not null default 'UTC',
  preferred_language text not null default 'en',
  marketing_opt_in boolean not null default false,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'pending', 'verified')),
  notes text,
  created_at_ms double precision not null default 0,
  updated_at_ms double precision not null default 0,

  is_demo boolean not null default false,
  seed_batch text,
  seeded_at_ms double precision,
  demo_key text
);

create index customer_profiles_by_user_idx on public.customer_profiles (user_id);
create index customer_profiles_by_reference_idx on public.customer_profiles (reference);
create index customer_profiles_by_country_idx on public.customer_profiles (country);
create index customer_profiles_by_email_idx on public.customer_profiles (email);

create table public.broker_profiles (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  user_id text not null references public.users (id),
  reference text not null,
  org_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  countries text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'suspended')),
  agreement_ref text,
  commission_enabled boolean not null default false,
  commission_rate double precision not null default 0,
  created_at_ms double precision not null default 0,
  updated_at_ms double precision not null default 0,

  is_demo boolean not null default false,
  seed_batch text,
  seeded_at_ms double precision,
  demo_key text
);

create index broker_profiles_by_user_idx on public.broker_profiles (user_id);
create index broker_profiles_by_status_idx on public.broker_profiles (status);

create table public.broker_assignments (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  broker_user_id text not null references public.users (id),
  customer_user_id text not null references public.users (id),
  status text not null default 'active' check (status in ('active', 'revoked')),
  assigned_by text not null references public.users (id),
  note text,
  created_at_ms double precision not null default 0,
  revoked_at_ms double precision,

  is_demo boolean not null default false,
  seed_batch text,
  seeded_at_ms double precision,
  demo_key text
);

create index broker_assignments_by_broker_idx on public.broker_assignments (broker_user_id, status);
create index broker_assignments_by_customer_idx on public.broker_assignments (customer_user_id, status);

-- Products -------------------------------------------------------------------
create table public.products (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  code text not null,
  name text not null,
  category_key text not null,
  description text not null default '',
  target_customer text not null default '',
  countries text[] not null default '{}',
  currency text not null,
  base_premium double precision not null default 0,
  term_months double precision not null default 12,
  excess double precision not null default 0,
  coverage_limit double precision not null default 0,
  exclusions text[] not null default '{}',
  benefits text[] not null default '{}',
  rating_factors jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  required_documents jsonb not null default '[]'::jsonb,
  wording_version text not null default '1',
  wording text not null default '',
  disclosures text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  version double precision not null default 1,
  effective_from_ms double precision not null default 0,
  renewal_notice_days double precision not null default 30,
  cancellation_notice_days double precision not null default 0,
  created_by text references public.users (id),
  published_by text references public.users (id),
  published_at_ms double precision,
  created_at_ms double precision not null default 0,
  updated_at_ms double precision not null default 0,

  is_demo boolean not null default false,
  seed_batch text,
  seeded_at_ms double precision,
  demo_key text
);

create index products_by_code_idx on public.products (code);
create index products_by_status_idx on public.products (status);
create index products_by_category_idx on public.products (category_key);
create index products_by_country_idx on public.products using gin (countries);
create index products_by_code_version_idx on public.products (code, version);

-- Quotations and applications ------------------------------------------------
create table public.quotations (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  reference text not null,
  customer_user_id text not null references public.users (id),
  broker_user_id text references public.users (id),
  product_id text not null references public.products (id),
  product_code text not null,
  product_version double precision not null default 1,
  product_name text not null,
  country text not null,
  currency text not null,
  answers jsonb not null default '{}'::jsonb,
  premium double precision not null default 0,
  breakdown jsonb not null default '{}'::jsonb,
  status text not null default 'quoted' check (status in ('quoted', 'accepted', 'expired', 'withdrawn')),
  expires_at_ms double precision not null default 0,
  created_by text not null references public.users (id),
  consent_at_ms double precision,
  created_at_ms double precision not null default 0
);

create index quotations_by_customer_idx on public.quotations (customer_user_id);
create index quotations_by_broker_idx on public.quotations (broker_user_id);
create index quotations_by_reference_idx on public.quotations (reference);
create index quotations_by_product_idx on public.quotations (product_id);

-- `policy_id` is a real foreign key, added after `policies` exists: the two
-- tables reference each other (an approved application produces a policy, and
-- the policy points back at the application).
create table public.applications (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  reference text not null,
  quotation_id text references public.quotations (id),
  customer_user_id text not null references public.users (id),
  broker_user_id text references public.users (id),
  product_id text not null references public.products (id),
  product_code text not null,
  product_version double precision not null default 1,
  product_name text not null,
  category_key text not null,
  country text not null,
  currency text not null,
  premium double precision not null default 0,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'under_review', 'additional_info_required', 'approved', 'declined', 'withdrawn')),
  submitted_at_ms double precision,
  assigned_to text references public.users (id),
  decision text check (decision in ('approved', 'declined')),
  decision_reason text,
  decided_by text references public.users (id),
  decided_at_ms double precision,
  info_request text,
  info_request_at_ms double precision,
  customer_response text,
  withdrawn_at_ms double precision,
  terms_accepted_at_ms double precision,
  consent_recorded_at_ms double precision,
  documents jsonb not null default '[]'::jsonb,
  policy_id text,
  created_at_ms double precision not null default 0,
  updated_at_ms double precision not null default 0,

  is_demo boolean not null default false,
  seed_batch text,
  seeded_at_ms double precision,
  demo_key text
);

create index applications_by_customer_idx on public.applications (customer_user_id);
create index applications_by_broker_idx on public.applications (broker_user_id);
create index applications_by_status_idx on public.applications (status);
create index applications_by_assigned_idx on public.applications (assigned_to);
create index applications_by_product_idx on public.applications (product_id);
create index applications_by_reference_idx on public.applications (reference);

create table public.application_events (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  application_id text not null references public.applications (id),
  actor_id text not null references public.users (id),
  actor_role text not null,
  kind text not null check (kind in ('status', 'note', 'decision', 'info_request', 'document', 'assignment')),
  message text not null default '',
  from_status text,
  to_status text,
  internal boolean not null default false,
  created_at_ms double precision not null default 0,

  is_demo boolean not null default false,
  seed_batch text,
  seeded_at_ms double precision,
  demo_key text
);

create index application_events_by_application_idx on public.application_events (application_id);

-- Policies -------------------------------------------------------------------
create table public.policies (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  policy_number text not null,
  customer_user_id text not null references public.users (id),
  broker_user_id text references public.users (id),
  application_id text not null references public.applications (id),
  product_id text not null references public.products (id),
  product_code text not null,
  product_version double precision not null default 1,
  product_name text not null,
  category_key text not null,
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'active', 'renewal_pending', 'expired', 'cancelled', 'suspended')),
  insured_name text not null,
  country text not null,
  currency text not null,
  premium double precision not null default 0,
  excess double precision not null default 0,
  coverage_limit double precision not null default 0,
  exclusions text[] not null default '{}',
  benefits text[] not null default '{}',
  wording_version text not null default '1',
  start_date_ms double precision not null default 0,
  end_date_ms double precision not null default 0,
  renewal_date_ms double precision not null default 0,
  issued_by text not null references public.users (id),
  issued_at_ms double precision not null default 0,
  cancelled_at_ms double precision,
  cancel_reason text,
  suspended_at_ms double precision,
  suspension_reason text,
  endorsements jsonb not null default '[]'::jsonb,
  created_at_ms double precision not null default 0,
  updated_at_ms double precision not null default 0,

  is_demo boolean not null default false,
  seed_batch text,
  seeded_at_ms double precision,
  demo_key text
);

create index policies_by_customer_idx on public.policies (customer_user_id);
create index policies_by_broker_idx on public.policies (broker_user_id);
create index policies_by_status_idx on public.policies (status);
create index policies_by_number_idx on public.policies (policy_number);
create index policies_by_end_date_idx on public.policies (end_date_ms);
create index policies_by_application_idx on public.policies (application_id);

alter table public.applications
  add constraint applications_policy_id_fkey foreign key (policy_id) references public.policies (id);

create table public.policy_requests (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  policy_id text not null references public.policies (id),
  customer_user_id text not null references public.users (id),
  kind text not null check (kind in ('endorsement', 'cancellation', 'renewal', 'suspension')),
  details text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  requested_by text not null references public.users (id),
  decided_by text references public.users (id),
  decision_note text,
  decided_at_ms double precision,
  created_at_ms double precision not null default 0
);

create index policy_requests_by_policy_idx on public.policy_requests (policy_id);
create index policy_requests_by_customer_idx on public.policy_requests (customer_user_id);
create index policy_requests_by_status_idx on public.policy_requests (status);

-- Claims ---------------------------------------------------------------------
create table public.claims (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  reference text not null,
  policy_id text not null references public.policies (id),
  customer_user_id text not null references public.users (id),
  product_id text not null references public.products (id),
  product_name text not null,
  country text not null,
  currency text not null,
  incident_date_ms double precision not null default 0,
  location text not null default '',
  description text not null default '',
  amount_claimed double precision not null default 0,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'under_review', 'additional_info_required', 'under_assessment', 'approved', 'partially_approved', 'declined', 'payment_pending', 'paid', 'closed')),
  assigned_to text references public.users (id),
  decision text check (decision in ('approved', 'partially_approved', 'declined')),
  approved_amount double precision,
  decision_reason text,
  decided_by text references public.users (id),
  decided_at_ms double precision,
  info_request text,
  info_request_at_ms double precision,
  customer_response text,
  settlement_ref text,
  paid_at_ms double precision,
  closed_at_ms double precision,
  closure_reason text,
  dispute_message text,
  documents jsonb not null default '[]'::jsonb,
  reported_at_ms double precision not null default 0,
  created_at_ms double precision not null default 0,
  updated_at_ms double precision not null default 0,

  is_demo boolean not null default false,
  seed_batch text,
  seeded_at_ms double precision,
  demo_key text
);

create index claims_by_customer_idx on public.claims (customer_user_id);
create index claims_by_policy_idx on public.claims (policy_id);
create index claims_by_status_idx on public.claims (status);
create index claims_by_assigned_idx on public.claims (assigned_to);
create index claims_by_reference_idx on public.claims (reference);

create table public.claim_events (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  claim_id text not null references public.claims (id),
  actor_id text not null references public.users (id),
  actor_role text not null,
  kind text not null check (kind in ('status', 'note', 'decision', 'info_request', 'document', 'settlement')),
  message text not null default '',
  from_status text,
  to_status text,
  internal boolean not null default false,
  created_at_ms double precision not null default 0,

  is_demo boolean not null default false,
  seed_batch text,
  seeded_at_ms double precision,
  demo_key text
);

create index claim_events_by_claim_idx on public.claim_events (claim_id);

-- Money ----------------------------------------------------------------------
create table public.transactions (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  reference text not null,
  customer_user_id text not null references public.users (id),
  policy_id text references public.policies (id),
  application_id text references public.applications (id),
  claim_id text references public.claims (id),
  type text not null check (type in ('premium', 'refund', 'settlement', 'adjustment')),
  amount double precision not null default 0,
  currency text not null,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded', 'disputed')),
  method text not null check (method in ('bank_transfer', 'card', 'manual')),
  provider_ref text,
  provider_verified boolean not null default false,
  idempotency_key text,
  note text,
  recorded_by text references public.users (id),
  reconciled boolean not null default false,
  reconciled_by text references public.users (id),
  reconciled_at_ms double precision,
  failure_reason text,
  refund_of text references public.transactions (id),
  due_date_ms double precision,
  created_at_ms double precision not null default 0,
  updated_at_ms double precision not null default 0,

  is_demo boolean not null default false,
  seed_batch text,
  seeded_at_ms double precision,
  demo_key text
);

create index transactions_by_customer_idx on public.transactions (customer_user_id);
create index transactions_by_policy_idx on public.transactions (policy_id);
create index transactions_by_application_idx on public.transactions (application_id);
create index transactions_by_claim_idx on public.transactions (claim_id);
create index transactions_by_status_idx on public.transactions (status);
create index transactions_by_reference_idx on public.transactions (reference);
create index transactions_by_idempotency_idx on public.transactions (idempotency_key);
create index transactions_by_type_idx on public.transactions (type);

-- Documents ------------------------------------------------------------------
--
-- `storage_id` used to hold a Convex `_storage` id. After the copy it holds the
-- object path inside the private `documents` bucket (see 0003_storage.sql), so
-- the column stays text and nullable: rows with a `body` never had an object.
create table public.documents (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  owner_user_id text not null references public.users (id),
  name text not null,
  category text not null check (category in ('policy', 'invoice', 'receipt', 'claim', 'endorsement', 'application', 'other')),
  policy_id text references public.policies (id),
  claim_id text references public.claims (id),
  application_id text references public.applications (id),
  storage_id text,
  body text,
  content_type text not null default 'text/plain',
  size double precision,
  version double precision not null default 1,
  issued_by text references public.users (id),
  issued_at_ms double precision not null default 0,
  created_at_ms double precision not null default 0,

  is_demo boolean not null default false,
  seed_batch text,
  seeded_at_ms double precision,
  demo_key text
);

create index documents_by_owner_idx on public.documents (owner_user_id);
create index documents_by_policy_idx on public.documents (policy_id);
create index documents_by_claim_idx on public.documents (claim_id);
create index documents_by_application_idx on public.documents (application_id);

-- Notifications --------------------------------------------------------------
create table public.notifications (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  user_id text not null references public.users (id),
  type text not null,
  title text not null default '',
  body text not null default '',
  href text,
  related_type text,
  related_id text,
  dedupe_key text not null,
  read_at_ms double precision,
  email_status text not null default 'queued' check (email_status in ('queued', 'sent', 'skipped', 'failed')),
  email_attempts double precision not null default 0,
  email_error text,
  email_subject text,
  email_text text,
  email_html text,
  email_queued_at_ms double precision,
  created_at_ms double precision not null default 0,

  is_demo boolean not null default false,
  seed_batch text,
  seeded_at_ms double precision,
  demo_key text
);

create index notifications_by_user_idx on public.notifications (user_id);
create index notifications_by_dedupe_idx on public.notifications (dedupe_key);
create index notifications_by_email_status_idx on public.notifications (email_status);
create index notifications_by_related_idx on public.notifications (related_id);

create table public.shipment_emails (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  tracking_number text not null,
  mineral_name text not null default '',
  owner_name text not null default '',
  owner_email text not null default '',
  shipment_status text not null default '',
  subject text not null default '',
  html text not null default '',
  text text not null default '',
  delivery_status text not null default 'queued' check (delivery_status in ('queued', 'sent', 'skipped', 'failed')),
  attempts double precision not null default 0,
  error text,
  sent_by text references public.users (id),
  created_at_ms double precision not null default 0,
  delivered_at_ms double precision,

  is_demo boolean not null default false,
  seed_batch text,
  seeded_at_ms double precision,
  demo_key text
);

create index shipment_emails_by_tracking_idx on public.shipment_emails (tracking_number, created_at_ms);
create index shipment_emails_by_created_idx on public.shipment_emails (created_at_ms);

-- Support --------------------------------------------------------------------
create table public.tickets (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  reference text not null,
  user_id text not null references public.users (id),
  category text not null default 'general',
  subject text not null,
  message text not null default '',
  status text not null default 'open' check (status in ('open', 'awaiting_customer', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  related_type text,
  related_id text,
  assigned_to text references public.users (id),
  created_at_ms double precision not null default 0,
  updated_at_ms double precision not null default 0
);

create index tickets_by_user_idx on public.tickets (user_id);
create index tickets_by_status_idx on public.tickets (status);
create index tickets_by_reference_idx on public.tickets (reference);

create table public.ticket_messages (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  ticket_id text not null references public.tickets (id),
  author_id text not null references public.users (id),
  author_role text not null,
  body text not null default '',
  internal boolean not null default false,
  created_at_ms double precision not null default 0
);

create index ticket_messages_by_ticket_idx on public.ticket_messages (ticket_id);

-- Mineral assets -------------------------------------------------------------
create table public.minerals (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  reference text not null,
  name text not null,
  category text not null default 'other',
  description text,
  quantity double precision not null default 0,
  unit text not null default 'kg',
  declared_value double precision not null default 0,
  currency text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  assigned_user_id text references public.users (id),
  assigned_at_ms double precision,
  assigned_by text references public.users (id),
  created_by text not null references public.users (id),
  created_at_ms double precision not null default 0,
  updated_at_ms double precision not null default 0,

  is_demo boolean not null default false,
  seed_batch text,
  seeded_at_ms double precision,
  demo_key text
);

create index minerals_by_reference_idx on public.minerals (reference);
create index minerals_by_assigned_idx on public.minerals (assigned_user_id);
create index minerals_by_status_idx on public.minerals (status);

create table public.mineral_policies (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  mineral_id text not null references public.minerals (id),
  policy_number text not null,
  provider text not null default '',
  coverage text not null check (coverage in ('all_risk', 'cargo_transit', 'storage', 'liability')),
  coverage_limit double precision not null default 0,
  premium double precision not null default 0,
  currency text not null,
  start_date_ms double precision not null default 0,
  end_date_ms double precision not null default 0,
  status text not null default 'draft' check (status in ('draft', 'active', 'expired', 'cancelled')),
  notes text,
  policy_id text references public.policies (id),
  created_by text not null references public.users (id),
  created_at_ms double precision not null default 0,
  updated_at_ms double precision not null default 0,

  is_demo boolean not null default false,
  seed_batch text,
  seeded_at_ms double precision,
  demo_key text
);

create index mineral_policies_by_mineral_idx on public.mineral_policies (mineral_id);
create index mineral_policies_by_number_idx on public.mineral_policies (policy_number);
create index mineral_policies_by_policy_idx on public.mineral_policies (policy_id);
create index mineral_policies_by_status_idx on public.mineral_policies (status);

create table public.shipment_requests (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  mineral_id text not null references public.minerals (id),
  customer_user_id text not null references public.users (id),
  destination text not null,
  preferred_date_ms double precision,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  shipment_id text,
  decided_by text references public.users (id),
  decision_note text,
  decided_at_ms double precision,
  created_at_ms double precision not null default 0,
  updated_at_ms double precision not null default 0,

  is_demo boolean not null default false,
  seed_batch text,
  seeded_at_ms double precision,
  demo_key text
);

create index shipment_requests_by_mineral_idx on public.shipment_requests (mineral_id);
create index shipment_requests_by_customer_idx on public.shipment_requests (customer_user_id);
create index shipment_requests_by_status_idx on public.shipment_requests (status);

create table public.shipments (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  mineral_id text not null references public.minerals (id),
  reference text not null,
  carrier text not null default '',
  tracking_number text,
  origin text not null default '',
  destination text not null default '',
  departure_at_ms double precision,
  estimated_arrival_at_ms double precision,
  status text not null default 'preparing' check (status in ('preparing', 'in_transit', 'customs_hold', 'out_for_delivery', 'delivered', 'delayed', 'cancelled')),
  current_location text,
  notes text,
  assigned_user_id text references public.users (id),
  created_by text not null references public.users (id),
  updated_by text references public.users (id),
  last_status_at_ms double precision not null default 0,
  created_at_ms double precision not null default 0,
  updated_at_ms double precision not null default 0,

  is_demo boolean not null default false,
  seed_batch text,
  seeded_at_ms double precision,
  demo_key text
);

create index shipments_by_mineral_idx on public.shipments (mineral_id);
create index shipments_by_assigned_idx on public.shipments (assigned_user_id);
create index shipments_by_reference_idx on public.shipments (reference);
create index shipments_by_status_idx on public.shipments (status);

alter table public.shipment_requests
  add constraint shipment_requests_shipment_id_fkey foreign key (shipment_id) references public.shipments (id);

create table public.shipment_events (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  shipment_id text not null references public.shipments (id),
  mineral_id text not null references public.minerals (id),
  status text not null check (status in ('preparing', 'in_transit', 'customs_hold', 'out_for_delivery', 'delivered', 'delayed', 'cancelled')),
  from_status text check (from_status in ('preparing', 'in_transit', 'customs_hold', 'out_for_delivery', 'delivered', 'delayed', 'cancelled')),
  location text,
  note text,
  actor_id text not null references public.users (id),
  actor_role text not null,
  created_at_ms double precision not null default 0,

  is_demo boolean not null default false,
  seed_batch text,
  seeded_at_ms double precision,
  demo_key text
);

create index shipment_events_by_shipment_idx on public.shipment_events (shipment_id);
create index shipment_events_by_mineral_idx on public.shipment_events (mineral_id);

-- Audit ----------------------------------------------------------------------
create table public.audit_logs (
  id text primary key default gen_random_uuid()::text,
  convex_creation_time_ms double precision not null default (extract(epoch from clock_timestamp()) * 1000),
  updated_at timestamptz not null default now(),

  actor_id text not null references public.users (id),
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before jsonb,
  after jsonb,
  reason text,
  request_id text,
  at_ms double precision not null default 0,

  is_demo boolean not null default false,
  seed_batch text,
  seeded_at_ms double precision,
  demo_key text
);

create index audit_logs_by_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_by_actor_idx on public.audit_logs (actor_id);
create index audit_logs_by_action_idx on public.audit_logs (action);

-- Bookkeeping ----------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
      and c.table_name <> 'app_users'
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at',
      t
    );
  end loop;
end;
$$;

-- One identity row per Supabase Auth user. SECURITY DEFINER because the insert
-- runs as `supabase_auth_admin`, which has no rights on `public.users`; the
-- function is the only writer, so the RLS policies can deny client inserts.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.users (auth_user_id, email, name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    'customer',
    'active'
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- `pg_cron`/`pg_net` (the daily maintenance job in Phase 4) are deliberately not
-- created here: they are extensions on the hosted project and enabling them is a
-- dashboard/CLI decision, not something a schema migration should assume.

commit;
