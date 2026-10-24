import { describe, expect, it } from "vitest";
import {
  cleanProbeMessage,
  classifyProbePayload,
  probeConvexDeployment,
  probeUrl,
} from "../src/lib/convexHealth";

/**
 * The failure these pin: a deployment that answers HTTP 200 and `/version`, yet
 * runs no function, so every query fails with a bare "Server Error". The probe
 * has to tell that apart from a paused deployment and an unreachable host,
 * because the dashboard says something different for each.
 */
describe("cleanProbeMessage", () => {
  it("drops the Convex request id", () => {
    expect(cleanProbeMessage("[Request ID: abc123] Server Error")).toBe(
      "Server Error",
    );
    expect(
      cleanProbeMessage(
        "[Request ID: abc123] Cannot run functions while this deployment is paused.",
      ),
    ).toBe("Cannot run functions while this deployment is paused.");
  });

  it("tolerates a missing or non-string message", () => {
    expect(cleanProbeMessage(undefined)).toBe("");
    expect(cleanProbeMessage(null)).toBe("");
    expect(cleanProbeMessage(42)).toBe("");
  });
});

describe("classifyProbePayload", () => {
  it("accepts the HTTP API's success body", () => {
    // The exact answer from setup:health on the production deployment.
    expect(
      classifyProbePayload({ status: "success", value: { ok: true } }),
    ).toEqual({ state: "ok" });
  });

  it("accepts the WebSocket protocol's spelling too", () => {
    expect(
      classifyProbePayload({ status: "value", value: { hasSuperAdmin: true } }),
    ).toEqual({ state: "ok" });
  });

  it("recognises a paused deployment", () => {
    expect(
      classifyProbePayload({
        status: "error",
        errorMessage:
          "[Request ID: 6dc2ba41711497e2] Server Error\nCannot run functions while this deployment is paused. Resume the deployment in the dashboard settings to allow functions to run.\n",
      }),
    ).toEqual({
      state: "paused",
      detail:
        "Server Error\nCannot run functions while this deployment is paused. Resume the deployment in the dashboard settings to allow functions to run.",
    });
  });

  it("treats a bare Server Error as a backend that runs nothing", () => {
    // The exact answer from the production deployment on 24 Oct 2026.
    expect(
      classifyProbePayload({
        status: "error",
        errorMessage: "[Request ID: ef3754c126a1a36a] Server Error",
      }),
    ).toEqual({ state: "unavailable", detail: "Server Error" });
  });

  it("treats a missing function as unavailable and keeps the reason", () => {
    expect(
      classifyProbePayload({
        status: "error",
        errorMessage:
          "[Request ID: abc] Could not find public function for 'setup:health'. Did you forget to run `npx convex dev` or `npx convex deploy`?",
      }),
    ).toEqual({
      state: "unavailable",
      detail:
        "Could not find public function for 'setup:health'. Did you forget to run `npx convex dev` or `npx convex deploy`?",
    });
  });


  it("rejects bodies that are not Convex responses", () => {
    expect(classifyProbePayload(null).state).toBe("unreachable");
    expect(classifyProbePayload("").state).toBe("unreachable");
    expect(classifyProbePayload({}).state).toBe("unreachable");
    expect(classifyProbePayload({ status: "whatever" }).state).toBe(
      "unreachable",
    );
  });
});

describe("probeUrl", () => {
  it("appends the query endpoint once", () => {
    expect(probeUrl("https://descriptive-ferret-801.convex.cloud")).toBe(
      "https://descriptive-ferret-801.convex.cloud/api/query",
    );
    expect(probeUrl("https://x.convex.cloud/")).toBe(
      "https://x.convex.cloud/api/query",
    );
  });
});

describe("probeConvexDeployment", () => {
  it("calls the public probe function and reports a healthy backend", async () => {
    let seen: { url: string; body: unknown } | null = null;
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(input), body: JSON.parse(String(init?.body)) };
      return new Response(
        JSON.stringify({ status: "success", value: { ok: true } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    await expect(
      probeConvexDeployment("https://x.convex.cloud/", { fetchImpl }),
    ).resolves.toEqual({ state: "ok" });
    expect(seen).toEqual({
      url: "https://x.convex.cloud/api/query",
      body: { path: "setup:health", args: {}, format: "json" },
    });
  });

  it("reports an HTTP failure as unreachable", async () => {
    const fetchImpl = (async () =>
      new Response("nope", { status: 503 })) as typeof fetch;

    await expect(
      probeConvexDeployment("https://x.convex.cloud", { fetchImpl }),
    ).resolves.toEqual({
      state: "unreachable",
      detail: "The deployment answered HTTP 503.",
    });
  });

  it("reports a non-JSON body as unreachable", async () => {
    // What the dev server's SPA fallback returns for an unknown path.
    const fetchImpl = (async () =>
      new Response("<!doctype html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      })) as typeof fetch;

    const result = await probeConvexDeployment("https://x.convex.cloud", {
      fetchImpl,
    });
    expect(result.state).toBe("unreachable");
  });

  it("reports a network failure instead of throwing", async () => {
    const fetchImpl = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;

    await expect(
      probeConvexDeployment("https://x.convex.cloud", { fetchImpl }),
    ).resolves.toEqual({ state: "unreachable", detail: "Failed to fetch" });
  });

  it("times out a host that never answers", async () => {
    const hanging = ((_: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      })) as typeof fetch;

    await expect(
      probeConvexDeployment("https://x.convex.cloud", {
        fetchImpl: hanging,
        timeoutMs: 10,
      }),
    ).resolves.toEqual({
      state: "unreachable",
      detail: "The deployment did not answer in time.",
    });
  });
});
