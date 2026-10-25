import { geocodePlace, type GeoPoint } from "@/lib/geocode";
import { cn } from "@/lib/utils";
import type { ShipmentMode } from "./shipmentMode";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, MapPinOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/* Leaflet places markers from raw HTML, so the glyphs it needs are inlined
   from the same icon set the rest of the page renders with. */
const PIN_GLYPH =
  '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>';

const MODE_GLYPH: Record<ShipmentMode["key"], string> = {
  road: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  air: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  sea: '<path d="M12 10.189V14"/><path d="M12 2v3"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76"/><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
};

function glyph(path: string) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

function escapeHtml(value: string) {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(
    /[&<>"']/g,
    (character) => replacements[character] ?? character,
  );
}

/** A gentle great-circle stand-in so the route reads as a journey, not a ruler. */
function arcPath(from: GeoPoint, to: GeoPoint): [number, number][] {
  const deltaLat = to.lat - from.lat;
  const deltaLon = to.lon - from.lon;
  const bend = 0.16;
  const control = {
    lat: (from.lat + to.lat) / 2 + deltaLon * bend,
    lon: (from.lon + to.lon) / 2 - deltaLat * bend,
  };
  const points: [number, number][] = [];
  const steps = 48;
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const inverse = 1 - t;
    points.push([
      inverse * inverse * from.lat +
        2 * inverse * t * control.lat +
        t * t * to.lat,
      inverse * inverse * from.lon +
        2 * inverse * t * control.lon +
        t * t * to.lon,
    ]);
  }
  return points;
}

type MapState =
  | { status: "loading" }
  | {
      status: "ready";
      origin: GeoPoint;
      destination: GeoPoint;
      position?: GeoPoint;
    }
  | { status: "unavailable" };

export function ShipmentMap({
  origin,
  destination,
  currentLocation,
  mode,
  className,
}: {
  origin: string;
  destination: string;
  currentLocation?: string;
  mode: ShipmentMode;
  className?: string;
}) {
  const modeKey = mode.key;
  const modeLabel = mode.label;
  const requestKey = `${origin}\u0000${destination}\u0000${currentLocation ?? ""}`;
  /* The answer is stored with the request it belongs to, so a new route reads
     as loading during render instead of being reset from inside the effect. */
  const [resolved, setResolved] = useState<{
    key: string;
    state: MapState;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const state = useMemo<MapState>(
    () =>
      resolved?.key === requestKey ? resolved.state : { status: "loading" },
    [resolved, requestKey],
  );

  useEffect(() => {
    const controller = new AbortController();
    const key = requestKey;

    const resolve = async () => {
      try {
        const [from, to] = await Promise.all([
          geocodePlace(origin, controller.signal),
          geocodePlace(destination, controller.signal),
        ]);
        const position =
          currentLocation &&
          currentLocation !== origin &&
          currentLocation !== destination
            ? await geocodePlace(currentLocation, controller.signal)
            : null;
        if (controller.signal.aborted) return;
        if (!from || !to) {
          setResolved({ key, state: { status: "unavailable" } });
          return;
        }
        setResolved({
          key,
          state: {
            status: "ready",
            origin: from,
            destination: to,
            position: position ?? undefined,
          },
        });
      } catch {
        if (!controller.signal.aborted) {
          setResolved({ key, state: { status: "unavailable" } });
        }
      }
    };

    void resolve();
    return () => controller.abort();
  }, [requestKey, origin, destination, currentLocation]);

  useEffect(() => {
    if (state.status !== "ready" || !containerRef.current) return;
    const node = containerRef.current;

    const styles = getComputedStyle(document.documentElement);
    const primary = styles.getPropertyValue("--primary").trim() || "#2f4bdb";

    const instance = L.map(node, {
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
      zoomAnimation: false,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      minZoom: 2,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(instance);

    const route: [number, number][] = [];
    const stops: GeoPoint[] = state.position
      ? [state.origin, state.position, state.destination]
      : [state.origin, state.destination];
    for (let index = 0; index < stops.length - 1; index += 1) {
      const leg = arcPath(stops[index], stops[index + 1]);
      route.push(...(index === 0 ? leg : leg.slice(1)));
    }

    L.polyline(route, {
      color: primary,
      weight: 2.5,
      opacity: 0.85,
      dashArray: "7 8",
      lineCap: "round",
    }).addTo(instance);

    const tooltip = () => ({
      permanent: true,
      direction: "right" as const,
      offset: [16, 0] as [number, number],
      className: "shipment-map__label",
      opacity: 1,
      interactive: false,
    });

    const pin = (kind: "origin" | "destination") =>
      L.divIcon({
        className: "shipment-map__marker",
        html: `<span class="shipment-map__pin shipment-map__pin--${kind}">${glyph(PIN_GLYPH)}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

    L.marker([state.origin.lat, state.origin.lon], {
      icon: pin("origin"),
      title: origin,
    })
      .addTo(instance)
      .bindTooltip(escapeHtml(origin), tooltip());

    L.marker([state.destination.lat, state.destination.lon], {
      icon: pin("destination"),
      title: destination,
    })
      .addTo(instance)
      .bindTooltip(escapeHtml(destination), tooltip());

    if (state.position) {
      const carrier = L.divIcon({
        className: "shipment-map__marker",
        html: `<span class="shipment-map__badge">${glyph(MODE_GLYPH[modeKey])}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const positionLabel = currentLocation || modeLabel;
      L.marker([state.position.lat, state.position.lon], {
        icon: carrier,
        title: positionLabel,
      })
        .addTo(instance)
        .bindTooltip(escapeHtml(positionLabel), tooltip());
    }

    const bounds = L.latLngBounds(stops.map((point) => [point.lat, point.lon]));
    if (bounds.isValid()) {
      instance.fitBounds(bounds, { padding: [56, 80], maxZoom: 6 });
    }

    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(node);
    const frame = requestAnimationFrame(() => instance.invalidateSize());

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      instance.remove();
    };
  }, [state, currentLocation, destination, modeKey, modeLabel, origin]);

  const mapLabel = `Map of the route from ${origin} to ${destination}`;

  return (
    <figure
      className={cn(
        "shipment-map relative m-0 overflow-hidden rounded-xl border border-line bg-ice",
        className,
      )}
    >
      {state.status === "ready" && (
        <div ref={containerRef} className="h-full w-full" />
      )}

      {state.status === "loading" && (
        <div className="flex h-full w-full items-center justify-center gap-2 text-[0.65rem] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Locating {origin} and {destination}…
        </div>
      )}

      {state.status === "unavailable" && (
        <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-ice p-4">
          <span className="vault-grid pointer-events-none absolute inset-0 opacity-70" />
          <div className="relative flex items-start justify-between gap-3 text-[0.66rem] font-semibold text-ink">
            <span className="truncate">{origin}</span>
            <span className="truncate text-right">{destination}</span>
          </div>
          <svg
            viewBox="0 0 100 40"
            preserveAspectRatio="none"
            className="relative h-16 w-full text-primary"
            aria-hidden="true"
          >
            <path
              d="M3 34 Q 50 -8 97 30"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.7"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx="3"
              cy="34"
              r="2.2"
              fill="currentColor"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx="97"
              cy="30"
              r="2.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <p className="relative flex items-center justify-center gap-1.5 text-[0.6rem] text-muted-foreground">
            <MapPinOff className="size-3" />
            Location lookup unavailable — route shown schematically.
          </p>
        </div>
      )}

      <figcaption className="sr-only">
        {mapLabel}.{currentLocation ? ` Last seen at ${currentLocation};` : ""}{" "}
        the route runs from {origin} to {destination}.
      </figcaption>
    </figure>
  );
}
