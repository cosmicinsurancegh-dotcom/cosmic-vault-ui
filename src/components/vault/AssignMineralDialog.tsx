import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Assign a mineral to another member.
 *
 * Ownership lives on the mineral, so the record moves together with the policy
 * and every shipment attached to it. `minerals.reassign` writes the audit entry,
 * emails the new owner and tells the previous one in-app, so this dialog only
 * has to pick the account and explain the move.
 */
export function AssignMineralDialog({
  open,
  onOpenChange,
  mineralId,
  mineralName,
  mineralReference,
  currentAssigneeId,
  shipmentCount = 0,
  title = "Assign this mineral",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mineralId: Id<"minerals"> | null;
  mineralName: string;
  mineralReference: string;
  currentAssigneeId?: Id<"users">;
  shipmentCount?: number;
  title?: string;
}) {
  const options = useQuery(
    api.minerals.assigneeOptions,
    open ? {} : "skip",
  );
  const reassign = useMutation(api.minerals.reassign);
  const [targetId, setTargetId] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  const targets = (options ?? []).filter(
    (option) => option.userId !== currentAssigneeId,
  );

  const close = () => {
    if (pending) return;
    setTargetId("");
    setNote("");
    onOpenChange(false);
  };

  const submit = async () => {
    if (!mineralId || !targetId) return;
    setPending(true);
    try {
      const result = await reassign({
        mineralId,
        assignment: {
          mode: "existing" as const,
          userId: targetId as Id<"users">,
        },
        note: note.trim() || undefined,
      });
      toast.success(
        result.notified
          ? "Assigned. The new owner has been emailed."
          : "Assigned. No owner email was sent.",
        {
          description:
            shipmentCount > 0
              ? `The insurance policy and ${shipmentCount} consignment${
                  shipmentCount === 1 ? "" : "s"
                } moved with the record.`
              : "The insurance policy moved with the record.",
        },
      );
      setTargetId("");
      setNote("");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not assign the mineral.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="rounded-[4px] border-line bg-background sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mineralName} ({mineralReference}). The mineral, its insurance
            policy
            {shipmentCount > 0
              ? ` and ${shipmentCount} consignment${shipmentCount === 1 ? "" : "s"}`
              : ""}{" "}
            move together to the account you choose.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="assign-owner">New owner</Label>
            <select
              id="assign-owner"
              aria-label="New owner"
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
            >
              <option value="">Choose a customer or broker…</option>
              {targets.map((option) => (
                <option key={option.userId} value={option.userId}>
                  {option.name} · {option.email}
                  {option.role === "broker" ? " (broker)" : ""}
                </option>
              ))}
            </select>
            {options !== undefined && targets.length === 0 && (
              <p className="text-[0.62rem] text-muted-foreground">
                No other accounts are available to assign this record to.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assign-note">Reason (optional)</Label>
            <Input
              id="assign-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Recorded in the audit log"
              aria-label="Reason for the assignment"
              className="h-9 rounded-lg bg-card text-xs"
            />
          </div>

          <p className="rounded-lg border border-line bg-ice/20 px-3 py-2 text-[0.62rem] leading-5 text-muted-foreground">
            The new owner is emailed immediately and the record appears in their
            dashboard. The previous owner is told in-app that it moved.
          </p>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="h-9 rounded-[4px] bg-transparent px-3 text-[0.65rem]"
              onClick={close}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              className="h-9 rounded-[4px] px-3 text-[0.65rem]"
              disabled={!targetId || pending}
              onClick={submit}
            >
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              Assign to this account
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
