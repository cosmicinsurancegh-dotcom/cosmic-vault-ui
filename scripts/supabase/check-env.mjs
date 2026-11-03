#!/usr/bin/env node
/**
 * Reports whether the Supabase environment is complete enough to migrate.
 *
 * Run it before `db push` and before flipping any `VITE_DATA_PLANE_*` flag:
 *
 *   bun run supabase:check
 *   bun run supabase:check --file .env.local
 *   bun run supabase:check --json
 *
 * It exits 0 only when every required key is present and well formed, so a
 * deploy pipeline can gate on it. It never prints a key's value - only whether
 * it exists, whether it looks like the right kind of key, and the variable it
 * belongs in. That matters because this runs in CI logs.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const REQUIRED = [
  {
    key: "VITE_SUPABASE_URL",
    scope: "browser",
    check: (v) => /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(v),
    expect: "https://<project-ref>.supabase.co",
  },
  {
    key: "VITE_SUPABASE_ANON_KEY",
    scope: "browser",
    check: (v) => v.split(".").length === 3 || v.startsWith("sb_publishable_"),
    expect: "the anon/publishable key from Project Settings -> API",
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    scope: "server only",
    check: (v) => v.split(".").length === 3 || v.startsWith("sb_secret_"),
    expect: "the service_role key - server only, never in the bundle",
  },
  {
    key: "SUPABASE_DB_URL",
    scope: "server only",
    check: (v) => /^postgres(ql)?:\/\//.test(v),
    expect: "postgresql://... (Project Settings -> Database -> Connection string)",
  },
];

/** Minimal `.env` parser: `KEY=value`, optional quotes, `#` comments. */
function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[line.slice(0, eq).trim()] = value;
  }
  return out;
}

function mask(value) {
  if (!value) return "(unset)";
  return `set (${value.length} chars)`;
}

const args = process.argv.slice(2);
const json = args.includes("--json");
const fileFlag = args.indexOf("--file");
const envFile = fileFlag >= 0 ? args[fileFlag + 1] : null;

let fileValues = {};
let filePath = null;
if (envFile) {
  filePath = path.resolve(process.cwd(), envFile);
  try {
    fileValues = parseEnv(await readFile(filePath, "utf8"));
  } catch (error) {
    console.error(`Could not read ${envFile}: ${error.message}`);
    process.exit(1);
  }
}

const results = REQUIRED.map((requirement) => {
  const value = String(
    fileValues[requirement.key] ?? process.env[requirement.key] ?? "",
  ).trim();
  const present = value.length > 0;
  const valid = present && requirement.check(value);
  return {
    key: requirement.key,
    scope: requirement.scope,
    status: !present ? "missing" : valid ? "ok" : "malformed",
    value: mask(value),
    expect: requirement.expect,
  };
});

const optional = [
  "SUPABASE_PROJECT_REF",
  "SUPABASE_ACCESS_TOKEN",
  "VITE_DATA_PLANE",
  ...["QUOTES", "CATALOGUE", "IDENTITY", "POLICIES", "APPLICATIONS"].map(
    (d) => `VITE_DATA_PLANE_${d}`,
  ),
].map((key) => ({
  key,
  status: String(fileValues[key] ?? process.env[key] ?? "").trim()
    ? "ok"
    : "unset",
}));

const failures = results.filter((row) => row.status !== "ok");

if (json) {
  console.log(JSON.stringify({ required: results, optional }, null, 2));
} else {
  console.log(
    `Supabase environment${filePath ? ` (${path.relative(process.cwd(), filePath)})` : ""}\n`,
  );
  for (const row of results) {
    const mark = row.status === "ok" ? "OK  " : row.status === "missing" ? "MISS" : "BAD ";
    console.log(`  ${mark} ${row.key.padEnd(28)} ${row.scope.padEnd(12)} ${row.value}`);
    if (row.status !== "ok") console.log(`       expected ${row.expect}`);
  }
  console.log("\nOptional:");
  for (const row of optional) {
    console.log(`  ${row.status === "ok" ? "OK  " : "--  "} ${row.key}`);
  }
}

if (failures.length) {
  console.error(
    `\n${failures.length} required variable${failures.length === 1 ? "" : "s"} missing or malformed. ` +
      "Add them to .env.local (gitignored) and to the Vercel project's environment variables. " +
      "The service-role and database URLs are server-side only: never prefix them with VITE_.",
  );
  process.exit(1);
}

console.log("\nAll required Supabase variables are set.");
