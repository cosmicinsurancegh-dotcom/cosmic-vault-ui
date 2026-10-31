#!/usr/bin/env node
/**
 * A digest of every Convex function's argument and return shape, so the site
 * build can tell whether production runs the signatures its bundle was compiled
 * against.
 *
 * The release gate answers two questions with this: does production serve the
 * functions the site calls (by name), and does it validate them the same way?
 * Names alone would let a commit that adds an argument to `tickets.queueSummary`
 * and updates the site to send it publish ahead of the functions - the site's
 * call would then fail validation at runtime, which is the same masked
 * `Server Error` as a missing function.
 *
 * Both sides come from the same representation. A deployed function carries
 * `exportArgs()` and `exportReturns()`, which return the serialized validators
 * that `convex function-spec` reports; this script digests that document, so the
 * deploy side (from the CLI's spec) and the build side (from the source itself)
 * produce the same value for the same shapes. That is what makes a difference
 * meaningful rather than an artifact of two encodings.
 *
 * The source side needs the validators to actually run, so each module is
 * bundled with esbuild and imported. `convex/server` is left external: the
 * constructors it exports are what attach `exportArgs`/`exportReturns`, and they
 * work in plain Node. Bundles are written inside the project's `node_modules`
 * cache and removed again, so bare imports resolve the way they do in the app.
 *
 * Usage:
 *   node scripts/convex-signatures.mjs --spec function-spec.json  # as deployed
 *   node scripts/convex-signatures.mjs --tree                     # as checked out
 *
 * Prints a compact JSON object of `<module>:<function>` to digest.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Repository root, one level above this script's directory. */
const DEFAULT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/**
 * Ten hex characters, not a full digest: the stamp is stored in a deployment
 * environment variable for every function, and 40 bits is far more than enough
 * to tell two shapes of the same function apart.
 */
const DIGEST_LENGTH = 10;

/**
 * JSON with object keys sorted, so a validator that serializes in a different
 * key order still digests to the same value. Array order is kept: it is part of
 * the shape (a union's members, an object's fields).
 */
export function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** The digest of one function's argument and return validators. */
export function signatureDigest({ args, returns }) {
  const shape = { args: args ?? null, returns: returns ?? null };
  return createHash("sha256")
    .update(canonicalJson(shape))
    .digest("hex")
    .slice(0, DIGEST_LENGTH);
}

/** Object keys in a stable order, so two stamps for one tree compare equal. */
function sorted(stamp) {
  const ordered = {};
  for (const key of Object.keys(stamp).sort()) ordered[key] = stamp[key];
  return ordered;
}

/**
 * The stamp a `convex function-spec` document describes - the deployment's own
 * account of what it serves. HTTP routes have a path instead of an identifier
 * and are skipped: no client calls them by name.
 */
export function specSignatures(spec) {
  const entries = Array.isArray(spec) ? spec : spec?.functions;
  if (!Array.isArray(entries)) {
    throw new Error("That is not a convex function spec (no functions list).");
  }
  const stamp = {};
  for (const entry of entries) {
    const identifier = entry?.identifier;
    if (typeof identifier !== "string") continue;
    const separator = identifier.indexOf(":");
    if (separator <= 0) continue;
    const module = identifier.slice(0, separator).replace(/\.js$/, "");
    const fn = identifier.slice(separator + 1);
    if (!module || !fn) continue;
    stamp[`${module}:${fn}`] = signatureDigest({
      args: entry.args,
      returns: entry.returns,
    });
  }
  return sorted(stamp);
}

function isConvexFunction(value) {
  return (
    typeof value === "function" &&
    (value.isQuery === true || value.isMutation === true || value.isAction === true)
  );
}

/**
 * The stamp of the source in this checkout, produced by running its validators.
 * A module that cannot be loaded is a failure, not a skip: an unnoticed gap
 * would silently drop functions from the comparison.
 */
export async function treeSignatures(root = DEFAULT_ROOT) {
  const convexDirectory = path.join(root, "src", "convex");
  const outDirectory = path.join(root, "node_modules", ".cache", "convex-release");
  const modules = (await readdir(convexDirectory))
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".d.ts"))
    .sort();

  const { build } = await import("esbuild");
  const stamp = {};
  await mkdir(outDirectory, { recursive: true });
  try {
    for (const [index, moduleFile] of modules.entries()) {
      const moduleName = moduleFile.replace(/\.ts$/, "");
      const outfile = path.join(outDirectory, `${moduleName}.mjs`);
      await build({
        entryPoints: [path.join(convexDirectory, moduleFile)],
        outfile,
        bundle: true,
        format: "esm",
        platform: "node",
        packages: "external",
        logLevel: "silent",
      });
      // The outfile name is stable, so a repeated capture in one process would
      // otherwise import the first bundle again after the source changed.
      const imported = await import(
        `${pathToFileURL(outfile).href}?capture=${index}-${Date.now()}`
      );
      for (const [fn, exported] of Object.entries(imported)) {
        if (!isConvexFunction(exported)) continue;
        stamp[`${moduleName}:${fn}`] = signatureDigest({
          args: JSON.parse(exported.exportArgs()),
          returns: JSON.parse(exported.exportReturns()),
        });
      }
    }
  } finally {
    await rm(outDirectory, { recursive: true, force: true });
  }
  return sorted(stamp);
}

async function main() {
  const [mode, file] = process.argv.slice(2);
  if (mode === "--tree") {
    process.stdout.write(JSON.stringify(await treeSignatures()));
    return;
  }
  if (mode === "--spec" && file) {
    const spec = JSON.parse(await readFile(file, "utf8"));
    const stamp = specSignatures(spec);
    if (Object.keys(stamp).length === 0) {
      throw new Error(`${file} lists no functions.`);
    }
    process.stdout.write(JSON.stringify(stamp));
    return;
  }
  throw new Error(
    "usage: node scripts/convex-signatures.mjs --spec <function-spec.json> | --tree",
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[release] ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  });
}
