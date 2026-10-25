import { geocodeCandidates } from "@/lib/geocode";
import { describe, expect, it } from "vitest";

/**
 * Shipments store the place operations wrote down, including the facility word.
 * These cases pin the queries the map sends, so a shipped "London vault" does
 * not cost a wasted lookup before "London".
 */
describe("geocodeCandidates", () => {
  it("tries the place before the facility it sits in", () => {
    expect(geocodeCandidates("London vault")[0]).toBe("London");
    expect(geocodeCandidates("Zurich vault")[0]).toBe("Zurich");
  });

  it("drops the port heading but keeps the city and region", () => {
    expect(geocodeCandidates("Port of Miami, FL")[0]).toBe("Miami, FL");
  });

  it("expands region codes for the second attempt", () => {
    const candidates = geocodeCandidates("Port of Miami, FL");
    expect(candidates).toContain("Miami, Florida");
  });

  it("leaves a plain city name untouched", () => {
    expect(geocodeCandidates("Basel, CH")).toEqual([
      "Basel, CH",
      "Basel, Switzerland",
    ]);
  });

  it("ignores an empty place", () => {
    expect(geocodeCandidates("   ")).toEqual([]);
  });
});
