import {
  Callout,
  Detail,
  EmptyState,
  LoadingState,
  PageHeader,
  Panel,
  StatusPill,
  Timeline,
} from "@/components/dashboard/PlatformUI";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDocumentDownload } from "@/hooks/use-document-download";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { formatDate, formatDateTime, formatMoney, statusLabel } from "@/lib/format";
import { normalizeRole } from "@/lib/permissions";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowUpRight,
  Download,
  FileText,
  Loader2,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type Policy = Doc<"policies">;
const STATUS_FILTERS = ["all", "active", "suspended", "expired", "cancelled"];

export default function PoliciesPage() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const [status, setStatus] = useState("all");
  const policies = useQuery(api.policies.mine, { status });
  const [selectedId, setSelectedId] = useState<Id<"policies"> | null>(null);

  if (policies === undefined) return <LoadingState label="Loading policies" />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={role === "broker" ? "Broker portfolio" : "My policies"}
        title="The cover you hold."
        description="Terms, documents, and servicing requests. Changes only take effect after an authorised staff decision."
        actions={
          <select
            aria-label="Filter policies"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9 rounded-[4px] border border-line bg-card px-3 text-xs text-ink"
          >
            {STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All statuses" : statusLabel(value)}
              </option>
            ))}
          </select>
        }
      />

      {policies.length === 0 ? (
        <Panel>
          <EmptyState
            icon={ShieldCheck}
            title={status === "all" ? "No policies yet" : "No policies in this state"}
            description="A policy is issued after an application is approved and the premium is confirmed. Nothing becomes active automatically."
            action={
              <Button asChild size="sm" className="rounded-[4px]">
                <Link to="/dashboard/applications">View applications</Link>
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {policies.map((policy) => (
            <article key={policy._id} className="rounded-[4px] border border-line bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
                    {policy.policyNumber}
                  </p>
                  <h2 className="mt-1 text-base font-semibold tracking-[-0.02em] text-ink">
                    {policy.productName}
                  </h2>
                  <p className="mt-1 text-[0.68rem] text-muted-foreground">
                    {policy.country} · {policy.insuredName}
                  </p>
                </div>
                <StatusPill status={policy.status} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs">
                <div>
                  <dt className="text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">Premium</dt>
                  <dd className="mt-1 font-semibold text-ink">
                    {formatMoney(policy.premium, policy.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">Coverage</dt>
                  <dd className="mt-1 text-ink">{formatMoney(policy.coverageLimit, policy.currency)}</dd>
                </div>
                <div>
                  <dt className="text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">Starts</dt>
                  <dd className="mt-1 text-ink">{formatDate(policy.startDate)}</dd>
                </div>
                <div>
                  <dt className="text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">Renews</dt>
                  <dd className="mt-1 text-ink">{formatDate(policy.endDate)}</dd>
                </div>
              </dl>
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 flex-1 rounded-[4px] bg-transparent"
                  onClick={() => setSelectedId(policy._id)}
                >
                  Open policy
                </Button>
                {policy.status === "active" && (
                  <Button asChild size="sm" className="h-9 flex-1 rounded-[4px]">
                    <Link to="/dashboard/claims">Make a claim</Link>
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedId && (
        <PolicyDialog
          policyId={selectedId}
          open={Boolean(selectedId)}
          onOpenChange={(open) => !open && setSelectedId(null)}
        />
      )}
    </div>
  );
}

function PolicyDialog({
  policyId,
  open,
  onOpenChange,
}: {
  policyId: Id<"policies">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const detail = useQuery(api.policies.get, { policyId });
  const requestChange = useMutation(api.policies.requestChange);
  const download = useDocumentDownload();
  const [kind, setKind] = useState<"endorsement" | "cancellation" | "renewal" | "suspension">("endorsement");
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);

  if (detail === undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background sm:max-w-[760px]">
          <LoadingState label="Loading policy" />
        </DialogContent>
      </Dialog>
    );
  }

  const { policy, documents, requests, transactions, claims, customer } = detail;
  const pendingRequest = requests.find((request) => request.status === "pending");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background p-0 sm:max-w-[780px]">
        <div className="border-b border-line px-5 py-5 sm:px-7">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-lg tracking-[-0.02em]">
              {policy.policyNumber} <StatusPill status={policy.status} />
            </DialogTitle>
            <DialogDescription>
              {policy.productName} · wording v{policy.wordingVersion} · issued{" "}
              {formatDate(policy.issuedAt)}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 px-5 py-5 sm:px-7">
          {policy.status === "cancelled" && (
            <Callout tone="danger" title="Policy cancelled">
              {policy.cancelReason ?? "Cancelled by staff."}{" "}
              {policy.cancelledAt ? formatDateTime(policy.cancelledAt) : ""}
            </Callout>
          )}
          {policy.status === "suspended" && (
            <Callout tone="warning" title="Policy suspended">
              {policy.suspensionReason ?? "Suspended by staff."}
            </Callout>
          )}

          <section className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Detail label="Policyholder">{customer?.fullName ?? policy.insuredName}</Detail>
            <Detail label="Insured country">{policy.country}</Detail>
            <Detail label="Premium">{formatMoney(policy.premium, policy.currency)} per year</Detail>
            <Detail label="Coverage limit">{formatMoney(policy.coverageLimit, policy.currency)}</Detail>
            <Detail label="Excess">{formatMoney(policy.excess, policy.currency)}</Detail>
            <Detail label="Term">{formatDate(policy.startDate)} – {formatDate(policy.endDate)}</Detail>
            <Detail label="Renewal date">{formatDate(policy.renewalDate)}</Detail>
            <Detail label="Product version">{policy.productVersion}</Detail>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Included & excluded
            </h3>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              <ul className="space-y-1.5">
                {policy.benefits.map((benefit) => (
                  <li key={benefit} className="text-xs leading-5 text-ink">• {benefit}</li>
                ))}
              </ul>
              <ul className="space-y-1.5">
                {policy.exclusions.map((exclusion) => (
                  <li key={exclusion} className="text-xs leading-5 text-muted-foreground">• {exclusion}</li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Documents
              </h3>
              <Link to="/dashboard/documents" className="text-[0.65rem] font-medium text-primary">
                Full library
              </Link>
            </div>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {documents.length === 0 ? (
                <li className="px-4 py-3 text-xs text-muted-foreground">No documents available.</li>
              ) : (
                documents.map((document) => (
                  <li key={document._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="flex min-w-0 items-center gap-2 text-xs text-ink">
                      <FileText className="size-3.5 shrink-0 text-primary" />
                      <span className="truncate">{document.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await download(document._id);
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Could not open the document.");
                        }
                      }}
                      className="inline-flex shrink-0 items-center gap-1 text-[0.65rem] font-medium text-primary"
                    >
                      <Download className="size-3.5" /> Download
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Payments
            </h3>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {transactions.length === 0 ? (
                <li className="px-4 py-3 text-xs text-muted-foreground">No transactions yet.</li>
              ) : (
                transactions.map((transaction) => (
                  <li key={transaction._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div>
                      <p className="text-xs font-medium text-ink">
                        {transaction.reference} · {transaction.type.replace("_", " ")}
                      </p>
                      <p className="text-[0.62rem] text-muted-foreground">
                        {formatDate(transaction.createdAt)} · {transaction.method.replace("_", " ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-ink">
                        {formatMoney(transaction.amount, transaction.currency)}
                      </p>
                      <StatusPill status={transaction.status} />
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>

          {claims.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Claims on this policy
              </h3>
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                {claims.map((claim) => (
                  <li key={claim._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div>
                      <p className="text-xs font-medium text-ink">{claim.reference}</p>
                      <p className="text-[0.62rem] text-muted-foreground">
                        reported {formatDate(claim.reportedAt)}
                      </p>
                    </div>
                    <StatusPill status={claim.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Change history
            </h3>
            {policy.endorsements.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No endorsements recorded.</p>
            ) : (
              <div className="mt-2">
                <Timeline
                  items={policy.endorsements.map((endorsement) => ({
                    body: endorsement.summary,
                    at: endorsement.at,
                  }))}
                />
              </div>
            )}
          </section>

          <section className="rounded-xl border border-line bg-ice/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Request a change
            </h3>
            <p className="mt-1 text-[0.68rem] leading-5 text-muted-foreground">
              Requests are reviewed by staff. The policy record is not altered until a decision is
              recorded.
            </p>
            {pendingRequest ? (
              <p className="mt-3 text-xs text-ink">
                Your {pendingRequest.kind} request is awaiting a decision.{" "}
                <span className="text-muted-foreground">“{pendingRequest.details}”</span>
              </p>
            ) : policy.status === "cancelled" || policy.status === "expired" ? (
              <p className="mt-3 text-xs text-muted-foreground">
                This policy can no longer be changed. Contact support for help.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {(["endorsement", "renewal", "cancellation", "suspension"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setKind(option)}
                      className={
                        kind === option
                          ? "rounded-[4px] bg-primary px-3 py-1.5 text-[0.65rem] font-medium text-primary-foreground"
                          : "rounded-[4px] border border-line px-3 py-1.5 text-[0.65rem] font-medium text-muted-foreground"
                      }
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <Label htmlFor="request-details" className="text-[0.65rem]">
                  What would you like to change?
                </Label>
                <Textarea
                  id="request-details"
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  className="rounded-xl bg-card"
                  placeholder="Add the details the team needs to assess this request."
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="rounded-[4px]"
                    disabled={pending || details.trim().length < 5}
                    onClick={async () => {
                      setPending(true);
                      try {
                        await requestChange({ policyId, kind, details });
                        setDetails("");
                        toast.success("Request sent to the servicing team.");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Could not submit the request.");
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    {pending && <Loader2 className="size-3.5 animate-spin" />}
                    Send request
                  </Button>
                </div>
              </div>
            )}
            {requests.length > 0 && (
              <ul className="mt-3 space-y-1">
                {requests.map((request) => (
                  <li key={request._id} className="flex items-center justify-between gap-2 text-[0.65rem]">
                    <span className="text-muted-foreground">
                      {request.kind} · {formatDate(request.createdAt)}
                    </span>
                    <StatusPill status={request.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex justify-end">
            <Button variant="outline" className="rounded-[4px]" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
