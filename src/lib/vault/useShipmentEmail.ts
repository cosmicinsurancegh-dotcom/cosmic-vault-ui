import { api } from "@/convex/_generated/api";
import { resolveShipmentMapUrl } from "@/lib/shipmentMapUrl";
import { useAction } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { shipmentEmailArgs, type ShipmentEmailDelivery } from "./shipmentEmail";
import { updateShipmentStatus } from "./store";
import type { Mineral, ShippingStatus, VaultActor } from "./types";

/**
 * Publishes a shipment status change and, as part of the same operation,
 * emails the member. The store update is the source of truth: an email problem
 * never rolls it back, it is reported as an outcome and recorded on the
 * delivery row.
 */

export type ShipmentEmailOutcome =
  | { kind: "sent"; to: string }
  | { kind: "demo" }
  | { kind: "failed"; reason: string }
  | { kind: "skipped"; reason: string }
  | { kind: "error"; reason: string };

export function describeShipmentEmailOutcome(outcome: ShipmentEmailOutcome) {
  switch (outcome.kind) {
    case "sent":
      return `Email sent to ${outcome.to}.`;
    case "demo":
      return "Demo operations — preview the member email from the shipping tab. Sign in as staff to deliver it.";
    case "failed":
      return `Email not delivered — ${outcome.reason}`;
    case "skipped":
      return `Email skipped — ${outcome.reason}`;
    case "error":
      return `Email could not be sent — ${outcome.reason}`;
  }
}

/**
 * The route image for a consignment preview. It arrives a beat after the
 * message does - geocoding is two network lookups - and until then the preview
 * shows the rail, exactly as an unconfigured send would.
 */
export function useShipmentMapUrl(origin: string, destination: string) {
  const key = `${origin}\u0000${destination}`;
  const [resolved, setResolved] = useState<{
    key: string;
    url?: string;
  } | null>(null);

  useEffect(() => {
    if (!origin.trim() || !destination.trim()) return;
    const controller = new AbortController();
    const current = key;
    resolveShipmentMapUrl(origin, destination, controller.signal).then(
      (url) => {
        if (!controller.signal.aborted) setResolved({ key: current, url });
      },
    );
    return () => controller.abort();
  }, [origin, destination, key]);

  return resolved?.key === key ? resolved.url : undefined;
}

export function useShipmentEmailSender() {
  const sendUpdate = useAction(api.shipmentEmailDelivery.sendUpdate);

  return useCallback(
    async (
      mineral: Mineral,
      status: ShippingStatus,
      note: string,
    ): Promise<ShipmentEmailDelivery> => {
      const args = shipmentEmailArgs(mineral, status, note);
      if (!args) throw new Error("No shipment exists for this consignment.");
      /* The map is resolved here because the server side of the send renders
         inside a mutation and cannot geocode. A missing map never blocks the
         email: the template draws its rail instead. */
      const mapUrl = await resolveShipmentMapUrl(
        args.originCity,
        args.destinationCity,
        new AbortController().signal,
      );
      const result = (await sendUpdate({
        ...args,
        mapUrl,
      })) as ShipmentEmailDelivery;
      return result;
    },
    [sendUpdate],
  );
}

export function useShipmentStatusPublisher(actor: VaultActor) {
  const sendEmail = useShipmentEmailSender();

  return useCallback(
    async (
      mineral: Mineral,
      status: ShippingStatus,
      note: string,
    ): Promise<ShipmentEmailOutcome> => {
      updateShipmentStatus(actor, mineral.id, status, note);

      // Delivery needs a real staff identity: the action is permission-gated,
      // and the demo operations toggle is an anonymous preview.
      if (actor.isDemo) return { kind: "demo" };

      try {
        const result = await sendEmail(mineral, status, note);
        if (result.deliveryStatus === "sent") {
          return { kind: "sent", to: mineral.ownerEmail };
        }
        if (result.deliveryStatus === "skipped") {
          return {
            kind: "skipped",
            reason: result.error ?? "the email provider is not configured.",
          };
        }
        return {
          kind: "failed",
          reason: result.error ?? "the provider rejected the message.",
        };
      } catch (error) {
        return {
          kind: "error",
          reason:
            error instanceof Error
              ? error.message
              : "the email could not be sent.",
        };
      }
    },
    [actor, sendEmail],
  );
}
