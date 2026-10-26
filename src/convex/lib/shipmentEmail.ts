import { EMAIL_COLOURS } from "./emailPalette";
import {
  renderRouteRail,
  renderStageLedger,
  type LedgerStage,
  type LedgerStageState,
  type RouteRailTone,
} from "./routeRail";
import { isStaticMapUrl } from "./staticMap";
import {
  SHIPMENT_STAGES,
  SHIPMENT_STATUS_LABELS,
  shipmentNeedsAttention,
  shipmentStageCount,
  type ShipmentStatus,
} from "./shipments";

/**
 * Branded transactional emails for mineral shipments.
 *
 * The layout follows the Cosmic Vault identity - deep navy header, electric
 * blue accents, hairline borders, the origin-to-destination route rail the
 * dashboard draws and the stage ledger beneath it - and is built with tables
 * and inline styles so it renders consistently in Gmail, Outlook and Apple
 * Mail.
 */

export type EmailMineral = {
  name: string;
  reference: string;
  category: string;
  quantity: string;
  declaredValue: string;
};

export type EmailPolicy = {
  policyNumber: string;
  provider: string;
  coverage: string;
  coverageLimit: string;
  endDate: string;
};

export type EmailShipment = {
  reference: string;
  carrier: string;
  trackingNumber?: string;
  origin: string;
  destination: string;
  departure?: string;
  eta?: string;
};

export type ShipmentEmailInput = {
  recipientName: string;
  companyName: string;
  supportEmail: string;
  appUrl: string;
  updatedAt: string;
  status: ShipmentStatus;
  previousStatus?: ShipmentStatus;
  location?: string;
  note?: string;
  /** A Mapbox static image of the route; the rail is drawn without one. */
  mapUrl?: string;
  mineral: EmailMineral;
  policy?: EmailPolicy;
  shipment: EmailShipment;
};

export type AssignmentEmailInput = {
  recipientName: string;
  companyName: string;
  supportEmail: string;
  appUrl: string;
  isNewAccount: boolean;
  mineral: EmailMineral;
  policy?: EmailPolicy;
  shipment?: EmailShipment;
};

/* The project's colours, from the stylesheet's own tokens; nothing below is a
   hand-picked hex. See `emailPalette`. */
const NAVY = EMAIL_COLOURS.navy;
const ELECTRIC = EMAIL_COLOURS.electric;
const INK = EMAIL_COLOURS.ink;
const MUTED = EMAIL_COLOURS.muted;
const LINE = EMAIL_COLOURS.line;
const CANVAS = EMAIL_COLOURS.canvas;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function headlineFor(status: ShipmentStatus) {
  switch (status) {
    case "preparing":
      return "Your shipment is being prepared";
    case "in_transit":
      return "Your shipment is on its way";
    case "customs_hold":
      return "Your shipment is with customs";
    case "out_for_delivery":
      return "Your shipment is out for delivery";
    case "delivered":
      return "Your shipment has been delivered";
    case "delayed":
      return "Your shipment has been delayed";
    case "cancelled":
      return "Your shipment has been cancelled";
  }
}

function sentenceFor(input: ShipmentEmailInput) {
  const { mineral, shipment, status, location, policy } = input;
  const place = location ? ` in ${location}` : "";
  switch (status) {
    case "preparing":
      return `${mineral.name} (${mineral.reference}) is being prepared for dispatch with ${shipment.carrier}. We will email you as soon as it moves.`;
    case "in_transit":
      return `${mineral.name} (${mineral.reference}) has left ${shipment.origin} and is on its way to ${shipment.destination} with ${shipment.carrier}.`;
    case "customs_hold":
      return `Your shipment is currently held at customs${place}. Clearance is in progress and no action is needed from you right now.`;
    case "out_for_delivery":
      return `Your shipment is out for delivery${place} and is expected to arrive shortly.`;
    case "delivered":
      return `Your shipment was delivered${place}.${policy ? ` Cover under ${policy.policyNumber} remains in place until ${policy.endDate}.` : ""}`;
    case "delayed":
      return `Your shipment has been delayed${place}. The carrier has flagged a revised schedule and we will keep you updated.`;
    case "cancelled":
      return `Your shipment has been cancelled${place}. If this is unexpected, reply to this email and our team will look into it.`;
  }
}

const TONES: Record<
  string,
  { background: string; border: string; text: string }
> = {
  delivered: {
    background: EMAIL_COLOURS.emeraldTint,
    border: EMAIL_COLOURS.emeraldLine,
    text: EMAIL_COLOURS.emerald,
  },
  delayed: {
    background: EMAIL_COLOURS.amberTint,
    border: EMAIL_COLOURS.amberLine,
    text: EMAIL_COLOURS.amber,
  },
  customs_hold: {
    background: EMAIL_COLOURS.amberTint,
    border: EMAIL_COLOURS.amberLine,
    text: EMAIL_COLOURS.amber,
  },
  cancelled: {
    background: EMAIL_COLOURS.dangerTint,
    border: EMAIL_COLOURS.dangerLine,
    text: EMAIL_COLOURS.danger,
  },
  default: {
    background: EMAIL_COLOURS.electricTint,
    border: EMAIL_COLOURS.electricLine,
    text: EMAIL_COLOURS.electricDeep,
  },
};

function toneFor(status: ShipmentStatus) {
  return TONES[status] ?? TONES.default;
}

/**
 * The website's own mark in the navy header. It is the same PNG the vault email
 * uses, served from the app origin the CTA already points at, so the two emails
 * open with the same logo. Without a usable origin - a preview with no site
 * configured - the header keeps the plain electric square instead of a broken
 * image.
 */
function headerMark(appUrl: string, size = 22) {
  const base = appUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) {
    return `<span style="display:inline-block;width:${size}px;height:${size}px;background-color:${ELECTRIC};border-radius:4px;vertical-align:middle;font-size:0;line-height:0;">&nbsp;</span>`;
  }

  return `<img src="${escapeHtml(
    `${base}/email/logo-mark.png`,
  )}" width="${size}" height="${size}" alt="" style="display:inline-block;width:${size}px;height:${size}px;border:0;vertical-align:middle;" />`;
}

/**
 * The status chip, drawn the way the vault email draws it: one compact pill,
 * tinted by the status, and filled solid while the consignment is on the road
 * so the live state reads first. The hero headline already says what happened,
 * so the pill only carries the label it sits beside on the dispatch board.
 */
function statusPill(input: ShipmentEmailInput) {
  const tone = toneFor(input.status);
  const solid = input.status === "in_transit";
  const border = solid ? ELECTRIC : tone.border;
  const background = solid ? ELECTRIC : tone.background;
  const colour = solid ? EMAIL_COLOURS.white : tone.text;

  // Separate borders on both tables: a collapsed cell drops its radius.
  return `<td style="padding:0 6px 0 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;mso-table-lspace:0;mso-table-rspace:0;">
                    <tr>
                      <td style="border:1px solid ${border};background-color:${background};border-radius:999px;padding:6px 11px;font-family:${RAIL_FONT};font-size:10px;line-height:12px;font-weight:700;color:${colour};white-space:nowrap;">${escapeHtml(
                        SHIPMENT_STATUS_LABELS[input.status],
                      )}</td>
                    </tr>
                  </table>
                </td>`;
}

function detailRow(label: string, value: string, last = false) {
  return `
    <tr>
      <td style="padding:11px 0;border-bottom:${last ? "none" : `1px solid ${LINE}`};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${MUTED};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;vertical-align:top;width:44%;">${escapeHtml(label)}</td>
      <td align="right" style="padding:11px 0;border-bottom:${last ? "none" : `1px solid ${LINE}`};font-size:13px;font-weight:600;color:${INK};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;vertical-align:top;">${escapeHtml(value)}</td>
    </tr>`;
}

function sectionTitle(title: string) {
  return `<p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${MUTED};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${escapeHtml(title)}</p>`;
}

const RAIL_TRACK = EMAIL_COLOURS.electricTrack;
const RAIL_FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";

/** The Convex palette, in the shape the shared rail and ledger draw with. */
function railTone(input: ShipmentEmailInput): RouteRailTone {
  return {
    origin: ELECTRIC,
    accent: shipmentNeedsAttention(input.status)
      ? EMAIL_COLOURS.amber
      : ELECTRIC,
    attention: EMAIL_COLOURS.amber,
    track: RAIL_TRACK,
    ink: INK,
    muted: MUTED,
    faint: EMAIL_COLOURS.faint,
    white: EMAIL_COLOURS.white,
    surface: EMAIL_COLOURS.card,
    outline: EMAIL_COLOURS.electricLine,
    outlineInk: ELECTRIC,
    emerald: EMAIL_COLOURS.emerald,
  };
}

/**
 * The four milestones, in the shipping desk's own vocabulary. The stamps only
 * repeat what the desk knows: a completed stage is done, the current one carries
 * the update's own timestamp, and the last carries the estimate when there is
 * one. Nothing is invented for the stages in between.
 */
function journeyStages(input: ShipmentEmailInput): LedgerStage[] {
  const reached = shipmentStageCount(input.status);
  const attention = shipmentNeedsAttention(input.status);
  /* A cancelled consignment is not waiting for its next milestone, so the
     stages ahead are shown as stages that will never happen. */
  const cancelled = input.status === "cancelled";

  return SHIPMENT_STAGES.map((stage, index) => {
    const position = index + 1;
    const isCurrent = position === reached;
    const complete = position < reached;
    const state: LedgerStageState = complete
      ? "complete"
      : isCurrent
        ? "active"
        : cancelled
          ? "skipped"
          : "future";
    const stamp = complete
      ? "Complete"
      : isCurrent
        ? input.updatedAt
        : cancelled
          ? "Will not progress"
          : stage.key === "delivered" && input.shipment.eta
            ? `Expected ${input.shipment.eta}`
            : "To come";

    return {
      label: stage.label,
      state,
      stamp,
      attention: isCurrent && attention,
      delivered: isCurrent && input.status === "delivered",
    };
  });
}

/**
 * The consignment route: origin, live position and destination on one line,
 * with the passed span in electric blue and the rest of the journey dashed.
 * The stage count decides how far the fill reaches, so the email agrees with
 * the dispatch board: preparing reaches the first waypoint, in transit the
 * truck, out for delivery the second, and only delivery reaches the
 * destination. The drawing itself is shared with the vault email, so the two
 * templates cannot drift apart.
 */
function routeRail(input: ShipmentEmailInput) {
  const status = input.status;
  const needsAttention = shipmentNeedsAttention(status);

  const rail = isStaticMapUrl(input.mapUrl)
    ? `<img src="${escapeHtml(
        input.mapUrl,
      )}" width="494" height="317" alt="Map of the route from ${escapeHtml(
        input.shipment.origin,
      )} to ${escapeHtml(
        input.shipment.destination,
      )}" style="display:block;width:100%;max-width:100%;height:auto;border:1px solid ${LINE};border-radius:4px;" />
    <p style="margin:8px 0 0;font-size:9px;line-height:13px;letter-spacing:0.04em;color:${MUTED};font-family:${RAIL_FONT};">Mapbox &nbsp;&middot;&nbsp; &copy; OpenStreetMap contributors</p>`
    : renderRouteRail({
        origin: input.shipment.origin,
        destination: input.shipment.destination,
        position: input.location,
        progress: shipmentStageCount(status) / SHIPMENT_STAGES.length,
        attention: needsAttention,
        delivered: status === "delivered",
        iconBase: input.appUrl,
        fontStack: RAIL_FONT,
        tone: railTone(input),
      });

  if (!needsAttention) return rail;

  const note =
    status === "customs_hold"
      ? "Your shipment is paused at customs. We will notify you the moment it clears."
      : status === "delayed"
        ? "The carrier has flagged a delay. Revised timing appears below."
        : "This shipment will not progress further. Our team is available if you need help.";

  return `${rail}
    <p style="margin:14px 0 0;font-size:11px;line-height:18px;color:${MUTED};font-family:${RAIL_FONT};">${note}</p>`;
}

function shell({
  preheader,
  companyName,
  supportEmail,
  appUrl,
  headerLabel,
  reference,
  children,
}: {
  preheader: string;
  companyName: string;
  appUrl: string;
  supportEmail: string;
  headerLabel: string;
  /** The consignment this message is about, printed in the footer. */
  reference?: string;
  children: string;
}) {
  const footerLink = (path: string, label: string) =>
    `<p style="margin:0 0 8px;font-family:${RAIL_FONT};font-size:10px;line-height:16px;"><a href="${escapeHtml(
      `${appUrl.replace(/\/+$/, "")}${path}`,
    )}" style="color:${EMAIL_COLOURS.navyMuted};text-decoration:none;">${escapeHtml(
      label,
    )}</a></p>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${escapeHtml(companyName)}</title>
<style>
  @media only screen and (max-width:620px) {
    .cv-shell { width:100% !important; }
    .cv-pad { padding-left:20px !important; padding-right:20px !important; }
    .cv-headline { font-size:23px !important; }
    /* The footer columns stack rather than squeeze three-across. */
    .cv-foot-col { display:block !important; width:100% !important; padding:0 0 14px 0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${CANVAS};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CANVAS};">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" class="cv-shell" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:${EMAIL_COLOURS.card};border:1px solid ${LINE};border-radius:6px;overflow:hidden;">
        <tr>
          <td style="background-color:${NAVY};padding:26px 32px 22px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="left" style="vertical-align:middle;">
                  ${headerMark(appUrl)}
                  <span style="display:inline-block;margin-left:10px;font-size:12px;font-weight:700;letter-spacing:0.26em;text-transform:uppercase;color:${EMAIL_COLOURS.white};vertical-align:middle;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${escapeHtml(companyName)}</span>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="display:inline-block;padding:5px 10px;border:1px solid rgba(255,255,255,0.22);border-radius:3px;font-size:9px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${EMAIL_COLOURS.electricSoft};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${escapeHtml(headerLabel)}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ${children}
        <tr>
          <td bgcolor="${NAVY}" style="background-color:${NAVY};padding:26px 32px 22px;border-top:3px solid ${ELECTRIC};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td class="cv-foot-col" valign="top" width="46%" style="padding:0 18px 18px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      <td width="26" valign="middle" style="width:26px;padding:0;">${headerMark(
                        appUrl,
                        26,
                      )}</td>
                      <td style="padding-left:9px;vertical-align:middle;">
                        <p style="margin:0;font-family:${RAIL_FONT};font-size:13px;line-height:16px;font-weight:700;letter-spacing:-0.01em;color:${EMAIL_COLOURS.white};">${escapeHtml(
                          companyName,
                        )}</p>
                        <p style="margin:4px 0 0;font-family:${RAIL_FONT};font-size:8px;line-height:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${EMAIL_COLOURS.navyMuted};">Mineral vault</p>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:12px 0 0;font-family:${RAIL_FONT};font-size:10px;line-height:16px;color:${EMAIL_COLOURS.navyMuted};">Mineral logistics desk. Questions? Reply to this email or write to
                    <a href="mailto:${escapeHtml(
                      supportEmail,
                    )}" style="color:${EMAIL_COLOURS.navyMuted};text-decoration:underline;">${escapeHtml(
                      supportEmail,
                    )}</a>.</p>
                </td>
                <td class="cv-foot-col" valign="top" width="27%" style="padding:0 10px 18px 0;">
                  <p style="margin:0 0 10px;font-family:${RAIL_FONT};font-size:8px;line-height:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${EMAIL_COLOURS.navyMuted};">Your vault</p>
                  ${footerLink("/dashboard/shipments", "Shipment tracking")}
                  ${footerLink("/dashboard/vault", "Mineral register")}
                  ${footerLink("/dashboard/documents", "Documents")}
                  ${footerLink("/dashboard/support", "Concierge")}
                </td>
                <td class="cv-foot-col" valign="top" width="27%" style="padding:0 0 18px;">
                  <p style="margin:0 0 10px;font-family:${RAIL_FONT};font-size:8px;line-height:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${EMAIL_COLOURS.navyMuted};">Small print</p>
                  ${footerLink("/legal/terms", "Terms")}
                  ${footerLink("/legal/privacy", "Privacy")}
                  ${footerLink("/about", "About the vault")}
                </td>
              </tr>
              <tr>
                <td colspan="3" style="padding:14px 0 0;border-top:1px solid ${EMAIL_COLOURS.navyLine};font-family:${RAIL_FONT};font-size:9px;line-height:15px;color:${EMAIL_COLOURS.navyFaint};">
                  &copy; ${new Date().getUTCFullYear()} ${escapeHtml(
                    companyName,
                  )}${reference ? ` &nbsp;&middot;&nbsp; ${escapeHtml(reference)}` : ""}<br />
                  You are receiving this because this mineral shipment is assigned to your account. This message does not change the terms of your cover.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function renderShipmentStatusEmail(input: ShipmentEmailInput) {
  const headline = headlineFor(input.status);
  const previous = input.previousStatus
    ? SHIPMENT_STATUS_LABELS[input.previousStatus]
    : undefined;
  const statusLabel = SHIPMENT_STATUS_LABELS[input.status];
  const arrivedOrCancelled =
    input.status === "delivered" || input.status === "cancelled";
  /* A resolved Mapbox image takes the rail's place, so the ledger has to carry
     the place the drawing would have shown. */
  const mapsInsteadOfRail = isStaticMapUrl(input.mapUrl);
  /* An estimate only means something while the consignment is still ahead;
     beside a delivered pill it would read as the delivery time. */
  const showEta = Boolean(input.shipment.eta) && !arrivedOrCancelled;
  const subject = `${headline} - ${input.mineral.reference}`;

  const body = `
    <tr>
      <td class="cv-pad" style="padding:30px 32px 0;">
        <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${ELECTRIC};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Status update · ${escapeHtml(input.updatedAt)}</p>
        <h1 class="cv-headline" style="margin:10px 0 0;font-size:27px;line-height:1.18;font-weight:600;letter-spacing:-0.03em;color:${INK};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${escapeHtml(headline)}</h1>
        <p style="margin:12px 0 0;font-size:14px;line-height:23px;color:${MUTED};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Hello ${escapeHtml(input.recipientName)}, ${escapeHtml(sentenceFor(input))}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin-top:16px;">
          <tr>
            ${statusPill(input)}
            ${
              showEta
                ? `<td valign="middle" style="padding:0 0 0 11px;font-size:10px;line-height:15px;font-weight:600;letter-spacing:0.13em;text-transform:uppercase;color:${MUTED};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">ETA &nbsp;&middot;&nbsp; ${escapeHtml(
                    input.shipment.eta!,
                  )}</td>`
                : ""
            }
          </tr>
        </table>
        ${
          /* What the update replaced, kept as a caption under the chip: the
             journey below shows where it has got to, not where it came from. */
          previous
            ? `<p style="margin:9px 0 0;font-size:11px;line-height:16px;color:${MUTED};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Previously ${escapeHtml(previous.toLowerCase())}</p>`
            : ""
        }
      </td>
    </tr>
    <tr>
      <td class="cv-pad" style="padding:26px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL_COLOURS.card};border:1px solid ${LINE};border-radius:4px;">
          <tr>
            <td style="padding:18px 20px;">
              ${sectionTitle("Consignment route")}
              ${routeRail(input)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="cv-pad" style="padding:16px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL_COLOURS.card};border:1px solid ${LINE};border-radius:4px;">
          <tr>
            <td style="padding:18px 20px 16px;">
              ${sectionTitle("Journey")}
              ${renderStageLedger({
                stages: journeyStages(input),
                tone: railTone(input),
                fontStack: RAIL_FONT,
              })}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="cv-pad" style="padding:28px 32px 0;">
        ${sectionTitle("Shipment")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">
          ${detailRow("Reference", input.shipment.reference)}
          ${detailRow("Carrier", input.shipment.carrier)}
          ${input.shipment.trackingNumber ? detailRow("Tracking number", input.shipment.trackingNumber) : ""}
          ${detailRow("Route", `${input.shipment.origin} → ${input.shipment.destination}`)}
          ${input.shipment.departure ? detailRow("Departed", input.shipment.departure) : ""}
          ${
            showEta
              ? detailRow(
                  "Estimated arrival",
                  input.shipment.eta!,
                  !mapsInsteadOfRail,
                )
              : ""
          }
          ${
            /* The rail already names the position, so repeating it here would
               be the same fact twice. When a map image replaces the rail the
               drawing is gone, and the ledger is where the place belongs - and
               an unrecorded place is said plainly rather than filled in with
               the status, which the chip above already names. */
            mapsInsteadOfRail
              ? detailRow(
                  "Current location",
                  input.location ?? "Not recorded",
                  true,
                )
              : ""
          }
        </table>
      </td>
    </tr>
    <tr>
      <td class="cv-pad" style="padding:26px 32px 0;">
        ${sectionTitle("Insured mineral")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">
          ${detailRow("Mineral", input.mineral.name)}
          ${detailRow("Reference", input.mineral.reference)}
          ${detailRow("Category", input.mineral.category)}
          ${detailRow("Quantity", input.mineral.quantity)}
          ${detailRow("Declared value", input.mineral.declaredValue, !input.policy)}
        </table>
      </td>
    </tr>
    ${
      input.policy
        ? `<tr>
      <td class="cv-pad" style="padding:26px 32px 0;">
        ${sectionTitle("Policy")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">
          ${detailRow("Policy number", input.policy.policyNumber)}
          ${detailRow("Provider", input.policy.provider)}
          ${detailRow("Cover", input.policy.coverage)}
          ${detailRow("Cover limit", input.policy.coverageLimit)}
          ${detailRow("Cover ends", input.policy.endDate, true)}
        </table>
      </td>
    </tr>`
        : ""
    }
    ${
      input.note
        ? `<tr>
      <td class="cv-pad" style="padding:26px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CANVAS};border:1px solid ${LINE};border-radius:4px;">
          <tr>
            <td style="padding:14px 16px;">
              <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${MUTED};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Update from the logistics desk</p>
              <p style="margin:6px 0 0;font-size:13px;line-height:21px;color:${INK};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${escapeHtml(input.note)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
        : ""
    }
    <tr>
      <td align="center" style="padding:28px 32px 30px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="background-color:${ELECTRIC};border-radius:4px;">
              <a href="${escapeHtml(input.appUrl)}/dashboard/minerals" style="display:inline-block;padding:13px 26px;font-size:13px;font-weight:700;letter-spacing:0.01em;color:${EMAIL_COLOURS.white};text-decoration:none;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Track this shipment</a>
            </td>
          </tr>
        </table>
        <p style="margin:12px 0 0;font-size:10px;color:${EMAIL_COLOURS.faint};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Sign in with your email address - no password needed.</p>
      </td>
    </tr>`;

  const lines = [
    `Hello ${input.recipientName},`,
    "",
    sentenceFor(input),
    "",
    `Status: ${statusLabel}`,
    previous ? `Previously: ${previous}` : "",
    input.location || mapsInsteadOfRail
      ? `Current location: ${input.location ?? "Not recorded"}`
      : "",
    "",
    "Journey",
    ...journeyStages(input).map(
      (stage) => `  ${stage.label.padEnd(18, " ")} ${stage.stamp}`,
    ),
    "",
    `Shipment: ${input.shipment.reference} (${input.shipment.carrier})`,
    `Route: ${input.shipment.origin} to ${input.shipment.destination}`,
    input.shipment.trackingNumber
      ? `Tracking: ${input.shipment.trackingNumber}`
      : "",
    showEta ? `Estimated arrival: ${input.shipment.eta}` : "",
    "",
    `Mineral: ${input.mineral.name} (${input.mineral.reference})`,
    `Quantity: ${input.mineral.quantity}`,
    `Declared value: ${input.mineral.declaredValue}`,
    input.policy
      ? `Policy: ${input.policy.policyNumber} - ${input.policy.coverage}, cover limit ${input.policy.coverageLimit}, ends ${input.policy.endDate}`
      : "",
    input.note ? `\nLogistics note: ${input.note}` : "",
    "",
    `Track this shipment: ${input.appUrl}/dashboard/minerals`,
    "",
    `${input.companyName}`,
    input.supportEmail,
  ];

  return {
    subject,
    html: shell({
      preheader: `${headline} - ${input.mineral.name} (${input.mineral.reference})`,
      companyName: input.companyName,
      supportEmail: input.supportEmail,
      appUrl: input.appUrl,
      headerLabel: "Shipment update",
      reference: input.shipment.reference,
      children: body,
    }),
    text: lines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}

export function renderAssignmentEmail(input: AssignmentEmailInput) {
  const subject = `${input.mineral.name} has been added to your vault`;
  const trackLine = input.shipment
    ? `${input.shipment.reference}: ${input.shipment.origin} → ${input.shipment.destination}`
    : undefined;

  const body = `
    <tr>
      <td class="cv-pad" style="padding:30px 32px 0;">
        <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${ELECTRIC};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Mineral assigned</p>
        <h1 class="cv-headline" style="margin:10px 0 0;font-size:27px;line-height:1.18;font-weight:600;letter-spacing:-0.03em;color:${INK};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Your mineral record is live</h1>
        <p style="margin:12px 0 0;font-size:14px;line-height:23px;color:${MUTED};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          Hello ${escapeHtml(input.recipientName)}, ${escapeHtml(input.companyName)} has recorded ${escapeHtml(input.mineral.name)} under your name and linked its ${input.policy ? "cover" : "record"} to your account.${
            input.shipment
              ? " Its shipment sits below. Status changes will be emailed to you automatically."
              : " You can request a shipment whenever you need it moved, and we will email you when one is booked."
          }
        </p>
      </td>
    </tr>
    <tr>
      <td class="cv-pad" style="padding:24px 32px 0;">
        ${sectionTitle("Mineral")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">
          ${detailRow("Mineral", input.mineral.name)}
          ${detailRow("Reference", input.mineral.reference)}
          ${detailRow("Category", input.mineral.category)}
          ${detailRow("Quantity", input.mineral.quantity)}
          ${detailRow("Declared value", input.mineral.declaredValue, !input.policy && !trackLine)}
        </table>
      </td>
    </tr>
    ${
      input.policy
        ? `<tr>
      <td class="cv-pad" style="padding:26px 32px 0;">
        ${sectionTitle("Policy")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">
          ${detailRow("Policy number", input.policy.policyNumber)}
          ${detailRow("Provider", input.policy.provider)}
          ${detailRow("Cover", input.policy.coverage)}
          ${detailRow("Cover limit", input.policy.coverageLimit)}
          ${detailRow("Cover ends", input.policy.endDate, true)}
        </table>
      </td>
    </tr>`
        : ""
    }
    ${
      trackLine
        ? `<tr>
      <td class="cv-pad" style="padding:26px 32px 0;">
        ${sectionTitle("Shipment")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">
          ${detailRow("Route", trackLine, true)}
        </table>
      </td>
    </tr>`
        : ""
    }
    <tr>
      <td align="center" style="padding:28px 32px 30px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="background-color:${ELECTRIC};border-radius:4px;">
              <a href="${escapeHtml(input.appUrl)}/dashboard/minerals" style="display:inline-block;padding:13px 26px;font-size:13px;font-weight:700;color:${EMAIL_COLOURS.white};text-decoration:none;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Open your vault</a>
            </td>
          </tr>
        </table>
        ${
          input.isNewAccount
            ? `<p style="margin:12px 0 0;font-size:10px;line-height:16px;color:${EMAIL_COLOURS.faint};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Sign in at ${escapeHtml(input.appUrl)}/auth with this email address - we send a one-time code, so there is no password to set.</p>`
            : ""
        }
      </td>
    </tr>`;

  const lines = [
    `Hello ${input.recipientName},`,
    "",
    `${input.companyName} has recorded ${input.mineral.name} (${input.mineral.reference}) under your account, with its policy details.`,
    input.shipment
      ? ""
      : "You can request a shipment from your minerals page whenever you need it moved.",
    "",
    `Category: ${input.mineral.category}`,
    `Quantity: ${input.mineral.quantity}`,
    `Declared value: ${input.mineral.declaredValue}`,
    input.policy
      ? `Policy: ${input.policy.policyNumber} - ${input.policy.coverage}, cover limit ${input.policy.coverageLimit}, ends ${input.policy.endDate}`
      : "",
    trackLine ? `Shipment: ${trackLine}` : "",
    "",
    `Open your vault: ${input.appUrl}/dashboard/minerals`,
    input.isNewAccount
      ? `Sign in with this email address at ${input.appUrl}/auth - we send a one-time code, so there is no password to set.`
      : "",
    "",
    `${input.companyName}`,
    input.supportEmail,
  ];

  return {
    subject,
    html: shell({
      preheader: `${input.mineral.name} is now linked to your account.`,
      companyName: input.companyName,
      supportEmail: input.supportEmail,
      appUrl: input.appUrl,
      headerLabel: "New mineral",
      reference: input.shipment?.reference,
      children: body,
    }),
    text: lines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}
