import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { normalizeEmailIdentifier } from "@/lib/emailIdentifier";

/**
 * Email sign-in is keyed by the exact address: Convex Auth matches
 * `providerAccountId` byte for byte, so "Name@Example.com" and
 * "name@example.com" are two accounts. These checks keep every email-code
 * sign-in on the normalised spelling.
 */

const AUTH_PAGE = join(
  fileURLToPath(new URL("..", import.meta.url)),
  "src",
  "pages",
  "Auth.tsx",
);

describe("normalizeEmailIdentifier", () => {
  it("lower-cases and trims a typed address", () => {
    expect(normalizeEmailIdentifier("  ElvinMensmiller@Yahoo.com ")).toBe(
      "elvinmensmiller@yahoo.com",
    );
  });

  it("leaves an already-normalised address untouched", () => {
    expect(normalizeEmailIdentifier("cosmicvault@gmail.com")).toBe(
      "cosmicvault@gmail.com",
    );
  });
});

describe("email-code sign-in", () => {
  it("normalises the address before the first code is sent", () => {
    const source = readFileSync(AUTH_PAGE, "utf8");

    // The address is normalised once and reused for the `signIn` call and for
    // `setStep`, so the code is verified against the same identifier.
    expect(source).toMatch(
      /const address = normalizeEmailIdentifier\(\s*email,?\s*\);/,
    );
  });
});
