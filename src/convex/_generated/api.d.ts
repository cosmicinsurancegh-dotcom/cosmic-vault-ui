/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountSecurity from "../accountSecurity.js";
import type * as adminGate from "../adminGate.js";
import type * as applications from "../applications.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as brokers from "../brokers.js";
import type * as claims from "../claims.js";
import type * as crons from "../crons.js";
import type * as customers from "../customers.js";
import type * as demoSeed from "../demoSeed.js";
import type * as documents from "../documents.js";
import type * as email from "../email.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_account from "../lib/account.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_delivery from "../lib/delivery.js";
import type * as lib_files from "../lib/files.js";
import type * as lib_invite from "../lib/invite.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_people from "../lib/people.js";
import type * as lib_policyDocuments from "../lib/policyDocuments.js";
import type * as lib_pricing from "../lib/pricing.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_refs from "../lib/refs.js";
import type * as lib_sender from "../lib/sender.js";
import type * as lib_settings from "../lib/settings.js";
import type * as lib_shipmentEmail from "../lib/shipmentEmail.js";
import type * as lib_shipments from "../lib/shipments.js";
import type * as lib_vly from "../lib/vly.js";
import type * as maintenance from "../maintenance.js";
import type * as minerals from "../minerals.js";
import type * as notifications from "../notifications.js";
import type * as payments from "../payments.js";
import type * as policies from "../policies.js";
import type * as products from "../products.js";
import type * as quotations from "../quotations.js";
import type * as quotes from "../quotes.js";
import type * as reports from "../reports.js";
import type * as settings from "../settings.js";
import type * as setup from "../setup.js";
import type * as shipmentEmailDelivery from "../shipmentEmailDelivery.js";
import type * as shipmentEmails from "../shipmentEmails.js";
import type * as staff from "../staff.js";
import type * as supabase from "../supabase.js";
import type * as tickets from "../tickets.js";
import type * as users from "../users.js";
import type * as vault_shipmentEmail from "../vault/shipmentEmail.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountSecurity: typeof accountSecurity;
  adminGate: typeof adminGate;
  applications: typeof applications;
  audit: typeof audit;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  brokers: typeof brokers;
  claims: typeof claims;
  crons: typeof crons;
  customers: typeof customers;
  demoSeed: typeof demoSeed;
  documents: typeof documents;
  email: typeof email;
  http: typeof http;
  "lib/access": typeof lib_access;
  "lib/account": typeof lib_account;
  "lib/audit": typeof lib_audit;
  "lib/authz": typeof lib_authz;
  "lib/delivery": typeof lib_delivery;
  "lib/files": typeof lib_files;
  "lib/invite": typeof lib_invite;
  "lib/notify": typeof lib_notify;
  "lib/people": typeof lib_people;
  "lib/policyDocuments": typeof lib_policyDocuments;
  "lib/pricing": typeof lib_pricing;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/refs": typeof lib_refs;
  "lib/sender": typeof lib_sender;
  "lib/settings": typeof lib_settings;
  "lib/shipmentEmail": typeof lib_shipmentEmail;
  "lib/shipments": typeof lib_shipments;
  "lib/vly": typeof lib_vly;
  maintenance: typeof maintenance;
  minerals: typeof minerals;
  notifications: typeof notifications;
  payments: typeof payments;
  policies: typeof policies;
  products: typeof products;
  quotations: typeof quotations;
  quotes: typeof quotes;
  reports: typeof reports;
  settings: typeof settings;
  setup: typeof setup;
  shipmentEmailDelivery: typeof shipmentEmailDelivery;
  shipmentEmails: typeof shipmentEmails;
  staff: typeof staff;
  supabase: typeof supabase;
  tickets: typeof tickets;
  users: typeof users;
  "vault/shipmentEmail": typeof vault_shipmentEmail;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
