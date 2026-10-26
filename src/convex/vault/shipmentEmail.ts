/**
 * The member-facing shipment update email.
 *
 * This module is deliberately dependency-free: the Convex email action renders
 * with it on the server, and the dashboard preview renders the exact same HTML
 * in the browser, so what staff preview is what the member receives. It must
 * never import `react`, `convex/*` or anything from the Vite `src/lib` tree -
 * the Convex bundler cannot resolve outside the `convex` folder.
 *
 * Design: the dashboard's own language, rebuilt with email-safe tables and
 * inline styles only (no scripts, no external fonts, no CSS files). A porcelain
 * canvas, a white card with 4px corners and hairline borders, electric-blue
 * accents, ink-navy type, uppercase micro-labels at wide tracking, pill chips,
 * and the shipping desk's route rail - pins at either end, the carrier's mode
 * at the live position, a dashed track and a solid passed span. The footer is
 * the dashboard's dark navy panel. A three-pixel amber rule at the very top
 * echoes the orbit in the brand mark.
 */

export const SHIPMENT_EMAIL_STATUSES = [
  "pending",
  "in_progress",
  "on_hold",
  "in_transit",
  "shipped",
] as const;

export type ShipmentEmailStatus = (typeof SHIPMENT_EMAIL_STATUSES)[number];

export type ShipmentEmailEvent = {
  status: ShipmentEmailStatus;
  at: number;
  note?: string;
};

export type ShipmentEmailInput = {
  memberName: string;
  memberEmail: string;
  mineralName: string;
  mineralType: string;
  category: string;
  vaultId: string;
  weightLabel: string;
  photoPath?: string;
  trackingNumber: string;
  carrier: string;
  service: string;
  origin: string;
  destination: string;
  /** Short city labels for the route rail; the full addresses stay in the table. */
  originCity?: string;
  destinationCity?: string;
  estimatedDelivery: number;
  status: ShipmentEmailStatus;
  note?: string;
  updatedAt: number;
  events: ShipmentEmailEvent[];
  /** Absolute link to the member's tracking view. Required for the CTA. */
  trackingUrl: string;
  /** Absolute origin used for footer links and the mineral photo. */
  appOrigin?: string;
  companyName?: string;
  supportEmail?: string;
};

export type RenderedShipmentEmail = {
  subject: string;
  preheader: string;
  html: string;
  text: string;
};

type StepState = "complete" | "active" | "skipped" | "future";

/** Dashboard palette, converted to email-safe hex. */
const PALETTE = {
  canvas: "#F2F6FC",
  card: "#FFFFFF",
  ice: "#EDF4FF",
  iceDeep: "#DCE9FB",
  primary: "#1D74F5",
  primaryDeep: "#0A3BCB",
  primarySoft: "#8BB9FD",
  primaryTint: "#EAF2FE",
  primaryLine: "#BBD3FB",
  ink: "#0A1224",
  muted: "#5E6572",
  faint: "#8A93A3",
  line: "#D4D9E1",
  lineSoft: "#E7EBF2",
  halo: "#DBC8A2",
  amber: "#B45309",
  amberTint: "#FEF3E2",
  amberLine: "#F0D9B5",
  emerald: "#047857",
  emeraldTint: "#E9F6F0",
  emeraldLine: "#BDE5D2",
  white: "#FFFFFF",
} as const;

const FONT_STACK =
  "'PolySans', 'Inter', 'Helvetica Neue', Helvetica, Arial, 'Segoe UI', sans-serif";

const STEP_COPY: Record<
  ShipmentEmailStatus,
  {
    label: string;
    stamp: string;
    headline: string;
    subject: string;
    description: string;
  }
> = {
  pending: {
    label: "Authorised",
    stamp: "Booked in",
    headline: "Your shipment is booked in",
    subject: "Shipment authorised",
    description: "Authorised and queued with vault operations.",
  },
  in_progress: {
    label: "Preparing",
    stamp: "Preparing",
    headline: "Your piece is being prepared",
    subject: "Shipment in preparation",
    description: "Being prepared, verified and packaged.",
  },
  on_hold: {
    label: "On Hold",
    stamp: "On hold",
    headline: "Your shipment is on hold",
    subject: "Shipment on hold",
    description: "Paused pending an operational or customs check.",
  },
  in_transit: {
    label: "In transit",
    stamp: "In transit",
    headline: "Your shipment is on its way",
    subject: "Shipment in transit",
    description: "With the secure carrier and moving to its destination.",
  },
  shipped: {
    label: "Delivered",
    stamp: "Delivered",
    headline: "Your shipment has arrived",
    subject: "Shipment delivered",
    description: "Delivered and signed for at the destination.",
  },
};

/** The operational chip, which is the shipping desk's label rather than the stage label. */
const STATUS_CHIP_LABEL: Record<ShipmentEmailStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  on_hold: "On hold",
  in_transit: "In transit",
  shipped: "Delivered",
};

/**
 * How far the route fill reaches for each status. The rail lands its fill on
 * the waypoints rather than sliding continuously - first waypoint, truck,
 * second waypoint, destination - so this email and the Convex-native shipment
 * email draw the same journey at every stage.
 */
const ROUTE_PROGRESS: Record<ShipmentEmailStatus, number> = {
  pending: 0,
  in_progress: 0.25,
  on_hold: 0.5,
  in_transit: 0.5,
  shipped: 1,
};

const CHIP_TONE: Record<
  ShipmentEmailStatus,
  { border: string; background: string; text: string }
> = {
  pending: {
    border: PALETTE.line,
    background: PALETTE.card,
    text: PALETTE.muted,
  },
  in_progress: {
    border: PALETTE.primaryLine,
    background: PALETTE.primaryTint,
    text: PALETTE.primaryDeep,
  },
  on_hold: {
    border: PALETTE.amberLine,
    background: PALETTE.amberTint,
    text: PALETTE.amber,
  },
  in_transit: {
    border: PALETTE.primary,
    background: PALETTE.primary,
    text: PALETTE.white,
  },
  shipped: {
    border: PALETTE.emeraldLine,
    background: PALETTE.emeraldTint,
    text: PALETTE.emerald,
  },
};

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPES[character] ?? "&amp;",
  );
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

/** Only http(s) links are allowed into an email body. */
function safeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function toText(value: string | undefined, fallback: string) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function breakLines(value: string) {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const DAY_WITH_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

function dayStamp(at: number) {
  return DAY.format(new Date(at));
}

function fullStamp(at: number) {
  return `${DAY_WITH_YEAR.format(new Date(at))}, ${TIME.format(new Date(at))} UTC`;
}

function firstName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

function buildSteps(input: ShipmentEmailInput) {
  const currentIndex = SHIPMENT_EMAIL_STATUSES.indexOf(input.status);
  const latest = new Map<ShipmentEmailStatus, ShipmentEmailEvent>();
  for (const event of input.events) latest.set(event.status, event);

  return SHIPMENT_EMAIL_STATUSES.map((status, index) => {
    const event = latest.get(status);
    const at =
      event?.at ?? (status === input.status ? input.updatedAt : undefined);
    let state: StepState;
    if (index < currentIndex) {
      state = at ? "complete" : "skipped";
    } else if (index === currentIndex) {
      state = "active";
    } else {
      state = "future";
    }
    return { status, index, at, state };
  });
}

function stepStamp(
  step: ReturnType<typeof buildSteps>[number],
  estimatedDelivery: number,
) {
  if (step.state === "complete" || step.state === "active") {
    if (!step.at)
      return { primary: STEP_COPY[step.status].stamp, secondary: "" };
    return {
      primary: dayStamp(step.at),
      secondary: TIME.format(new Date(step.at)),
    };
  }
  if (step.state === "skipped") return { primary: "Skipped", secondary: "" };
  if (step.status === "shipped") {
    return { primary: "Expected", secondary: dayStamp(estimatedDelivery) };
  }
  return { primary: "To come", secondary: "" };
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

type Marker = {
  background: string;
  border: string;
  color: string;
  glyph: string;
  size: number;
};

function stepMarker(state: StepState, status: ShipmentEmailStatus): Marker {
  if (state === "complete") {
    return {
      background: PALETTE.primary,
      border: `1px solid ${PALETTE.primary}`,
      color: PALETTE.white,
      glyph: "&#10003;",
      size: 11,
    };
  }
  if (state === "active") {
    const accent = status === "on_hold" ? PALETTE.amber : PALETTE.primary;
    return {
      background: PALETTE.card,
      border: `2px solid ${accent}`,
      color: accent,
      glyph: stepGlyph(state, status),
      size: 13,
    };
  }
  if (state === "skipped") {
    return {
      background: PALETTE.ice,
      border: `1px dashed ${PALETTE.line}`,
      color: PALETTE.faint,
      glyph: "&#8211;",
      size: 10,
    };
  }
  return {
    background: PALETTE.card,
    border: `1px solid ${PALETTE.line}`,
    color: PALETTE.line,
    glyph: "&#183;",
    size: 10,
  };
}

function stepGlyph(state: StepState, status?: ShipmentEmailStatus) {
  if (state === "complete") return "&#10003;";
  if (state === "skipped") return "&#8211;";
  if (state === "active" && status === "on_hold") return "!";
  if (state === "active") return "&#8226;";
  return "&#183;";
}

/**
 * One segment of a rail: a dashed hairline, or a solid accent bar once the
 * consignment has passed it. `waypoint` adds the shipping desk's diamond.
 */
function railSegment(filled: boolean, accent: string, waypoint = false) {
  const colour = filled ? accent : PALETTE.line;
  // Both states are drawn as a top border on a 2px row, so the solid progress
  // and the dashed track share one baseline through the station markers.
  const bar = filled
    ? `height:2px;line-height:2px;font-size:0;border-top:2px solid ${colour};`
    : `height:2px;line-height:2px;font-size:0;border-top:1px dashed ${colour};`;

  if (!waypoint) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                    <tr><td height="2" style="${bar}"></td></tr>
                  </table>`;
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      <td width="48%" height="2" style="${bar}"></td>
                      <td width="10" height="2" align="center" style="height:2px;line-height:2px;font-family:${FONT_STACK};font-size:8px;color:${colour};">&#9670;</td>
                      <td width="48%" height="2" style="${bar}"></td>
                    </tr>
                  </table>`;
}

type Station = {
  marker: Marker;
  kicker: string;
  title: string;
  titleColor?: string;
  lines: string[];
};

/**
 * A route rail: stations on a dashed track with a solid fill up to `progress`
 * (0-1). The diamond waypoints sit midway through each passed segment, exactly
 * like the dispatch board in the member's shipping view.
 */
function rail(
  stations: Station[],
  progress: number,
  accent: string,
  waypoints: boolean,
) {
  const count = stations.length;
  const lastIndex = count - 1;

  const cells = stations
    .map((station, index) => {
      const thresholdLeft = lastIndex === 0 ? 0 : (index - 0.5) / lastIndex;
      const thresholdRight = lastIndex === 0 ? 0 : (index + 0.5) / lastIndex;
      const left =
        index > 0 ? railSegment(progress >= thresholdLeft, accent) : "";
      const right =
        index < lastIndex
          ? railSegment(progress >= thresholdRight, accent, waypoints)
          : "";

      return `
              <td width="${Math.floor(100 / count)}%" align="center" valign="top" style="padding:0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td valign="middle" align="right" style="padding:0 0 0 0;">${left}</td>
                    <td width="26" valign="middle" align="center" style="width:26px;padding:0;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                        <tr>
                          <td width="26" height="26" align="center" valign="middle" style="width:26px;height:26px;border-radius:13px;background-color:${
                            station.marker.background
                          };border:${station.marker.border};text-align:center;font-family:${FONT_STACK};font-size:${
                            station.marker.size
                          }px;line-height:24px;font-weight:700;color:${station.marker.color};">${
                            station.marker.glyph
                          }</td>
                        </tr>
                      </table>
                    </td>
                    <td valign="middle" align="left" style="padding:0;">${right}</td>
                  </tr>
                </table>
                <p style="margin:10px 0 0;font-family:${FONT_STACK};font-size:8px;line-height:12px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${PALETTE.faint};text-align:center;">${escapeHtml(
                  station.kicker,
                )}</p>
                <p style="margin:3px 0 0;font-family:${FONT_STACK};font-size:11px;line-height:15px;font-weight:700;letter-spacing:-0.01em;color:${
                  station.titleColor ?? PALETTE.ink
                };text-align:center;">${escapeHtml(station.title)}</p>
                ${station.lines
                  .filter(Boolean)
                  .map(
                    (line, lineIndex) =>
                      `<p style="margin:${lineIndex === 0 ? "3" : "1"}px 0 0;font-family:${FONT_STACK};font-size:9px;line-height:13px;color:${PALETTE.muted};text-align:center;font-variant-numeric:tabular-nums;">${escapeHtml(
                        line,
                      )}</p>`,
                  )
                  .join("")}
              </td>`;
    })
    .join("");

  return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;">
          <tr>${cells}
          </tr>
        </table>`;
}

/** The route's passing line: solid once travelled, dashed while still ahead. */
function routeLine(filled: boolean, accent: string) {
  const colour = filled ? accent : PALETTE.line;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;">
                    <tr><td height="2" style="height:2px;line-height:2px;font-size:0;border-top:${
                      filled ? "2px solid" : "2px dashed"
                    } ${colour};">&nbsp;</td></tr>
                  </table>`;
}

/** The shipping desk's waypoint diamond, filled once the route passes it. */
function routeDiamond(filled: boolean, accent: string) {
  return `<td width="9" align="center" valign="middle" style="width:9px;font-family:${FONT_STACK};font-size:8px;line-height:8px;color:${
    filled ? accent : PALETTE.line
  };">&#9670;</td>`;
}

/** A station marker: a pin at either end, the carrier's mode at the live one. */
function routeMarker({
  background,
  border,
  colour,
  icon,
}: {
  background: string;
  border: string;
  colour: string;
  icon?: string;
}) {
  return `<table role="presentation" width="30" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;">
                  <tr>
                    <td width="30" height="30" align="center" valign="middle" style="width:30px;height:30px;border-radius:15px;background-color:${background};border:${border};text-align:center;">${
                      icon
                        ? `<img src="${escapeAttribute(
                            icon,
                          )}" width="15" height="15" alt="" style="display:block;width:15px;height:15px;border:0;margin:0 auto;" />`
                        : `<span style="font-family:${FONT_STACK};font-size:10px;line-height:15px;color:${colour};">&#9670;</span>`
                    }</td>
                  </tr>
                </table>`;
}

function routeStation(kicker: string, title: string, attention = false) {
  return `<p style="margin:10px 0 0;font-family:${FONT_STACK};font-size:9px;line-height:12px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${
    PALETTE.faint
  };text-align:center;">${escapeHtml(kicker)}</p>
                <p style="margin:5px 0 0;font-family:${FONT_STACK};font-size:13px;line-height:17px;font-weight:700;letter-spacing:-0.01em;color:${
                  attention ? PALETTE.amber : PALETTE.ink
                };text-align:center;">${escapeHtml(title)}</p>`;
}

/**
 * The consignment route, drawn exactly as the Convex-native shipment email
 * draws it: origin pin, the carrier's mode at the live position, destination
 * pin, with the passed span solid and the rest of the journey dashed. The
 * vault keeps no position, so the middle station says so plainly rather than
 * lending the status word as a place.
 */
function routeRail({
  origin,
  destination,
  status,
  accent,
  appOrigin,
}: {
  origin: string;
  destination: string;
  status: ShipmentEmailStatus;
  accent: string;
  appOrigin?: string;
}) {
  const progress = ROUTE_PROGRESS[status];
  const attention = status === "on_hold";
  const delivered = status === "shipped";
  const position = "No location recorded";
  const icon = (file: string) =>
    appOrigin ? `${appOrigin}/email/${file}` : undefined;

  const originMarker = routeMarker({
    background: PALETTE.primary,
    border: `1px solid ${PALETTE.primary}`,
    colour: PALETTE.white,
    icon: icon("route-pin-origin.png"),
  });
  const positionMarker = routeMarker({
    background: accent,
    border: `1px solid ${accent}`,
    colour: PALETTE.white,
    icon: icon("route-truck.png"),
  });
  const destinationMarker = routeMarker(
    delivered
      ? {
          background: PALETTE.emerald,
          border: `1px solid ${PALETTE.emerald}`,
          colour: PALETTE.white,
          icon: icon("route-pin-origin.png"),
        }
      : {
          background: PALETTE.card,
          border: `1px solid ${PALETTE.primaryLine}`,
          colour: PALETTE.primaryDeep,
          icon: icon("route-pin-destination.png"),
        },
  );

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;">
      <tr>
        <td width="33.33%" align="center" valign="top" style="padding:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td width="50%" style="padding:0;"></td>
              <td width="30" valign="middle" style="width:30px;padding:0;">${originMarker}</td>
              <td width="50%" valign="middle" style="padding:0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td valign="middle" style="padding:0;">${routeLine(
                      progress >= 0.25,
                      accent,
                    )}</td>
                    ${routeDiamond(progress >= 0.25, accent)}
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          ${routeStation("Origin", origin)}
        </td>
        <td width="33.33%" align="center" valign="top" style="padding:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td width="50%" valign="middle" style="padding:0;">${routeLine(
                progress >= 0.5,
                accent,
              )}</td>
              <td width="30" valign="middle" style="width:30px;padding:0;">${positionMarker}</td>
              <td width="50%" valign="middle" style="padding:0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td valign="middle" style="padding:0;">${routeLine(
                      progress >= 0.75,
                      accent,
                    )}</td>
                    ${routeDiamond(progress >= 0.75, accent)}
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          ${routeStation("Position", position, attention)}
        </td>
        <td width="33.33%" align="center" valign="top" style="padding:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td width="50%" valign="middle" style="padding:0;">${routeLine(
                progress >= 1,
                accent,
              )}</td>
              <td width="30" valign="middle" style="width:30px;padding:0;">${destinationMarker}</td>
              <td width="50%" style="padding:0;"></td>
            </tr>
          </table>
          ${routeStation("Destination", destination)}
        </td>
      </tr>
    </table>`;
}

function chip(
  label: string,
  tone: { border: string; background: string; text: string },
  dot?: string,
) {
  return `<td style="padding:0 6px 0 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;mso-table-lspace:0;mso-table-rspace:0;">
                    <tr>
                      <td style="border:1px solid ${tone.border};background-color:${
                        tone.background
                      };border-radius:999px;padding:6px 11px;font-family:${FONT_STACK};font-size:10px;line-height:12px;font-weight:700;color:${
                        tone.text
                      };white-space:nowrap;">${
                        dot
                          ? `<span style="color:${dot};font-size:8px;">&#9679;</span>&nbsp;`
                          : ""
                      }${escapeHtml(label)}</td>
                    </tr>
                  </table>
                </td>`;
}

function detailRow(label: string, value: string, last = false) {
  return `
                <tr>
                  <td valign="top" width="38%" style="padding:11px 0 ${
                    last ? "0" : "11px"
                  };font-family:${FONT_STACK};font-size:10px;line-height:16px;letter-spacing:0.04em;color:${
                    PALETTE.muted
                  };border-bottom:${last ? "none" : `1px solid ${PALETTE.lineSoft}`};">${escapeHtml(
                    label,
                  )}</td>
                  <td valign="top" style="padding:11px 0 ${
                    last ? "0" : "11px"
                  };font-family:${FONT_STACK};font-size:11px;line-height:17px;font-weight:600;color:${
                    PALETTE.ink
                  };text-align:right;border-bottom:${last ? "none" : `1px solid ${PALETTE.lineSoft}`};">${escapeHtml(
                    value,
                  )}</td>
                </tr>`;
}

function sectionLabel(text: string) {
  return `<p style="margin:0 0 14px;font-family:${FONT_STACK};font-size:8px;line-height:12px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${PALETTE.faint};">${escapeHtml(
    text,
  )}</p>`;
}

function serviceCell(glyph: string, title: string, copy: string, last = false) {
  return `
            <td width="33.33%" valign="top" style="padding:0 ${
              last ? "0" : "10px"
            } 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td width="26" height="26" align="center" valign="middle" style="width:26px;height:26px;border-radius:4px;background-color:${
                    PALETTE.ice
                  };border:1px solid ${PALETTE.iceDeep};text-align:center;font-family:${FONT_STACK};font-size:12px;color:${
                    PALETTE.primaryDeep
                  };">${glyph}</td>
                  <td style="padding-left:9px;font-family:${FONT_STACK};font-size:10px;line-height:14px;font-weight:700;color:${
                    PALETTE.ink
                  };">${escapeHtml(title)}</td>
                </tr>
              </table>
              <p style="margin:6px 0 0;font-family:${FONT_STACK};font-size:9px;line-height:14px;color:${
                PALETTE.muted
              };">${escapeHtml(copy)}</p>
            </td>`;
}

function photoCell(input: ShipmentEmailInput, origin: string | undefined) {
  const path =
    input.photoPath &&
    /^\/[a-z0-9/_-]+\.(webp|png|jpe?g|svg)$/i.test(input.photoPath)
      ? input.photoPath
      : undefined;
  const src = path && origin ? safeUrl(`${origin}${path}`) : undefined;

  if (src) {
    return `<td width="54" valign="middle" style="width:54px;padding:0 14px 0 0;">
                        <img src="${escapeAttribute(src)}" width="54" height="54" alt="${escapeAttribute(
                          input.mineralName,
                        )}" style="display:block;width:54px;height:54px;border-radius:4px;border:1px solid ${
                          PALETTE.line
                        };object-fit:cover;background-color:${PALETTE.ice};" />
                      </td>`;
  }

  return `<td width="54" valign="middle" style="width:54px;padding:0 14px 0 0;">
                        <table role="presentation" width="54" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                          <tr>
                            <td width="54" height="54" align="center" valign="middle" style="width:54px;height:54px;border-radius:4px;border:1px solid ${
                              PALETTE.line
                            };background-color:${PALETTE.ice};text-align:center;font-family:${FONT_STACK};font-size:18px;color:${
                              PALETTE.primaryDeep
                            };">&#9670;</td>
                          </tr>
                        </table>
                      </td>`;
}

const TRACKING_PATH = "/dashboard/shipments";

/**
 * Render the complete email. Every interpolated field is HTML-escaped, links
 * are restricted to http(s), and dates are formatted in UTC so the server and
 * the in-app preview always agree.
 */
export function renderShipmentUpdateEmail(
  input: ShipmentEmailInput,
): RenderedShipmentEmail {
  const copy = STEP_COPY[input.status];
  const name = firstName(input.memberName);
  const company = toText(input.companyName, "Cosmic Vault Insurance");
  const support = toText(input.supportEmail, "concierge@cosmicvault.co");
  const trackingUrl = safeUrl(input.trackingUrl);
  const appOrigin = safeUrl(input.appOrigin)?.replace(/\/$/, "");
  const note = toText(input.note, copy.description);
  const updatedLabel = fullStamp(input.updatedAt);
  const eta = DAY_WITH_YEAR.format(new Date(input.estimatedDelivery));
  const delivered = input.status === "shipped";
  const accent = input.status === "on_hold" ? PALETTE.amber : PALETTE.primary;
  const steps = buildSteps(input);
  const currentIndex = steps.findIndex((step) => step.state === "active");
  const originCity = toText(input.originCity, input.origin);
  const destinationCity = toText(input.destinationCity, input.destination);

  const subject = `${copy.subject} \u00b7 ${input.trackingNumber}`;
  const preheader = `${copy.headline}. ${note} Estimated delivery ${eta}.`;

  const journeyStations: Station[] = steps.map((step) => {
    const stamp = stepStamp(step, input.estimatedDelivery);
    return {
      marker: stepMarker(step.state, step.status),
      kicker: STEP_COPY[step.status].stamp,
      title: STEP_COPY[step.status].label,
      titleColor:
        step.state === "future"
          ? PALETTE.faint
          : step.status === "on_hold" && step.state === "active"
            ? PALETTE.amber
            : PALETTE.ink,
      lines: [stamp.primary, stamp.secondary],
    };
  });

  const journeyProgress =
    currentIndex <= 0 ? 0 : currentIndex / (SHIPMENT_EMAIL_STATUSES.length - 1);

  const footerLink = (path: string, label: string) => {
    if (!appOrigin) {
      return `<p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:10px;line-height:16px;color:#A9C3E8;">${escapeHtml(
        label,
      )}</p>`;
    }
    return `<p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:10px;line-height:16px;"><a href="${escapeAttribute(
      `${appOrigin}${path}`,
    )}" style="color:#A9C3E8;text-decoration:none;">${escapeHtml(label)}</a></p>`;
  };

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light only" />
    <title>${escapeHtml(subject)}</title>
    <style>
      @media only screen and (max-width: 480px) {
        .cv-pad { padding-left: 20px !important; padding-right: 20px !important; }
        .cv-hero { padding: 26px 20px 24px !important; }
        .cv-title { font-size: 23px !important; line-height: 29px !important; }
        .cv-service { display: block !important; width: 100% !important; padding: 0 0 14px 0 !important; }
        .cv-step-title { font-size: 10px !important; }
        .cv-step-copy { font-size: 8px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:${PALETTE.canvas};">
    <div style="display:none;font-size:1px;color:${PALETTE.canvas};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
      ${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:${PALETTE.canvas};">
      <tr>
        <td align="center" style="padding:26px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;background-color:${PALETTE.card};border:1px solid ${PALETTE.line};border-radius:4px;overflow:hidden;">

            <!-- Brand rule: the amber orbit from the mark -->
            <tr>
              <td height="3" style="height:3px;line-height:3px;font-size:0;background-color:#FFC400;">&nbsp;</td>
            </tr>

            <!-- Utility strip -->
            <tr>
              <td class="cv-pad" style="padding:10px 28px;border-bottom:1px solid ${PALETTE.line};">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="font-family:${FONT_STACK};font-size:8px;line-height:12px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:${PALETTE.muted};">Vault &nbsp;/&nbsp; Shipments</td>
                    <td align="right" style="font-family:${FONT_STACK};font-size:9px;line-height:12px;color:${PALETTE.muted};">Concierge &nbsp;&middot;&nbsp; <a href="mailto:${escapeAttribute(
                      support,
                    )}" style="color:${PALETTE.primaryDeep};text-decoration:none;">${escapeHtml(
                      support,
                    )}</a></td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Brand header -->
            <tr>
              <td class="cv-pad" style="padding:18px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td valign="middle">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                        <tr>
                          <td width="30" height="30" align="center" valign="middle" style="width:30px;height:30px;border-radius:4px;background-color:${PALETTE.primary};text-align:center;font-family:${FONT_STACK};font-size:14px;font-weight:700;color:${PALETTE.white};">C</td>
                          <td style="padding-left:10px;">
                            <p style="margin:0;font-family:${FONT_STACK};font-size:15px;line-height:17px;font-weight:700;letter-spacing:-0.02em;color:${PALETTE.ink};">${escapeHtml(
                              company,
                            )}</p>
                            <p style="margin:3px 0 0;font-family:${FONT_STACK};font-size:7px;line-height:9px;font-weight:600;letter-spacing:0.26em;text-transform:uppercase;color:${PALETTE.faint};">Mineral vault</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td align="right" valign="middle" style="font-family:${FONT_STACK};font-size:8px;line-height:12px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:${PALETTE.faint};">Shipment update</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Hero -->
            <tr>
              <td class="cv-hero cv-pad" style="padding:28px 28px 26px;background-color:${PALETTE.ice};border-top:1px solid ${PALETTE.line};border-bottom:1px solid ${PALETTE.line};">
                <p style="margin:0 0 12px;font-family:${FONT_STACK};font-size:8px;line-height:12px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:${PALETTE.muted};">
                  Shipment update
                  <span style="display:inline-block;width:4px;height:4px;border-radius:1px;background-color:${PALETTE.primary};vertical-align:middle;">&nbsp;</span>
                  ${escapeHtml(input.trackingNumber)}
                </p>
                <h1 class="cv-title" style="margin:0;font-family:${FONT_STACK};font-size:26px;line-height:32px;font-weight:700;letter-spacing:-0.045em;color:${PALETTE.ink};">${escapeHtml(
                  copy.headline,
                )}</h1>
                <p style="margin:10px 0 0;font-family:${FONT_STACK};font-size:11px;line-height:18px;color:${PALETTE.muted};">${breakLines(
                  note,
                )}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin-top:16px;">
                  <tr>
                    ${chip(STATUS_CHIP_LABEL[input.status], CHIP_TONE[input.status])}
                    ${chip(
                      delivered ? `Delivered ${eta}` : `ETA \u00b7 ${eta}`,
                      {
                        border: PALETTE.line,
                        background: PALETTE.card,
                        text: PALETTE.muted,
                      },
                    )}
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Route -->
            <tr>
              <td class="cv-pad" style="padding:24px 28px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid ${PALETTE.line};border-radius:4px;background-color:${PALETTE.card};">
                  <tr>
                    <td style="padding:18px 18px 16px;">
                      ${sectionLabel("Consignment route")}
                      ${routeRail({
                        origin: originCity,
                        destination: destinationCity,
                        status: input.status,
                        accent,
                        appOrigin,
                      })}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Journey -->
            <tr>
              <td class="cv-pad" style="padding:16px 28px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid ${PALETTE.line};border-radius:4px;background-color:${PALETTE.card};">
                  <tr>
                    <td style="padding:18px 18px 16px;">
                      ${sectionLabel("Journey")}
                      ${rail(journeyStations, journeyProgress, accent, false)}
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                        <tr>
                          <td style="padding:16px 0 0;border-top:1px solid ${PALETTE.lineSoft};">
                            <p style="margin:0;font-family:${FONT_STACK};font-size:8px;line-height:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${PALETTE.faint};">Latest update &nbsp;&middot;&nbsp; ${escapeHtml(
                              updatedLabel,
                            )}</p>
                            <p style="margin:6px 0 0;font-family:${FONT_STACK};font-size:11px;line-height:18px;color:${PALETTE.ink};">${breakLines(
                              note,
                            )}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Consignment -->
            <tr>
              <td class="cv-pad" style="padding:16px 28px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid ${PALETTE.line};border-radius:4px;background-color:${PALETTE.card};">
                  <tr>
                    <td style="padding:18px 18px 14px;">
                      ${sectionLabel("Your consignment")}
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                        <tr>
                          ${photoCell(input, appOrigin)}
                          <td valign="middle">
                            <p style="margin:0;font-family:${FONT_STACK};font-size:13px;line-height:18px;font-weight:700;letter-spacing:-0.01em;color:${PALETTE.ink};">${escapeHtml(
                              input.mineralName,
                            )}</p>
                            <p style="margin:3px 0 0;font-family:${FONT_STACK};font-size:10px;line-height:15px;color:${PALETTE.muted};">${escapeHtml(
                              input.category,
                            )} &nbsp;&middot;&nbsp; ${escapeHtml(input.weightLabel)}</p>
                            <p style="margin:2px 0 0;font-family:${FONT_STACK};font-size:9px;line-height:14px;color:${PALETTE.faint};">${escapeHtml(
                              input.mineralType,
                            )} &nbsp;&middot;&nbsp; ${escapeHtml(input.vaultId)}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px 16px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:1px solid ${PALETTE.lineSoft};">
                        ${detailRow("Carrier", `${input.carrier} \u00b7 ${input.service}`)}
                        ${detailRow("Tracking number", input.trackingNumber)}
                        ${detailRow("Origin", input.origin)}
                        ${detailRow("Destination", input.destination)}
                        ${detailRow("Estimated delivery", eta, true)}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Services -->
            <tr>
              <td class="cv-pad" style="padding:18px 28px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    ${serviceCell("&#10003;", "Fully insured", "Cover travels with the piece")}
                    ${serviceCell("&#9998;", "Signature release", "Handed over to you only")}
                    ${serviceCell("&#9742;", "24&times;7 concierge", "A human, at any hour", true)}
                  </tr>
                </table>
              </td>
            </tr>

            <!-- CTA -->
            <tr>
              <td class="cv-pad" style="padding:20px 28px 26px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:${PALETTE.ice};border:1px solid ${PALETTE.line};border-radius:4px;">
                  <tr>
                    <td align="center" style="padding:22px 20px;">
                      <p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:8px;line-height:12px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${PALETTE.muted};">Your vault</p>
                      <p style="margin:0;font-family:${FONT_STACK};font-size:18px;line-height:24px;font-weight:700;letter-spacing:-0.035em;color:${PALETTE.ink};">Follow every handover</p>
                      <p style="margin:8px 0 0;font-family:${FONT_STACK};font-size:10px;line-height:17px;color:${PALETTE.muted};">The tracking view carries this same timeline, the carrier reference and every note our vault team records.</p>
                      ${
                        trackingUrl
                          ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:separate;margin:16px auto 0;">
                        <tr>
                          <td align="center" bgcolor="${PALETTE.primary}" style="border-radius:4px;">
                            <a href="${escapeAttribute(
                              trackingUrl,
                            )}" style="display:inline-block;padding:12px 26px;font-family:${FONT_STACK};font-size:11px;line-height:16px;font-weight:700;letter-spacing:0.02em;color:${PALETTE.white};text-decoration:none;border-radius:4px;">Track this shipment</a>
                          </td>
                        </tr>
                      </table>`
                          : ""
                      }
                      <p style="margin:12px 0 0;font-family:${FONT_STACK};font-size:10px;line-height:16px;color:${PALETTE.muted};">Questions? <a href="mailto:${escapeAttribute(
                        support,
                      )}" style="color:${PALETTE.primaryDeep};text-decoration:underline;">${escapeHtml(
                        support,
                      )}</a></p>
                    </td>
                  </tr>
                </table>
                <p style="margin:14px 0 0;font-family:${FONT_STACK};font-size:9px;line-height:15px;color:${PALETTE.faint};text-align:center;">Tracking statuses are changed only by vault operations.</p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td bgcolor="${PALETTE.ink}" style="background-color:${PALETTE.ink};padding:26px 28px 22px;border-top:3px solid ${PALETTE.primary};">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td valign="top" width="46%" style="padding:0 18px 18px 0;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                        <tr>
                          <td width="28" height="28" align="center" valign="middle" style="width:28px;height:28px;border-radius:4px;background-color:${PALETTE.primary};text-align:center;font-family:${FONT_STACK};font-size:13px;font-weight:700;color:${PALETTE.white};">C</td>
                          <td style="padding-left:9px;">
                            <p style="margin:0;font-family:${FONT_STACK};font-size:14px;line-height:16px;font-weight:700;letter-spacing:-0.02em;color:${PALETTE.white};">${escapeHtml(
                              company,
                            )}</p>
                            <p style="margin:3px 0 0;font-family:${FONT_STACK};font-size:7px;line-height:9px;font-weight:600;letter-spacing:0.26em;text-transform:uppercase;color:#A9C3E8;">Mineral vault</p>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:12px 0 0;font-family:${FONT_STACK};font-size:10px;line-height:16px;color:#A9C3E8;">Vaulted, insured and tracked under one roof. Every consignment is handled by named vault staff and released only against your instruction.</p>
                    </td>
                    <td valign="top" width="27%" style="padding:0 10px 18px 0;">
                      <p style="margin:0 0 10px;font-family:${FONT_STACK};font-size:8px;line-height:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#7E9FC9;">Your vault</p>
                      ${footerLink(TRACKING_PATH, "Shipment tracking")}
                      ${footerLink("/dashboard/vault", "Mineral register")}
                      ${footerLink("/dashboard/documents", "Documents")}
                      ${footerLink("/dashboard/support", "Concierge")}
                    </td>
                    <td valign="top" width="27%" style="padding:0 0 18px;">
                      <p style="margin:0 0 10px;font-family:${FONT_STACK};font-size:8px;line-height:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#7E9FC9;">Small print</p>
                      ${footerLink("/legal/terms", "Terms")}
                      ${footerLink("/legal/privacy", "Privacy")}
                      ${footerLink("/about", "About the vault")}
                    </td>
                  </tr>
                  <tr>
                    <td colspan="3" style="padding:14px 0 0;border-top:1px solid #1E3050;font-family:${FONT_STACK};font-size:9px;line-height:15px;color:#7E9FC9;">
                      &copy; ${new Date().getUTCFullYear()} ${escapeHtml(
                        company,
                      )} &nbsp;&middot;&nbsp; ${escapeHtml(
                        input.trackingNumber,
                      )}<br />
                      You are receiving this service message because a consignment in your vault changed status.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

          </table>

          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;">
            <tr>
              <td align="center" style="padding:14px 20px 0;font-family:${FONT_STACK};font-size:8px;line-height:13px;color:${PALETTE.faint};">
                Sent to ${escapeHtml(input.memberEmail)} &nbsp;&middot;&nbsp; ${escapeHtml(
                  company,
                )}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textLines = steps.map((step) => {
    const stamp = stepStamp(step, input.estimatedDelivery);
    const when = stamp.secondary
      ? `${stamp.primary} ${stamp.secondary}`
      : stamp.primary;
    return `  ${STEP_COPY[step.status].label.padEnd(12, " ")} ${when}`;
  });

  const trackLine = trackingUrl
    ? `Track your shipment: ${trackingUrl}`
    : `Track your shipment from your vault at ${appOrigin ?? "your dashboard"}.`;

  const text = [
    `${company.toUpperCase()} \u00b7 SHIPMENT UPDATE`,
    "",
    `Hello ${name},`,
    "",
    `${copy.headline}.`,
    "",
    note,
    "",
    `Latest update: ${updatedLabel}`,
    "",
    `Status: ${copy.label}`,
    `Tracking: ${input.trackingNumber} (${input.carrier} \u00b7 ${input.service})`,
    `Route: ${originCity} to ${destinationCity}`,
    "",
    "Journey",
    ...textLines,
    "",
    "Consignment",
    `  ${input.mineralName} \u00b7 ${input.category}`,
    `  ${input.weightLabel} \u00b7 ${input.vaultId}`,
    `  From: ${input.origin}`,
    `  To: ${input.destination}`,
    `  Estimated delivery: ${eta}`,
    "",
    trackLine,
    "",
    `Questions? Reply to this message or write to ${support}.`,
    "",
    `${company}`,
    `You are receiving this service message because a consignment in your vault changed status.`,
  ].join("\n");

  return { subject, preheader, html, text };
}
