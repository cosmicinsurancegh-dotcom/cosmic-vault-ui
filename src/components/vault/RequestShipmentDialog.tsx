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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * A request is not a booking: the member says where the mineral should go and
 * when, and the logistics desk chooses the carrier, route and dates. Keeping the
 * form to those three fields is what makes that split obvious.
 */
export function RequestShipmentDialog({
  open,
  onOpenChange,
  mineral,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mineral: { _id: Id<"minerals">; name: string; reference: string };
}) {
  const request = useMutation(api.minerals.requestShipment);
  const [destination, setDestination] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = destination.trim().length > 1;

  const close = (next: boolean) => {
    if (!next) {
      setDestination("");
      setPreferredDate("");
      setNotes("");
      setError(null);
    }
    onOpenChange(next);
  };

  const submit = async () => {
    if (pending || !ready) return;
    setPending(true);
    setError(null);
    try {
      await request({
        mineralId: mineral._id,
        destination: destination.trim(),
        preferredDate: preferredDate || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Request sent.", {
        description:
          "Our logistics desk will set up the shipment and email you when it is booked.",
      });
      close(false);
    } catch (thrown) {
      setError(
        thrown instanceof Error
          ? thrown.message
          : "Could not send the shipment request.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) close(next);
      }}
    >
      <DialogContent className="rounded-[4px] border-line bg-background sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Request a shipment</DialogTitle>
          <DialogDescription>
            {mineral.name} · {mineral.reference}. Tell us where it should go and
            when; the logistics desk confirms the carrier and dates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="request-destination">Destination</Label>
            <Input
              id="request-destination"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="London, GB"
              maxLength={120}
              disabled={pending}
              className="h-9 rounded-lg bg-card text-xs"
            />
            <p className="text-[0.6rem] leading-4 text-muted-foreground">
              The vault or address the consignment should be delivered to.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="request-date">Preferred shipping date</Label>
            <Input
              id="request-date"
              type="date"
              value={preferredDate}
              min={today()}
              onChange={(event) => setPreferredDate(event.target.value)}
              disabled={pending}
              className="h-9 rounded-lg bg-card text-xs"
            />
            <p className="text-[0.6rem] leading-4 text-muted-foreground">
              Optional. We will do our best to plan around it.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="request-notes">Notes (optional)</Label>
            <Textarea
              id="request-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Anything the logistics desk should know"
              disabled={pending}
              className="rounded-lg bg-card text-xs"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-[0.62rem] leading-5 text-destructive"
            >
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="h-9 rounded-[4px] bg-transparent px-3 text-[0.65rem]"
            disabled={pending}
            onClick={() => close(false)}
          >
            Cancel
          </Button>
          <Button
            className="h-9 rounded-[4px] px-3 text-[0.65rem]"
            disabled={pending || !ready}
            onClick={submit}
          >
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
