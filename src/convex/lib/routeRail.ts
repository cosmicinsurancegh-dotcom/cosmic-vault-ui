/**
 * The shipment route rail: origin pin, the carrier's mode at the live
 * position and the destination pin, on one dashed track with the passed span
 * solid and a diamond at each stage boundary.
 *
 * Both shipment emails - `lib/shipmentEmail` (the Convex-native one) and
 * `vault/shipmentEmail` (the dashboard design) - draw this same illustration,
 * so it lives here once. Each template passes its own palette, font stack and
 * progress, because the two carry different status vocabularies; the drawing
 * itself - geometry, waypoints, station labels and marker assets - is shared,
 * so the two emails cannot drift apart.
 *
 * Email-safe by construction: tables and inline styles only, no SVG, and the
 * pins are PNGs served from the app origin. Without an origin the markers fall
 * back to a diamond glyph, so a preview with no configured site still reads.
 */

/** How far the fill reaches for each stage, in rail fractions. */
export const ROUTE_RAIL_STOPS = {
  start: 0,
  firstWaypoint: 0.25,
  truck: 0.5,
  secondWaypoint: 0.75,
  destination: 1,
} as const;

export type RouteRailTone = {
  /** The origin disc, which keeps the brand blue even when the rest warns. */
  origin: string;
  /** The travelled span and the truck's disc. */
  accent: string;
  /** The Position label when the shipment needs attention. */
  attention: string;
  /** The dashed track ahead. */
  track: string;
  ink: string;
  faint: string;
  white: string;
  /** The destination disc before delivery: surface and hairline border. */
  surface: string;
  outline: string;
  /** The glyph colour inside the outlined destination disc. */
  outlineInk: string;
  /** The destination disc once delivered. */
  emerald: string;
};

export type RouteRailInput = {
  origin: string;
  destination: string;
  /** The live location; the vault keeps none, so this says so plainly. */
  position?: string;
  /** One of `ROUTE_RAIL_STOPS`, or any 0-1 fraction. */
  progress: number;
  attention?: boolean;
  delivered?: boolean;
  tone: RouteRailTone;
  fontStack: string;
  /** Absolute origin for the marker PNGs. */
  iconBase?: string;
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

/** One hairline of the route: solid once passed, dashed while still ahead. */
function railLine(filled: boolean, tone: RouteRailTone) {
  const colour = filled ? tone.accent : tone.track;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;">
                    <tr><td height="2" style="height:2px;line-height:2px;font-size:0;border-top:${
                      filled ? "2px solid" : "2px dashed"
                    } ${colour};">&nbsp;</td></tr>
                  </table>`;
}

/** The shipping desk's waypoint diamond, filled once the route passes it. */
function railDiamond(filled: boolean, input: RouteRailInput) {
  return `<td width="9" align="center" valign="middle" style="width:9px;font-family:${
    input.fontStack
  };font-size:8px;line-height:8px;color:${
    filled ? input.tone.accent : input.tone.track
  };">&#9670;</td>`;
}

/**
 * A station marker: a pin at either end, the carrier's mode at the live one.
 * The disc keeps its size even when the icon cannot load, which is why the
 * table carries an explicit 30px width.
 */
function railMarker({
  background,
  border,
  glyphColour,
  icon,
  fontStack,
}: {
  background: string;
  border: string;
  glyphColour: string;
  icon?: string;
  fontStack: string;
}) {
  return `<table role="presentation" width="30" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;">
                  <tr>
                    <td width="30" height="30" align="center" valign="middle" style="width:30px;height:30px;border-radius:15px;background-color:${background};border:${border};text-align:center;">${
                      icon
                        ? `<img src="${escapeAttribute(
                            icon,
                          )}" width="15" height="15" alt="" style="display:block;width:15px;height:15px;border:0;margin:0 auto;" />`
                        : `<span style="font-family:${fontStack};font-size:10px;line-height:15px;color:${glyphColour};">&#9670;</span>`
                    }</td>
                  </tr>
                </table>`;
}

function railStation(
  kicker: string,
  title: string,
  input: RouteRailInput,
  attention = false,
) {
  return `<p style="margin:10px 0 0;font-family:${
    input.fontStack
  };font-size:9px;line-height:12px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${
    input.tone.faint
  };text-align:center;">${escapeHtml(kicker)}</p>
                <p style="margin:5px 0 0;font-family:${
                  input.fontStack
                };font-size:13px;line-height:17px;font-weight:700;letter-spacing:-0.01em;color:${
                  attention ? input.tone.attention : input.tone.ink
                };text-align:center;">${escapeHtml(title)}</p>`;
}

export function renderRouteRail(input: RouteRailInput) {
  const { progress, tone, iconBase } = input;
  const position = input.position?.trim() || "No location recorded";
  const delivered = Boolean(input.delivered);
  const icon = (file: string) =>
    iconBase ? `${iconBase.replace(/\/$/, "")}/email/${file}` : undefined;

  const originMarker = railMarker({
    background: tone.origin,
    border: `1px solid ${tone.origin}`,
    glyphColour: tone.white,
    icon: icon("route-pin-origin.png"),
    fontStack: input.fontStack,
  });
  const positionMarker = railMarker({
    background: tone.accent,
    border: `1px solid ${tone.accent}`,
    glyphColour: tone.white,
    icon: icon("route-truck.png"),
    fontStack: input.fontStack,
  });
  const destinationMarker = railMarker(
    delivered
      ? {
          background: tone.emerald,
          border: `1px solid ${tone.emerald}`,
          glyphColour: tone.white,
          icon: icon("route-pin-origin.png"),
          fontStack: input.fontStack,
        }
      : {
          background: tone.surface,
          border: `1px solid ${tone.outline}`,
          glyphColour: tone.outlineInk,
          icon: icon("route-pin-destination.png"),
          fontStack: input.fontStack,
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
                      progress >= ROUTE_RAIL_STOPS.firstWaypoint,
                      tone,
                    )}</td>
                    ${railDiamond(
                      progress >= ROUTE_RAIL_STOPS.firstWaypoint,
                      input,
                    )}
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          ${railStation("Origin", input.origin, input)}
        </td>
        <td width="33.33%" align="center" valign="top" style="padding:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td width="50%" valign="middle" style="padding:0;">${railLine(
                progress >= ROUTE_RAIL_STOPS.truck,
                tone,
              )}</td>
              <td width="30" valign="middle" style="width:30px;padding:0;">${positionMarker}</td>
              <td width="50%" valign="middle" style="padding:0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td valign="middle" style="padding:0;">${railLine(
                      progress >= ROUTE_RAIL_STOPS.secondWaypoint,
                      tone,
                    )}</td>
                    ${railDiamond(
                      progress >= ROUTE_RAIL_STOPS.secondWaypoint,
                      input,
                    )}
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          ${railStation("Position", position, input, Boolean(input.attention))}
        </td>
        <td width="33.33%" align="center" valign="top" style="padding:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td width="50%" valign="middle" style="padding:0;">${railLine(
                progress >= ROUTE_RAIL_STOPS.destination,
                tone,
              )}</td>
              <td width="30" valign="middle" style="width:30px;padding:0;">${destinationMarker}</td>
              <td width="50%" style="padding:0;"></td>
            </tr>
          </table>
          ${railStation("Destination", input.destination, input)}
        </td>
      </tr>
    </table>`;
}
