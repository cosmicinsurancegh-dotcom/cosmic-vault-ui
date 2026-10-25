import {
  Panel,
  PanelHeader,
  StatusPill,
} from "@/components/dashboard/PlatformUI";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ShipmentFormDialog } from "@/components/vault/ShipmentFormDialog";
import { api } from "@/convex/_generated/api";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  CalendarClock,
  Check,
  MapPin,
  Truck,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** A stored timestamp as the local calendar day a date input speaks. */
function dateInputValue(at?: number) {
  if (!at) return "";
  const date = new Date(at);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

type QueueRow =
  FunctionReturnType<typeof api.minerals.shipmentRequests>[number];

/**
 * The dispatch desk's request queue.
 *
 * A request is a member's intent, not a consignment, so the row only carries
 * what they asked for. Staff answer it by booking the shipment from the same
 * form the mineral register uses, or by declining with a reason the member is
 * emailed - either way the queue never holds a request that has been answered.
 */
export function ShipmentRequestPanel() {
  const rows = useQuery(api.minerals.shipmentRequests, { status: "pending" });
  const fulfil = useMutation(api.minerals.fulfilShipmentRequest);
  const decline = useMutation(api.minerals.declineShipmentRequest);
  const [booking, setBooking] = useState<QueueRow | null>(null);
  const [declining, setDeclining] = useState<QueueRow | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  if (rows === undefined) {
    // The queue is secondary to the register on this page, so it never blocks
    // the rest of the board while it loads.
    return (
      <div className="rounded-[4px] border border-line bg-card px-5 py-4 text-[0.62rem] text-muted-foreground">
        Loading shipment requests…
      </div>
    );
  }

  if (rows.length === 0) return null;

  const closeDecline = (open: boolean) => {
    if (!open && !pending) {
      setDeclining(null);
      setReason("");
    }
  };

  const submitDecline = async () => {
    if (!declining || pending) return;
    setPending(true);
    try {
      await decline({ requestId: declining.request._id, note: reason.trim() });
      toast.success("Request declined.", {
        description: `${declining.requester?.name ?? "The member"} has been told why.`,
      });
      setDeclining(null);
      setReason("");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not decline the request.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Panel>
      <PanelHeader
        title={
          <span className="flex items-center gap-2">
            <Truck className="size-4 text-primary" />
            Shipment requests
            <span className="rounded-[4px] border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[0.55rem] font-semibold text-amber-700 dark:text-amber-400">
              {rows.length}
            </span>
          </span>
        }
        description="Members waiting on a consignment. Booking one answers the request and emails the owner; declining asks for a reason they will see."
      />

      <div className="divide-y divide-line">
        {rows.map(({ request, mineral, requester }) => {
          if (!mineral) return null;
          return (
            <div
              key={request._id}
              className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-start lg:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold text-ink">
                    {mineral.name}
                  </p>
                  <span className="text-[0.62rem] text-muted-foreground">
                    {mineral.reference} ·{" "}
                    {mineral.quantity.toLocaleString("en-GB")} {mineral.unit} ·{" "}
                    {formatMoney(mineral.declaredValue, mineral.currency)}
                  </span>
                  <StatusPill status="pending" />
                </div>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.65rem] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 text-ink">
                    <MapPin className="size-3 shrink-0" />
                    {request.destination}
                  </span>
                  {request.preferredDate && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock className="size-3 shrink-0" />
                      Preferred {formatDate(request.preferredDate)}
                    </span>
                  )}
                  <span>
                    Requested by {requester?.name ?? "a member"}
                    {requester?.email ? ` · ${requester.email}` : ""} ·{" "}
                    {formatDateTime(request.createdAt)}
                  </span>
                </p>
                {request.notes && (
                  <p className="max-w-2xl text-[0.65rem] leading-5 text-muted-foreground">
                    {request.notes}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  size="sm"
                  className="h-8 rounded-[4px] px-3 text-[0.62rem]"
                  onClick={() => setBooking({ request, mineral, requester })}
                >
                  <Check className="size-3" /> Set up shipment
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-[4px] bg-transparent px-3 text-[0.62rem]"
                  onClick={() => setDeclining({ request, mineral, requester })}
                >
                  <X className="size-3" /> Decline
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {booking?.mineral && (
        <ShipmentFormDialog
          key={booking.request._id}
          open
          title="Book the requested shipment"
          description={`${booking.mineral.name} · ${booking.mineral.reference}. ${booking.requester?.name ?? "The member"} asked for delivery to ${booking.request.destination}. Booking this answers their request and emails them the details.`}
          submitLabel="Book shipment"
          initial={{
            destination: booking.request.destination,
            estimatedArrivalAt: dateInputValue(booking.request.preferredDate),
            origin: "",
            status: "preparing",
            notes: booking.request.notes,
          }}
          onSubmit={async (values) => {
            await fulfil({
              requestId: booking.request._id,
              shipment: values,
            });
            toast.success("Shipment booked.", {
              description: `Email queued to ${booking.requester?.email || "the owner"}.`,
            });
            setBooking(null);
          }}
          onOpenChange={(open) => {
            if (!open) setBooking(null);
          }}
        />
      )}

      <AlertDialog
        open={Boolean(declining?.mineral)}
        onOpenChange={closeDecline}
      >
        <AlertDialogContent className="rounded-[4px] border-line bg-background sm:max-w-[460px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this shipment request?</AlertDialogTitle>
            <AlertDialogDescription>
              {declining?.mineral?.name ?? "This mineral"} will stay in the
              member's vault. They are emailed the reason you give here, so say
              what needs to change.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="decline-reason">Reason</Label>
            <Textarea
              id="decline-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={500}
              disabled={pending}
              placeholder="Cover has lapsed, so we cannot move this consignment yet."
              className="rounded-lg bg-card text-xs"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[4px]" disabled={pending}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              className="h-9 rounded-[4px] px-3 text-[0.65rem]"
              disabled={pending || reason.trim().length === 0}
              onClick={submitDecline}
            >
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              Decline request
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}
