/**
 * Place-name geocoding for the shipment map.
 *
 * Consignments carry the place names operations wrote down ("London vault"),
 * not coordinates, so the tracking map resolves each end against OpenStreetMap's
 * Nominatim service. Requests are serialised to one per second as the usage
 * policy asks, and every answer (including "nothing found") is cached for the
 * session so paging through shipments does not repeat a lookup. A failed lookup
 * throws and is never cached, which lets the caller fall back to the schematic
 * route instead of remembering an outage as a missing place.
 */
export type GeoPoint = { lat: number; lon: number };

const CACHE_KEY = "cosmic-vault-geocode-v1";
const REQUEST_GAP_MS = 1100;
const REQUEST_TIMEOUT_MS = 8000;

/**
 * A vault, depot or port is a facility inside the place, not the place itself,
 * so those words are dropped before a second attempt.
 */
const FACILITY_WORDS =
  /\b(vault|depot|warehouse|terminal|hub|facility|office|branch|port of|port)\b/gi;

/** Two-letter region codes that appear in port names but not in Nominatim. */
const REGION_ALIASES: Record<string, string> = {
  ny: "New York",
  nj: "New Jersey",
  md: "Maryland",
  va: "Virginia",
  nc: "North Carolina",
  sc: "South Carolina",
  ga: "Georgia",
  fl: "Florida",
  al: "Alabama",
  ax: "Alaska",
  ca: "California",
  tx: "Texas",
  uk: "United Kingdom",
  usa: "United States",
  ch: "Switzerland",
  nl: "Netherlands",
  sg: "Singapore",
  ae: "United Arab Emirates",
  cn: "China",
  jp: "Japan",
  hk: "Hong Kong",
  za: "South Africa",
  br: "Brazil",
  au: "Australia",
};

function clean(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .trim();
}

/**
 * The queries to try, most specific first. Exported so the ordering can be
 * tested without touching the network.
 */
export function geocodeCandidates(place: string): string[] {
  const original = clean(place);
  if (!original) return [];
  const stripped = clean(original.replace(FACILITY_WORDS, " "));
  const expanded = clean(
    stripped
      .split(" ")
      .map((token) => {
        const key = token.replace(/[^a-z]/gi, "").toLowerCase();
        return REGION_ALIASES[key] ?? token;
      })
      .join(" "),
  );
  /* The place inside the facility resolves far more often than the facility
     name itself, so it is tried first and saves a second round trip. */
  return [...new Set([stripped, expanded, original])].filter(
    (candidate) => candidate.length > 1,
  );
}

const memory = new Map<string, GeoPoint | null>();
let hydrated = false;

function readStorage() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const stored = JSON.parse(raw) as Record<string, GeoPoint | null>;
    for (const [key, value] of Object.entries(stored)) {
      memory.set(key, value);
    }
  } catch {
    // A blocked session store only costs a repeat lookup.
  }
}

function writeStorage() {
  try {
    window.sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify(Object.fromEntries(memory)),
    );
  } catch {
    // Storage can be full or blocked in a private window.
  }
}

/* One request at a time, spaced by the usage policy. */
let chain: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.catch(() => undefined);
  return run;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchPlace(
  query: string,
  signal: AbortSignal,
): Promise<GeoPoint | null> {
  const wait = Math.max(0, lastRequestAt + REQUEST_GAP_MS - Date.now());
  if (wait > 0) await sleep(wait);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  lastRequestAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const forwardAbort = () => controller.abort();
  signal.addEventListener("abort", forwardAbort, { once: true });

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(
      query,
    )}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Geocoder responded with ${response.status}.`);
    }
    const results = (await response.json()) as { lat?: string; lon?: string }[];
    const hit = Array.isArray(results) ? results[0] : undefined;
    const lat = Number(hit?.lat);
    const lon = Number(hit?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", forwardAbort);
  }
}

/** Resolve a place name to a point, or `null` when the place is unknown. */
export async function geocodePlace(
  place: string,
  signal: AbortSignal,
): Promise<GeoPoint | null> {
  const key = place.trim().toLowerCase();
  if (!key) return null;
  readStorage();
  if (memory.has(key)) return memory.get(key) ?? null;

  for (const candidate of geocodeCandidates(place)) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const point = await enqueue(() => searchPlace(candidate, signal));
    if (point) {
      memory.set(key, point);
      writeStorage();
      return point;
    }
  }

  memory.set(key, null);
  writeStorage();
  return null;
}
