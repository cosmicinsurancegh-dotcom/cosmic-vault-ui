import {
  Callout,
  Detail,
  EmptyState,
  LoadingState,
  Pagination,
  PageHeader,
  Panel,
  StatusPill,
  TableShell,
  Td,
  Th,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDocumentDownload } from "@/hooks/use-document-download";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate, formatDateTime, formatMoney, statusLabel } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import { Download, Loader2, Search, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STATUSES = [
  "all",
  "submitted",
  "under_review",
  "additional_info_required",
  "under_assessment",
  "payment_pending",
  "approved",
  "partially_approved",
  "declined",
  "paid",
  "closed",
];

export default function AdminClaimsPage() {
  const [status, setStatus] = useState("submitted");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<Id<"claims"> | null>(null);
  const queue = useQuery(api.claims.queue, {
    status,
    search: search || undefined,
    page,
    pageSize: 10,
  });

  if (queue === undefined) return <LoadingState label="Loading claims queue" />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Claims administration"
        title="Assess, decide, settle - separately."
        description="A recorded decision is not a payment. Settlement is recorded only when the funds have been sent through an authorised financial workflow."
      />

      <Panel>
        <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Claim reference, product, or location"
              className="h-9 rounded-[4px] bg-card pl-9 text-xs"
            />
          </div>
          <select
            aria-label="Claim status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-[4px] border border-line bg-card px-3 text-xs text-ink"
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All statuses" : statusLabel(value)}
              </option>
            ))}
          </select>
        </div>

        {queue.rows.length === 0 ? (
          <EmptyState icon={ShieldAlert} title="Queue empty" description="No claims match the selected filters." />
        ) : (
          <>
            <TableShell>
              <thead>
                <tr>
                  <Th>Claim</Th>
                  <Th>Customer</Th>
                  <Th>Policy</Th>
                  <Th>Claimed</Th>
                  <Th>Incident</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {queue.rows.map((claim) => (
                  <tr key={claim._id} className="transition-colors hover:bg-primary/[0.02]">
                    <Td>
                      <p className="text-xs font-medium text-ink">{claim.reference}</p>
                      <p className="text-[0.62rem] text-muted-foreground">
                        {claim.assignedTo ? "Assigned" : "Unassigned"}
                      </p>
                    </Td>
                    <Td>{claim.customerName}</Td>
                    <Td>{claim.policyNumber}</Td>
                    <Td>{formatMoney(claim.amountClaimed, claim.currency)}</Td>
                    <Td>{formatDate(claim.incidentDate)}</Td>
                    <Td><StatusPill status={claim.status} /></Td>
                    <Td className="text-right">
                      <Button size="sm" variant="outline" className="h-8 rounded-[4px] bg-transparent px-3" onClick={() => setSelectedId(claim._id)}>
                        Review
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
            <Pagination page={queue.page} pageSize={queue.pageSize} total={queue.total} onPage={setPage} />
          </>
        )}
      </Panel>

      {selectedId && (
        <ClaimReviewDialog
          claimId={selectedId}
          open={Boolean(selectedId)}
          onOpenChange={(open) => !open && setSelectedId(null)}
        />
      )}
    </div>
  );
}

function ClaimReviewDialog({
  claimId,
  open,
  onOpenChange,
}: {
  claimId: Id<"claims">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const detail = useQuery(api.claims.get, { claimId });
  const docs = useQuery(api.documents.forRecord, { claimId });
  const assign = useMutation(api.claims.assign);
  const requestInfo = useMutation(api.claims.requestInfo);
  const note = useMutation(api.claims.note);
  const decide = useMutation(api.claims.decide);
  const settle = useMutation(api.payments.recordSettlement);
  const close = useMutation(api.claims.close);
  const download = useDocumentDownload();

  const [info, setInfo] = useState("");
  const [noteText, setNoteText] = useState("");
  const [decision, setDecision] = useState<"approved" | "partially_approved" | "declined">("approved");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [providerRef, setProviderRef] = useState("");
  const [method, setMethod] = useState<"bank_transfer" | "card" | "manual">("bank_transfer");
  const [closeReason, setCloseReason] = useState("");
  const [pending, setPending] = useState(false);

  if (detail === undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[1.5rem] border-line bg-background sm:max-w-[840px]">
          <LoadingState label="Loading claim" />
        </DialogContent>
      </Dialog>
    );
  }

  const { claim, policy, customer, events, transactions, canReview, canDecide } = detail;
  const reviewable = ["submitted", "under_review", "under_assessment", "additional_info_required"].includes(claim.status);
  const decided = Boolean(claim.decision);
  const canSettle =
    decision !== "declined" &&
    claim.approvedAmount !== undefined &&
    claim.approvedAmount > 0 &&
    claim.status !== "paid";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[1.5rem] border-line bg-background p-0 sm:max-w-[860px]">
        <div className="border-b border-line px-5 py-5 sm:px-7">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-lg tracking-[-0.02em]">
              {claim.reference} <StatusPill status={claim.status} />
              {claim.decision && <StatusPill status={claim.decision} />}
            </DialogTitle>
            <DialogDescription>
              {claim.productName} · {policy?.policyNumber} · {formatMoney(claim.amountClaimed, claim.currency)} claimed
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-7">
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Detail label="Customer">{customer?.fullName ?? "-"}</Detail>
            <Detail label="Incident date">{formatDate(claim.incidentDate)}</Detail>
            <Detail label="Reported">{formatDateTime(claim.reportedAt)}</Detail>
            <Detail label="Location">{claim.location}</Detail>
            <Detail label="Assigned">
              {claim.assignedTo === user?._id ? "You" : claim.assignedTo ? "Another handler" : "Unassigned"}
            </Detail>
            <Detail label="Policy coverage">
              {policy ? formatMoney(policy.coverageLimit, claim.currency) : "-"}
            </Detail>
            <Detail label="Description" className="sm:col-span-2">{claim.description}</Detail>
            {claim.customerResponse && (
              <Detail label="Customer response" className="sm:col-span-2">{claim.customerResponse}</Detail>
            )}
          </div>

          <Callout tone="info" title="Coverage check">
            Review the policy wording, term, exclusions, and excess before recording a decision. The
            platform does not determine cover automatically.
          </Callout>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Evidence</h3>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {(docs ?? []).length === 0 ? (
                <li className="px-4 py-3 text-xs text-muted-foreground">No evidence.</li>
              ) : (
                (docs ?? []).map((document) => (
                  <li key={document._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="truncate text-xs text-ink">{document.name}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await download(document._id);
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Could not open the file.");
                        }
                      }}
                      className="inline-flex shrink-0 items-center gap-1 text-[0.65rem] font-medium text-primary"
                    >
                      <Download className="size-3.5" /> Open
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>

          {claim.infoRequest && (
            <Callout tone="warning" title="Information requested">
              {claim.infoRequest}
            </Callout>
          )}

          {decided && (
            <Callout tone={claim.decision === "declined" ? "danger" : "success"} title={`Decision: ${statusLabel(claim.decision)}`}>
              {claim.decisionReason}
              <p className="mt-1 text-[0.65rem]">
                Approved amount {formatMoney(claim.approvedAmount ?? 0, claim.currency)} · recorded{" "}
                {formatDateTime(claim.decidedAt)}. Settlement status:{" "}
                {claim.status === "paid" ? `paid (${claim.settlementRef})` : "not paid"}.
              </p>
            </Callout>
          )}

          {reviewable && canReview && (
            <section className="space-y-3 rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Review actions</h3>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-[4px] bg-transparent"
                  disabled={pending || claim.assignedTo === user?._id}
                  onClick={async () => {
                    setPending(true);
                    try {
                      await assign({ claimId, staffUserId: user!._id });
                      toast.success("Assigned to you.");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not assign.");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Assign to me
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="claim-info" className="text-[0.65rem]">Request more evidence</Label>
                  <Textarea id="claim-info" value={info} onChange={(event) => setInfo(event.target.value)} className="rounded-lg bg-card text-xs" />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-[4px] bg-transparent"
                    disabled={pending || info.trim().length < 5}
                    onClick={async () => {
                      setPending(true);
                      try {
                        await requestInfo({ claimId, message: info });
                        setInfo("");
                        toast.success("Information request sent.");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Could not request information.");
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    Send request
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="claim-note" className="text-[0.65rem]">Internal note</Label>
                  <Textarea id="claim-note" value={noteText} onChange={(event) => setNoteText(event.target.value)} className="rounded-lg bg-card text-xs" />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 rounded-[4px]"
                    disabled={pending || noteText.trim().length < 3}
                    onClick={async () => {
                      setPending(true);
                      try {
                        await note({ claimId, message: noteText });
                        setNoteText("");
                        toast.success("Note added.");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Could not add the note.");
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    Add note
                  </Button>
                </div>
              </div>
            </section>
          )}

          {!decided && canDecide && reviewable && (
            <section className="space-y-3 rounded-xl border border-primary/25 bg-primary/[0.03] p-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Record a decision</h3>
              <div className="flex flex-wrap gap-2">
                {(["approved", "partially_approved", "declined"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDecision(option)}
                    className={
                      decision === option
                        ? "rounded-[4px] bg-primary px-3 py-1.5 text-[0.65rem] font-medium text-primary-foreground"
                        : "rounded-[4px] border border-line px-3 py-1.5 text-[0.65rem] font-medium text-muted-foreground"
                    }
                  >
                    {statusLabel(option)}
                  </button>
                ))}
              </div>
              {decision !== "declined" && (
                <div className="space-y-1.5">
                  <Label htmlFor="approved-amount" className="text-[0.65rem]">Approved settlement amount ({claim.currency})</Label>
                  <Input
                    id="approved-amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="h-9 rounded-lg bg-card text-xs"
                    placeholder={(claim.amountClaimed / 100).toFixed(2)}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="claim-reason" className="text-[0.65rem]">Decision reason (required)</Label>
                <Textarea id="claim-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="rounded-lg bg-card text-xs" />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="h-8 rounded-[4px]"
                  disabled={pending || reason.trim().length < 5 || (decision !== "declined" && !amount)}
                  onClick={async () => {
                    setPending(true);
                    try {
                      await decide({
                        claimId,
                        decision,
                        reason,
                        approvedAmount:
                          decision === "declined"
                            ? 0
                            : Math.round(Number(amount) * 100),
                      });
                      toast.success("Claim decision recorded. Settlement is still outstanding.");
                      setReason("");
                      setAmount("");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not record the decision.");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  {pending && <Loader2 className="size-3.5 animate-spin" />} Record decision
                </Button>
              </div>
            </section>
          )}

          {claim.decision && claim.decision !== "declined" && canSettle && (
            <section className="space-y-3 rounded-xl border border-line p-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Record settlement</h3>
              <p className="text-[0.68rem] text-muted-foreground">
                Only record this after the settlement has actually been sent. It creates a settlement
                transaction and marks the claim paid.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="settle-method" className="text-[0.65rem]">Method</Label>
                  <select
                    id="settle-method"
                    value={method}
                    onChange={(event) => setMethod(event.target.value as typeof method)}
                    className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
                  >
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="card">Card</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="settle-ref" className="text-[0.65rem]">Payment reference</Label>
                  <Input id="settle-ref" value={providerRef} onChange={(event) => setProviderRef(event.target.value)} className="h-9 rounded-lg bg-card text-xs" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="h-8 rounded-[4px]"
                  disabled={pending || providerRef.trim().length < 3}
                  onClick={async () => {
                    setPending(true);
                    try {
                      await settle({ claimId, providerRef, method });
                      toast.success("Settlement recorded.");
                      setProviderRef("");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not record the settlement.");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Record settlement
                </Button>
              </div>
            </section>
          )}

          {(claim.status === "paid" || claim.status === "declined") && canDecide && (
            <section className="rounded-xl border border-line p-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Close claim</h3>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input value={closeReason} onChange={(event) => setCloseReason(event.target.value)} placeholder="Closure reason" className="h-9 rounded-lg bg-card text-xs" />
                <Button
                  size="sm"
                  className="h-9 shrink-0 rounded-[4px]"
                  disabled={pending || closeReason.trim().length < 3}
                  onClick={async () => {
                    setPending(true);
                    try {
                      await close({ claimId, reason: closeReason });
                      toast.success("Claim closed.");
                      setCloseReason("");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not close the claim.");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Close claim
                </Button>
              </div>
            </section>
          )}

          {transactions.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Settlement transactions</h3>
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                {transactions.map((tx) => (
                  <li key={tx._id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-ink">{tx.reference} · {formatDate(tx.createdAt)}</span>
                    <span className="text-xs font-semibold text-ink">{formatMoney(tx.amount, tx.currency)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Decision history</h3>
            <div className="mt-2">
              <Timeline
                items={events.map((event) => ({
                  body: event.message,
                  at: event.createdAt,
                  internal: event.internal,
                  title: event.toStatus ? statusLabel(event.toStatus) : undefined,
                }))}
              />
            </div>
          </section>

          <div className="flex justify-end">
            <Button variant="outline" className="rounded-[4px]" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
