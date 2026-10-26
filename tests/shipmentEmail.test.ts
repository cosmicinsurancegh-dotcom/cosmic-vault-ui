import { describe, expect, it } from "vitest";
import {
  renderShipmentUpdateEmail,
  SHIPMENT_EMAIL_STATUSES,
} from "../src/convex/vault/shipmentEmail";
import { renderShipmentStatusEmail } from "../src/convex/lib/shipmentEmail";
import { staticMapUrl } from "../src/convex/lib/staticMap";
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
    const args = shipmentEmailArgs(
      mineral,
      "in_transit",
      "Handed to the crew.",
    );
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
    expect(email.text).toContain(
      `Track your shipment: ${ORIGIN}/dashboard/shipments`,
    );
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
      originCity: '<img src=x onerror="alert(1)">',
      destinationCity: "A & B",
      trackingUrl: "javascript:alert(1)",
      appOrigin: "javascript:alert(1)",
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain("javascript:");
    // The shared route rail escapes the place names it prints.
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;img src=x onerror=");
    expect(email.html).toContain("A &amp; B");
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

    // The route rail is the same pin-and-truck drawing the Convex-native
    // shipment email uses: origin, position and destination, one line.
    expect(email.html).toContain(">Origin<");
    expect(email.html).toContain(">Position<");
    expect(email.html).toContain(">Destination<");
    expect(email.html).toContain(
      "https://vault.example/email/route-pin-origin.png",
    );
    expect(email.html).toContain("https://vault.example/email/route-truck.png");
    expect(email.html).toContain(
      "https://vault.example/email/route-pin-destination.png",
    );

    // The vault records no position, so the middle station says so plainly
    // rather than offering the status as a place.
    expect(email.html).toContain("No location recorded");
    expect(email.html).not.toContain(">Progress<");
  });

  it("draws the same route rail as the Convex-native shipment email", () => {
    // Both templates carry their own copy of the rail markup, so this guard
    // keeps them from drifting apart: same stations, same solid and dashed
    // segments, same markers and the same carrier icons at every stage.
    const stages: {
      vault: (typeof SHIPMENT_EMAIL_STATUSES)[number];
      convex: Parameters<typeof renderShipmentStatusEmail>[0]["status"];
    }[] = [
      { vault: "in_progress", convex: "preparing" },
      { vault: "on_hold", convex: "customs_hold" },
      { vault: "in_transit", convex: "in_transit" },
      { vault: "shipped", convex: "delivered" },
    ];

    const count = (html: string, pattern: RegExp) => html.match(pattern) ?? [];
    const rail = (html: string) => {
      const start = html.indexOf("border-radius:15px");
      expect(start).toBeGreaterThan(-1);
      const tail = html.slice(start);
      return {
        segments: count(tail, /border-top:2px (solid|dashed)/g)
          .map((hit) => hit.replace("border-top:2px ", ""))
          .slice(0, 4),
        // Colours come from each email's own palette; the markers themselves
        // must still be the same three 30px discs.
        markers: count(
          tail,
          /border-radius:15px;background-color:#[0-9A-Fa-f]{6}/g,
        )
          .slice(0, 3)
          .map(() => "marker"),
        icons: count(tail, /\/email\/route-[a-z-]+\.png/g).slice(0, 3),
        stations: [">Origin<", ">Position<", ">Destination<"].map((label) =>
          tail.includes(label),
        ),
      };
    };

    const base = shipmentEmailArgs(
      demoMineral("in_transit"),
      "in_transit",
      "",
    )!;

    for (const stage of stages) {
      const vault = previewShipmentEmail(
        {
          ...base,
          status: stage.vault,
          events: [{ status: stage.vault, at: Date.UTC(2026, 9, 24) }],
        },
        { appOrigin: ORIGIN },
      );
      const convex = renderShipmentStatusEmail({
        recipientName: "David Mensah",
        companyName: "Cosmic Vault Insurance",
        supportEmail: "concierge@cosmicvault.co",
        appUrl: ORIGIN,
        updatedAt: "24 Oct 2026",
        status: stage.convex,
        mineral: {
          name: base.mineralName,
          reference: base.vaultId,
          category: base.category,
          quantity: base.weightLabel,
          declaredValue: "",
        },
        shipment: {
          reference: base.trackingNumber,
          carrier: base.carrier,
          trackingNumber: base.trackingNumber,
          origin: "Berlin",
          destination: "London",
        },
      });

      expect(rail(vault.html)).toEqual(rail(convex.html));
    }
  });

  it("shows a real map when one was resolved, and the rail otherwise", () => {
    const mineral = demoMineral("in_transit");
    const args = shipmentEmailArgs(mineral, "in_transit", "")!;
    const map = staticMapUrl({
      origin: { lat: 51.5072, lon: -0.1276 },
      destination: { lat: 51.4545, lon: -2.5879 },
      token: "pk.test",
    })!;

    const mapped = previewShipmentEmail(args, {
      appOrigin: ORIGIN,
      mapUrl: map.url,
    });
    expect(mapped.html).toContain("api.mapbox.com");
    expect(mapped.html).toContain("Map of the route from");
    expect(mapped.html).toContain("OpenStreetMap contributors");
    // The map takes the place of the rail, not a second copy of it: the
    // station markers (the 30px discs) are gone. The consignment card below
    // still lists Origin and Destination as rows, so those words remain.
    expect(mapped.html).not.toContain(">Position<");
    expect(mapped.html).not.toContain("border-radius:15px");

    // Anything that is not a Mapbox image is refused and the rail is drawn.
    const unsafe = previewShipmentEmail(args, {
      appOrigin: ORIGIN,
      mapUrl: "https://tracker.example/pixel.png",
    });
    expect(unsafe.html).not.toContain("tracker.example");
    expect(unsafe.html).toContain(">Position<");

    // The Convex-native email makes the same choice from the same URL.
    const convexMapped = renderShipmentStatusEmail({
      recipientName: "David Mensah",
      companyName: "Cosmic Vault Insurance",
      supportEmail: "concierge@cosmicvault.co",
      appUrl: ORIGIN,
      updatedAt: "24 Oct 2026",
      status: "in_transit",
      mapUrl: map.url,
      mineral: {
        name: args.mineralName,
        reference: args.vaultId,
        category: args.category,
        quantity: args.weightLabel,
        declaredValue: "",
      },
      shipment: {
        reference: args.trackingNumber,
        carrier: args.carrier,
        trackingNumber: args.trackingNumber,
        origin: args.originCity,
        destination: args.destinationCity,
      },
    });
    expect(convexMapped.html).toContain("api.mapbox.com");
    expect(convexMapped.html).not.toContain(">Origin<");
  });

  it("returns nothing for a mineral that is still in the vault", () => {
    const inVault = DEMO_MINERALS.find((item) => !item.shipping);
    expect(inVault).toBeDefined();
    expect(shipmentEmailArgs(inVault!, "pending", "")).toBeNull();
  });
});
