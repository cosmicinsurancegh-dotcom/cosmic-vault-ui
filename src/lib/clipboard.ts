import { toast } from "sonner";

/** The tracking number is the one value members and staff copy most. */
export function copyTracking(value?: string) {
  if (!value) {
    toast.error("This consignment has no tracking number yet.");
    return;
  }
  navigator.clipboard
    ?.writeText(value)
    .then(() => toast.success("Tracking number copied."))
    .catch(() => toast.error("Could not reach the clipboard."));
}
