import { api } from "@/convex/_generated/api";
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
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { Loader2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const EMPTY = { name: "", email: "", country: "GB", currency: "GBP", notes: "" };

/**
 * Creates a customer account with no password to hand over: the invited record
 * carries the verified marker, so the first sign-in with the emailed six-digit
 * code links to it. The welcome email is queued by the server.
 */
export function NewCustomerDialog({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited?: (email: string) => void;
}) {
  const reference = useQuery(api.setup.referenceData);
  const invite = useMutation(api.customers.invite);
  const [form, setForm] = useState(EMPTY);
  const [pending, setPending] = useState(false);

  const countries = reference?.countries ?? [];
  const currencies = (reference?.currencies ?? [])
    .filter((currency) => currency.active)
    .map((currency) => currency.code);

  const ready =
    form.name.trim().length > 1 &&
    form.email.trim().length > 3 &&
    form.country.length > 0 &&
    form.currency.length > 0;

  const submit = async () => {
    setPending(true);
    try {
      const result = await invite({
        name: form.name,
        email: form.email,
        country: form.country,
        currency: form.currency,
        notes: form.notes || undefined,
      });
      toast.success("Customer invited", {
        description: `${form.email.trim().toLowerCase()} · ${result.reference}. A welcome email is queued.`,
      });
      onInvited?.(form.email.trim().toLowerCase());
      setForm(EMPTY);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create the customer.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setForm(EMPTY);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Invite a customer</DialogTitle>
          <DialogDescription>
            Creates the account, customer profile and reference. The customer
            signs in with this email address and a one-time code - there is no
            password to send.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="new-customer-name">Full name</Label>
            <Input
              id="new-customer-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Morgan Ellis"
              className="h-9 rounded-lg bg-card"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="new-customer-email">Email address</Label>
            <Input
              id="new-customer-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="morgan@example.com"
              className="h-9 rounded-lg bg-card"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-customer-country">Country</Label>
            <select
              id="new-customer-country"
              value={form.country}
              onChange={(event) => setForm({ ...form, country: event.target.value })}
              className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
            >
              {countries.length === 0 && <option value="GB">United Kingdom</option>}
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-customer-currency">Currency</Label>
            <select
              id="new-customer-currency"
              value={form.currency}
              onChange={(event) => setForm({ ...form, currency: event.target.value })}
              className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
            >
              {currencies.length === 0 && <option value="GBP">GBP</option>}
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="new-customer-notes">Internal note (optional)</Label>
            <Textarea
              id="new-customer-notes"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="How this account was introduced"
              className="rounded-lg bg-card text-xs"
            />
          </div>
        </div>

        <p className="text-[0.62rem] leading-5 text-muted-foreground">
          The invitation is audited. If the email already has an account, open it
          in the directory instead - this form never takes over an existing
          login.
        </p>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            className="rounded-[4px]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="rounded-[4px]"
            disabled={pending || !ready}
            onClick={submit}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            Invite customer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
