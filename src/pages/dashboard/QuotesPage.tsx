import {
  EmptyState,
  LoadingState,
  PageHeader,
  Panel,
  StatusPill,
  Callout,
} from "@/components/dashboard/PlatformUI";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { formatDate, formatMoney, formatDateTime } from "@/lib/format";
import { normalizeRole } from "@/lib/permissions";
import { useMutation, useQuery } from "convex/react";
import { ArrowUpRight, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

type Quotation = Doc<"quotations">;

export default function QuotesPage() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const quotations = useQuery(api.quotations.mine);
  const brokerCustomers = useQuery(
    api.brokers.myCustomers,
    role === "broker" ? {} : "skip",
  );
  const convert = useMutation(api.quotations.convertToApplication);
  const [selected, setSelected] = useState<Quotation | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const navigate = useNavigate();

  if (quotations === undefined) return <LoadingState label="Loading quotations" />;

  const names = new Map(
    (brokerCustomers ?? []).map((row) => [
      row.assignment.customerUserId,
      row.profile?.fullName ?? "Customer",
    ]),
  );

  const continueToApplication = async (quotation: Quotation) => {
    setPendingId(quotation._id);
    try {
      const result = await convert({ quotationId: quotation._id });
      toast.success("Draft application created.", { description: result.reference });
      navigate("/dashboard/applications");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the application.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Quotations"
        title="Indicative terms, kept on file."
        description="Every quotation records the product version, answers, and calculation used. Quotations expire after 30 days."
        actions={
          <Button asChild className="h-10 rounded-full px-5">
            <Link to="/dashboard/catalogue">New quotation <ArrowUpRight className="size-4" /></Link>
          </Button>
        }
      />

      {quotations.length === 0 ? (
        <Panel>
          <EmptyState
            icon={FileText}
            title="No quotations yet"
            description="Choose a product, answer its questions, and the configured rating rules will calculate an indicative premium."
            action={
              <Button asChild size="sm" className="rounded-full">
                <Link to="/dashboard/catalogue">Browse products</Link>
              </Button>
            }
          />
        </Panel>
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="border-b border-line px-5 py-3">Reference</th>
                  <th className="border-b border-line px-5 py-3">Product</th>
                  {role === "broker" && <th className="border-b border-line px-5 py-3">Customer</th>}
                  <th className="border-b border-line px-5 py-3">Premium</th>
                  <th className="border-b border-line px-5 py-3">Created</th>
                  <th className="border-b border-line px-5 py-3">Expires</th>
                  <th className="border-b border-line px-5 py-3">Status</th>
                  <th className="border-b border-line px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {quotations.map((quotation) => (
                  <tr key={quotation._id} className="align-middle text-xs text-ink transition-colors hover:bg-primary/[0.02]">
                    <td className="border-b border-line/70 px-5 py-3.5 font-medium">
                      <button type="button" className="hover:text-primary" onClick={() => setSelected(quotation)}>
                        {quotation.reference}
                      </button>
                    </td>
                    <td className="border-b border-line/70 px-5 py-3.5">
                      <p>{quotation.productName}</p>
                      <p className="mt-0.5 text-[0.62rem] text-muted-foreground">
                        v{quotation.productVersion} · {quotation.country}
                      </p>
                    </td>
                    {role === "broker" && (
                      <td className="border-b border-line/70 px-5 py-3.5">
                        {names.get(quotation.customerUserId) ?? "Customer"}
                      </td>
                    )}
                    <td className="border-b border-line/70 px-5 py-3.5 font-semibold">
                      {formatMoney(quotation.premium, quotation.currency)}
                      <span className="block text-[0.6rem] font-normal text-muted-foreground">per year</span>
                    </td>
                    <td className="border-b border-line/70 px-5 py-3.5">{formatDate(quotation.createdAt)}</td>
                    <td className="border-b border-line/70 px-5 py-3.5">{formatDate(quotation.expiresAt)}</td>
                    <td className="border-b border-line/70 px-5 py-3.5">
                      <StatusPill status={quotation.status} />
                    </td>
                    <td className="border-b border-line/70 px-5 py-3.5 text-right">
                      {quotation.status === "quoted" ? (
                        <Button
                          size="sm"
                          className="h-8 rounded-full px-3"
                          disabled={pendingId === quotation._id}
                          onClick={() => continueToApplication(quotation)}
                        >
                          {pendingId === quotation._id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : null}
                          Apply
                        </Button>
                      ) : (
                        <span className="text-[0.62rem] text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[1.5rem] border-line bg-background sm:max-w-[620px]">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="tracking-[-0.02em]">{selected.productName}</DialogTitle>
                <DialogDescription>
                  Quotation {selected.reference} · created {formatDateTime(selected.createdAt)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-line px-3 py-3">
                    <p className="text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">Indicative premium</p>
                    <p className="mt-1 text-lg font-semibold text-ink">
                      {formatMoney(selected.premium, selected.currency)}
                    </p>
                    <p className="text-[0.62rem] text-muted-foreground">per year, before underwriting</p>
                  </div>
                  <div className="rounded-xl border border-line px-3 py-3">
                    <p className="text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">Terms</p>
                    <p className="mt-1 text-sm text-ink">
                      {selected.status === "quoted"
                        ? `Valid until ${formatDate(selected.expiresAt)}`
                        : selected.status === "expired"
                          ? "Expired — request a new quotation"
                          : "Converted to an application"}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Rating basis
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {(selected.breakdown?.factors ?? []).map((factor: { label: string; selected: string; multiplier: number }) => (
                      <li key={factor.label} className="flex justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">{factor.label}</span>
                        <span className="text-ink">
                          {factor.selected} · ×{factor.multiplier}
                        </span>
                      </li>
                    ))}
                    <li className="flex justify-between gap-2 border-t border-line pt-1.5 text-xs">
                      <span className="text-muted-foreground">Base premium</span>
                      <span className="text-ink">
                        {formatMoney(selected.breakdown?.basePremium ?? 0, selected.currency)}
                      </span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Declared answers
                  </h3>
                  <dl className="mt-2 space-y-1.5">
                    {Object.entries(selected.answers ?? {}).map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-3 text-xs">
                        <dt className="text-muted-foreground">{key.replace(/_/g, " ")}</dt>
                        <dd className="max-w-[60%] text-right text-ink">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <Callout tone="info" title="What happens next">
                  Applying does not bind cover. Upload the required documents, submit for manual
                  underwriting, and pay the premium only after approval. A policy is issued once
                  payment is confirmed.
                </Callout>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" className="rounded-full" onClick={() => setSelected(null)}>
                    Close
                  </Button>
                  {selected.status === "quoted" && (
                    <Button
                      className="rounded-full"
                      disabled={pendingId === selected._id}
                      onClick={() => continueToApplication(selected)}
                    >
                      Continue to application
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
