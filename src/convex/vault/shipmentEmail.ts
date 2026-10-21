/**
 * The member-facing shipment update email.
 *
 * This module is deliberately dependency-free: the Convex email action renders
 * with it on the server, and the dashboard preview renders the exact same HTML
 * in the browser, so what staff preview is what the member receives. It must
 * never import `react`, `convex/*` or anything from the Vite `src/lib` tree -
 * the Convex bundler cannot resolve outside the `convex` folder.
 *
 * Design: a warm porcelain canvas, forest-green header and footer bands, a
 * centred cream hero and a five-step tracking rail inside a bordered card -
 * the layout of the reference order-tracking page, rebuilt with email-safe
 * tables and inline styles only (no scripts, no external fonts, no CSS files).
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

const PALETTE = {
  forest: "#0F3729",
  forestDeep: "#0A2A1F",
  moss: "#23583E",
  gold: "#F5C93B",
  goldSoft: "#FBF1CB",
  cream: "#F7F4EA",
  canvas: "#F1EDE1",
  white: "#FFFFFF",
  ink: "#1E2A23",
  muted: "#6B7A71",
  faint: "#9AA79E",
  line: "#E4E0D3",
  track: "#D9D4C3",
  amber: "#C98A2B",
} as const;

const FONT_STACK =
  "'Helvetica Neue', Helvetica, Arial, 'Segoe UI', sans-serif";

const STEP_COPY: Record<
  ShipmentEmailStatus,
  { label: string; stamp: string; headline: string; subject: string; description: string }
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

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? "&amp;");
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
    const at = event?.at ?? (status === input.status ? input.updatedAt : undefined);
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

function stepDot(state: StepState, status: ShipmentEmailStatus) {
  if (state === "complete") {
    return `background-color:${PALETTE.forest};border:1px solid ${PALETTE.forest};color:${PALETTE.white};font-size:12px;`;
  }
  if (state === "active") {
    const accent = status === "on_hold" ? PALETTE.amber : PALETTE.moss;
    return `background-color:${PALETTE.white};border:2px solid ${accent};color:${accent};font-size:16px;`;
  }
  if (state === "skipped") {
    return `background-color:${PALETTE.cream};border:1px dashed ${PALETTE.track};color:${PALETTE.faint};font-size:11px;`;
  }
  return `background-color:${PALETTE.white};border:1px solid ${PALETTE.track};color:${PALETTE.track};font-size:11px;`;
}

function stepGlyph(state: StepState) {
  if (state === "complete") return "&#10003;";
  if (state === "active") return "&#8226;";
  if (state === "skipped") return "&#8211;";
  return "&#183;";
}

function stepStamp(step: ReturnType<typeof buildSteps>[number], estimatedDelivery: number) {
  if (step.state === "complete" || step.state === "active") {
    if (!step.at) return { primary: STEP_COPY[step.status].stamp, secondary: "" };
    return { primary: dayStamp(step.at), secondary: TIME.format(new Date(step.at)) };
  }
  if (step.state === "skipped") return { primary: "Skipped", secondary: "" };
  if (step.status === "shipped") {
    return { primary: "Expected", secondary: dayStamp(estimatedDelivery) };
  }
  return { primary: "To come", secondary: "" };
}

function timeline(input: ShipmentEmailInput) {
  const steps = buildSteps(input);
  const currentIndex = steps.findIndex((step) => step.state === "active");

  const cells = steps
    .map((step, index) => {
      const isFirst = index === 0;
      const isLast = index === steps.length - 1;
      const leftFilled = !isFirst && index <= currentIndex;
      const rightFilled = !isLast && index < currentIndex;
      const stamp = stepStamp(step, input.estimatedDelivery);
      const labelColour =
        step.state === "future"
          ? PALETTE.faint
          : step.state === "skipped"
            ? PALETTE.muted
            : PALETTE.ink;
      const stampColour = step.state === "future" ? PALETTE.faint : PALETTE.muted;

      return `
              <td width="20%" align="center" valign="top" style="padding:0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td width="50%" height="2" style="height:2px;line-height:2px;font-size:0;background-color:${
                      isFirst ? "transparent" : leftFilled ? PALETTE.forest : PALETTE.track
                    };"></td>
                    <td width="26" height="26" align="center" valign="middle" style="width:26px;height:26px;line-height:24px;border-radius:13px;text-align:center;font-family:${FONT_STACK};font-weight:700;${stepDot(
                      step.state,
                      step.status,
                    )}">${stepGlyph(step.state)}</td>
                    <td height="2" style="height:2px;line-height:2px;font-size:0;background-color:${
                      isLast ? "transparent" : rightFilled ? PALETTE.forest : PALETTE.track
                    };"></td>
                  </tr>
                </table>
                <p style="margin:9px 0 0;font-family:${FONT_STACK};font-size:11px;line-height:15px;font-weight:600;color:${labelColour};text-align:center;">${
                  STEP_COPY[step.status].label
                }</p>
                <p style="margin:2px 0 0;font-family:${FONT_STACK};font-size:10px;line-height:14px;color:${stampColour};text-align:center;font-variant-numeric:tabular-nums;">${
                  stamp.primary
                }</p>
                ${
                  stamp.secondary
                    ? `<p style="margin:0;font-family:${FONT_STACK};font-size:10px;line-height:14px;color:${stampColour};text-align:center;font-variant-numeric:tabular-nums;">${stamp.secondary}</p>`
                    : ""
                }
              </td>`;
    })
    .join("");

  return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;">
          <tr>${cells}
          </tr>
        </table>`;
}

function detailRow(label: string, value: string, last = false) {
  return `
                <tr>
                  <td valign="top" width="38%" style="padding:12px 0 ${
                    last ? "0" : "12px"
                  };font-family:${FONT_STACK};font-size:11px;line-height:16px;color:${
                    PALETTE.muted
                  };border-bottom:${last ? "none" : `1px solid ${PALETTE.line}`};">${escapeHtml(
                    label,
                  )}</td>
                  <td valign="top" style="padding:12px 0 ${
                    last ? "0" : "12px"
                  };font-family:${FONT_STACK};font-size:12px;line-height:18px;font-weight:600;color:${
                    PALETTE.ink
                  };text-align:right;border-bottom:${last ? "none" : `1px solid ${PALETTE.line}`};">${escapeHtml(
                    value,
                  )}</td>
                </tr>`;
}

function serviceCell(glyph: string, title: string, copy: string, last = false) {
  return `
            <td width="33.33%" valign="top" style="padding:0 ${
              last ? "0" : "10px"
            } 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td width="30" height="30" align="center" valign="middle" style="width:30px;height:30px;line-height:30px;border-radius:15px;background-color:${
                    PALETTE.goldSoft
                  };border:1px solid #EFDFA4;text-align:center;font-family:${FONT_STACK};font-size:13px;color:${
                    PALETTE.forest
                  };">${glyph}</td>
                  <td style="padding-left:9px;font-family:${FONT_STACK};font-size:11px;line-height:15px;font-weight:700;color:${
                    PALETTE.ink
                  };">${escapeHtml(title)}</td>
                </tr>
              </table>
              <p style="margin:6px 0 0;font-family:${FONT_STACK};font-size:10px;line-height:15px;color:${
                PALETTE.muted
              };">${escapeHtml(copy)}</p>
            </td>`;
}

function photoCell(input: ShipmentEmailInput, origin: string | undefined) {
  const path = input.photoPath && /^\/[a-z0-9/_-]+\.(webp|png|jpe?g|svg)$/i.test(input.photoPath)
    ? input.photoPath
    : undefined;
  const src = path && origin ? safeUrl(`${origin}${path}`) : undefined;

  if (src) {
    return `<td width="58" valign="middle" style="width:58px;padding:0 14px 0 0;">
                        <img src="${escapeAttribute(src)}" width="58" height="58" alt="${escapeAttribute(
                          input.mineralName,
                        )}" style="display:block;width:58px;height:58px;border-radius:10px;border:1px solid ${
                          PALETTE.line
                        };object-fit:cover;background-color:${PALETTE.cream};" />
                      </td>`;
  }

  return `<td width="58" valign="middle" style="width:58px;padding:0 14px 0 0;">
                        <table role="presentation" width="58" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                          <tr>
                            <td width="58" height="58" align="center" valign="middle" style="width:58px;height:58px;border-radius:10px;border:1px solid ${
                              PALETTE.line
                            };background-color:${PALETTE.cream};text-align:center;font-family:${FONT_STACK};font-size:20px;color:${
                              PALETTE.forest
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
  const heroBreadcrumb = `Vault &nbsp;/&nbsp; Shipments &nbsp;/&nbsp; ${escapeHtml(
    input.trackingNumber,
  )}`;

  const subject = `${copy.subject} \u00b7 ${input.trackingNumber}`;
  const preheader = `${copy.headline}. ${note} Estimated delivery ${eta}.`;

  const footerLink = (path: string, label: string) => {
    if (!appOrigin) {
      return `<p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:11px;line-height:17px;color:#C9D8CE;">${escapeHtml(
        label,
      )}</p>`;
    }
    return `<p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:11px;line-height:17px;"><a href="${escapeAttribute(
      `${appOrigin}${path}`,
    )}" style="color:#C9D8CE;text-decoration:none;">${escapeHtml(label)}</a></p>`;
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
        .cv-hero { padding: 26px 20px !important; }
        .cv-title { font-size: 23px !important; line-height: 30px !important; }
        .cv-step-label { font-size: 9px !important; }
        .cv-service { display: block !important; width: 100% !important; padding: 0 0 14px 0 !important; }
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
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;border-collapse:collapse;background-color:${PALETTE.white};border-radius:16px;overflow:hidden;">

            <!-- Announcement bar -->
            <tr>
              <td bgcolor="${PALETTE.forest}" style="background-color:${PALETTE.forest};padding:9px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="font-family:${FONT_STACK};font-size:10px;line-height:14px;color:#D8E4DA;">Concierge &nbsp;&middot;&nbsp; ${escapeHtml(
                      support,
                    )}</td>
                    <td align="right" style="font-family:${FONT_STACK};font-size:10px;line-height:14px;color:#A9C3B1;">Fully insured &nbsp;&middot;&nbsp; Door to door</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Brand header -->
            <tr>
              <td style="padding:18px 28px;border-bottom:1px solid ${PALETTE.line};">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td valign="middle">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                        <tr>
                          <td width="32" height="32" align="center" valign="middle" style="width:32px;height:32px;border-radius:16px;background-color:${
                            PALETTE.gold
                          };text-align:center;font-family:${FONT_STACK};font-size:15px;color:${
                            PALETTE.forestDeep
                          };">&#9670;</td>
                          <td style="padding-left:10px;font-family:${FONT_STACK};font-size:18px;line-height:22px;font-weight:700;letter-spacing:-0.2px;color:${
                            PALETTE.forest
                          };">${escapeHtml(company)}</td>
                        </tr>
                      </table>
                    </td>
                    <td align="right" valign="middle" style="font-family:${FONT_STACK};font-size:10px;line-height:14px;letter-spacing:0.08em;text-transform:uppercase;color:${
                      PALETTE.muted
                    };">Shipment update</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Hero -->
            <tr>
              <td class="cv-hero" style="padding:34px 28px 30px;background-color:${PALETTE.cream};text-align:center;border-bottom:1px solid ${PALETTE.line};">
                <p style="margin:0 0 10px;font-family:${FONT_STACK};font-size:10px;line-height:14px;letter-spacing:0.18em;text-transform:uppercase;color:${
                  PALETTE.moss
                };">${escapeHtml(copy.stamp)}</p>
                <h1 class="cv-title" style="margin:0;font-family:${FONT_STACK};font-size:28px;line-height:36px;font-weight:700;letter-spacing:-0.6px;color:${
                  PALETTE.forest
                };">${escapeHtml(copy.headline)}</h1>
                <p style="margin:10px 0 0;font-family:${FONT_STACK};font-size:11px;line-height:17px;color:${
                  PALETTE.muted
                };">${heroBreadcrumb}</p>
              </td>
            </tr>

            <!-- Status -->
            <tr>
              <td class="cv-pad" style="padding:26px 28px 0;">
                <p style="margin:0;font-family:${FONT_STACK};font-size:14px;line-height:20px;font-weight:700;color:${
                  PALETTE.ink
                };">Shipment status</p>
                <p style="margin:3px 0 0;font-family:${FONT_STACK};font-size:11px;line-height:17px;color:${
                  PALETTE.muted
                };">Tracking reference <span style="font-weight:600;color:${PALETTE.ink};">${escapeHtml(
                  input.trackingNumber,
                )}</span></p>
              </td>
            </tr>
            <tr>
              <td class="cv-pad" style="padding:14px 28px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid ${
                  PALETTE.line
                };border-radius:12px;background-color:${PALETTE.white};">
                  <tr>
                    <td style="padding:22px 18px 18px;">
                      ${timeline(input)}
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                        <tr>
                          <td style="padding:18px 0 0;border-top:1px solid ${PALETTE.line};">
                            <p style="margin:0;font-family:${FONT_STACK};font-size:9px;line-height:13px;letter-spacing:0.14em;text-transform:uppercase;color:${
                              PALETTE.muted
                            };">Latest update &nbsp;&middot;&nbsp; ${escapeHtml(updatedLabel)}</p>
                            <p style="margin:6px 0 0;font-family:${FONT_STACK};font-size:12px;line-height:20px;color:${
                              PALETTE.ink
                            };">${breakLines(note)}</p>
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
              <td class="cv-pad" style="padding:22px 28px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid ${
                  PALETTE.line
                };border-radius:12px;background-color:${PALETTE.white};">
                  <tr>
                    <td style="padding:18px 18px 16px;">
                      <p style="margin:0 0 14px;font-family:${FONT_STACK};font-size:9px;line-height:13px;letter-spacing:0.16em;text-transform:uppercase;color:${
                        PALETTE.muted
                      };">Your consignment</p>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                        <tr>
                          ${photoCell(input, appOrigin)}
                          <td valign="middle" style="font-family:${FONT_STACK};">
                            <p style="margin:0;font-family:${FONT_STACK};font-size:14px;line-height:20px;font-weight:700;color:${
                              PALETTE.ink
                            };">${escapeHtml(input.mineralName)}</p>
                            <p style="margin:2px 0 0;font-family:${FONT_STACK};font-size:11px;line-height:17px;color:${
                              PALETTE.muted
                            };">${escapeHtml(input.category)} &nbsp;&middot;&nbsp; ${escapeHtml(
                              input.weightLabel,
                            )}</p>
                            <p style="margin:1px 0 0;font-family:${FONT_STACK};font-size:10px;line-height:16px;color:${
                              PALETTE.faint
                            };">${escapeHtml(input.mineralType)} &nbsp;&middot;&nbsp; ${escapeHtml(
                              input.vaultId,
                            )}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px 16px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:1px solid ${
                        PALETTE.line
                      };">
                        ${detailRow("Carrier", `${input.carrier} \u00b7 ${input.service}`)}
                        ${detailRow("Tracking number", input.trackingNumber)}
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
              <td class="cv-pad" style="padding:20px 28px 0;">
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
              <td class="cv-pad" style="padding:24px 28px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:${
                  PALETTE.cream
                };border-radius:12px;">
                  <tr>
                    <td align="center" style="padding:24px 22px;">
                      <p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:9px;line-height:13px;letter-spacing:0.18em;text-transform:uppercase;color:${
                        PALETTE.moss
                      };">Your vault</p>
                      <p style="margin:0;font-family:${FONT_STACK};font-size:19px;line-height:26px;font-weight:700;letter-spacing:-0.3px;color:${
                        PALETTE.forest
                      };">Follow every handover</p>
                      <p style="margin:8px 0 0;font-family:${FONT_STACK};font-size:11px;line-height:18px;color:${
                        PALETTE.muted
                      };">The tracking view carries this same timeline, the carrier reference and every note our vault team records.</p>
                      ${
                        trackingUrl
                          ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;margin:16px auto 0;">
                        <tr>
                          <td align="center" bgcolor="${PALETTE.gold}" style="border-radius:999px;">
                            <a href="${escapeAttribute(
                              trackingUrl,
                            )}" style="display:inline-block;padding:11px 24px;font-family:${FONT_STACK};font-size:12px;line-height:16px;font-weight:700;color:${
                              PALETTE.forestDeep
                            };text-decoration:none;border-radius:999px;">Track your shipment</a>
                          </td>
                        </tr>
                      </table>`
                          : ""
                      }
                      <p style="margin:12px 0 0;font-family:${FONT_STACK};font-size:10px;line-height:16px;color:${
                        PALETTE.muted
                      };">Questions? <a href="mailto:${escapeAttribute(
                        support,
                      )}" style="color:${PALETTE.moss};text-decoration:underline;">${escapeHtml(
                        support,
                      )}</a></p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td bgcolor="${PALETTE.forest}" style="background-color:${PALETTE.forest};padding:26px 28px 22px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td valign="top" width="46%" style="padding:0 18px 18px 0;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                        <tr>
                          <td width="30" height="30" align="center" valign="middle" style="width:30px;height:30px;border-radius:15px;background-color:${
                            PALETTE.gold
                          };text-align:center;font-family:${FONT_STACK};font-size:14px;color:${
                            PALETTE.forestDeep
                          };">&#9670;</td>
                          <td style="padding-left:9px;font-family:${FONT_STACK};font-size:16px;line-height:20px;font-weight:700;color:${PALETTE.white};">${escapeHtml(
                            company,
                          )}</td>
                        </tr>
                      </table>
                      <p style="margin:12px 0 0;font-family:${FONT_STACK};font-size:10px;line-height:17px;color:#A9C3B1;">Vaulted, insured and tracked under one roof. Every consignment is handled by named vault staff and released only against your instruction.</p>
                    </td>
                    <td valign="top" width="27%" style="padding:0 10px 18px 0;">
                      <p style="margin:0 0 10px;font-family:${FONT_STACK};font-size:9px;line-height:13px;letter-spacing:0.14em;text-transform:uppercase;color:#8FAE99;">Your vault</p>
                      ${footerLink(TRACKING_PATH, "Shipment tracking")}
                      ${footerLink("/dashboard/vault", "Mineral register")}
                      ${footerLink("/dashboard/documents", "Documents")}
                      ${footerLink("/dashboard/support", "Concierge")}
                    </td>
                    <td valign="top" width="27%" style="padding:0 0 18px;">
                      <p style="margin:0 0 10px;font-family:${FONT_STACK};font-size:9px;line-height:13px;letter-spacing:0.14em;text-transform:uppercase;color:#8FAE99;">Small print</p>
                      ${footerLink("/legal/terms", "Terms")}
                      ${footerLink("/legal/privacy", "Privacy")}
                      ${footerLink("/about", "About the vault")}
                    </td>
                  </tr>
                  <tr>
                    <td colspan="3" style="padding:14px 0 0;border-top:1px solid #24523F;font-family:${FONT_STACK};font-size:10px;line-height:16px;color:#8FAE99;">
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

          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;border-collapse:collapse;">
            <tr>
              <td align="center" style="padding:14px 20px 0;font-family:${FONT_STACK};font-size:9px;line-height:14px;color:${PALETTE.faint};">
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

  const steps = buildSteps(input);
  const textLines = steps.map((step) => {
    const stamp = stepStamp(step, input.estimatedDelivery);
    const when = stamp.secondary ? `${stamp.primary} ${stamp.secondary}` : stamp.primary;
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
