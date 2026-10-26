import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import {
  previewShipmentEmail,
  shipmentEmailArgs,
} from "@/lib/vault/shipmentEmail";
import { useShipmentMapUrl } from "@/lib/vault/useShipmentEmail";
import type { Mineral, ShippingStatus } from "@/lib/vault/types";
import { SHIPPING_STATUS_META } from "@/lib/vault/types";
import { useConvex } from "convex/react";
import { useEffect, useMemo, useState } from "react";

/**
 * Shows the exact HTML the member receives for a consignment's current status.
 * The preview is rendered from the same module the server sends with, so there
 * is no second template to keep in step. The latest delivery attempt is shown
 * to staff; the query returns `null` for anyone else.
 */

function deliveryLine(attempt: {
  deliveryStatus: string;
  error?: string;
  createdAt: number;
  deliveredAt?: number;
}) {
  if (attempt.deliveryStatus === "sent") {
    return `delivered ${formatDateTime(attempt.deliveredAt ?? attempt.createdAt)}`;
  }
  if (attempt.deliveryStatus === "failed") {
    return `failed ${formatDateTime(attempt.createdAt)}${attempt.error ? ` — ${attempt.error}` : ""}`;
  }
  if (attempt.deliveryStatus === "skipped") {
    return `skipped${attempt.error ? ` — ${attempt.error}` : ""}`;
  }
  return `queued ${formatDateTime(attempt.createdAt)}`;
}

export function ShipmentEmailPreview({
  mineral,
  status,
  note,
  open,
  onOpenChange,
}: {
  mineral: Mineral;
  status: ShippingStatus;
  note: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const args = useMemo(
    () => shipmentEmailArgs(mineral, status, note),
    [mineral, status, note],
  );
  const mapUrl = useShipmentMapUrl(
    args?.originCity ?? "",
    args?.destinationCity ?? "",
  );
  const email = useMemo(
    () => (args ? previewShipmentEmail(args, { mapUrl }) : null),
    [args, mapUrl],
  );
  // Read the latest delivery attempt imperatively: a deployment that has not
  // yet received the shipment-email functions must still preview the message
  // instead of throwing through the dialog.
  const convex = useConvex();
  const [attempt, setAttempt] = useState<{
    trackingNumber: string;
    row: {
      deliveryStatus: string;
      error?: string;
      createdAt: number;
      deliveredAt?: number;
    } | null;
  } | null>(null);
  const trackingNumber = args?.trackingNumber;

  useEffect(() => {
    if (!open || !trackingNumber) return;
    let cancelled = false;
    convex
      .query(api.shipmentEmails.lastForTracking, { trackingNumber })
      .then((row) => {
        if (!cancelled) {
          setAttempt({ trackingNumber, row: row ?? null });
        }
      })
      .catch(() => {
        if (!cancelled) setAttempt({ trackingNumber, row: null });
      });
    return () => {
      cancelled = true;
    };
  }, [convex, open, trackingNumber]);

  const lastAttempt =
    attempt && attempt.trackingNumber === trackingNumber ? attempt.row : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94dvh] flex-col gap-0 rounded-[4px] border-line bg-background p-0 sm:max-w-[760px]">
        <div className="border-b border-line px-4 py-4 pr-12 sm:px-5 sm:pr-14">
          <DialogHeader className="text-left">
            <p className="text-[0.52rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Member email · preview
            </p>
            <DialogTitle className="mt-1 pr-6 text-[0.95rem] font-semibold tracking-[-0.02em] text-ink">
              {email?.subject ?? "Shipment update"}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-[0.62rem] text-muted-foreground">
              {mineral.ownerName} · {mineral.ownerEmail} ·{" "}
              {SHIPPING_STATUS_META[status].label}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-ice/40 p-3 sm:p-4">
          {email ? (
            <iframe
              title={`Shipment update email for ${mineral.name}`}
              srcDoc={email.html}
              sandbox=""
              className="h-[58vh] min-h-[420px] w-full rounded-[4px] border border-line bg-white"
            />
          ) : (
            <p className="px-1 py-6 text-center text-xs text-muted-foreground">
              This mineral has no shipment, so there is no progress email to
              preview.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="max-w-[30rem] text-[0.55rem] leading-4 text-muted-foreground">
            This message is sent automatically when a tracking status is
            published.
            {lastAttempt
              ? ` Last attempt to ${mineral.ownerEmail}: ${deliveryLine(
                  lastAttempt,
                )}.`
              : ""}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 rounded-[4px] bg-transparent text-[0.62rem]"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
