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
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { STAFF_PERMISSIONS, can } from "@/lib/permissions";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Search, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function AdminPaymentsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<Id<"transactions"> | null>(null);
  const transactions = useQuery(api.payments.listStaff, {
    status,
    type,
    search: search || undefined,
    page,
    pageSize: 10,
  });

  const canManage = can(user?.role, user?.permissions, STAFF_PERMISSIONS.PAYMENTS_MANAGE);

  if (transactions === undefined) return <LoadingState label="Loading transactions" />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Transactions, reconciliation, refunds."
        description="Confirmed means an authorised user has verified the received funds and recorded the reference. Nothing is marked successful from a customer click."
      />
      <Callout tone="info" title="Accounting basis">
        Premium receipts are confirmed premium transactions. Outstanding premiums are pending invoices,
        not receipts. Refunds are recorded separately and are not netted against premiums here. Every
        total is grouped by currency.
      </Callout>

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
              placeholder="Reference, provider ref, or note"
              className="h-9 rounded-full bg-card pl-9 text-xs"
            />
          </div>
          <select
            aria-label="Transaction status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-full border border-line bg-card px-3 text-xs text-ink"
          >
            {["all", "pending", "succeeded", "failed", "refunded", "disputed"].map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All statuses" : value === "succeeded" ? "Confirmed" : value}
              </option>
            ))}
          </select>
          <select
            aria-label="Transaction type"
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-full border border-line bg-card px-3 text-xs text-ink"
          >
            {["all", "premium", "refund", "settlement", "adjustment"].map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All types" : value}
              </option>
            ))}
          </select>
        </div>

        {transactions.rows.length === 0 ? (
          <EmptyState icon={Wallet} title="No transactions match" />
        ) : (
          <>
            <TableShell>
              <thead>
                <tr>
                  <Th>Reference</Th>
                  <Th>Customer</Th>
                  <Th>Type</Th>
                  <Th>Amount</Th>
                  <Th>Method</Th>
                  <Th>Created</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {transactions.rows.map((transaction) => (
                  <tr key={transaction._id} className="transition-colors hover:bg-primary/[0.02]">
                    <Td>
                      <p className="text-xs font-medium text-ink">{transaction.reference}</p>
                      <p className="text-[0.62rem] text-muted-foreground">
                        {transaction.providerRef ?? "no provider ref"}
                      </p>
                    </Td>
                    <Td>{transaction.customerName}</Td>
                    <Td className="capitalize">{transaction.type.replace("_", " ")}</Td>
                    <Td>{formatMoney(transaction.amount, transaction.currency)}</Td>
                    <Td className="capitalize">{transaction.method.replace("_", " ")}</Td>
                    <Td>{formatDate(transaction.createdAt)}</Td>
                    <Td><StatusPill status={transaction.status} /></Td>
                    <Td className="text-right">
                      <Button size="sm" variant="outline" className="h-8 rounded-full bg-transparent px-3" onClick={() => setSelectedId(transaction._id)}>
                        Manage
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
            <Pagination page={transactions.page} pageSize={transactions.pageSize} total={transactions.total} onPage={setPage} />
          </>
        )}
      </Panel>

      {selectedId && (
        <FinanceDialog
          transactionId={selectedId}
          open={Boolean(selectedId)}
          onOpenChange={(open) => !open && setSelectedId(null)}
          canManage={canManage}
          canRefund={can(user?.role, user?.permissions, STAFF_PERMISSIONS.REFUNDS_APPROVE)}
        />
      )}
    </div>
  );
}

function FinanceDialog({
  transactionId,
  open,
  onOpenChange,
  canManage,
  canRefund,
}: {
  transactionId: Id<"transactions">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  canRefund: boolean;
}) {
  const detail = useQuery(api.payments.get, { transactionId });
  const confirm = useMutation(api.payments.confirm);
  const fail = useMutation(api.payments.fail);
  const refund = useMutation(api.payments.refund);
  const markOutstanding = useMutation(api.payments.markOutstanding);
  const [providerRef, setProviderRef] = useState("");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  if (detail === undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[1.5rem] border-line bg-background sm:max-w-[620px]">
          <LoadingState label="Loading transaction" />
        </DialogContent>
      </Dialog>
    );
  }

  const { transaction, policy, application, claim } = detail;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[1.5rem] border-line bg-background sm:max-w-[660px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 tracking-[-0.02em]">
            {transaction.reference} <StatusPill status={transaction.status} />
          </DialogTitle>
          <DialogDescription>
            {transaction.type.replace("_", " ")} ·{" "}
            {formatMoney(transaction.amount, transaction.currency)} ·{" "}
            {formatDateTime(transaction.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Method">{transaction.method.replace("_", " ")}</Detail>
            <Detail label="Provider reference">{transaction.providerRef ?? "—"}</Detail>
            <Detail label="Reconciled">
              {transaction.reconciled ? formatDateTime(transaction.reconciledAt) : "No"}
            </Detail>
            <Detail label="Due date">{transaction.dueDate ? formatDate(transaction.dueDate) : "—"}</Detail>
            {policy && <Detail label="Policy">{policy.policyNumber}</Detail>}
            {application && <Detail label="Application">{application.reference}</Detail>}
            {claim && <Detail label="Claim">{claim.reference}</Detail>}
          </div>

          {transaction.status === "pending" && canManage && (
            <section className="space-y-2 rounded-xl border border-line p-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Confirm received funds
              </h3>
              <p className="text-[0.65rem] text-muted-foreground">
                Enter the bank or provider reference. This creates a receipt and marks the transaction
                confirmed. Duplicate confirmation is blocked by the server.
              </p>
              <Input value={providerRef} onChange={(event) => setProviderRef(event.target.value)} placeholder="Bank / provider reference" className="h-9 rounded-lg bg-card text-xs" />
              <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional reconciliation note" className="h-9 rounded-lg bg-card text-xs" />
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full border-destructive/40 bg-transparent text-destructive"
                  disabled={pending || reason.trim().length < 3}
                  onClick={async () => {
                    if (reason.trim().length < 3) {
                      toast.error("Add a failure reason first.");
                      return;
                    }
                    setPending(true);
                    try {
                      await fail({ transactionId, reason });
                      toast.success("Transaction marked failed.");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not update the transaction.");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Mark failed
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full bg-transparent"
                  disabled={pending}
                  onClick={async () => {
                    setPending(true);
                    try {
                      await markOutstanding({ transactionId });
                      toast.success("Marked overdue and customer notified.");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not update the transaction.");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Mark overdue
                </Button>
                <Button
                  size="sm"
                  className="h-8 rounded-full"
                  disabled={pending || providerRef.trim().length < 3}
                  onClick={async () => {
                    setPending(true);
                    try {
                      await confirm({ transactionId, providerRef, note: note || undefined });
                      toast.success("Payment confirmed and receipt issued.");
                      setProviderRef("");
                      setNote("");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not confirm the payment.");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  {pending && <Loader2 className="size-3.5 animate-spin" />} Confirm payment
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fail-reason" className="text-[0.65rem]">Reason (used for failure / overdue notes)</Label>
                <Input id="fail-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="h-9 rounded-lg bg-card text-xs" />
              </div>
            </section>
          )}

          {transaction.status === "succeeded" && transaction.type !== "refund" && (
            <section className="space-y-2 rounded-xl border border-line p-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Refund
              </h3>
              {!canRefund ? (
                <p className="text-[0.68rem] text-muted-foreground">
                  Refunds require the refund approval permission. Ask a super admin to grant it.
                </p>
              ) : (
                <>
                  <p className="text-[0.65rem] text-muted-foreground">
                    Maximum {formatMoney(transaction.amount, transaction.currency)}. One refund can be
                    recorded per original transaction; issue a manual adjustment for partial follow-ups.
                  </p>
                  <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="Refund amount" className="h-9 rounded-lg bg-card text-xs" />
                  <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Refund reason (required)" className="rounded-lg bg-card text-xs" />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-full border-destructive/40 bg-transparent text-destructive"
                      disabled={pending || !amount || reason.trim().length < 5}
                      onClick={async () => {
                        setPending(true);
                        try {
                          await refund({
                            transactionId,
                            amount: Math.round(Number(amount) * 100),
                            reason,
                          });
                          toast.success("Refund recorded.");
                          setAmount("");
                          setReason("");
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Could not record the refund.");
                        } finally {
                          setPending(false);
                        }
                      }}
                    >
                      Record refund
                    </Button>
                  </div>
                </>
              )}
            </section>
          )}

          {transaction.failureReason && (
            <Callout tone="danger" title="Failure reason">{transaction.failureReason}</Callout>
          )}

          <div className="flex justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
