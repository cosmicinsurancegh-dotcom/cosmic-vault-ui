import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
import { formatDate, formatMoney, toMinor } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import { FilePlus2, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type CustomerOption = {
  userId: Id<"users">;
  name: string;
  email: string;
  reference: string;
  country: string;
  currency: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Mirrors the server's term arithmetic closely enough for a preview. */
function termEnd(startDate: string, months: number) {
  const start = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return undefined;
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + months);
  return end.getTime();
}

/**
 * Issues a policy straight from the register. The server records the approved
 * application the policy must point at, writes the schedule, certificate and
 * wording, and raises the premium invoice as a pending transaction.
 */
export function NewPolicyDialog({
  open,
  onOpenChange,
  onIssued,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIssued?: (policyId: Id<"policies">, policyNumber: string) => void;
}) {
  const [search, setSearch] = useState("");
  /* Both lists are staff-only queries. The register mounts this dialog for the
     whole visit, so asking for them while it is closed would run two gated
     queries (and their scans) on every page load - and a rejection there takes
     the register down with it, because a failed Convex query throws during
     render. They are asked for once the dialog is actually opened. */
  const customers = useQuery(
    api.policies.customerOptions,
    open ? { search: search.trim() || undefined } : "skip",
  );
  const products = useQuery(api.policies.productOptions, open ? {} : "skip");
  const create = useMutation(api.policies.create);

  const [selected, setSelected] = useState<CustomerOption | null>(null);
  const [productId, setProductId] = useState("");
  const [country, setCountry] = useState("");
  const [premium, setPremium] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [pending, setPending] = useState(false);

  const product = useMemo(
    () => (products ?? []).find((item) => item._id === productId),
    [products, productId],
  );
  const endDate = product ? termEnd(startDate, product.termMonths) : undefined;
  const renewalDate =
    product && endDate
      ? endDate - product.renewalNoticeDays * 24 * 60 * 60 * 1000
      : undefined;

  const reset = () => {
    setSelected(null);
    setSearch("");
    setProductId("");
    setCountry("");
    setPremium("");
    setStartDate(today());
  };

  const chooseProduct = (id: string) => {
    setProductId(id);
    const next = (products ?? []).find((item) => item._id === id);
    if (!next) return;
    const preferred =
      selected && next.countries.includes(selected.country)
        ? selected.country
        : (next.countries[0] ?? "");
    setCountry(preferred);
    setPremium((next.basePremium / 100).toFixed(2));
  };

  const chooseCustomer = (id: string) => {
    const next = (customers ?? []).find((item) => item.userId === id) ?? null;
    setSelected(next);
    if (next && product && product.countries.includes(next.country)) {
      setCountry(next.country);
    }
  };

  const ready =
    Boolean(selected) &&
    Boolean(product) &&
    country.length > 0 &&
    premium.trim().length > 0 &&
    startDate.length > 0;

  const submit = async () => {
    if (!selected || !product) return;
    setPending(true);
    try {
      const result = await create({
        customerUserId: selected.userId,
        productId: product._id,
        country,
        premium: toMinor(premium, "Premium"),
        startDate,
      });
      toast.success(`Policy ${result.policyNumber} issued`, {
        description: `${selected.name} · ${product.name}. The premium invoice is pending.`,
      });
      onIssued?.(result.policyId, result.policyNumber);
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not issue the policy.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Issue a policy</DialogTitle>
          <DialogDescription>
            Issues cover for an existing customer on a published product. The
            schedule, certificate and wording are generated, and the premium is
            raised as a pending invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <section className="space-y-3 rounded-[4px] border border-line p-4">
            <h3 className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              1 · Customer
            </h3>
            {selected ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-ink">{selected.name}</p>
                  <p className="mt-0.5 text-[0.62rem] text-muted-foreground">
                    {selected.reference || "No reference"} · {selected.email} ·{" "}
                    {selected.country}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-[4px] bg-transparent"
                  onClick={() => setSelected(null)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    aria-label="Search customers"
                    placeholder="Search name, email, or reference"
                    className="h-9 rounded-lg bg-card pl-9 text-xs"
                  />
                </div>
                <select
                  aria-label="Customer"
                  value=""
                  onChange={(event) => chooseCustomer(event.target.value)}
                  className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
                >
                  <option value="">
                    {customers === undefined
                      ? "Loading customers…"
                      : (customers?.length ?? 0) === 0
                        ? "No customers match"
                        : "Choose a customer…"}
                  </option>
                  {(customers ?? []).map((customer) => (
                    <option key={customer.userId} value={customer.userId}>
                      {customer.name} · {customer.email}
                      {customer.reference ? ` · ${customer.reference}` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[0.6rem] leading-4 text-muted-foreground">
                  Need a new customer? Invite them from the customer directory
                  first.
                </p>
              </>
            )}
          </section>

          <section className="space-y-3 rounded-[4px] border border-line p-4">
            <h3 className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              2 · Cover
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="policy-product">Published product</Label>
                <select
                  id="policy-product"
                  value={productId}
                  onChange={(event) => chooseProduct(event.target.value)}
                  className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
                >
                  <option value="">
                    {products === undefined
                      ? "Loading products…"
                      : (products?.length ?? 0) === 0
                        ? "No published products"
                        : "Choose a product…"}
                  </option>
                  {(products ?? []).map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name} · v{item.version} · {item.currency}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="policy-country">Insured country</Label>
                <select
                  id="policy-country"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  disabled={!product}
                  className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink disabled:opacity-60"
                >
                  {(product?.countries ?? []).length === 0 && (
                    <option value="">Choose a product first</option>
                  )}
                  {(product?.countries ?? []).map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="policy-start">Start date</Label>
                <Input
                  id="policy-start"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="h-9 rounded-lg bg-card text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="policy-premium">
                  Premium ({product?.currency ?? "—"})
                </Label>
                <Input
                  id="policy-premium"
                  inputMode="decimal"
                  value={premium}
                  onChange={(event) => setPremium(event.target.value)}
                  placeholder="2500.00"
                  className="h-9 rounded-lg bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="policy-term">Term</Label>
                <Input
                  id="policy-term"
                  readOnly
                  value={
                    product
                      ? `${product.termMonths} months`
                      : "—"
                  }
                  className="h-9 rounded-lg bg-card text-xs text-muted-foreground"
                />
              </div>
            </div>

            {product && (
              <div className="grid gap-x-6 gap-y-2 rounded-[4px] bg-ice/50 px-3 py-3 sm:grid-cols-2">
                <p className="text-[0.6rem] text-muted-foreground">
                  Policy ends{" "}
                  <span className="font-medium text-ink">
                    {formatDate(endDate)}
                  </span>
                </p>
                <p className="text-[0.6rem] text-muted-foreground">
                  Renewal reminder{" "}
                  <span className="font-medium text-ink">
                    {formatDate(renewalDate)}
                  </span>
                </p>
                <p className="text-[0.6rem] text-muted-foreground">
                  Coverage limit{" "}
                  <span className="font-medium text-ink">
                    {formatMoney(product.coverageLimit, product.currency)}
                  </span>
                </p>
                <p className="text-[0.6rem] text-muted-foreground">
                  Excess{" "}
                  <span className="font-medium text-ink">
                    {formatMoney(product.excess, product.currency)}
                  </span>
                </p>
              </div>
            )}
          </section>
        </div>

        <p className="text-[0.62rem] leading-5 text-muted-foreground">
          The policy number and application reference are generated on issue.
          The approval, documents and invoice are recorded in the audit trail.
        </p>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            className="rounded-[4px]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button className="rounded-[4px]" disabled={pending || !ready} onClick={submit}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FilePlus2 className="size-4" />
            )}
            Issue policy
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
