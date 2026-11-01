import { describe, expect, it, vi } from "vitest";
import {
  compareRelease,
  probeRelease,
  RELEASE_PROBE_FUNCTION,
} from "../src/lib/releaseSkew";

/**
 * The runtime half of the release gate. The build refuses to publish a bundle
 * whose functions production does not serve; these cover the same question
 * asked from inside the published bundle, where the answer has to be a sentence
 * an operator can act on - and where a deployment that cannot be asked must
 * stay silent rather than accuse a healthy backend.
 */
const EXPECTED = {
  "tickets:queueSummary": "aaaaaaaaaa",
  "policies:list": "bbbbbbbbbb",
};

const MATCHING_STAMP = {
  functions: ["policies:list", "tickets:queueSummary", "vault:list"],
  signatures: {
    "policies:list": "bbbbbbbbbb",
    "tickets:queueSummary": "aaaaaaaaaa",
    "vault:list": "cccccccccc",
  },
};

/** A fetch that answers one JSON body, and records what it was asked. */
function answering(body: unknown, status = 200) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("compareRelease", () => {
  it("matches when every function is served with the shape it was built for", () => {
    expect(compareRelease(EXPECTED, MATCHING_STAMP)).toEqual({
      state: "match",
      checked: 2,
    });
  });

  it("names the functions the deployment does not serve", () => {
    const verdict = compareRelease(EXPECTED, {
      functions: ["policies:list"],
      signatures: { "policies:list": "bbbbbbbbbb" },
    });
    expect(verdict).toEqual({
      state: "skew",
      missing: ["tickets:queueSummary"],
      changed: [],
    });
  });

  it("names a function whose argument or return shape differs", () => {
    const verdict = compareRelease(EXPECTED, {
      ...MATCHING_STAMP,
      signatures: { ...MATCHING_STAMP.signatures, "policies:list": "9999999999" },
    });
    expect(verdict).toEqual({
      state: "skew",
      missing: [],
      changed: ["policies:list"],
    });
  });

  it("ignores functions this build never calls", () => {
    // A backend ahead of the site is not a failure: extra functions are not
    // calls the bundle can make.
    expect(
      compareRelease(EXPECTED, {
        functions: [...MATCHING_STAMP.functions, "claims:list", "staff:list"],
        signatures: {
          ...MATCHING_STAMP.signatures,
          "claims:list": "dddddddddd",
          "staff:list": "eeeeeeeeee",
        },
      }),
    ).toEqual({ state: "match", checked: 2 });
  });

  it("checks names on a deployment stamped before shapes were recorded", () => {
    // The older stamp is a bare list, so what it can answer is what is there.
    expect(
      compareRelease(EXPECTED, {
        functions: ["policies:list", "tickets:queueSummary"],
        signatures: null,
      }),
    ).toEqual({ state: "match", checked: 2 });

    expect(
      compareRelease(EXPECTED, { functions: ["policies:list"], signatures: null }),
    ).toEqual({
      state: "skew",
      missing: ["tickets:queueSummary"],
      changed: [],
    });
  });

  it("says nothing when the build recorded nothing to compare", () => {
    for (const expected of [null, {}]) {
      const verdict = compareRelease(expected, MATCHING_STAMP);
      expect(verdict.state).toBe("unknown");
    }
  });

  it("says nothing when the deployment has not published what it serves", () => {
    for (const payload of [null, {}, { functions: null, signatures: null }]) {
      expect(compareRelease(EXPECTED, payload).state).toBe("unknown");
    }
  });

  it("rejects a stamp that is not a map of digests", () => {
    // Guards the caller's parse as much as its own: a value list cannot be
    // read as shapes, so it is not evidence either way.
    expect(
      compareRelease(EXPECTED, { functions: ["policies:list"], signatures: ["bb"] })
        .state,
    ).toBe("unknown");
  });
});

describe("probeRelease", () => {
  it("asks setup:release over the public HTTP API", async () => {
    const { fetchImpl, calls } = answering({
      status: "success",
      value: MATCHING_STAMP,
    });
    const verdict = await probeRelease("https://x.convex.cloud/", {
      expected: EXPECTED,
      fetchImpl,
    });

    expect(verdict).toEqual({ state: "match", checked: 2 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://x.convex.cloud/api/query");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      path: RELEASE_PROBE_FUNCTION,
      args: {},
      format: "json",
    });
  });

  it("accepts the WebSocket protocol's spelling of a value", async () => {
    const { fetchImpl } = answering({ status: "value", value: MATCHING_STAMP });
    expect(
      await probeRelease("https://x.convex.cloud", {
        expected: EXPECTED,
        fetchImpl,
      }),
    ).toEqual({ state: "match", checked: 2 });
  });

  it("reports a skew it can see", async () => {
    const { fetchImpl } = answering({
      status: "success",
      value: { functions: ["policies:list"], signatures: { "policies:list": "bbbbbbbbbb" } },
    });
    expect(
      await probeRelease("https://x.convex.cloud", {
        expected: EXPECTED,
        fetchImpl,
      }),
    ).toEqual({ state: "skew", missing: ["tickets:queueSummary"], changed: [] });
  });

  it("says nothing when the deployment answers with an error", async () => {
    // Production masks every failure as a bare Server Error, including the one
    // an older deployment gives for a query it does not have.
    const { fetchImpl } = answering({
      status: "error",
      errorMessage: "[Request ID: abc] Server Error",
    });
    const verdict = await probeRelease("https://x.convex.cloud", {
      expected: EXPECTED,
      fetchImpl,
    });
    expect(verdict.state).toBe("unknown");
  });

  it("says nothing when the deployment cannot be reached or parsed", async () => {
    const failing = (async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    }) as unknown as typeof fetch;
    expect(
      (await probeRelease("https://x.convex.cloud", { expected: EXPECTED, fetchImpl: failing }))
        .state,
    ).toBe("unknown");

    const serverError = answering({}, 500);
    expect(
      (await probeRelease("https://x.convex.cloud", {
        expected: EXPECTED,
        fetchImpl: serverError.fetchImpl,
      })).state,
    ).toBe("unknown");

    const html = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
      }) as unknown as Response) as unknown as typeof fetch;
    expect(
      (await probeRelease("https://x.convex.cloud", { expected: EXPECTED, fetchImpl: html }))
        .state,
    ).toBe("unknown");
  });

  it("does not ask at all without an expectation", async () => {
    const { fetchImpl, calls } = answering({ status: "success", value: MATCHING_STAMP });
    const verdict = await probeRelease("https://x.convex.cloud", {
      expected: null,
      fetchImpl,
    });
    expect(verdict.state).toBe("unknown");
    expect(calls).toHaveLength(0);
  });

  it("never throws", async () => {
    const spy = vi.fn();
    spy.mockImplementation(() => {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    });
    const verdict = await probeRelease("https://x.convex.cloud", {
      expected: EXPECTED,
      fetchImpl: spy as unknown as typeof fetch,
    });
    expect(verdict.state).toBe("unknown");
  });
});
