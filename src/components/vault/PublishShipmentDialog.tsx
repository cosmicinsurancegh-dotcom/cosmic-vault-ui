import { ShipmentStateChip } from "@/components/dashboard/ShipmentJourney";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { formatDate } from "@/lib/format";
import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";

/** A stored timestamp as the local calendar day a date input speaks. */
function dateInputValue(at?: number) {
  if (!at) return "";
  const date = new Date(at);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The local midnight of a "YYYY-MM-DD" value, or `null` when unreadable. */
function dateInputEpoch(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const at = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  ).getTime();
  return Number.isFinite(at) ? at : null;
}

/**
 * Publishing a status change emails the owner and appends to the tracking
 * history, so it is confirmed with the facts the history is actually read for:
 * where the consignment is, what happened, and when it should arrive. Each is
 * optional; an empty location keeps the last known one, an untouched date keeps
 * the current estimate, and ticking "No estimate" removes one that no longer
 * applies.
 */
export function PublishShipmentDialog({
  open,
  onOpenChange,
  mineralName,
  shipmentReference,
  currentStatus,
  currentLocation,
  currentEta,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mineralName: string;
  shipmentReference: string;
  currentStatus: ShipmentStatus;
  currentLocation?: string;
  currentEta?: number;
  onSubmit: (input: {
    status: ShipmentStatus;
    location?: string;
    note?: string;
    estimatedArrivalAt?: number | null;
  }) => Promise<void>;
}) {
  /* The status it already has is not a change, so the dialog opens on the next
     one in the journey and staff move from there. */
  const options = SHIPMENT_STATUSES.filter(
    (status) => status !== currentStatus,
  );
  const [status, setStatus] = useState<ShipmentStatus>(options[0]);
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const initialEta = dateInputValue(currentEta);
  const [eta, setEta] = useState(initialEta);
  const [noEstimate, setNoEstimate] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (pending) return;

    // Only a date staff actually changed is sent, so an untouched estimate is
    // not rewritten (or recorded as a change in the audit log). Clearing sends
    // `null`, which removes the estimate instead of leaving the old date.
    let estimatedArrivalAt: number | null | undefined;
    if (noEstimate) {
      estimatedArrivalAt = currentEta ? null : undefined;
    } else if (eta && eta !== initialEta) {
      const parsed = dateInputEpoch(eta);
      if (parsed === null) {
        setError("Enter a valid estimated delivery date.");
        return;
      }
      estimatedArrivalAt = parsed;
    }

    setPending(true);
    setError(null);
    try {
      await onSubmit({
        status,
        location: location.trim() || undefined,
        note: note.trim() || undefined,
        estimatedArrivalAt,
      });
    } catch (thrown) {
      setError(
        thrown instanceof Error
          ? thrown.message
          : "Could not publish this update.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onOpenChange(false);
      }}
    >
      <DialogContent className="rounded-[4px] border-line bg-background sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Publish a status change</DialogTitle>
          <DialogDescription>
            {mineralName} · {shipmentReference}. The owner is emailed this
            update and it appears on their tracking desk immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-ice/25 px-3 py-2">
            <ShipmentStateChip status={currentStatus} />
            <ArrowRight className="size-3 text-muted-foreground" />
            <ShipmentStateChip status={status} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="publish-status">New status</Label>
            <select
              id="publish-status"
              aria-label="New status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as ShipmentStatus)
              }
              className="h-9 w-full cursor-pointer rounded-lg border border-line bg-card px-2 text-xs text-ink"
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {SHIPMENT_STATUS_LABELS[option]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="publish-location">Location (optional)</Label>
            <Input
              id="publish-location"
              aria-label="Location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder={
                currentLocation
                  ? `Leave empty to keep ${currentLocation}`
                  : "e.g. Basel, CH"
              }
              maxLength={120}
              className="h-9 rounded-lg bg-card text-xs"
            />
            <p className="text-[0.6rem] leading-4 text-muted-foreground">
              Becomes the consignment's last known position.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="publish-eta">Estimated delivery</Label>
              {currentEta !== undefined && (
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="publish-clear-eta"
                    aria-label="No estimate"
                    checked={noEstimate}
                    onCheckedChange={(checked) => {
                      setNoEstimate(checked === true);
                      // Unticking puts the stored date back, so the field never
                      // looks empty while the estimate is actually kept.
                      setEta(checked === true ? "" : initialEta);
                    }}
                    className="size-3.5"
                  />
                  <Label
                    htmlFor="publish-clear-eta"
                    className="cursor-pointer text-[0.62rem] font-normal text-muted-foreground"
                  >
                    No estimate
                  </Label>
                </div>
              )}
            </div>
            <Input
              id="publish-eta"
              type="date"
              aria-label="Estimated delivery"
              value={noEstimate ? "" : eta}
              disabled={noEstimate}
              onChange={(event) => setEta(event.target.value)}
              className="h-9 rounded-lg bg-card text-xs"
            />
            <p className="text-[0.6rem] leading-4 text-muted-foreground">
              {noEstimate
                ? "The estimate is removed on publish. Use the note to tell the owner why it is being re-planned."
                : currentEta
                  ? `Currently ${formatDate(currentEta)}. Move it if this update changes the estimate.`
                  : "No estimate is recorded yet. Pick the date the owner should plan for."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="publish-note">Note for the owner (optional)</Label>
            <Textarea
              id="publish-note"
              aria-label="Note for the owner"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What changed, or what happens next"
              rows={3}
              maxLength={2000}
              className="rounded-lg bg-card text-xs"
            />
            <p className="text-[0.6rem] leading-4 text-muted-foreground">
              Included in the email and kept on the shipment's history.
            </p>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-[0.62rem] leading-5 text-destructive"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="h-9 rounded-[4px] bg-transparent px-3 text-[0.65rem]"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              className="h-9 rounded-[4px] px-3 text-[0.65rem]"
              onClick={submit}
              disabled={pending}
            >
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              Publish update
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
