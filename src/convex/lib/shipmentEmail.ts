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
 * blue accents, hairline borders and the origin-to-destination route rail the
 * dashboard draws - and is built with tables and inline styles so it renders
 * consistently in Gmail, Outlook and Apple Mail.
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

const NAVY = "#071227";
const ELECTRIC = "#2f6bf0";
const INK = "#0f172a";
const MUTED = "#5b6478";
const LINE = "#e4e9f3";
const CANVAS = "#eef1f7";

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
  delivered: { background: "#ecfdf5", border: "#a7f3d0", text: "#047857" },
  delayed: { background: "#fff7ed", border: "#fed7aa", text: "#b45309" },
  customs_hold: { background: "#fffbeb", border: "#fde68a", text: "#92400e" },
  cancelled: { background: "#fef2f2", border: "#fecaca", text: "#b91c1c" },
  default: { background: "#eff4ff", border: "#d5e2ff", text: "#1d4ed8" },
};

function toneFor(status: ShipmentStatus) {
  return TONES[status] ?? TONES.default;
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

const RAIL_TRACK = "#c3cddf";

/** One hairline of the route: solid once passed, dashed while still ahead. */
function railLine(filled: boolean, accent: string) {
  const colour = filled ? accent : RAIL_TRACK;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;">
                    <tr><td height="2" style="height:2px;line-height:2px;font-size:0;border-top:${
                      filled ? "2px solid" : "2px dashed"
                    } ${colour};">&nbsp;</td></tr>
                  </table>`;
}

/** The shipping desk's waypoint diamond, filled once the route passes it. */
function railDiamond(filled: boolean, accent: string) {
  return `<td width="9" align="center" valign="middle" style="width:9px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:8px;line-height:8px;color:${
    filled ? accent : RAIL_TRACK
  };">&#9670;</td>`;
}

/** A station marker: a pin at either end, the carrier's mode at the live one. */
function railMarker({
  background,
  border,
  icon,
}: {
  background: string;
  border: string;
  icon: string;
}) {
  return `<table role="presentation" width="30" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;">
                  <tr>
                    <td width="30" height="30" align="center" valign="middle" style="width:30px;height:30px;border-radius:15px;background-color:${background};border:${border};text-align:center;">
                      <img src="${escapeHtml(icon)}" width="15" height="15" alt="" style="display:block;width:15px;height:15px;border:0;margin:0 auto;" />
                    </td>
                  </tr>
                </table>`;
}

function railStation(kicker: string, title: string, attention = false) {
  return `<p style="margin:10px 0 0;font-size:9px;line-height:12px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#8b94a8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;text-align:center;">${escapeHtml(
    kicker,
  )}</p>
                <p style="margin:5px 0 0;font-size:13px;line-height:17px;font-weight:700;letter-spacing:-0.01em;color:${
                  attention ? "#b45309" : INK
                };font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;text-align:center;">${escapeHtml(
                  title,
                )}</p>`;
}

/**
 * The consignment route: origin, live position and destination on one line,
 * with the passed span in electric blue and the rest of the journey dashed.
 * The stage count decides how far the fill reaches, so the email agrees with
 * the dispatch board: preparing reaches the first waypoint, in transit the
 * truck, out for delivery the second, and only delivery reaches the
 * destination.
 */
function routeRail(input: ShipmentEmailInput) {
  const status = input.status;
  const progress = shipmentStageCount(status) / SHIPMENT_STAGES.length;
  const needsAttention = shipmentNeedsAttention(status);
  const delivered = status === "delivered";
  const accent = needsAttention ? "#b45309" : ELECTRIC;
  const icon = (file: string) => `${input.appUrl}/email/${file}`;

  // The vault record carries no position until staff record one; saying so is
  // better than lending the status word as if it were a place.
  const position = input.location ?? "No location recorded";

  const originMarker = railMarker({
    background: ELECTRIC,
    border: `1px solid ${ELECTRIC}`,
    icon: icon("route-pin-origin.png"),
  });
  const positionMarker = railMarker({
    background: accent,
    border: `1px solid ${accent}`,
    icon: icon("route-truck.png"),
  });
  const destinationMarker = railMarker(
    delivered
      ? {
          background: "#047857",
          border: "1px solid #047857",
          icon: icon("route-pin-origin.png"),
        }
      : {
          background: "#ffffff",
          border: "1px solid #c9d9f8",
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
                    <td valign="middle" style="padding:0;">${railLine(
                      progress >= 0.25,
                      accent,
                    )}</td>
                    ${railDiamond(progress >= 0.25, accent)}
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          ${railStation("Origin", input.shipment.origin)}
        </td>
        <td width="33.33%" align="center" valign="top" style="padding:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td width="50%" valign="middle" style="padding:0;">${railLine(
                progress >= 0.5,
                accent,
              )}</td>
              <td width="30" valign="middle" style="width:30px;padding:0;">${positionMarker}</td>
              <td width="50%" valign="middle" style="padding:0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td valign="middle" style="padding:0;">${railLine(
                      progress >= 0.75,
                      accent,
                    )}</td>
                    ${railDiamond(progress >= 0.75, accent)}
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          ${railStation("Position", position, needsAttention)}
        </td>
        <td width="33.33%" align="center" valign="top" style="padding:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td width="50%" valign="middle" style="padding:0;">${railLine(
                progress >= 1,
                accent,
              )}</td>
              <td width="30" valign="middle" style="width:30px;padding:0;">${destinationMarker}</td>
              <td width="50%" style="padding:0;"></td>
            </tr>
          </table>
          ${railStation("Destination", input.shipment.destination)}
        </td>
      </tr>
    </table>
    ${
      needsAttention
        ? `<p style="margin:14px 0 0;font-size:11px;line-height:18px;color:${MUTED};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${
            status === "customs_hold"
              ? "Your shipment is paused at customs. We will notify you the moment it clears."
              : status === "delayed"
                ? "The carrier has flagged a delay. Revised timing appears below."
                : "This shipment will not progress further. Our team is available if you need help."
          }</p>`
        : ""
    }`;
}

function shell({
  preheader,
  companyName,
  supportEmail,
  headerLabel,
  children,
}: {
  preheader: string;
  companyName: string;
  supportEmail: string;
  headerLabel: string;
  children: string;
}) {
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
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${CANVAS};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CANVAS};">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" class="cv-shell" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid ${LINE};border-radius:6px;overflow:hidden;">
        <tr>
          <td style="background-color:${NAVY};padding:26px 32px 22px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="left" style="vertical-align:middle;">
                  <span style="display:inline-block;width:18px;height:18px;background-color:${ELECTRIC};border-radius:4px;vertical-align:middle;font-size:0;line-height:0;">&nbsp;</span>
                  <span style="display:inline-block;margin-left:10px;font-size:12px;font-weight:700;letter-spacing:0.26em;text-transform:uppercase;color:#ffffff;vertical-align:middle;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${escapeHtml(companyName)}</span>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="display:inline-block;padding:5px 10px;border:1px solid rgba(255,255,255,0.22);border-radius:3px;font-size:9px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#c9d6f2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${escapeHtml(headerLabel)}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ${children}
        <tr>
          <td style="padding:22px 32px 26px;border-top:1px solid ${LINE};background-color:#f8fafd;">
            <p style="margin:0;font-size:11px;line-height:18px;color:${MUTED};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
              ${escapeHtml(companyName)} · Mineral logistics desk<br />
              Questions? Reply to this email or write to
              <a href="mailto:${escapeHtml(supportEmail)}" style="color:${ELECTRIC};text-decoration:none;">${escapeHtml(supportEmail)}</a>.
            </p>
            <p style="margin:10px 0 0;font-size:10px;line-height:16px;color:#8b94a8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
              You are receiving this because this mineral shipment is assigned to your account. This message does not change the terms of your cover.
            </p>
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
  const tone = toneFor(input.status);
  const previous = input.previousStatus
    ? SHIPMENT_STATUS_LABELS[input.previousStatus]
    : undefined;
  const statusLabel = SHIPMENT_STATUS_LABELS[input.status];
  const where = input.location ? ` · ${input.location}` : "";
  const subject = `${headline} - ${input.mineral.reference}`;

  const body = `
    <tr>
      <td class="cv-pad" style="padding:30px 32px 0;">
        <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${ELECTRIC};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Status update · ${escapeHtml(input.updatedAt)}</p>
        <h1 class="cv-headline" style="margin:10px 0 0;font-size:27px;line-height:1.18;font-weight:600;letter-spacing:-0.03em;color:${INK};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${escapeHtml(headline)}</h1>
        <p style="margin:12px 0 0;font-size:14px;line-height:23px;color:${MUTED};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Hello ${escapeHtml(input.recipientName)}, ${escapeHtml(sentenceFor(input))}</p>
      </td>
    </tr>
    <tr>
      <td class="cv-pad" style="padding:20px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${tone.background};border:1px solid ${tone.border};border-radius:4px;">
          <tr>
            <td style="padding:14px 16px;">
              <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${tone.text};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Current status</p>
              <p style="margin:6px 0 0;font-size:15px;font-weight:700;color:${tone.text};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${escapeHtml(statusLabel)}${escapeHtml(where)}</p>
              ${
                previous
                  ? `<p style="margin:4px 0 0;font-size:11px;color:${MUTED};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Previously ${escapeHtml(previous.toLowerCase())}</p>`
                  : ""
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="cv-pad" style="padding:24px 32px 0;">${routeRail(input)}</td>
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
            /* With no estimate the row falls back to where the consignment is;
               an unrecorded place is said plainly rather than filled in with
               the status, which is already named above. */
            input.shipment.eta
              ? detailRow("Estimated arrival", input.shipment.eta, true)
              : detailRow(
                  "Current location",
                  input.location ?? "Not recorded",
                  true,
                )
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
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f8fc;border:1px solid ${LINE};border-radius:4px;">
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
              <a href="${escapeHtml(input.appUrl)}/dashboard/minerals" style="display:inline-block;padding:13px 26px;font-size:13px;font-weight:700;letter-spacing:0.01em;color:#ffffff;text-decoration:none;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Track this shipment</a>
            </td>
          </tr>
        </table>
        <p style="margin:12px 0 0;font-size:10px;color:#8b94a8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Sign in with your email address - no password needed.</p>
      </td>
    </tr>`;

  const lines = [
    `Hello ${input.recipientName},`,
    "",
    sentenceFor(input),
    "",
    `Status: ${statusLabel}${where}`,
    `Shipment: ${input.shipment.reference} (${input.shipment.carrier})`,
    `Route: ${input.shipment.origin} to ${input.shipment.destination}`,
    input.shipment.trackingNumber
      ? `Tracking: ${input.shipment.trackingNumber}`
      : "",
    input.shipment.eta ? `Estimated arrival: ${input.shipment.eta}` : "",
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
      headerLabel: "Shipment update",
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
              <a href="${escapeHtml(input.appUrl)}/dashboard/minerals" style="display:inline-block;padding:13px 26px;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Open your vault</a>
            </td>
          </tr>
        </table>
        ${
          input.isNewAccount
            ? `<p style="margin:12px 0 0;font-size:10px;line-height:16px;color:#8b94a8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Sign in at ${escapeHtml(input.appUrl)}/auth with this email address - we send a one-time code, so there is no password to set.</p>`
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
      headerLabel: "New mineral",
      children: body,
    }),
    text: lines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}
