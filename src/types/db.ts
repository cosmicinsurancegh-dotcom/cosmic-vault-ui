/**
 * Types for the Supabase schema in `supabase/migrations/0001_schema.sql`.
 *
 * Hand-written rather than generated because the generated file needs a live
 * project (`supabase gen types typescript`). The migration is the source of
 * truth; when a migration changes a column, change it here too. Once a hosted
 * project exists, regenerating replaces this file without touching any caller:
 *
 *   supabase gen types typescript --project-id <ref> > src/types/db.ts
 *
 * Notable shapes:
 *   * `id` is `text` and keeps Convex's `_id` values, so ids already held by the
 *     frontend (`Id<"users">`) stay valid across the move.
 *   * `convex_creation_time_ms` mirrors Convex's `_creationTime`.
 *   * `<field>_ms` columns are epoch milliseconds, exactly as Convex stored
 *     them. `updated_at` is Postgres row bookkeeping and is a real timestamp.
 *   * `Insert`/`Update` are `Partial<Row>`: the database fills ids, defaults and
 *     timestamps, and every write path in the app goes through an RPC anyway.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Bookkeeping = {
  id: string;
  convex_creation_time_ms: number;
  updated_at: string;
};

/** Provenance columns stamped by the protected demo seed. */
type DemoFields = {
  is_demo: boolean;
  seed_batch: string | null;
  seeded_at_ms: number | null;
  demo_key: string | null;
};

export type Role =
  | "super_admin"
  | "admin"
  | "customer"
  | "broker"
  | "user"
  | "member";
export type AccountStatus = "active" | "suspended" | "closed";
export type VerificationStatus = "unverified" | "pending" | "verified";
export type ProductStatus = "draft" | "published" | "archived";
export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "additional_info_required"
  | "approved"
  | "declined"
  | "withdrawn";
export type PolicyStatus =
  | "draft"
  | "pending_approval"
  | "active"
  | "renewal_pending"
  | "expired"
  | "cancelled"
  | "suspended";
export type ClaimStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "additional_info_required"
  | "under_assessment"
  | "approved"
  | "partially_approved"
  | "declined"
  | "payment_pending"
  | "paid"
  | "closed";
export type TransactionStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "refunded"
  | "disputed";
export type TransactionType = "premium" | "refund" | "settlement" | "adjustment";
export type RequestStatus = "pending" | "approved" | "declined";
export type EmailStatus = "queued" | "sent" | "skipped" | "failed";
export type TicketStatus = "open" | "awaiting_customer" | "resolved" | "closed";
export type MineralStatus = "active" | "archived";
export type MineralCoverage =
  | "all_risk"
  | "cargo_transit"
  | "storage"
  | "liability";
export type MineralPolicyStatus = "draft" | "active" | "expired" | "cancelled";
export type ShipmentStatus =
  | "preparing"
  | "in_transit"
  | "customs_hold"
  | "out_for_delivery"
  | "delivered"
  | "delayed"
  | "cancelled";
export type Coverage = "health" | "home" | "auto" | "life";
export type QuoteStatus = "in_review" | "quoted" | "active";

export type UsersRow = Bookkeeping &
  DemoFields & {
    auth_user_id: string | null;
    name: string | null;
    image: string | null;
    email: string | null;
    email_verification_time_ms: number | null;
    is_anonymous: boolean;
    role: Role | null;
    permissions: string[];
    status: AccountStatus;
    suspended_reason: string | null;
    last_role_change_at_ms: number | null;
    closed_at_ms: number | null;
  };

export type QuotesRow = Bookkeeping & {
  user_id: string | null;
  reference: string;
  name: string;
  email: string;
  coverage: Coverage;
  plan: string | null;
  message: string | null;
  status: QuoteStatus;
  monthly_estimate: number | null;
};

export type RateLimitsRow = Bookkeeping & {
  key: string;
  window_start_ms: number;
  count: number;
};

export type CountriesRow = Bookkeeping & {
  code: string;
  name: string;
  currency: string;
  region: string;
  dial_code: string | null;
  active: boolean;
};

export type CurrenciesRow = Bookkeeping & {
  code: string;
  name: string;
  symbol: string;
  minor_units: number;
  active: boolean;
};

export type CategoriesRow = Bookkeeping & {
  key: string;
  name: string;
  description: string;
  sort_order: number;
  active: boolean;
};

export type SettingsRow = Bookkeeping & {
  key: string;
  company_name: string;
  support_email: string;
  email_from_address: string | null;
  default_currency: string;
  commission_enabled: boolean;
  renewal_notice_days: number;
  claim_sla_days: number;
  support_response_hours: number | null;
  premium_payment_term_days: number | null;
  bank_account_name: string | null;
  bank_iban: string | null;
  bank_sort_code: string | null;
  bank_swift: string | null;
  allowed_currencies: string[];
  email_templates: Json;
  updated_at_ms: number;
  updated_by: string | null;
};

export type CustomerProfilesRow = Bookkeeping &
  DemoFields & {
    user_id: string;
    reference: string;
    full_name: string;
    email: string;
    phone: string | null;
    date_of_birth: string | null;
    country: string;
    city: string | null;
    address_line: string | null;
    postal_code: string | null;
    currency: string;
    locale: string;
    timezone: string;
    preferred_language: string;
    marketing_opt_in: boolean;
    verification_status: VerificationStatus;
    notes: string | null;
    created_at_ms: number;
    updated_at_ms: number;
  };

export type BrokerProfilesRow = Bookkeeping &
  DemoFields & {
    user_id: string;
    reference: string;
    org_name: string;
    contact_name: string;
    email: string;
    phone: string | null;
    countries: string[];
    status: "active" | "suspended";
    agreement_ref: string | null;
    commission_enabled: boolean;
    commission_rate: number;
    created_at_ms: number;
    updated_at_ms: number;
  };

export type BrokerAssignmentsRow = Bookkeeping &
  DemoFields & {
    broker_user_id: string;
    customer_user_id: string;
    status: "active" | "revoked";
    assigned_by: string;
    note: string | null;
    created_at_ms: number;
    revoked_at_ms: number | null;
  };

export type ProductsRow = Bookkeeping &
  DemoFields & {
    code: string;
    name: string;
    category_key: string;
    description: string;
    target_customer: string;
    countries: string[];
    currency: string;
    base_premium: number;
    term_months: number;
    excess: number;
    coverage_limit: number;
    exclusions: string[];
    benefits: string[];
    rating_factors: Json;
    questions: Json;
    required_documents: Json;
    wording_version: string;
    wording: string;
    disclosures: string;
    status: ProductStatus;
    version: number;
    effective_from_ms: number;
    renewal_notice_days: number;
    cancellation_notice_days: number;
    created_by: string | null;
    published_by: string | null;
    published_at_ms: number | null;
    created_at_ms: number;
    updated_at_ms: number;
  };

export type QuotationsRow = Bookkeeping & {
  reference: string;
  customer_user_id: string;
  broker_user_id: string | null;
  product_id: string;
  product_code: string;
  product_version: number;
  product_name: string;
  country: string;
  currency: string;
  answers: Json;
  premium: number;
  breakdown: Json;
  status: "quoted" | "accepted" | "expired" | "withdrawn";
  expires_at_ms: number;
  created_by: string;
  consent_at_ms: number | null;
  created_at_ms: number;
};

export type ApplicationsRow = Bookkeeping &
  DemoFields & {
    reference: string;
    quotation_id: string | null;
    customer_user_id: string;
    broker_user_id: string | null;
    product_id: string;
    product_code: string;
    product_version: number;
    product_name: string;
    category_key: string;
    country: string;
    currency: string;
    premium: number;
    answers: Json;
    status: ApplicationStatus;
    submitted_at_ms: number | null;
    assigned_to: string | null;
    decision: "approved" | "declined" | null;
    decision_reason: string | null;
    decided_by: string | null;
    decided_at_ms: number | null;
    info_request: string | null;
    info_request_at_ms: number | null;
    customer_response: string | null;
    withdrawn_at_ms: number | null;
    terms_accepted_at_ms: number | null;
    consent_recorded_at_ms: number | null;
    documents: Json;
    policy_id: string | null;
    created_at_ms: number;
    updated_at_ms: number;
  };

export type ApplicationEventsRow = Bookkeeping &
  DemoFields & {
    application_id: string;
    actor_id: string;
    actor_role: string;
    kind:
      | "status"
      | "note"
      | "decision"
      | "info_request"
      | "document"
      | "assignment";
    message: string;
    from_status: string | null;
    to_status: string | null;
    internal: boolean;
    created_at_ms: number;
  };

export type PoliciesRow = Bookkeeping &
  DemoFields & {
    policy_number: string;
    customer_user_id: string;
    broker_user_id: string | null;
    application_id: string;
    product_id: string;
    product_code: string;
    product_version: number;
    product_name: string;
    category_key: string;
    status: PolicyStatus;
    insured_name: string;
    country: string;
    currency: string;
    premium: number;
    excess: number;
    coverage_limit: number;
    exclusions: string[];
    benefits: string[];
    wording_version: string;
    start_date_ms: number;
    end_date_ms: number;
    renewal_date_ms: number;
    issued_by: string;
    issued_at_ms: number;
    cancelled_at_ms: number | null;
    cancel_reason: string | null;
    suspended_at_ms: number | null;
    suspension_reason: string | null;
    endorsements: Json;
    created_at_ms: number;
    updated_at_ms: number;
  };

export type PolicyRequestsRow = Bookkeeping & {
  policy_id: string;
  customer_user_id: string;
  kind: "endorsement" | "cancellation" | "renewal" | "suspension";
  details: string;
  status: RequestStatus;
  requested_by: string;
  decided_by: string | null;
  decision_note: string | null;
  decided_at_ms: number | null;
  created_at_ms: number;
};

export type ClaimsRow = Bookkeeping &
  DemoFields & {
    reference: string;
    policy_id: string;
    customer_user_id: string;
    product_id: string;
    product_name: string;
    country: string;
    currency: string;
    incident_date_ms: number;
    location: string;
    description: string;
    amount_claimed: number;
    status: ClaimStatus;
    assigned_to: string | null;
    decision: "approved" | "partially_approved" | "declined" | null;
    approved_amount: number | null;
    decision_reason: string | null;
    decided_by: string | null;
    decided_at_ms: number | null;
    info_request: string | null;
    info_request_at_ms: number | null;
    customer_response: string | null;
    settlement_ref: string | null;
    paid_at_ms: number | null;
    closed_at_ms: number | null;
    closure_reason: string | null;
    dispute_message: string | null;
    documents: Json;
    reported_at_ms: number;
    created_at_ms: number;
    updated_at_ms: number;
  };

export type ClaimEventsRow = Bookkeeping &
  DemoFields & {
    claim_id: string;
    actor_id: string;
    actor_role: string;
    kind:
      | "status"
      | "note"
      | "decision"
      | "info_request"
      | "document"
      | "settlement";
    message: string;
    from_status: string | null;
    to_status: string | null;
    internal: boolean;
    created_at_ms: number;
  };

export type TransactionsRow = Bookkeeping &
  DemoFields & {
    reference: string;
    customer_user_id: string;
    policy_id: string | null;
    application_id: string | null;
    claim_id: string | null;
    type: TransactionType;
    amount: number;
    currency: string;
    status: TransactionStatus;
    method: "bank_transfer" | "card" | "manual";
    provider_ref: string | null;
    provider_verified: boolean;
    idempotency_key: string | null;
    note: string | null;
    recorded_by: string | null;
    reconciled: boolean;
    reconciled_by: string | null;
    reconciled_at_ms: number | null;
    failure_reason: string | null;
    refund_of: string | null;
    due_date_ms: number | null;
    created_at_ms: number;
    updated_at_ms: number;
  };

export type DocumentsRow = Bookkeeping &
  DemoFields & {
    owner_user_id: string;
    name: string;
    category:
      | "policy"
      | "invoice"
      | "receipt"
      | "claim"
      | "endorsement"
      | "application"
      | "other";
    policy_id: string | null;
    claim_id: string | null;
    application_id: string | null;
    storage_id: string | null;
    body: string | null;
    content_type: string;
    size: number | null;
    version: number;
    issued_by: string | null;
    issued_at_ms: number;
    created_at_ms: number;
  };

export type NotificationsRow = Bookkeeping &
  DemoFields & {
    user_id: string;
    type: string;
    title: string;
    body: string;
    href: string | null;
    related_type: string | null;
    related_id: string | null;
    dedupe_key: string;
    read_at_ms: number | null;
    email_status: EmailStatus;
    email_attempts: number;
    email_error: string | null;
    email_subject: string | null;
    email_text: string | null;
    email_html: string | null;
    email_queued_at_ms: number | null;
    created_at_ms: number;
  };

export type ShipmentEmailsRow = Bookkeeping &
  DemoFields & {
    tracking_number: string;
    mineral_name: string;
    owner_name: string;
    owner_email: string;
    shipment_status: string;
    subject: string;
    html: string;
    text: string;
    delivery_status: EmailStatus;
    attempts: number;
    error: string | null;
    sent_by: string | null;
    created_at_ms: number;
    delivered_at_ms: number | null;
  };

export type TicketsRow = Bookkeeping & {
  reference: string;
  user_id: string;
  category: string;
  subject: string;
  message: string;
  status: TicketStatus;
  priority: "low" | "normal" | "high";
  related_type: string | null;
  related_id: string | null;
  assigned_to: string | null;
  created_at_ms: number;
  updated_at_ms: number;
};

export type TicketMessagesRow = Bookkeeping & {
  ticket_id: string;
  author_id: string;
  author_role: string;
  body: string;
  internal: boolean;
  created_at_ms: number;
};

export type MineralsRow = Bookkeeping &
  DemoFields & {
    reference: string;
    name: string;
    category: string;
    description: string | null;
    quantity: number;
    unit: string;
    declared_value: number;
    currency: string;
    status: MineralStatus;
    assigned_user_id: string | null;
    assigned_at_ms: number | null;
    assigned_by: string | null;
    created_by: string;
    created_at_ms: number;
    updated_at_ms: number;
  };

export type MineralPoliciesRow = Bookkeeping &
  DemoFields & {
    mineral_id: string;
    policy_number: string;
    provider: string;
    coverage: MineralCoverage;
    coverage_limit: number;
    premium: number;
    currency: string;
    start_date_ms: number;
    end_date_ms: number;
    status: MineralPolicyStatus;
    notes: string | null;
    policy_id: string | null;
    created_by: string;
    created_at_ms: number;
    updated_at_ms: number;
  };

export type ShipmentRequestsRow = Bookkeeping &
  DemoFields & {
    mineral_id: string;
    customer_user_id: string;
    destination: string;
    preferred_date_ms: number | null;
    notes: string | null;
    status: RequestStatus;
    shipment_id: string | null;
    decided_by: string | null;
    decision_note: string | null;
    decided_at_ms: number | null;
    created_at_ms: number;
    updated_at_ms: number;
  };

export type ShipmentsRow = Bookkeeping &
  DemoFields & {
    mineral_id: string;
    reference: string;
    carrier: string;
    tracking_number: string | null;
    origin: string;
    destination: string;
    departure_at_ms: number | null;
    estimated_arrival_at_ms: number | null;
    status: ShipmentStatus;
    current_location: string | null;
    notes: string | null;
    assigned_user_id: string | null;
    created_by: string;
    updated_by: string | null;
    last_status_at_ms: number;
    created_at_ms: number;
    updated_at_ms: number;
  };

export type ShipmentEventsRow = Bookkeeping &
  DemoFields & {
    shipment_id: string;
    mineral_id: string;
    status: ShipmentStatus;
    from_status: ShipmentStatus | null;
    location: string | null;
    note: string | null;
    actor_id: string;
    actor_role: string;
    created_at_ms: number;
  };

export type AuditLogsRow = Bookkeeping &
  DemoFields & {
    actor_id: string;
    actor_role: string;
    action: string;
    entity_type: string;
    entity_id: string;
    before: Json | null;
    after: Json | null;
    reason: string | null;
    request_id: string | null;
    at_ms: number;
  };

type TableDef<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      users: TableDef<UsersRow>;
      quotes: TableDef<QuotesRow>;
      rate_limits: TableDef<RateLimitsRow>;
      countries: TableDef<CountriesRow>;
      currencies: TableDef<CurrenciesRow>;
      categories: TableDef<CategoriesRow>;
      settings: TableDef<SettingsRow>;
      customer_profiles: TableDef<CustomerProfilesRow>;
      broker_profiles: TableDef<BrokerProfilesRow>;
      broker_assignments: TableDef<BrokerAssignmentsRow>;
      products: TableDef<ProductsRow>;
      quotations: TableDef<QuotationsRow>;
      applications: TableDef<ApplicationsRow>;
      application_events: TableDef<ApplicationEventsRow>;
      policies: TableDef<PoliciesRow>;
      policy_requests: TableDef<PolicyRequestsRow>;
      claims: TableDef<ClaimsRow>;
      claim_events: TableDef<ClaimEventsRow>;
      transactions: TableDef<TransactionsRow>;
      documents: TableDef<DocumentsRow>;
      notifications: TableDef<NotificationsRow>;
      shipment_emails: TableDef<ShipmentEmailsRow>;
      tickets: TableDef<TicketsRow>;
      ticket_messages: TableDef<TicketMessagesRow>;
      minerals: TableDef<MineralsRow>;
      mineral_policies: TableDef<MineralPoliciesRow>;
      shipment_requests: TableDef<ShipmentRequestsRow>;
      shipments: TableDef<ShipmentsRow>;
      shipment_events: TableDef<ShipmentEventsRow>;
      audit_logs: TableDef<AuditLogsRow>;
    };
    Views: {
      app_users: { Row: UsersRow; Relationships: [] };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
