import { staticMapUrl } from "@/convex/lib/staticMap";
import { geocodePlace } from "./geocode";

/**
 * The route image for a shipment email, resolved where the sending happens.
 *
 * Emails render inside database mutations, which cannot call out, so the two
 * place names are geocoded here in the staff browser (through the same cached
 * Nominatim helper the tracking map uses) and the resulting URL travels with
 * the message. Without a Mapbox token the email falls back to the drawn rail,
 * so a missing token is a quieter email, not a failure.
 */

const TOKEN = (
  (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ?? ""
).trim();

export const shipmentMapConfigured = Boolean(TOKEN);

export async function resolveShipmentMapUrl(
  origin: string,
  destination: string,
  signal: AbortSignal,
): Promise<string | undefined> {
  if (!TOKEN) return undefined;
  try {
    const [from, to] = await Promise.all([
      geocodePlace(origin, signal),
      geocodePlace(destination, signal),
    ]);
    if (!from || !to || signal.aborted) return undefined;
    return staticMapUrl({ origin: from, destination: to, token: TOKEN })?.url;
  } catch {
    return undefined;
  }
}
