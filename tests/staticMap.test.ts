import { describe, expect, it } from "vitest";
import { EMAIL_COLOURS } from "../src/convex/lib/emailPalette";
import {
  isStaticMapUrl,
  staticMapUrl,
  validGeoPoint,
} from "../src/convex/lib/staticMap";

const LONDON = { lat: 51.5072, lon: -0.1276 };
const BRISTOL = { lat: 51.4545, lon: -2.5879 };

describe("static route map", () => {
  it("asks Mapbox for the route, the two pins and a fitted frame", () => {
    const map = staticMapUrl({
      origin: LONDON,
      destination: BRISTOL,
      token: "pk.test-token",
    });

    expect(map).not.toBeNull();
    const url = map!.url;
    expect(url.startsWith("https://api.mapbox.com/styles/v1/mapbox/")).toBe(
      true,
    );
    // Mapbox takes longitude first, then latitude. The pins and the line are
    // the design system's blues, not map defaults.
    const line = EMAIL_COLOURS.electric.replace("#", "").toLowerCase();
    const land = EMAIL_COLOURS.electricDeep.replace("#", "").toLowerCase();
    expect(url).toContain(
      `path-3+${line}-0.85(-0.12760,51.50720,-2.58790,51.45450)`,
    );
    expect(url).toContain(`pin-s+${line}(-0.12760,51.50720)`);
    expect(url).toContain(`pin-s+${land}(-2.58790,51.45450)`);
    // `auto` fits both ends in the frame, so no zoom arithmetic is needed.
    expect(url).toContain("/auto/280x180@2x");
    expect(url).toContain("access_token=pk.test-token");
    expect(map).toMatchObject({ width: 280, height: 180 });
  });

  it("honours the requested size and drops the retina suffix", () => {
    const map = staticMapUrl({
      origin: LONDON,
      destination: BRISTOL,
      token: "pk.test-token",
      width: 320,
      height: 200,
      retina: false,
    });
    expect(map!.url).toContain("/auto/320x200?");
    expect(map!.url).not.toContain("@2x");
  });

  it("returns nothing without a token or a usable pair of places", () => {
    expect(
      staticMapUrl({ origin: LONDON, destination: BRISTOL, token: "  " }),
    ).toBeNull();
    expect(
      staticMapUrl({
        origin: { lat: 91, lon: 0 },
        destination: BRISTOL,
        token: "pk.test-token",
      }),
    ).toBeNull();
    expect(
      staticMapUrl({
        origin: LONDON,
        destination: { lat: Number.NaN, lon: 0 },
        token: "pk.test-token",
      }),
    ).toBeNull();
    expect(
      staticMapUrl({
        origin: LONDON,
        destination: BRISTOL,
        token: "pk.test-token",
        width: 10,
        height: 10,
      }),
    ).toBeNull();
  });

  it("rejects anything that is not a Mapbox https image", () => {
    const map = staticMapUrl({
      origin: LONDON,
      destination: BRISTOL,
      token: "pk.test-token",
    });
    expect(isStaticMapUrl(map!.url)).toBe(true);
    expect(isStaticMapUrl("http://api.mapbox.com/x.png")).toBe(false);
    expect(isStaticMapUrl("https://tracker.example/pixel.png")).toBe(false);
    expect(isStaticMapUrl("javascript:alert(1)")).toBe(false);
    expect(isStaticMapUrl(undefined)).toBe(false);
  });

  it("guards the coordinates it will accept", () => {
    expect(validGeoPoint(LONDON)).toBe(true);
    expect(validGeoPoint({ lat: 0, lon: 0 })).toBe(true);
    expect(validGeoPoint({ lat: 86, lon: 0 })).toBe(false);
    expect(validGeoPoint({ lat: 0, lon: 181 })).toBe(false);
    expect(validGeoPoint({})).toBe(false);
    expect(validGeoPoint(null)).toBe(false);
  });
});
