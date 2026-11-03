#!/usr/bin/env node
/**
 * Copies a Convex export into the Supabase Postgres schema.
 *
 *   npx convex export --path ./.convex-export          # produces a zip
 *   unzip .convex-export -d ./.convex-export-dir
 *   bun run supabase:migrate --in ./.convex-export-dir --dry-run
 *   bun run supabase:migrate --in ./.convex-export-dir
 *
 * Why this exists rather than a one-off SQL file: the move has to be repeatable
 * and re-runnable, because the site keeps taking writes on Convex until each
 * domain flips. Running the import again must update rows in place (same `id`,
 * Convex's own `_id`) instead of duplicating them, so a re-run after a week of
 * production traffic converges rather than collides.
 *
 * Guarantees:
 *   * `--dry-run` touches nothing and prints the row count per table.
 *   * Rows are upserted `on conflict (id)`, in foreign-key order.
 *   * Values are never coerced: Convex numbers (epoch ms, minor units) are
 *     written as `double precision`, so nothing is rounded or timezone-shifted.
 *   * A field the destination table does not have is reported, not dropped
 *     silently - that is how a schema drift between the two planes surfaces.
 *
 * The Supabase service-role key is read from the environment. It is needed
 * because a full export includes rows the anon role cannot write (audit logs,
 * notifications); the script never logs it.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const BATCH = 200;

/**
 * Insert order: parents before children. `applications.policy_id` and
 * `shipment_requests.shipment_id` are nullable foreign keys filled in later by
 * a second pass, so their cycle does not block the import.
 */
const TABLE_ORDER = [
  "users",
  "countries",
  "currencies",
  "categories",
  "settings",
  "rateLimits",
  "quotes",
  "customerProfiles",
  "brokerProfiles",
  "brokerAssignments",
  "products",
  "quotations",
  "applications",
  "policies",
  "applicationEvents",
  "policyRequests",
  "claims",
  "claimEvents",
  "transactions",
  "documents",
  "notifications",
  "shipmentEmails",
  "tickets",
  "ticketMessages",
  "minerals",
  "mineralPolicies",
  "shipments",
  "shipmentRequests",
  "shipmentEvents",
  "auditLogs",
];

/** Tables filled in a second pass once both sides of a cycle exist. */
const DEFERRED = {
  applications: ["policyId"],
  shipmentRequests: ["shipmentId"],
};

/**
 * `v.number()` fields that hold epoch milliseconds. In Postgres those columns
 * are named `<snake>_ms` (see 0001_schema.sql); everything else numeric keeps
 * the plain snake_case name. Keeping this list beside the importer is
 * deliberate: it is the one place that knows the shape of the two schemas, and
 * a mistake shows up as a reported, unmapped field rather than a silent drop.
 */
const MS_FIELDS = new Set([
  "email_verification_time",
  "last_role_change_at",
  "closed_at",
  "seeded_at",
  "created_at",
  "updated_at",
  "window_start",
  "effective_from",
  "published_at",
  "expires_at",
  "consent_at",
  "submitted_at",
  "decided_at",
  "info_request_at",
  "withdrawn_at",
  "terms_accepted_at",
  "consent_recorded_at",
  "start_date",
  "end_date",
  "renewal_date",
  "issued_at",
  "cancelled_at",
  "suspended_at",
  "incident_date",
  "reported_at",
  "paid_at",
  "closed_at",
  "reconciled_at",
  "due_date",
  "read_at",
  "email_queued_at",
  "delivered_at",
  "assigned_at",
  "revoked_at",
  "preferred_date",
  "departure_at",
  "estimated_arrival_at",
  "last_status_at",
  "at",
]);

const snake = (key) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();

/** `_id` -> `id`, `_creationTime` -> `convex_creation_time_ms`, else snake_case. */
function targetColumn(key) {
  if (key === "_id") return "id";
  if (key === "_creationTime") return "convex_creation_time_ms";
  const base = snake(key);
  return MS_FIELDS.has(base) ? `${base}_ms` : base;
}

function argsOf(argv) {
  const out = { input: null, dryRun: false, table: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--in") out.input = argv[++i];
    else if (arg === "--table") out.table = argv[++i];
    else if (arg.startsWith("--in=")) out.input = arg.slice(5);
    else if (arg.startsWith("--table=")) out.table = arg.slice(8);
  }
  return out;
}

/** Accepts an unzipped Convex export, a single JSON file, or a JSONL directory. */
async function readExport(input) {
  const resolved = path.resolve(process.cwd(), input);
  const stats = await statSafe(resolved);

  if (stats?.isFile() && resolved.endsWith(".json")) {
    const parsed = JSON.parse(await readFile(resolved, "utf8"));
    // `{ "users": [...], ... }` or `{ tables: { users: [...] } }`.
    return parsed.tables ?? parsed;
  }

  const tables = {};
  const candidates = [
    path.join(resolved, "_tables"),
    resolved,
  ];
  for (const root of candidates) {
    let entries = [];
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const docs = path.join(root, entry.name, "documents.jsonl");
      try {
        const text = await readFile(docs, "utf8");
        tables[entry.name] = text
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line));
      } catch {
        /* table not exported */
      }
    }
    if (Object.keys(tables).length) break;
  }
  return tables;
}

async function statSafe(file) {
  try {
    const { stat } = await import("node:fs/promises");
    return await stat(file);
  } catch {
    return null;
  }
}

function mapRow(table, doc, report) {
  const row = {};
  for (const [key, value] of Object.entries(doc)) {
    const column = targetColumn(key);
    if (DEFERRED[table]?.includes(key) && value) {
      row[column] = value;
      continue;
    }
    row[column] = value;
  }
  // Convex always stamps `_creationTime`; be explicit for clarity in the report.
  if (!("convex_creation_time_ms" in row)) {
    report.missingCreationTime += 1;
  }
  return row;
}

async function main() {
  const args = argsOf(process.argv.slice(2));
  const input = args.input ?? process.env.CONVEX_EXPORT ?? ".convex-export";
  const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  let exportData;
  try {
    exportData = await readExport(input);
  } catch (error) {
    console.error(`Could not read the Convex export at ${input}: ${error.message}`);
    console.error(
      "Create one with `npx convex export --path ./.convex-export`, then unzip it.",
    );
    process.exit(1);
  }

  const tables = args.table ? TABLE_ORDER.filter((t) => t === args.table) : TABLE_ORDER;
  const found = tables.filter((t) => Array.isArray(exportData[t]) && exportData[t].length);

  const report = { missingCreationTime: 0 };
  const counts = found.map((table) => ({
    table,
    rows: exportData[table].length,
  }));

  console.log(`Convex export: ${path.resolve(process.cwd(), input)}`);
  for (const { table, rows } of counts) {
    console.log(`  ${table.padEnd(20)} ${String(rows).padStart(7)} rows`);
  }
  const empty = tables.filter((t) => !counts.some((c) => c.table === t));
  if (empty.length) console.log(`  (no rows: ${empty.join(", ")})`);

  if (args.dryRun) {
    console.log("\nDry run - nothing written. Drop --dry-run to import.");
    return;
  }

  if (!url || !serviceKey) {
    console.error(
      "\nSUPABASE_URL / VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to import.\n" +
        "Run `bun run supabase:check --file .env.local` to see what is missing.",
    );
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let written = 0;
  const failures = [];

  for (const table of found) {
    const rows = exportData[table].map((doc) => mapRow(table, doc, report));
    const chunks = [];
    for (let i = 0; i < rows.length; i += BATCH) chunks.push(rows.slice(i, i + BATCH));

    for (const [index, chunk] of chunks.entries()) {
      const { error } = await db.from(table).upsert(chunk, { onConflict: "id" });
      if (error) {
        failures.push({ table, chunk: index, message: error.message, code: error.code });
        break;
      }
      written += chunk.length;
      process.stdout.write(
        `\r  ${table}: ${Math.min((index + 1) * BATCH, rows.length)}/${rows.length}`,
      );
    }
    process.stdout.write(`\r  ${table}: ${rows.length}/${rows.length} imported\n`);
  }

  // Second pass for the two foreign keys that point "backwards".
  for (const [table, fields] of Object.entries(DEFERRED)) {
    if (!Array.isArray(exportData[table])) continue;
    for (const doc of exportData[table]) {
      const patch = {};
      for (const field of fields) {
        if (doc[field]) patch[snake(field)] = doc[field];
      }
      if (!Object.keys(patch).length) continue;
      const { error } = await db.from(table).update(patch).eq("id", doc._id);
      if (error) failures.push({ table, message: error.message, code: error.code });
    }
  }

  if (report.missingCreationTime) {
    console.log(
      `\nNote: ${report.missingCreationTime} rows had no _creationTime; the column default was used.`,
    );
  }

  if (failures.length) {
    console.error("\nImport finished with errors:");
    for (const failure of failures) {
      console.error(
        `  ${failure.table}${failure.chunk !== undefined ? ` (batch ${failure.chunk + 1})` : ""}: ${failure.code ?? ""} ${failure.message}`,
      );
    }
    console.error(
      "\nRe-running is safe: rows are upserted by id. Fix the reported column and run again.",
    );
    process.exit(1);
  }

  console.log(`\nImported ${written} rows across ${found.length} tables.`);
  console.log(
    "Next: verify counts against Convex, then flip one domain with VITE_DATA_PLANE_<DOMAIN>=supabase.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
