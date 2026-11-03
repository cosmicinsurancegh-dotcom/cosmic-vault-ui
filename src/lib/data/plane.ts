import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Which backend serves a domain.
 *
 * The migration moves one domain at a time, so the app has to be able to run
 * several planes at once. `VITE_DATA_PLANE` is the default for every domain and
 * `VITE_DATA_PLANE_<DOMAIN>` overrides a single one:
 *
 *   VITE_DATA_PLANE=convex                 # today's behaviour, unchanged
 *   VITE_DATA_PLANE_QUOTES=supabase        # quote capture reads/writes Postgres
 *
 * Two rules keep the live site safe:
 *
 *   1. Anything unset is `convex`. A missing or misspelled variable can only
 *      ever keep a domain where it already is, never move it.
 *   2. A domain cannot resolve to `supabase` when the Supabase keys are absent
 *      or unusable. Flipping the flag before the project exists would
 *      otherwise take a dashboard down; instead the domain stays on Convex and
 *      `describeDataPlanes()` reports why.
 */

export type DataPlane = "convex" | "supabase";

/** The domains the migration flips, in the order they move. */
export const DATA_DOMAINS = [
  "quotes",
  "catalogue",
  "identity",
  "policies",
  "applications",
  "claims",
  "payments",
  "documents",
  "tickets",
  "notifications",
  "vault",
  "brokers",
  "staff",
  "reports",
  "settings",
] as const;

export type DataDomain = (typeof DATA_DOMAINS)[number];

/** Env var name that overrides a single domain, e.g. `VITE_DATA_PLANE_VAULT`. */
export function dataPlaneEnvKey(domain: DataDomain) {
  return `VITE_DATA_PLANE_${domain.toUpperCase()}` as const;
}

function parsePlane(value: unknown): DataPlane | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "supabase" || normalized === "convex") return normalized;
  return null;
}

function readEnv(key: string): unknown {
  // `import.meta.env` is replaced at build time; the `process.env` fallback is
  // for the Node scripts and tests that import this module directly.
  const meta = (import.meta as ImportMeta & { env?: Record<string, unknown> })
    .env;
  if (meta && key in meta) return meta[key];
  if (typeof process !== "undefined" && process.env) return process.env[key];
  return undefined;
}

/**
 * Whether the Supabase client can be created at all. Duplicated from
 * `src/lib/supabase.ts` on purpose: importing it here would pull the whole
 * Supabase client into modules that only need to read a flag (including the
 * Node migration scripts).
 */
function supabaseUsable() {
  const url = String(readEnv("VITE_SUPABASE_URL") ?? "").trim();
  const key = String(readEnv("VITE_SUPABASE_ANON_KEY") ?? "").trim();
  return url.startsWith("http") && key.length > 0;
}

/** The plane a domain runs on right now. */
export function dataPlane(domain: DataDomain): DataPlane {
  const override = parsePlane(readEnv(dataPlaneEnvKey(domain)));
  const fallback = parsePlane(readEnv("VITE_DATA_PLANE")) ?? "convex";
  const requested = override ?? fallback;
  if (requested === "supabase" && !supabaseUsable()) return "convex";
  return requested;
}

/** `true` when `domain` is served by Supabase. */
export function usesSupabase(domain: DataDomain) {
  return dataPlane(domain) === "supabase";
}

/**
 * Every domain with the plane it resolves to, plus whether a Supabase override
 * was ignored because the keys are missing - the answer to "I set the flag, why
 * is this page still on Convex?".
 */
export function describeDataPlanes(): Record<
  DataDomain,
  { plane: DataPlane; requested: DataPlane; keysMissing: boolean }
> {
  const usable = supabaseUsable();
  const rows = {} as Record<
    DataDomain,
    { plane: DataPlane; requested: DataPlane; keysMissing: boolean }
  >;
  for (const domain of DATA_DOMAINS) {
    const requested =
      parsePlane(readEnv(dataPlaneEnvKey(domain))) ??
      parsePlane(readEnv("VITE_DATA_PLANE")) ??
      "convex";
    const keysMissing = requested === "supabase" && !usable;
    rows[domain] = {
      plane: keysMissing ? "convex" : requested,
      requested,
      keysMissing,
    };
  }
  return rows;
}

/** Whether any domain is already served by Postgres. */
export function anySupabaseDomain() {
  return DATA_DOMAINS.some((domain) => dataPlane(domain) === "supabase");
}

export type { SupabaseClient };
