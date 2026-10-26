/**
 * The shipment route rail and the stage ledger it sits with: the rail puts
 * origin, live position and destination on one dashed track with the passed
 * span solid and a diamond at each stage boundary; the ledger lists the stages
 * themselves, one per row, joined by the same solid-or-dashed hairline.
 *
 * Both shipment emails - `lib/shipmentEmail` (the Convex-native one) and
 * `vault/shipmentEmail` (the dashboard design) - draw both illustrations from
 * here, so they live once. Each template passes its own palette, font stack and
 * progress, because the two carry different status vocabularies; the drawing
 * itself - geometry, waypoints, station labels, stage rows and marker assets -
 * is shared, so the two emails cannot drift apart.
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
  /** Secondary type: the stamp on a stage already reached. */
  muted: string;
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
  // Separate borders, not collapsed: a collapsed cell drops its radius, and the
  // disc would arrive as a square.
  return `<table role="presentation" width="30" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;mso-table-lspace:0;mso-table-rspace:0;">
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

export type LedgerStageState = "complete" | "active" | "future" | "skipped";

export type LedgerStage = {
  label: string;
  state: LedgerStageState;
  /** The date, or the state word ("To come"), shown at the right of the row. */
  stamp: string;
  /** The active stage is a hold or a delay rather than a move forward. */
  attention?: boolean;
  /** The active stage is the last one: the consignment has arrived. */
  delivered?: boolean;
};

type LedgerMarker = {
  background: string;
  border: string;
  colour: string;
  glyph: string;
  size: number;
  /** The glyph sits inside the ring, so a 2px ring pulls it in by two. */
  inset: number;
};

function ledgerMarker(stage: LedgerStage, tone: RouteRailTone): LedgerMarker {
  if (stage.state === "complete") {
    return {
      background: tone.accent,
      border: `1px solid ${tone.accent}`,
      colour: tone.white,
      glyph: "&#10003;",
      size: 11,
      inset: 20,
    };
  }
  if (stage.state === "active") {
    if (stage.delivered) {
      return {
        background: tone.emerald,
        border: `1px solid ${tone.emerald}`,
        colour: tone.white,
        glyph: "&#10003;",
        size: 11,
        inset: 20,
      };
    }
    const accent = stage.attention ? tone.attention : tone.accent;
    return {
      background: tone.surface,
      border: `2px solid ${accent}`,
      colour: accent,
      glyph: stage.attention ? "!" : "&#8226;",
      size: 13,
      inset: 18,
    };
  }
  if (stage.state === "skipped") {
    return {
      background: tone.surface,
      border: `1px dashed ${tone.track}`,
      colour: tone.faint,
      glyph: "&#8211;",
      size: 10,
      inset: 20,
    };
  }
  return {
    background: tone.surface,
    border: `1px solid ${tone.track}`,
    colour: tone.track,
    glyph: "&#183;",
    size: 10,
    inset: 20,
  };
}

/**
 * The stages, one per row: marker, name and stamp, joined by a hairline that is
 * solid over ground already covered and dashed ahead. It is deliberately a list
 * rather than a second route drawing - a rail above and a rail below would echo
 * each other, and a row has space for "Skipped" or "Expected" beside the name.
 */
export function renderStageLedger({
  stages,
  tone,
  fontStack,
}: {
  stages: LedgerStage[];
  tone: RouteRailTone;
  fontStack: string;
}): string {
  const lastIndex = stages.length - 1;
  const reached = (stage: LedgerStage | undefined) =>
    Boolean(stage) &&
    (stage!.state === "complete" || stage!.state === "active");

  const labelColour = (stage: LedgerStage) => {
    if (stage.state === "future") return tone.faint;
    if (stage.state === "active" && stage.attention) return tone.attention;
    if (stage.state === "active" && stage.delivered) return tone.emerald;
    return tone.ink;
  };

  const rows = stages
    .map((stage, index) => {
      const marker = ledgerMarker(stage, tone);
      const connector =
        index < lastIndex
          ? `
                <tr>
                  <td width="22" align="center" valign="top" style="width:22px;padding:0;">
                    <table role="presentation" width="2" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
                      <tr>
                        <td height="10" style="height:10px;width:0;font-size:0;line-height:0;border-left:${
                          reached(stage) && reached(stages[index + 1])
                            ? `2px solid ${tone.accent}`
                            : `2px dashed ${tone.track}`
                        };">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                  <td colspan="2" style="padding:0;"></td>
                </tr>`
          : "";

      return `
                <tr>
                  <td width="22" valign="middle" style="width:22px;padding:0;">
                    <table role="presentation" width="22" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
                      <tr>
                        <td width="22" height="22" align="center" valign="middle" style="width:22px;height:22px;border-radius:11px;background-color:${
                          marker.background
                        };border:${marker.border};text-align:center;font-family:${fontStack};font-size:${
                          marker.size
                        }px;line-height:${marker.inset}px;font-weight:700;color:${
                          marker.colour
                        };">${marker.glyph}</td>
                      </tr>
                    </table>
                  </td>
                  <td valign="middle" style="padding:0 10px 0 12px;font-family:${fontStack};font-size:11px;line-height:16px;font-weight:${
                    reached(stage) ? "700" : "500"
                  };letter-spacing:-0.01em;color:${labelColour(
                    stage,
                  )};"><span class="cv-step-title">${escapeHtml(
                    stage.label,
                  )}</span></td>
                  <td valign="middle" align="right" style="font-family:${fontStack};font-size:10px;line-height:15px;color:${
                    reached(stage) ? tone.muted : tone.faint
                  };font-variant-numeric:tabular-nums;"><span class="cv-step-copy">${escapeHtml(
                    stage.stamp,
                  )}</span></td>
                </tr>${connector}`;
    })
    .join("");

  return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;">${rows}
        </table>`;
}
