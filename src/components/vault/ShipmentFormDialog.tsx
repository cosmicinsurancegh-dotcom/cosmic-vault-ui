import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  type ShipmentStatus,
} from "@/convex/lib/shipments";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export type ShipmentFormValues = {
  carrier: string;
  trackingNumber?: string;
  origin: string;
  destination: string;
  departureAt?: string;
  estimatedArrivalAt?: string;
  status: ShipmentStatus;
  currentLocation?: string;
  notes?: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The details the logistics desk actually commits to when a consignment starts.
 * Shared by the two ways a shipment can now be booked - answering a member's
 * request, or recording one staff took by phone - so both ask for the same
 * facts and both keep the dialog open when the server refuses the write.
 */
export function ShipmentFormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  initial?: Partial<ShipmentFormValues>;
  onSubmit: (values: ShipmentFormValues) => Promise<void>;
}) {
  const [carrier, setCarrier] = useState(initial?.carrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(
    initial?.trackingNumber ?? "",
  );
  const [origin, setOrigin] = useState(initial?.origin ?? "");
  const [destination, setDestination] = useState(initial?.destination ?? "");
  const [departureAt, setDepartureAt] = useState(
    initial?.departureAt ?? today(),
  );
  const [estimatedArrivalAt, setEstimatedArrivalAt] = useState(
    initial?.estimatedArrivalAt ?? "",
  );
  const [status, setStatus] = useState<ShipmentStatus>(
    initial?.status ?? "preparing",
  );
  const [currentLocation, setCurrentLocation] = useState(
    initial?.currentLocation ?? "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready =
    carrier.trim().length > 0 &&
    origin.trim().length > 0 &&
    destination.trim().length > 0;

  const submit = async () => {
    if (pending || !ready) return;
    setPending(true);
    setError(null);
    try {
      await onSubmit({
        carrier: carrier.trim(),
        trackingNumber: trackingNumber.trim() || undefined,
        origin: origin.trim(),
        destination: destination.trim(),
        departureAt: departureAt || undefined,
        estimatedArrivalAt: estimatedArrivalAt || undefined,
        status,
        currentLocation: currentLocation.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } catch (thrown) {
      setError(
        thrown instanceof Error
          ? thrown.message
          : "Could not book this shipment.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="shipment-carrier">Carrier</Label>
            <Input
              id="shipment-carrier"
              value={carrier}
              onChange={(event) => setCarrier(event.target.value)}
              placeholder="Brink's Global Services"
              maxLength={120}
              disabled={pending}
              className="h-9 rounded-lg bg-card text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shipment-tracking">Tracking number (optional)</Label>
            <Input
              id="shipment-tracking"
              value={trackingNumber}
              onChange={(event) => setTrackingNumber(event.target.value)}
              maxLength={80}
              disabled={pending}
              className="h-9 rounded-lg bg-card text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shipment-origin">Origin</Label>
            <Input
              id="shipment-origin"
              value={origin}
              onChange={(event) => setOrigin(event.target.value)}
              placeholder="Zurich, CH"
              maxLength={120}
              disabled={pending}
              className="h-9 rounded-lg bg-card text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shipment-destination">Destination</Label>
            <Input
              id="shipment-destination"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="London, GB"
              maxLength={120}
              disabled={pending}
              className="h-9 rounded-lg bg-card text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shipment-departure">Departure</Label>
            <Input
              id="shipment-departure"
              type="date"
              value={departureAt}
              onChange={(event) => setDepartureAt(event.target.value)}
              disabled={pending}
              className="h-9 rounded-lg bg-card text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shipment-eta">Estimated arrival</Label>
            <Input
              id="shipment-eta"
              type="date"
              value={estimatedArrivalAt}
              onChange={(event) => setEstimatedArrivalAt(event.target.value)}
              disabled={pending}
              className="h-9 rounded-lg bg-card text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shipment-status">Starting status</Label>
            <select
              id="shipment-status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as ShipmentStatus)
              }
              disabled={pending}
              className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
            >
              {SHIPMENT_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {SHIPMENT_STATUS_LABELS[option]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shipment-location">Current location (optional)</Label>
            <Input
              id="shipment-location"
              value={currentLocation}
              onChange={(event) => setCurrentLocation(event.target.value)}
              maxLength={120}
              disabled={pending}
              className="h-9 rounded-lg bg-card text-xs"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="shipment-notes">Note for the owner (optional)</Label>
            <Textarea
              id="shipment-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              maxLength={2000}
              disabled={pending}
              className="rounded-lg bg-card text-xs"
            />
            <p className="text-[0.6rem] leading-4 text-muted-foreground">
              Included in the email and kept on the shipment's history.
            </p>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-[0.62rem] leading-5 text-destructive"
          >
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            className="h-9 rounded-[4px] bg-transparent px-3 text-[0.65rem]"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="h-9 rounded-[4px] px-3 text-[0.65rem]"
            disabled={pending || !ready}
            onClick={submit}
          >
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
