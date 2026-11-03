-- 0002_rls.sql
--
-- Row-level security for every table created in 0001.
--
-- The rules follow the backend's own authorization model (`src/convex/lib/`
-- and the per-module `requireStaff`/`getAuthUserId` calls):
--
--   * A member reads their own records.
--   * A broker reads the customers assigned to them (`broker_assignments`).
--   * Staff read everything their permission grants, and `super_admin` holds
--     every permission, exactly like `can()` in `src/lib/permissions.ts`.
--   * Reference data (countries, currencies, categories) is public; published
--     products are public; settings and audit logs are staff-only because they
--     contain bank details and internal history.
--   * `internal` notes on events and ticket messages are never visible to the
--     customer they are about.
--
-- Role and permissions are read from `public.users` through
-- `current_user_role()`/`has_permission()` rather than from JWT claims. A claim
-- is a snapshot from sign-in time: suspending an account or changing a role has
-- to take effect immediately, and a signed-in browser keeps its old token for
-- up to an hour otherwise.
--
-- Direct writes are denied on purpose. Every mutation the app performs has a
-- server-side invariant (a reference number, a lifecycle transition, a rate
-- limit, an audit entry), so `INSERT`/`UPDATE`/`DELETE` are only reachable from
-- `SECURITY DEFINER` functions added as each domain migrates - the same shape
-- the Convex mutations have today. Phase 1 adds `request_quote()`; nothing in
-- this migration lets a browser write a row.

begin;

-- Helpers --------------------------------------------------------------------
--
-- SECURITY DEFINER so the lookup itself is not filtered by the policies below
-- (which would recurse). `search_path` is pinned and `auth.uid()` stays the
-- caller's, which is the identity these functions are supposed to resolve.

create or replace function public.current_user_id()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id
  from public.users u
  where u.auth_user_id = auth.uid()
    and coalesce(u.status, 'active') = 'active'
  limit 1
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(u.role, 'customer')
  from public.users u
  where u.auth_user_id = auth.uid()
    and coalesce(u.status, 'active') = 'active'
  limit 1
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_user_role() in ('admin', 'super_admin'), false)
$$;

create or replace function public.has_permission(permission text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.current_user_role() = 'super_admin' then true
    when public.current_user_role() = 'admin' then
      permission = any (
        coalesce(
          (select u.permissions from public.users u where u.auth_user_id = auth.uid() limit 1),
          '{}'::text[]
        )
      )
    else false
  end
$$;

create or replace function public.is_broker()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_user_role() = 'broker', false)
$$;

/** True when the signed-in broker has an active assignment for `customer`. */
create or replace function public.broker_serves(customer text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.broker_assignments ba
    where ba.customer_user_id = customer
      and ba.broker_user_id = public.current_user_id()
      and ba.status = 'active'
  )
$$;

/** The single predicate most domain tables use for their SELECT policy. */
create or replace function public.can_read_customer(customer text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    customer is not null
      and customer = public.current_user_id()
      or public.broker_serves(customer)
      or public.is_staff(),
    false
  )
$$;

-- Grants ---------------------------------------------------------------------
--
-- Supabase grants broad access to the anon/authenticated roles by default;
-- take it back and hand out only reads (RLS then decides the rows) plus the
-- functions each domain publishes.

revoke all on all tables in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on public.countries, public.currencies, public.categories, public.products to anon, authenticated;

grant select on
  public.users,
  public.quotes,
  public.settings,
  public.customer_profiles,
  public.broker_profiles,
  public.broker_assignments,
  public.quotations,
  public.applications,
  public.application_events,
  public.policies,
  public.policy_requests,
  public.claims,
  public.claim_events,
  public.transactions,
  public.documents,
  public.notifications,
  public.shipment_emails,
  public.tickets,
  public.ticket_messages,
  public.minerals,
  public.mineral_policies,
  public.shipment_requests,
  public.shipments,
  public.shipment_events,
  public.audit_logs
to authenticated;

-- Identity -------------------------------------------------------------------
alter table public.users enable row level security;

create policy users_select_self_or_staff
  on public.users for select to authenticated
  using (auth_user_id = auth.uid() or public.is_staff());

create policy users_update_staff
  on public.users for update to authenticated
  using (public.has_permission('staff.manage'))
  with check (public.has_permission('staff.manage'));

-- `app_users` is deliberately not granted to any client role. A view runs with
-- its owner's rights, so granting it would hand every signed-in user the whole
-- users table - including other people's emails and roles - regardless of the
-- policy on `users`. It exists for operators and the SECURITY DEFINER helpers
-- above, which read `public.users` directly.

-- Leads ----------------------------------------------------------------------
alter table public.quotes enable row level security;

create policy quotes_select_own_or_staff
  on public.quotes for select to authenticated
  using (
    user_id = public.current_user_id()
    or lower(email) = (
      select lower(u.email) from public.users u where u.auth_user_id = auth.uid() limit 1
    )
    or public.has_permission('customers.view')
  );

alter table public.rate_limits enable row level security;
-- No policies: only SECURITY DEFINER RPCs may touch the counters.

-- Reference data -------------------------------------------------------------
alter table public.countries enable row level security;

create policy countries_select_all
  on public.countries for select to anon, authenticated
  using (true);
create policy countries_write_settings
  on public.countries for all to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

alter table public.currencies enable row level security;

create policy currencies_select_all
  on public.currencies for select to anon, authenticated
  using (true);
create policy currencies_write_settings
  on public.currencies for all to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

alter table public.categories enable row level security;

create policy categories_select_all
  on public.categories for select to anon, authenticated
  using (true);
create policy categories_write_settings
  on public.categories for all to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

alter table public.settings enable row level security;

create policy settings_staff
  on public.settings for all to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

-- Products -------------------------------------------------------------------
alter table public.products enable row level security;

create policy products_select_published_or_staff
  on public.products for select to anon, authenticated
  using (status = 'published' or public.has_permission('products.manage'));

create policy products_write_manage
  on public.products for all to authenticated
  using (public.has_permission('products.manage'))
  with check (public.has_permission('products.manage'));

-- People ---------------------------------------------------------------------
alter table public.customer_profiles enable row level security;

create policy customer_profiles_select
  on public.customer_profiles for select to authenticated
  using (public.can_read_customer(user_id) or public.has_permission('customers.view'));

create policy customer_profiles_update_self_or_staff
  on public.customer_profiles for update to authenticated
  using (user_id = public.current_user_id() or public.has_permission('customers.manage'))
  with check (user_id = public.current_user_id() or public.has_permission('customers.manage'));

alter table public.broker_profiles enable row level security;

create policy broker_profiles_select
  on public.broker_profiles for select to authenticated
  using (user_id = public.current_user_id() or public.has_permission('brokers.manage'));

create policy broker_profiles_write_manage
  on public.broker_profiles for all to authenticated
  using (public.has_permission('brokers.manage'))
  with check (public.has_permission('brokers.manage'));

alter table public.broker_assignments enable row level security;

create policy broker_assignments_select
  on public.broker_assignments for select to authenticated
  using (
    broker_user_id = public.current_user_id()
    or customer_user_id = public.current_user_id()
    or public.has_permission('brokers.manage')
  );

create policy broker_assignments_write_manage
  on public.broker_assignments for all to authenticated
  using (public.has_permission('brokers.manage'))
  with check (public.has_permission('brokers.manage'));

-- Quotations and applications ------------------------------------------------
alter table public.quotations enable row level security;

create policy quotations_select
  on public.quotations for select to authenticated
  using (public.can_read_customer(customer_user_id) or public.has_permission('applications.review'));

alter table public.applications enable row level security;

create policy applications_select
  on public.applications for select to authenticated
  using (public.can_read_customer(customer_user_id) or public.has_permission('applications.review'));

alter table public.application_events enable row level security;

create policy application_events_select
  on public.application_events for select to authenticated
  using (
    exists (
      select 1
      from public.applications a
      where a.id = application_events.application_id
        and (public.can_read_customer(a.customer_user_id) or public.has_permission('applications.review'))
    )
    and (not internal or public.is_staff())
  );

-- Policies -------------------------------------------------------------------
alter table public.policies enable row level security;

create policy policies_select
  on public.policies for select to authenticated
  using (public.can_read_customer(customer_user_id) or public.has_permission('policies.manage'));

alter table public.policy_requests enable row level security;

create policy policy_requests_select
  on public.policy_requests for select to authenticated
  using (public.can_read_customer(customer_user_id) or public.has_permission('policies.manage'));

-- Claims ---------------------------------------------------------------------
alter table public.claims enable row level security;

create policy claims_select
  on public.claims for select to authenticated
  using (public.can_read_customer(customer_user_id) or public.has_permission('claims.review'));

alter table public.claim_events enable row level security;

create policy claim_events_select
  on public.claim_events for select to authenticated
  using (
    exists (
      select 1
      from public.claims c
      where c.id = claim_events.claim_id
        and (public.can_read_customer(c.customer_user_id) or public.has_permission('claims.review'))
    )
    and (not internal or public.is_staff())
  );

-- Money ----------------------------------------------------------------------
alter table public.transactions enable row level security;

create policy transactions_select
  on public.transactions for select to authenticated
  using (public.can_read_customer(customer_user_id) or public.has_permission('payments.view'));

-- Documents ------------------------------------------------------------------
alter table public.documents enable row level security;

create policy documents_select
  on public.documents for select to authenticated
  using (public.can_read_customer(owner_user_id));
-- Writes arrive with the Storage phase: an object is uploaded to the private
-- bucket first and the row is created by an RPC that verifies the path.

-- Notifications --------------------------------------------------------------
alter table public.notifications enable row level security;

create policy notifications_select_own_or_staff
  on public.notifications for select to authenticated
  using (user_id = public.current_user_id() or public.is_staff());
-- Marking as read is an RPC (`mark_notification_read`), so a member cannot
-- rewrite the body or the delivery status of their own notification row.

alter table public.shipment_emails enable row level security;

create policy shipment_emails_staff
  on public.shipment_emails for select to authenticated
  using (public.has_permission('vault.manage') or public.has_permission('reports.view'));

-- Support --------------------------------------------------------------------
alter table public.tickets enable row level security;

create policy tickets_select
  on public.tickets for select to authenticated
  using (user_id = public.current_user_id() or public.is_staff());

alter table public.ticket_messages enable row level security;

create policy ticket_messages_select
  on public.ticket_messages for select to authenticated
  using (
    exists (
      select 1
      from public.tickets t
      where t.id = ticket_messages.ticket_id
        and (t.user_id = public.current_user_id() or public.is_staff())
    )
    and (not internal or public.is_staff())
  );

-- Mineral assets -------------------------------------------------------------
alter table public.minerals enable row level security;

create policy minerals_select
  on public.minerals for select to authenticated
  using (public.can_read_customer(assigned_user_id) or public.has_permission('vault.manage'));

alter table public.mineral_policies enable row level security;

create policy mineral_policies_select
  on public.mineral_policies for select to authenticated
  using (
    exists (
      select 1
      from public.minerals m
      where m.id = mineral_policies.mineral_id
        and (public.can_read_customer(m.assigned_user_id) or public.has_permission('vault.manage'))
    )
  );

alter table public.shipment_requests enable row level security;

create policy shipment_requests_select
  on public.shipment_requests for select to authenticated
  using (public.can_read_customer(customer_user_id) or public.has_permission('vault.manage'));

alter table public.shipments enable row level security;

create policy shipments_select
  on public.shipments for select to authenticated
  using (public.can_read_customer(assigned_user_id) or public.has_permission('vault.ship'));

alter table public.shipment_events enable row level security;

create policy shipment_events_select
  on public.shipment_events for select to authenticated
  using (
    exists (
      select 1
      from public.shipments s
      where s.id = shipment_events.shipment_id
        and (public.can_read_customer(s.assigned_user_id) or public.has_permission('vault.ship'))
    )
  );

-- Audit ----------------------------------------------------------------------
alter table public.audit_logs enable row level security;

create policy audit_logs_select
  on public.audit_logs for select to authenticated
  using (public.has_permission('audit.view'));
-- Append-only: rows are written by the SECURITY DEFINER function the migrated
-- mutations call, never by a client.

commit;
