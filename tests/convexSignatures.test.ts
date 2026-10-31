import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  canonicalJson,
  signatureDigest,
  specSignatures,
  treeSignatures,
} from "../scripts/convex-signatures.mjs";

/**
 * The gate compares functions by name and by the shape they validate, so these
 * digests have to mean the same thing computed two ways: from a deployment's
 * `convex function-spec` and from the source in the checkout. The last test is
 * the pair that proves it - the same function, captured from source and read
 * from a spec, digests identically.
 */

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const temporaryDirectories: string[] = [];

/**
 * A one-module `src/convex` tree inside the project, so a capture can resolve
 * `convex/server` and `convex/values` the way the real modules do.
 */
async function convexModule(source: string) {
  const root = await mkdtemp(
    path.join(projectRoot, "node_modules", ".cache", "signatures-"),
  );
  temporaryDirectories.push(root);
  await mkdir(path.join(root, "src", "convex"), { recursive: true });
  await writeFile(path.join(root, "src", "convex", "sample.ts"), source);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const SAMPLE_MODULE = `
import { queryGeneric } from "convex/server";
import { v } from "convex/values";

export const item = queryGeneric({
  args: { id: v.string(), limit: v.optional(v.number()) },
  returns: v.object({ ok: v.boolean() }),
  handler: async () => ({ ok: true }),
});
`;

/** What `convex function-spec` reports for SAMPLE_MODULE's one function. */
const SAMPLE_SPEC = {
  functions: [
    {
      identifier: "sample.js:item",
      functionType: "Query",
      args: {
        type: "object",
        value: {
          id: { fieldType: { type: "string" }, optional: false },
          limit: { fieldType: { type: "number" }, optional: true },
        },
      },
      returns: {
        type: "object",
        value: { ok: { fieldType: { type: "boolean" }, optional: false } },
      },
    },
  ],
};

describe("canonicalJson", () => {
  it("does not depend on key order", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(
      canonicalJson({ a: { c: 3, d: 2 }, b: 1 }),
    );
  });

  it("keeps array order, which is part of a shape", () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  it("writes null for a missing value", () => {
    expect(canonicalJson(undefined)).toBe("null");
    expect(canonicalJson({ args: null })).toBe('{"args":null}');
  });
});

describe("signatureDigest", () => {
  const args = { type: "object", value: { id: { type: "string" } } };
  const returns = null;

  it("is stable for the same shape written in another key order", () => {
    expect(signatureDigest({ args, returns })).toBe(
      signatureDigest({ args: { value: { id: { type: "string" } }, type: "object" }, returns }),
    );
  });

  it("changes when an argument or a result changes", () => {
    const base = signatureDigest({ args, returns });
    expect(
      signatureDigest({ args: { type: "object", value: { id: { type: "number" } } }, returns }),
    ).not.toBe(base);
    expect(signatureDigest({ args, returns: { type: "boolean" } })).not.toBe(base);
  });

  it("is short enough to publish for every function", () => {
    expect(signatureDigest({ args, returns })).toMatch(/^[0-9a-f]{10}$/);
  });
});

describe("specSignatures", () => {
  it("reads a spec document the way the deployment reports it", () => {
    expect(specSignatures(SAMPLE_SPEC)).toEqual({
      "sample:item": signatureDigest({
        args: SAMPLE_SPEC.functions[0].args,
        returns: SAMPLE_SPEC.functions[0].returns,
      }),
    });
  });

  it("skips HTTP routes, which have a path instead of a name", () => {
    expect(
      Object.keys(
        specSignatures({
          functions: [
            { functionType: "HttpAction", method: "GET", path: "/.well-known/jwks.json" },
            { identifier: "tickets.js:mine", args: null, returns: null },
          ],
        }),
      ),
    ).toEqual(["tickets:mine"]);
  });

  it("refuses a document that is not a function spec", () => {
    expect(() => specSignatures({ functions: "nope" })).toThrow(
      /not a convex function spec/,
    );
    expect(() => specSignatures(null)).toThrow(/function spec/);
  });
});

describe("treeSignatures", () => {
  it("reads the validators out of a module's source", async () => {
    const root = await convexModule(SAMPLE_MODULE);
    const stamp = await treeSignatures(root);
    expect(Object.keys(stamp)).toEqual(["sample:item"]);
    expect(stamp["sample:item"]).toMatch(/^[0-9a-f]{10}$/);
  });

  it("digests identically to the same function in a deployed spec", async () => {
    // The whole comparison rests on this: a shape read from source and the same
    // shape read from `convex function-spec` must be the same digest.
    const root = await convexModule(SAMPLE_MODULE);
    const fromSource = await treeSignatures(root);
    expect(fromSource).toEqual(specSignatures(SAMPLE_SPEC));
  });

  it("changes when an argument's validator changes", async () => {
    const before = await treeSignatures(await convexModule(SAMPLE_MODULE));
    const after = await treeSignatures(
      await convexModule(SAMPLE_MODULE.replace("limit: v.optional(v.number())", "limit: v.number()")),
    );
    expect(after["sample:item"]).not.toBe(before["sample:item"]);
  });

  it("takes a fresh reading after the source changes", async () => {
    // The bundles it writes have stable names, so a second capture in one
    // process would otherwise re-import the first one.
    const root = await convexModule(SAMPLE_MODULE);
    const first = await treeSignatures(root);
    await writeFile(
      path.join(root, "src", "convex", "sample.ts"),
      SAMPLE_MODULE.replace("v.boolean()", "v.number()"),
    );
    const second = await treeSignatures(root);
    expect(second["sample:item"]).not.toBe(first["sample:item"]);
  });
});
