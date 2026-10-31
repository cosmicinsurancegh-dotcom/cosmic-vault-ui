import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CONVEX_URL as APP_DEFAULT_CONVEX_URL } from "../src/lib/convexUrl";
import {
  DEFAULT_CONVEX_URL,
  decide,
  resolveDeploymentUrl,
  siteFunctionRefs,
  stripComments,
} from "../scripts/check-backend-release.mjs";

/**
 * The release gate exists because of 2026-10-30: a commit added
 * `tickets.queueSummary`, Vercel published the bundle that calls it, and the
 * production deployment did not have it - every staff dashboard load died. These
 * tests pin the two halves that decide whether the site may publish: which
 * functions the bundle calls, and the verdict that compares them - by name and
 * by the shape they validate - with what the deployment publishes.
 */

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const temporaryDirectories: string[] = [];

/** A throwaway tree with the given repo-relative files. */
async function tree(files: Record<string, string>) {
  const root = await mkdtemp(path.join(projectRoot, "node_modules", ".cache", "site-refs-"));
  temporaryDirectories.push(root);
  for (const [relative, contents] of Object.entries(files)) {
    const target = path.join(root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents);
  }
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("stripComments", () => {
  it("drops references written in comments", () => {
    const stripped = stripComments(
      [
        "// the staff queue calls api.tickets.queueSummary",
        "/* and api.ghost.missing was removed */",
        "const rows = useQuery(api.tickets.mine);",
      ].join("\n"),
    );
    expect(stripped).not.toContain("api.tickets.queueSummary");
    expect(stripped).not.toContain("api.ghost.missing");
    expect(stripped).toContain("api.tickets.mine");
  });

  it("keeps a double slash that is inside a string", () => {
    // `//` in a URL is not a comment, and treating it as one would swallow the
    // rest of the line - including the call on it.
    const stripped = stripComments(
      'fetch("https://example.com/api/x", { method: "POST" }); const p = api.setup.status;',
    );
    expect(stripped).toContain("https://example.com/api/x");
    expect(stripped).toContain("api.setup.status");
  });

  it("leaves ordinary source untouched", () => {
    const source = "const value = 1 + 2;\n";
    expect(stripComments(source)).toBe(source);
  });
});

describe("siteFunctionRefs", () => {
  it("collects the functions the site calls, sorted and unique", async () => {
    const root = await tree({
      "src/pages/Home.tsx":
        "const a = useQuery(api.tickets.queueSummary, {});\nconst b = useMutation(api.tickets.assign);",
      "src/pages/Again.tsx": "const c = useQuery(api.tickets.queueSummary, {});",
      "src/lib/actions.ts": "const d = useAction(api.email.sendTest);",
    });
    expect((await siteFunctionRefs(root)).refs).toEqual([
      "email:sendTest",
      "tickets:assign",
      "tickets:queueSummary",
    ]);
  });

  it("ignores the backend, codegen and tests - they are not the bundle", async () => {
    const root = await tree({
      "src/pages/Real.tsx": "useQuery(api.tickets.mine, {});",
      // The backend calls its own functions through `internal`, and imports the
      // codegen tree; neither says anything about what the browser needs.
      "src/convex/tickets.ts": "export const x = internalQuery({}); // api.ghost.nope",
      "src/convex/_generated/api.ts": "export const api = anyApi;",
      // Vitest and Playwright both reach for `api.*`; they are never shipped.
      "src/pages/Thing.test.tsx": "useQuery(api.ghost.testOnly, {});",
      "src/pages/Thing.spec.ts": "useQuery(api.ghost.specOnly, {});",
      "src/pages/notes.md": "api.ghost.markdown",
    });
    expect(await siteFunctionRefs(root)).toEqual({
      refs: ["tickets:mine"],
      dynamic: [],
    });
  });

  it("reports a file that indexes the api object instead of naming a function", async () => {
    const root = await tree({
      "src/lib/dispatch.ts":
        "export const pick = (module: string, name: string) => api[module][name];",
      "src/pages/Fine.tsx": "useQuery(api.tickets.mine, {});",
    });
    expect((await siteFunctionRefs(root)).dynamic).toEqual([
      path.join("src", "lib", "dispatch.ts"),
    ]);
  });

  it("finds nothing in an empty tree rather than throwing", async () => {
    const root = await tree({ "README.md": "no source" });
    expect(await siteFunctionRefs(root)).toEqual({ refs: [], dynamic: [] });
  });
});

describe("decide", () => {
  /** The shapes this build calls, and what the deployment published for them. */
  const shapes = { "tickets:assign": "bbbb", "tickets:mine": "aaaa" };
  const required = Object.keys(shapes);

  function production(overrides: Record<string, unknown> = {}) {
    return decide({
      environment: "production",
      required,
      served: required,
      signatures: shapes,
      expected: shapes,
      ...overrides,
    });
  }

  it("stays out of the way of preview and local builds", () => {
    for (const environment of ["preview", "development", ""]) {
      expect(
        decide({
          environment,
          required: ["tickets:queueSummary"],
          served: null,
          signatures: null,
          expected: {},
        }),
      ).toMatchObject({ ok: true });
    }
  });

  it("publishes when every function is served and validates the same", () => {
    const verdict = production();
    expect(verdict.ok).toBe(true);
    expect(verdict.detail).toContain("all 2 functions");
    expect(verdict.detail).toContain("matching argument and return shapes");
  });

  it("names the exact functions production is missing", () => {
    const verdict = production({
      required: [...required, "tickets:queueSummary"],
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.missing).toEqual(["tickets:queueSummary"]);
    expect(verdict.detail).toContain("tickets:queueSummary");
    // The functions that are served are not named as problems.
    expect(verdict.detail).not.toContain("tickets:mine");
  });

  it("names a function whose arguments or result changed", () => {
    const verdict = production({
      signatures: { ...shapes, "tickets:mine": "cccc" },
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.changed).toEqual(["tickets:mine"]);
    expect(verdict.detail).toContain("tickets:mine");
    expect(verdict.detail).toContain("An argument or return value changed");
    // A function whose shape still matches is not blamed.
    expect(verdict.detail).not.toContain("tickets:assign");
  });

  it("blocks when this build's own signatures could not be read", () => {
    // A capture gap is not a pass: the comparison would silently cover nothing.
    const verdict = production({ expected: { "tickets:mine": "aaaa" } });
    expect(verdict.ok).toBe(false);
    expect(verdict.detail).toContain("tickets:assign");
    expect(verdict.detail).toContain("could not be read");
  });

  it("treats an unpublished signature stamp as behind", () => {
    for (const signatures of [null, undefined]) {
      expect(production({ signatures }).ok).toBe(false);
    }
  });

  it("ignores functions the site does not call", () => {
    // The deployment may serve more than this build needs - old functions,
    // internal ones, functions for other clients.
    expect(
      production({
        served: [...required, "legacy:gone"],
        signatures: { ...shapes, "legacy:gone": "dddd" },
      }),
    ).toMatchObject({ ok: true });
  });

  it("keeps a long list of missing functions readable", () => {
    const many = Array.from({ length: 15 }, (_, index) => `mod:fn${index}`);
    const verdict = decisionFor(many);
    expect(verdict.missing).toHaveLength(15);
    // Sorted, so the twelve that fit are fn0, fn1, fn10-fn14 and fn2-fn6; the
    // rest are counted instead of pasted into the log.
    expect(verdict.detail).toContain("mod:fn14");
    expect(verdict.detail).not.toContain("mod:fn9");
    expect(verdict.detail).toContain("and 3 more");
  });

  it("treats an unpublished function list as behind, not as a match", () => {
    for (const served of [null, undefined]) {
      expect(production({ served }).ok).toBe(false);
    }
  });

  it("refuses to guess when the site indexes the api object", () => {
    const verdict = production({ dynamic: ["src/lib/dispatch.ts"] });
    expect(verdict.ok).toBe(false);
    expect(verdict.detail).toContain("src/lib/dispatch.ts");
  });

  it("refuses a scan that found no api references at all", () => {
    // A silent empty scan would pass every build forever.
    expect(production({ required: [] }).ok).toBe(false);
  });
});

/** `decide` for a build whose functions production has none of. */
function decisionFor(names: string[]) {
  return decide({
    environment: "production",
    required: names,
    served: [],
    signatures: {},
    expected: Object.fromEntries(names.map((name) => [name, "aaaa"])),
  });
}

describe("resolveDeploymentUrl", () => {
  it("uses the deployment the bundle will talk to", () => {
    expect(resolveDeploymentUrl("https://my-app-42.convex.cloud/")).toBe(
      "https://my-app-42.convex.cloud",
    );
    expect(resolveDeploymentUrl("http://127.0.0.1:3210")).toBe(
      "http://127.0.0.1:3210",
    );
  });

  it("falls back to production for a missing or unusable value", () => {
    for (const configured of [undefined, "", "  ", "https://freebuff.com"]) {
      expect(resolveDeploymentUrl(configured)).toBe(DEFAULT_CONVEX_URL);
    }
  });

  it("checks the same deployment the app resolves to", () => {
    // A copy of the constant is what lets this script run without importing
    // the app's TypeScript; this is what keeps the copy from drifting.
    expect(DEFAULT_CONVEX_URL).toBe(APP_DEFAULT_CONVEX_URL);
  });
});
