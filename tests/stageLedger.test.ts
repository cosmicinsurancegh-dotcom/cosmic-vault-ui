import { describe, expect, it } from "vitest";
import {
  renderStageLedger,
  type LedgerStage,
  type RouteRailTone,
} from "../src/convex/lib/routeRail";

const TONE: RouteRailTone = {
  origin: "#2F6BF0",
  accent: "#2F6BF0",
  attention: "#B45309",
  track: "#C3CDDF",
  ink: "#0F172A",
  muted: "#5B6478",
  faint: "#8B94A8",
  white: "#FFFFFF",
  surface: "#FFFFFF",
  outline: "#C9D9F8",
  outlineInk: "#2F6BF0",
  emerald: "#047857",
};

function ledger(stages: LedgerStage[]) {
  return renderStageLedger({ stages, tone: TONE, fontStack: "Arial" });
}

const count = (html: string, pattern: RegExp) => html.match(pattern) ?? [];

describe("stage ledger", () => {
  it("joins the rows with a solid hairline only up to the live stage", () => {
    const html = ledger([
      { label: "Preparing", state: "complete", stamp: "Complete" },
      { label: "In transit", state: "active", stamp: "24 Oct 2026" },
      { label: "Out for delivery", state: "future", stamp: "To come" },
    ]);

    expect(count(html, /border-radius:11px/g)).toHaveLength(3);
    expect(count(html, /border-left:2px solid/g)).toHaveLength(1);
    expect(count(html, /border-left:2px dashed/g)).toHaveLength(1);
    expect(html).toContain("24 Oct 2026");
  });

  it("dashes the whole ledger when nothing has been reached", () => {
    const html = ledger([
      { label: "Preparing", state: "future", stamp: "To come" },
      { label: "Delivered", state: "future", stamp: "To come" },
    ]);

    expect(count(html, /border-left:2px solid/g)).toHaveLength(0);
    expect(count(html, /border-left:2px dashed/g)).toHaveLength(1);
  });

  it("marks a hold in amber and an arrival in green", () => {
    const held = ledger([
      {
        label: "Held at customs",
        state: "active",
        attention: true,
        stamp: "24 Oct 2026",
      },
    ]);
    // The amber ring, the amber glyph and the amber label.
    expect(held).toContain("border:2px solid #B45309");
    expect(held).toContain("color:#B45309");

    const arrived = ledger([
      {
        label: "Delivered",
        state: "active",
        delivered: true,
        stamp: "24 Oct 2026",
      },
    ]);
    expect(arrived).toContain("background-color:#047857");
    expect(arrived).toContain("&#10003;");
  });

  it("escapes the stage names and stamps it prints", () => {
    const html = ledger([
      {
        label: '<img src=x onerror="alert(1)">',
        state: "future",
        stamp: "<script>alert(2)</script>",
      },
    ]);

    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
  });
});
