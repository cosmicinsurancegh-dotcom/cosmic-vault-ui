import {
  Callout,
  Detail,
  EmptyState,
  LoadingState,
  Pagination,
  PageHeader,
  Panel,
  PanelHeader,
  StatusPill,
  TableShell,
  Td,
  Th,
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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate, formatDateTime, formatMoney, statusLabel } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import { Download, Loader2, ScrollText, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminPoliciesPage() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [expiring, setExpiring] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<Id<"policies"> | null>(null);
  const [requestId, setRequestId] = useState<Id<"policyRequests"> | null>(null);
  const policies = useQuery(api.policies.listStaff, {
    status,
    search: search || undefined,
    expiringSoon: expiring || undefined,
    page,
    pageSize: 10,
  });
  const requests = useQuery(api.policies.requests, { status: "pending" });

  if (policies === undefined) return <LoadingState label="Loading policies" />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Policy administration"
        title="The policy register."
        description="Servicing requests, suspensions, cancellations, and renewals are recorded with an auditable decision."
      />

      {requests && requests.length > 0 && (
        <Panel>
          <PanelHeader
            title={`${requests.length} servicing request${requests.length === 1 ? "" : "s"} awaiting a decision`}
            description="Approving a cancellation or renewal changes the policy record and notifies the customer."
          />
          <ul className="divide-y divide-line">
            {requests.map((request) => (
              <li key={request._id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-ink">
                    {request.kind} · {request.policyNumber} · {request.customerName}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-muted-foreground">{request.details}</p>
                </div>
                <Button size="sm" className="h-8 shrink-0 self-start rounded-full px-3" onClick={() => setRequestId(request._id)}>
                  Review
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

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
              placeholder="Policy number, customer, or product"
              className="h-9 rounded-full bg-card pl-9 text-xs"
            />
          </div>
          <select
            aria-label="Policy status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-full border border-line bg-card px-3 text-xs text-ink"
          >
            {["all", "active", "suspended", "expired", "cancelled", "renewal_pending"].map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All statuses" : statusLabel(value)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-full border border-line px-3 text-xs text-muted-foreground">
            <input type="checkbox" checked={expiring} onChange={(event) => setExpiring(event.target.checked)} className="accent-[var(--primary)]" />
            Expiring soon
          </label>
        </div>

        {policies.rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="No policies match" />
        ) : (
          <>
            <TableShell>
              <thead>
                <tr>
                  <Th>Policy</Th>
                  <Th>Customer</Th>
                  <Th>Product</Th>
                  <Th>Premium</Th>
                  <Th>Term ends</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {policies.rows.map((policy) => (
                  <tr key={policy._id} className="transition-colors hover:bg-primary/[0.02]">
                    <Td>
                      <p className="text-xs font-medium text-ink">{policy.policyNumber}</p>
                      <p className="text-[0.62rem] text-muted-foreground">{formatDate(policy.issuedAt)}</p>
                    </Td>
                    <Td>{policy.customerName}</Td>
                    <Td>{policy.productName}</Td>
                    <Td>{formatMoney(policy.premium, policy.currency)}</Td>
                    <Td>{formatDate(policy.endDate)}</Td>
                    <Td><StatusPill status={policy.status} /></Td>
                    <Td className="text-right">
                      <Button size="sm" variant="outline" className="h-8 rounded-full bg-transparent px-3" onClick={() => setSelectedId(policy._id)}>
                        Open
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
            <Pagination page={policies.page} pageSize={policies.pageSize} total={policies.total} onPage={setPage} />
          </>
        )}
      </Panel>

      {selectedId && (
        <PolicyAdminDialog
          policyId={selectedId}
          open={Boolean(selectedId)}
          onOpenChange={(open) => !open && setSelectedId(null)}
        />
      )}
      {requestId && (
        <RequestDecisionDialog
          requestId={requestId}
          open={Boolean(requestId)}
          onOpenChange={(open) => !open && setRequestId(null)}
        />
      )}
    </div>
  );
}

function RequestDecisionDialog({
  requestId,
  open,
  onOpenChange,
}: {
  requestId: Id<"policyRequests">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const decide = useMutation(api.policies.decideRequest);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[1.5rem] border-line bg-background sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Record a servicing decision</DialogTitle>
          <DialogDescription>
            Approval applies the change to the policy and generates an endorsement document. A reason
            is required for the audit trail.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} className="rounded-xl bg-card" placeholder="Decision note" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              variant="outline"
              className="rounded-full border-destructive/40 bg-transparent text-destructive"
              disabled={pending || note.trim().length < 3}
              onClick={async () => {
                setPending(true);
                try {
                  await decide({ requestId, decision: "declined", note });
                  toast.success("Request declined.");
                  onOpenChange(false);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not record the decision.");
                } finally {
                  setPending(false);
                }
              }}
            >
              Decline
            </Button>
            <Button
              className="rounded-full"
              disabled={pending || note.trim().length < 3}
              onClick={async () => {
                setPending(true);
                try {
                  await decide({ requestId, decision: "approved", note });
                  toast.success("Request approved and applied.");
                  onOpenChange(false);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not approve the request.");
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Approve
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PolicyAdminDialog({
  policyId,
  open,
  onOpenChange,
}: {
  policyId: Id<"policies">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const detail = useQuery(api.policies.get, { policyId });
  const setStatus = useMutation(api.policies.setStatus);
  const download = useDocumentDownload();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  if (detail === undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[1.5rem] border-line bg-background sm:max-w-[760px]">
          <LoadingState label="Loading policy" />
        </DialogContent>
      </Dialog>
    );
  }

  const { policy, documents, requests, transactions, claims, customer, broker } = detail;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[1.5rem] border-line bg-background p-0 sm:max-w-[800px]">
        <div className="border-b border-line px-5 py-5 sm:px-7">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-lg tracking-[-0.02em]">
              {policy.policyNumber} <StatusPill status={policy.status} />
            </DialogTitle>
            <DialogDescription>
              {policy.productName} · {customer?.fullName ?? policy.insuredName} ·{" "}
              {formatMoney(policy.premium, policy.currency)}
              {broker ? " · broker-assisted" : ""}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-5 px-5 py-5 sm:px-7">
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Detail label="Term">
              {formatDate(policy.startDate)} – {formatDate(policy.endDate)}
            </Detail>
            <Detail label="Renewal date">{formatDate(policy.renewalDate)}</Detail>
            <Detail label="Coverage">{formatMoney(policy.coverageLimit, policy.currency)}</Detail>
            <Detail label="Excess">{formatMoney(policy.excess, policy.currency)}</Detail>
            <Detail label="Country">{policy.country}</Detail>
            <Detail label="Issued">
              {formatDateTime(policy.issuedAt)}
            </Detail>
          </div>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Documents</h3>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {documents.length === 0 ? (
                <li className="px-4 py-3 text-xs text-muted-foreground">No documents.</li>
              ) : (
                documents.map((document) => (
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

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Transactions</h3>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {transactions.length === 0 ? (
                <li className="px-4 py-3 text-xs text-muted-foreground">No transactions.</li>
              ) : (
                transactions.map((tx) => (
                  <li key={tx._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div>
                      <p className="text-xs text-ink">{tx.reference} · {tx.type}</p>
                      <p className="text-[0.6rem] text-muted-foreground">{formatDate(tx.createdAt)} · {tx.method.replace("_", " ")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-ink">{formatMoney(tx.amount, tx.currency)}</p>
                      <StatusPill status={tx.status} />
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>

          {claims.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Claims</h3>
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                {claims.map((claim) => (
                  <li key={claim._id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-ink">{claim.reference}</span>
                    <StatusPill status={claim.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {requests.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Servicing requests</h3>
              <ul className="mt-2 space-y-1.5">
                {requests.map((request) => (
                  <li key={request._id} className="flex items-center justify-between gap-2 text-[0.65rem]">
                    <span className="text-muted-foreground">
                      {request.kind} · {formatDate(request.createdAt)} · {request.details}
                    </span>
                    <StatusPill status={request.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-line p-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Change policy status</h3>
            <Callout tone="warning">
              Cancelling or suspending a policy affects cover immediately and is audited. Existing claims
              and transactions are preserved.
            </Callout>
            <div className="mt-2 space-y-2">
              <Label htmlFor="status-reason" className="text-[0.65rem]">Reason</Label>
              <Input id="status-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="h-9 rounded-lg bg-card text-xs" />
              <div className="flex flex-wrap gap-2">
                {(["active", "suspended", "cancelled", "expired"] as const).map((target) => (
                  <Button
                    key={target}
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-full bg-transparent capitalize"
                    disabled={pending || policy.status === target || reason.trim().length < 3}
                    onClick={async () => {
                      setPending(true);
                      try {
                        await setStatus({ policyId, status: target, reason });
                        toast.success(`Policy marked ${target}.`);
                        setReason("");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Could not change the status.");
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    {target}
                  </Button>
                ))}
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
