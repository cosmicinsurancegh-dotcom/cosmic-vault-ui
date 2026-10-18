import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONVEX_URL,
  isConvexDeploymentUrl,
  resolveConvexUrl,
} from "../src/lib/convexUrl";

/**
 * A wrong `VITE_CONVEX_URL` produces no error at runtime - the Convex client
 * simply waits for a connection that never opens, so the email-code button
 * spins on "Sending code" forever. These tests pin the resolution that keeps
 * that from reaching the client.
 */
describe("isConvexDeploymentUrl", () => {
  it("accepts Convex deployment and site URLs", () => {
    expect(
      isConvexDeploymentUrl("https://grateful-pony-619.convex.cloud"),
    ).toBe(true);
    expect(isConvexDeploymentUrl("https://grateful-pony-619.convex.site")).toBe(
      true,
    );
    expect(isConvexDeploymentUrl("https://team-1.convex.cloud/")).toBe(true);
  });

  it("accepts the local dev server", () => {
    expect(isConvexDeploymentUrl("http://localhost:3210")).toBe(true);
    expect(isConvexDeploymentUrl("http://127.0.0.1:3210")).toBe(true);
  });

  it("rejects the platform's own domains and other non-Convex hosts", () => {
    expect(isConvexDeploymentUrl("https://freebuff.com")).toBe(false);
    expect(isConvexDeploymentUrl("https://cosmic-vault-ui.vercel.app")).toBe(
      false,
    );
    expect(isConvexDeploymentUrl("https://vly.ai")).toBe(false);
    // A lookalike host must not pass.
    expect(isConvexDeploymentUrl("https://evil-convex.cloud.attacker.io")).toBe(
      false,
    );
  });

  it("rejects empty, relative and non-URL values", () => {
    expect(isConvexDeploymentUrl(undefined)).toBe(false);
    expect(isConvexDeploymentUrl(null)).toBe(false);
    expect(isConvexDeploymentUrl("")).toBe(false);
    expect(isConvexDeploymentUrl("   ")).toBe(false);
    expect(isConvexDeploymentUrl("grateful-pony-619.convex.cloud")).toBe(false);
  });
});

describe("resolveConvexUrl", () => {
  it("keeps a valid configured deployment", () => {
    expect(resolveConvexUrl("https://my-app-42.convex.cloud")).toBe(
      "https://my-app-42.convex.cloud",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(resolveConvexUrl("  https://my-app-42.convex.cloud\n")).toBe(
      "https://my-app-42.convex.cloud",
    );
  });

  it("falls back to this project's deployment for a wrong domain", () => {
    // The value the published Vercel build was compiled with.
    expect(resolveConvexUrl("https://freebuff.com")).toBe(DEFAULT_CONVEX_URL);
  });

  it("falls back when nothing is configured", () => {
    expect(resolveConvexUrl(undefined)).toBe(DEFAULT_CONVEX_URL);
    expect(resolveConvexUrl("")).toBe(DEFAULT_CONVEX_URL);
  });

  it("always returns something a client can connect to", () => {
    expect(isConvexDeploymentUrl(DEFAULT_CONVEX_URL)).toBe(true);
    expect(
      isConvexDeploymentUrl(resolveConvexUrl("https://freebuff.com")),
    ).toBe(true);
  });
});
