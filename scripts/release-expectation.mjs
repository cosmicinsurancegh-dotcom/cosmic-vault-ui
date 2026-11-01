#!/usr/bin/env node
/**
 * The functions this checkout's site calls, each with the digest of the
 * argument and return validators it has here.
 *
 * One capture, two uses. `scripts/check-backend-release.mjs` compares it with
 * what production serves and refuses to publish a bundle that would fail; and
 * `vite.config.ts` compiles it into that bundle, so the running site can make
 * the same comparison against whatever deployment it is talking to and name the
 * skew in the dashboard. Sharing the capture is what keeps the promise in the
 * banner and the promise in the gate from being two different promises.
 *
 * Only functions the site's source names are included - the same rule the gate
 * uses, for the same reason: a change to a function nothing calls is a backend
 * release, not a frontend one.
 *
 * Usage:
 *   node scripts/release-expectation.mjs   # prints the capture as JSON
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { siteFunctionRefs } from "./check-backend-release.mjs";
import { treeSignatures } from "./convex-signatures.mjs";

/** Repository root, one level above this script's directory. */
const DEFAULT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/**
 * `{ called, dynamic }`: the digests this build needs, and the files that index
 * the api object instead of naming a function - which would make the list
 * incomplete, so a caller that must be certain can refuse.
 */
export async function releaseExpectation(root = DEFAULT_ROOT) {
  const { refs, dynamic } = await siteFunctionRefs(root);
  const signatures = await treeSignatures(root);
  const called = {};
  const unread = [];
  for (const name of refs) {
    if (typeof signatures[name] === "string") called[name] = signatures[name];
    else unread.push(name);
  }
  if (unread.length > 0) {
    // Every name comes from the source scan and the capture reads every module,
    // so this means one of the two is looking somewhere the other is not.
    throw new Error(
      `No signature was captured for ${unread.join(", ")}, though the site calls ${unread.length === 1 ? "it" : "them"}.`,
    );
  }
  return { called, dynamic };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { called, dynamic } = await releaseExpectation();
    if (dynamic.length > 0) {
      console.error(
        `[release] The site indexes the api object in ${dynamic.join(", ")}, so this capture cannot list every function it calls.`,
      );
    }
    process.stdout.write(`${JSON.stringify(called)}\n`);
  } catch (error) {
    console.error(`[release] ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
