/**
 * The route map that sits at the top of a shipment email.
 *
 * Email clients run no scripts, so the map has to arrive as a plain image. It
 * is asked for from Mapbox's Static Images API, which draws the pins and the
 * line between them on a real map and fits the whole route in the frame with
 * `auto`. The URL is built here, dependency-free, so the browser that sends a
 * shipment update and the server that stores the message make the same URL.
 *
 * The access token is a Mapbox *public* token: it is meant to appear in image
 * URLs. Keep it in `VITE_MAPBOX_TOKEN` for the browser and `MAPBOX_ACCESS_TOKEN`
 * for anything server-side, and scope it to the styles this file uses.
 */

import { EMAIL_COLOURS } from "./emailPalette";

export type GeoPoint = { lat: number; lon: number };

const STATIC_API = "https://api.mapbox.com/styles/v1/mapbox/light-v11/static";

/** Mapbox overlays want a bare hex, so the palette's `#` comes off here. */
function bare(hex: string) {
  return hex.replace("#", "").toLowerCase();
}

/** The dashboard's own markers: the route starts blue and lands deep blue. */
const ORIGIN_PIN = `pin-s+${bare(EMAIL_COLOURS.electric)}`;
const DESTINATION_PIN = `pin-s+${bare(EMAIL_COLOURS.electricDeep)}`;
const ROUTE_LINE = `path-3+${bare(EMAIL_COLOURS.electric)}-0.85`;

export const MAP_SIZE = { width: 280, height: 180 } as const;

export type StaticMapOptions = {
  origin: GeoPoint;
  destination: GeoPoint;
  token: string;
  width?: number;
  height?: number;
  retina?: boolean;
};

/** Five decimals is about a metre; the map has no use for more. */
function coordinate(point: GeoPoint) {
  return `${point.lon.toFixed(5)},${point.lat.toFixed(5)}`;
}

export function validGeoPoint(
  point: { lat?: number; lon?: number } | null | undefined,
): point is GeoPoint {
  if (!point) return false;
  const { lat, lon } = point;
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    // Web Mercator, which Mapbox draws in, stops short of the poles.
    lat <= 85.0511 &&
    lat >= -85.0511 &&
    lon <= 180 &&
    lon >= -180
  );
}

export type StaticMapUrl = {
  url: string;
  width: number;
  height: number;
};

/**
 * The map image URL, or `null` when the token or either end is missing. A
 * missing map is not an error: the email falls back to the route rail, which
 * needs no network at all.
 */
export function staticMapUrl({
  origin,
  destination,
  token,
  width = MAP_SIZE.width,
  height = MAP_SIZE.height,
  retina = true,
}: StaticMapOptions): StaticMapUrl | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  if (!validGeoPoint(origin) || !validGeoPoint(destination)) return null;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width < 40 || height < 40 || width > 1280 || height > 1280) return null;

  const from = coordinate(origin);
  const to = coordinate(destination);
  const overlays = `${ROUTE_LINE}(${from},${to}),${ORIGIN_PIN}(${from}),${DESTINATION_PIN}(${to})`;
  const size = `${Math.round(width)}x${Math.round(height)}${retina ? "@2x" : ""}`;

  return {
    url: `${STATIC_API}/${overlays}/auto/${size}?access_token=${encodeURIComponent(trimmed)}`,
    width: Math.round(width),
    height: Math.round(height),
  };
}

/** Only Mapbox images may reach an email body. */
export function isStaticMapUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "api.mapbox.com" ||
        url.hostname.endsWith(".mapbox.com"))
    );
  } catch {
    return false;
  }
}
