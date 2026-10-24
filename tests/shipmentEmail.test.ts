import { describe, expect, it } from "vitest";
import {
  renderShipmentUpdateEmail,
  SHIPMENT_EMAIL_STATUSES,
} from "../src/convex/vault/shipmentEmail";
import { DEMO_MINERALS } from "../src/lib/vault/demoData";
import {
  previewShipmentEmail,
  shipmentEmailArgs,
} from "../src/lib/vault/shipmentEmail";

const ORIGIN = "https://vault.example";

function demoMineral(status: string) {
  const mineral = DEMO_MINERALS.find(
    (item) => item.shipping?.currentStatus === status,
  );
  if (!mineral) throw new Error(`Demo data has no shipment in ${status}.`);
  return mineral;
}

describe("shipment update email", () => {
  it("addresses the member with the piece, status and tracking reference", () => {
    const mineral = demoMineral("in_transit");
    const args = shipmentEmailArgs(mineral, "in_transit", "Handed to the crew.");
    expect(args).not.toBeNull();

    const email = previewShipmentEmail(args!, { appOrigin: ORIGIN });

    expect(email.subject).toBe(
      `Shipment in transit · ${mineral.shipping!.trackingNumber}`,
    );
    expect(email.preheader).toContain("Your shipment is on its way");
    expect(email.html).toContain("Your shipment is on its way");
    expect(email.html).toContain(mineral.name);
    expect(email.html).toContain("Handed to the crew.");
    expect(email.html).toContain(`${ORIGIN}/dashboard/shipments`);
    expect(email.text).toContain(mineral.ownerName.split(" ")[0]);
    expect(email.text).toContain(`Track your shipment: ${ORIGIN}/dashboard/shipments`);
    expect(email.text).not.toContain("<div");
    expect(email.text).not.toContain("<table");
  });

  it("keeps the five-step rail in step with the current status", () => {
    const mineral = demoMineral("in_transit");
    const args = shipmentEmailArgs(mineral, "in_transit", "")!;
    const email = previewShipmentEmail(args, { appOrigin: ORIGIN });

    for (const status of SHIPMENT_EMAIL_STATUSES) {
      const label = {
        pending: "Authorised",
        in_progress: "Preparing",
        on_hold: "On Hold",
        in_transit: "In transit",
        shipped: "Delivered",
      }[status];
      expect(email.html).toContain(label);
    }

    // The final stage has not happened yet, so it carries the estimate.
    expect(email.text).toMatch(/Delivered\s+Expected/);
    // The current stage carries the timestamp of the update.
    expect(email.text).toMatch(/In transit\s+\d{1,2} [A-Z][a-z]{2}/);
  });

  it("marks stages that were not required as skipped", () => {
    const mineral = demoMineral("in_transit");
    const args = shipmentEmailArgs(mineral, "in_transit", "")!;
    const at = Date.UTC(2026, 9, 20, 9, 0);

    const email = previewShipmentEmail(
      {
        ...args,
        status: "in_transit",
        updatedAt: at,
        events: [
          { status: "pending", at: at - 86_400_000 },
          { status: "in_transit", at },
        ],
      },
      { appOrigin: ORIGIN },
    );

    expect(email.html).toContain("Skipped");
    expect(email.text).toMatch(/Preparing\s+Skipped/);
    expect(email.text).toMatch(/On Hold\s+Skipped/);
  });

  it("gives every status its own subject and headline", () => {
    const mineral = demoMineral("pending");
    const args = shipmentEmailArgs(mineral, "pending", "")!;

    const headlines: Record<string, string> = {
      pending: "Your shipment is booked in",
      in_progress: "Your piece is being prepared",
      on_hold: "Your shipment is on hold",
      in_transit: "Your shipment is on its way",
      shipped: "Your shipment has arrived",
    };
    const subjects: Record<string, string> = {
      pending: "Shipment authorised",
      in_progress: "Shipment in preparation",
      on_hold: "Shipment on hold",
      in_transit: "Shipment in transit",
      shipped: "Shipment delivered",
    };

    for (const status of SHIPMENT_EMAIL_STATUSES) {
      const email = previewShipmentEmail(
        { ...args, status, events: [{ status, at: Date.now() }] },
        { appOrigin: ORIGIN },
      );
      expect(email.subject.startsWith(subjects[status])).toBe(true);
      expect(email.html).toContain(headlines[status]);
    }
  });

  it("escapes member-facing copy and refuses unsafe links", () => {
    const mineral = demoMineral("in_transit");
    const args = shipmentEmailArgs(mineral, "in_transit", "")!;

    const email = renderShipmentUpdateEmail({
      ...args,
      note: '<script>alert("xss")</script>',
      trackingUrl: "javascript:alert(1)",
      appOrigin: "javascript:alert(1)",
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain("javascript:");
    // Plain text keeps the member's words verbatim - it is not HTML.
    expect(email.text).toContain('<script>alert("xss")</script>');
  });

  it("only renders photos that live in the vault's own asset folder", () => {
    const mineral = demoMineral("in_transit");
    const args = shipmentEmailArgs(mineral, "in_transit", "")!;

    const local = renderShipmentUpdateEmail({
      ...args,
      trackingUrl: `${ORIGIN}/dashboard/shipments`,
      appOrigin: ORIGIN,
      photoPath: "/minerals/gold-bars.webp",
    });
    expect(local.html).toContain(
      `<img src="${ORIGIN}/minerals/gold-bars.webp"`,
    );

    const remote = renderShipmentUpdateEmail({
      ...args,
      trackingUrl: `${ORIGIN}/dashboard/shipments`,
      appOrigin: ORIGIN,
      photoPath: "https://tracker.example/pixel.png",
    });
    expect(remote.html).not.toContain("tracker.example");
    expect(remote.html).toContain("&#9670;");
  });

  it("adds the published event to the history the email carries", () => {
    const mineral = demoMineral("in_progress");
    const before = mineral.shipping!.statusHistory.length;
    const args = shipmentEmailArgs(mineral, "in_transit", "  ")!;
    expect(args.events).toHaveLength(before + 1);
    const latest = args.events[args.events.length - 1];
    expect(latest.status).toBe("in_transit");
    // A blank note falls back to the status description the member sees.
    expect(latest.note).toBe(
      "With the secure carrier and moving to its destination.",
    );
    expect(args.note).toBe(latest.note);
    expect(args.weightLabel).toMatch(/\d/);
    expect(args.destination).toContain(mineral.shipping!.destination.city);
  });

  it("wears the dashboard design system and the shipping desk's route", () => {
    const mineral = demoMineral("in_transit");
    const args = shipmentEmailArgs(mineral, "in_transit", "")!;
    const email = previewShipmentEmail(args, { appOrigin: ORIGIN });

    // Electric blue primary, porcelain canvas, 4px corners - the dashboard
    // tokens - and none of the old forest-green reference palette.
    expect(email.html).toContain("#1D74F5");
    expect(email.html).toContain("#F2F6FC");
    expect(email.html).toContain("border-radius:4px");
    expect(email.html).not.toContain("#0F3729");
    expect(email.html).not.toContain("#F5C93B");

    // The route rail carries the two city labels the member recognises.
    expect(email.html).toContain("Consignment route");
    expect(email.html).toContain(mineral.shipping!.origin.city);
    expect(email.html).toContain(mineral.shipping!.destination.city);
    expect(email.text).toContain(
      `Route: ${mineral.shipping!.origin.city} to ${mineral.shipping!.destination.city}`,
    );
  });

  it("returns nothing for a mineral that is still in the vault", () => {
    const inVault = DEMO_MINERALS.find((item) => !item.shipping);
    expect(inVault).toBeDefined();
    expect(shipmentEmailArgs(inVault!, "pending", "")).toBeNull();
  });
});
