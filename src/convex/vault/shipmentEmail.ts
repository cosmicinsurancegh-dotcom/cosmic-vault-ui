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
 * the dashboard's dark navy panel.
 *
 * Every band is full width and reads top to bottom: route, consignment, then
 * the stage ledger. Two drawings of the same journey would echo each other in a
 * narrow column, so the stages are a vertical list of rows rather than a second
 * rail, and the route keeps its full 544px to breathe.
 */

import { EMAIL_COLOURS } from "../lib/emailPalette";
import {
  renderRouteRail,
  renderStageLedger,
  type LedgerStage,
  type RouteRailTone,
} from "../lib/routeRail";
import { isStaticMapUrl } from "../lib/staticMap";

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
  /** A Mapbox static image of the route; the rail is drawn without one. */
  mapUrl?: string;
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

/**
 * The dashboard's own colours: every value comes from `emailPalette`, which
 * restates `src/index.css` in hex for email clients. Nothing here is typed in
 * by hand, so the email moves when the design system moves.
 */
const PALETTE = {
  canvas: EMAIL_COLOURS.canvas,
  card: EMAIL_COLOURS.card,
  ice: EMAIL_COLOURS.panel,
  primary: EMAIL_COLOURS.electric,
  primaryDeep: EMAIL_COLOURS.electricDeep,
  primaryTint: EMAIL_COLOURS.electricTint,
  primaryLine: EMAIL_COLOURS.electricLine,
  ink: EMAIL_COLOURS.ink,
  /** The dark panel behind the footer; the Convex email uses the same. */
  navy: EMAIL_COLOURS.navy,
  muted: EMAIL_COLOURS.muted,
  faint: EMAIL_COLOURS.faint,
  line: EMAIL_COLOURS.line,
  lineSoft: EMAIL_COLOURS.lineSoft,
  amber: EMAIL_COLOURS.amber,
  amberTint: EMAIL_COLOURS.amberTint,
  amberLine: EMAIL_COLOURS.amberLine,
  emerald: EMAIL_COLOURS.emerald,
  emeraldTint: EMAIL_COLOURS.emeraldTint,
  emeraldLine: EMAIL_COLOURS.emeraldLine,
  white: EMAIL_COLOURS.white,
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

/** The vault palette, in the shape the shared rail and ledger draw with. */
function vaultTone(accent: string): RouteRailTone {
  return {
    origin: PALETTE.primary,
    accent,
    attention: PALETTE.amber,
    track: PALETTE.line,
    ink: PALETTE.ink,
    muted: PALETTE.muted,
    faint: PALETTE.faint,
    white: PALETTE.white,
    surface: PALETTE.card,
    outline: PALETTE.primaryLine,
    outlineInk: PALETTE.primaryDeep,
    emerald: PALETTE.emerald,
  };
}

/**
 * The consignment route, drawn by the shared rail the Convex-native email also
 * uses: origin pin, the carrier's mode at the live position, destination pin,
 * with the passed span solid and the rest of the journey dashed. The vault
 * keeps no position, so the middle station says so plainly rather than lending
 * the status word as a place.
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
  return renderRouteRail({
    origin,
    destination,
    progress: ROUTE_PROGRESS[status],
    attention: status === "on_hold",
    delivered: status === "shipped",
    iconBase: appOrigin,
    fontStack: FONT_STACK,
    tone: vaultTone(accent),
  });
}

/**
 * The route: a real map when one was resolved for the consignment, otherwise
 * the drawn rail. The map is a plain image - email clients run no scripts -
 * and it links to the member's tracking view when that link is usable.
 */
function routeFigure({
  origin,
  destination,
  status,
  accent,
  appOrigin,
  mapUrl,
  trackingUrl,
}: {
  origin: string;
  destination: string;
  status: ShipmentEmailStatus;
  accent: string;
  appOrigin?: string;
  mapUrl?: string;
  trackingUrl?: string;
}) {
  if (!isStaticMapUrl(mapUrl)) {
    return routeRail({ origin, destination, status, accent, appOrigin });
  }

  const link = safeUrl(trackingUrl);
  // The card is full width, so the map is too: the URL is a @2x image, which
  // keeps it sharp at the widest the card ever gets.
  const image = `<img src="${escapeAttribute(
    mapUrl,
  )}" width="504" height="324" alt="Map of the route from ${escapeAttribute(
    origin,
  )} to ${escapeAttribute(
    destination,
  )}" style="display:block;width:100%;max-width:100%;height:auto;border:1px solid ${PALETTE.line};border-radius:4px;" />`;
  const figure = link
    ? `<a href="${escapeAttribute(link)}" style="text-decoration:none;">${image}</a>`
    : image;

  return `${figure}
                <p style="margin:8px 0 0;font-family:${FONT_STACK};font-size:8px;line-height:12px;letter-spacing:0.04em;color:${PALETTE.faint};">Mapbox &nbsp;&middot;&nbsp; &copy; OpenStreetMap contributors</p>`;
}

/**
 * The brand mark, as a PNG: Gmail strips SVG. Without an app origin there is
 * nothing to load, so the tile falls back to the letter.
 */
function brandMark(appOrigin: string | undefined, size: number) {
  const base = appOrigin
    ? `<img src="${escapeAttribute(
        `${appOrigin}/email/logo-mark.png`,
      )}" width="${size}" height="${size}" alt="" style="display:block;width:${size}px;height:${size}px;border:0;" />`
    : "C";
  const background = appOrigin ? "transparent" : PALETTE.primary;
  return `<td width="${size}" height="${size}" align="center" valign="middle" style="width:${size}px;height:${size}px;border-radius:4px;background-color:${background};text-align:center;font-family:${FONT_STACK};font-size:${Math.round(
    size / 2,
  )}px;font-weight:700;color:${PALETTE.white};">${base}</td>`;
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
  const padding = `padding:11px 0 ${last ? "0" : "11px"}`;
  const hairline = `border-bottom:${last ? "none" : `1px solid ${PALETTE.lineSoft}`}`;
  return `
                <tr>
                  <td valign="top" width="32%" style="${padding};${hairline};font-family:${FONT_STACK};font-size:8px;line-height:16px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${
                    PALETTE.muted
                  };">${escapeHtml(label)}</td>
                  <td valign="top" style="${padding};${hairline};font-family:${FONT_STACK};font-size:11px;line-height:17px;font-weight:600;color:${
                    PALETTE.ink
                  };text-align:right;font-variant-numeric:tabular-nums;">${escapeHtml(
                    value,
                  )}</td>
                </tr>`;
}

function sectionLabel(text: string) {
  return `<p style="margin:0 0 14px;font-family:${FONT_STACK};font-size:8px;line-height:12px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${PALETTE.muted};">${escapeHtml(
    text,
  )}</p>`;
}

/**
 * One of the three standing promises, set as print: a tracked label over a
 * line of copy, divided by a hairline rather than boxed in an icon tile.
 */
function assuranceCell(label: string, copy: string, first = false) {
  return `<td class="cv-assurance" width="33.33%" valign="top" style="width:33.33%;padding:0 16px 0 ${
    first ? "0" : "16px"
  };border-left:${first ? "0" : `1px solid ${PALETTE.lineSoft}`};">
              <p style="margin:0;font-family:${FONT_STACK};font-size:8px;line-height:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${
                PALETTE.ink
              };">${escapeHtml(label)}</p>
              <p style="margin:5px 0 0;font-family:${FONT_STACK};font-size:10px;line-height:15px;color:${
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
    return `<td width="64" valign="middle" style="width:64px;padding:0 16px 0 0;">
                        <img src="${escapeAttribute(src)}" width="64" height="64" alt="${escapeAttribute(
                          input.mineralName,
                        )}" style="display:block;width:64px;height:64px;border-radius:4px;border:1px solid ${
                          PALETTE.line
                        };object-fit:cover;background-color:${PALETTE.ice};" />
                      </td>`;
  }

  return `<td width="64" valign="middle" style="width:64px;padding:0 16px 0 0;">
                        <table role="presentation" width="64" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
                          <tr>
                            <td width="64" height="64" align="center" valign="middle" style="width:64px;height:64px;border-radius:4px;border:1px solid ${
                              PALETTE.line
                            };background-color:${PALETTE.ice};text-align:center;font-family:${FONT_STACK};font-size:20px;color:${
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
  /* An estimate only means something while the consignment is still ahead:
     beside a Delivered chip the date would read as the arrival date. */
  const showEta = !delivered;
  const accent = input.status === "on_hold" ? PALETTE.amber : PALETTE.primary;
  const steps = buildSteps(input);
  const originCity = toText(input.originCity, input.origin);
  const destinationCity = toText(input.destinationCity, input.destination);

  const subject = `${copy.subject} \u00b7 ${input.trackingNumber}`;
  const preheader = `${copy.headline}. ${note}${
    showEta ? ` Estimated delivery ${eta}.` : ""
  }`;

  const journeyStages: LedgerStage[] = steps.map((step) => {
    const stamp = stepStamp(step, input.estimatedDelivery);
    return {
      label: STEP_COPY[step.status].label,
      state: step.state,
      stamp: [stamp.primary, stamp.secondary].filter(Boolean).join(" \u00b7 "),
      attention: step.state === "active" && step.status === "on_hold",
      delivered: step.state === "active" && step.status === "shipped",
    };
  });

  const footerLink = (path: string, label: string) => {
    if (!appOrigin) {
      return `<p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:10px;line-height:16px;color:${EMAIL_COLOURS.navyMuted};">${escapeHtml(
        label,
      )}</p>`;
    }
    return `<p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:10px;line-height:16px;"><a href="${escapeAttribute(
      `${appOrigin}${path}`,
    )}" style="color:${EMAIL_COLOURS.navyMuted};text-decoration:none;">${escapeHtml(label)}</a></p>`;
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
        .cv-hero { padding: 24px 20px 22px !important; }
        .cv-title { font-size: 24px !important; line-height: 30px !important; }
        .cv-assurance { display: block !important; width: 100% !important; border-left: 0 !important; padding: 0 0 12px 0 !important; }
        .cv-foot-col { display: block !important; width: 100% !important; padding: 0 0 14px 0 !important; }
        .cv-step-title { font-size: 11px !important; }
        .cv-step-copy { font-size: 9px !important; }
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
                          ${brandMark(appOrigin, 30)}
                          <td style="padding-left:10px;">
                            <p style="margin:0;font-family:${FONT_STACK};font-size:15px;line-height:17px;font-weight:700;letter-spacing:-0.02em;color:${PALETTE.ink};">${escapeHtml(
                              company,
                            )}</p>
                            <p style="margin:4px 0 0;font-family:${FONT_STACK};font-size:8px;line-height:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${PALETTE.muted};">Mineral vault</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td align="right" valign="middle" style="font-family:${FONT_STACK};font-size:8px;line-height:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${PALETTE.muted};font-variant-numeric:tabular-nums;">Ref &nbsp;&middot;&nbsp; ${escapeHtml(
                      input.trackingNumber,
                    )}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Hero -->
            <tr>
              <td class="cv-hero cv-pad" style="padding:26px 28px 24px;background-color:${PALETTE.ice};border-top:1px solid ${PALETTE.line};border-bottom:1px solid ${PALETTE.line};">
                <p style="margin:0 0 10px;font-family:${FONT_STACK};font-size:8px;line-height:12px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${PALETTE.muted};">
                  Shipment update
                  <span style="display:inline-block;width:4px;height:4px;border-radius:1px;background-color:${PALETTE.primary};vertical-align:middle;">&nbsp;</span>
                  ${escapeHtml(updatedLabel)}
                </p>
                <h1 class="cv-title" style="margin:0;font-family:${FONT_STACK};font-size:27px;line-height:33px;font-weight:700;letter-spacing:-0.045em;color:${PALETTE.ink};">${escapeHtml(
                  copy.headline,
                )}</h1>
                <p style="margin:9px 0 0;font-family:${FONT_STACK};font-size:12px;line-height:19px;color:${PALETTE.muted};">${breakLines(
                  note,
                )}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin-top:17px;">
                  <tr>
                    ${chip(STATUS_CHIP_LABEL[input.status], CHIP_TONE[input.status])}
                    ${
                      showEta
                        ? `<td valign="middle" style="padding:0 0 0 11px;font-family:${FONT_STACK};font-size:10px;line-height:15px;font-weight:600;letter-spacing:0.13em;text-transform:uppercase;color:${PALETTE.muted};">ETA &nbsp;&middot;&nbsp; ${escapeHtml(
                            eta,
                          )}</td>`
                        : ""
                    }
                  </tr>
                </table>
              </td>
            </tr>

            <!-- The route, full width: a map when one was resolved, else the rail. -->
            <tr>
              <td class="cv-pad" style="padding:22px 28px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid ${PALETTE.line};border-radius:4px;background-color:${PALETTE.card};">
                  <tr>
                    <td style="padding:18px 20px;">
                      ${sectionLabel("Consignment route")}
                      ${routeFigure({
                        origin: originCity,
                        destination: destinationCity,
                        status: input.status,
                        accent,
                        appOrigin,
                        mapUrl: input.mapUrl,
                        trackingUrl,
                      })}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- The consignment itself -->
            <tr>
              <td class="cv-pad" style="padding:12px 28px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid ${PALETTE.line};border-radius:4px;background-color:${PALETTE.card};">
                  <tr>
                    <td style="padding:18px 20px 0;">
                      ${sectionLabel("Your consignment")}
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                        <tr>
                          ${photoCell(input, appOrigin)}
                          <td valign="middle">
                            <p style="margin:0;font-family:${FONT_STACK};font-size:15px;line-height:20px;font-weight:700;letter-spacing:-0.02em;color:${PALETTE.ink};">${escapeHtml(
                              input.mineralName,
                            )}</p>
                            <p style="margin:3px 0 0;font-family:${FONT_STACK};font-size:10px;line-height:15px;color:${PALETTE.muted};">${escapeHtml(
                              input.category,
                            )} &nbsp;&middot;&nbsp; ${escapeHtml(input.weightLabel)}</p>
                            <p style="margin:2px 0 0;font-family:${FONT_STACK};font-size:9px;line-height:14px;color:${PALETTE.muted};">${escapeHtml(
                              input.mineralType,
                            )} &nbsp;&middot;&nbsp; ${escapeHtml(input.vaultId)}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 20px 16px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:1px solid ${PALETTE.lineSoft};">
                        ${detailRow("Carrier", `${input.carrier} \u00b7 ${input.service}`)}
                        ${detailRow("Tracking number", input.trackingNumber)}
                        ${detailRow("Origin", input.origin)}
                        ${detailRow("Destination", input.destination, true)}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- The five stages, as a ledger rather than a second route drawing -->
            <tr>
              <td class="cv-pad" style="padding:12px 28px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid ${PALETTE.line};border-radius:4px;background-color:${PALETTE.card};">
                  <tr>
                    <td style="padding:18px 20px 16px;">
                      ${sectionLabel("Journey")}
                      ${renderStageLedger({
                        stages: journeyStages,
                        tone: vaultTone(accent),
                        fontStack: FONT_STACK,
                      })}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Assurances: three standing promises, set as one line of print -->
            <tr>
              <td class="cv-pad" style="padding:18px 28px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    ${assuranceCell("Fully insured", "Cover travels with the piece", true)}
                    ${assuranceCell("Signature release", "Handed over to you only")}
                    ${assuranceCell("Around the clock", "A human, at any hour")}
                  </tr>
                </table>
              </td>
            </tr>

            <!-- CTA -->
            <tr>
              <td class="cv-pad" style="padding:18px 28px 26px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:${PALETTE.ice};border-radius:4px;">
                  <tr>
                    <td align="center" style="padding:22px 20px 20px;">
                      <p style="margin:0 0 7px;font-family:${FONT_STACK};font-size:8px;line-height:12px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${PALETTE.muted};">Your vault</p>
                      <p style="margin:0;font-family:${FONT_STACK};font-size:17px;line-height:23px;font-weight:700;letter-spacing:-0.03em;color:${PALETTE.ink};">Follow every handover</p>
                      <p style="margin:7px 0 0;font-family:${FONT_STACK};font-size:10px;line-height:16px;color:${PALETTE.muted};">The tracking view carries this same timeline, the carrier reference and every note our vault team records.</p>
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
              <td bgcolor="${PALETTE.navy}" style="background-color:${PALETTE.navy};padding:26px 28px 22px;border-top:3px solid ${PALETTE.primary};">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td class="cv-foot-col" valign="top" width="46%" style="padding:0 18px 18px 0;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                        <tr>
                          ${brandMark(appOrigin, 28)}
                          <td style="padding-left:9px;">
                            <p style="margin:0;font-family:${FONT_STACK};font-size:14px;line-height:16px;font-weight:700;letter-spacing:-0.02em;color:${PALETTE.white};">${escapeHtml(
                              company,
                            )}</p>
                            <p style="margin:4px 0 0;font-family:${FONT_STACK};font-size:8px;line-height:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${EMAIL_COLOURS.navyMuted};">Mineral vault</p>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:12px 0 0;font-family:${FONT_STACK};font-size:10px;line-height:16px;color:${EMAIL_COLOURS.navyMuted};">Vaulted, insured and tracked under one roof. Every consignment is handled by named vault staff and released only against your instruction.</p>
                    </td>
                    <td class="cv-foot-col" valign="top" width="27%" style="padding:0 10px 18px 0;">
                      <p style="margin:0 0 10px;font-family:${FONT_STACK};font-size:8px;line-height:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${EMAIL_COLOURS.navyMuted};">Your vault</p>
                      ${footerLink(TRACKING_PATH, "Shipment tracking")}
                      ${footerLink("/dashboard/vault", "Mineral register")}
                      ${footerLink("/dashboard/documents", "Documents")}
                      ${footerLink("/dashboard/support", "Concierge")}
                    </td>
                    <td class="cv-foot-col" valign="top" width="27%" style="padding:0 0 18px;">
                      <p style="margin:0 0 10px;font-family:${FONT_STACK};font-size:8px;line-height:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${EMAIL_COLOURS.navyMuted};">Small print</p>
                      ${footerLink("/legal/terms", "Terms")}
                      ${footerLink("/legal/privacy", "Privacy")}
                      ${footerLink("/about", "About the vault")}
                    </td>
                  </tr>
                  <tr>
                    <td colspan="3" style="padding:14px 0 0;border-top:1px solid ${EMAIL_COLOURS.navyLine};font-family:${FONT_STACK};font-size:9px;line-height:15px;color:${EMAIL_COLOURS.navyFaint};">
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
              <td align="center" style="padding:14px 20px 0;font-family:${FONT_STACK};font-size:8px;line-height:13px;color:${PALETTE.muted};">
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
    showEta ? `  Estimated delivery: ${eta}` : "",
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
