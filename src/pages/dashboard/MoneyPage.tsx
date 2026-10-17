import {
  Callout,
  Detail,
  EmptyState,
  LoadingState,
  PageHeader,
  Panel,
  StatusPill,
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
import { Textarea } from "@/components/ui/textarea";
import { useDocumentDownload } from "@/hooks/use-document-download";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { formatDate, formatMoney, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Copy,
  CreditCard,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type Transaction = Doc<"transactions">;
const FILTERS = ["all", "pending", "succeeded", "failed", "refunded", "disputed"];

export function PaymentsPage() {
  const transactions = useQuery(api.payments.mine);
  const applications = useQuery(api.applications.mine);
  const myRequests = useQuery(api.policies.myRequests);
  const publicInfo = useQuery(api.settings.publicInfo);
  const initiatePremium = useMutation(api.payments.initiatePremium);
  const initiateRenewal = useMutation(api.payments.initiatePolicyRenewal);
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<Id<"transactions"> | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  if (transactions === undefined || applications === undefined || myRequests === undefined) {
    return <LoadingState label="Loading payments" />;
  }

  const filtered = status === "all" ? transactions : transactions.filter((tx) => tx.status === status);
  const awaitingPayment = applications.filter(
    (application) => application.status === "approved" && !application.policyId,
  );
  const pendingPremium = transactions.filter(
    (tx) => tx.type === "premium" && tx.status === "pending",
  );
  const renewalOffers = myRequests.filter(
    (request) => request.kind === "renewal" && request.status === "pending",
  );
  const awaitingIds = new Set(awaitingPayment.map((application) => application._id));
  const pendingExtra = pendingPremium.filter(
    (tx) => !tx.applicationId || !awaitingIds.has(tx.applicationId),
  );
  const overdue = pendingPremium.filter(
    (tx) => tx.dueDate !== undefined && tx.dueDate < Date.now(),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payments & billing"
        title="Every amount, accounted for."
        description="Premiums are recorded as pending until the finance team confirms the received funds. No UI action alone marks a payment successful."
        actions={
          <select
            aria-label="Filter transactions"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9 rounded-full border border-line bg-card px-3 text-xs text-ink"
          >
            {FILTERS.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All statuses" : value === "succeeded" ? "Confirmed" : value}
              </option>
            ))}
          </select>
        }
      />

      {overdue.length > 0 && (
        <Callout tone="danger" title="Overdue premium">
          {overdue.length} payment instruction{overdue.length === 1 ? " is" : "s are"} past its due
          date. If you have already transferred the funds, contact support with the reference.
        </Callout>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <Panel>
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Premium due</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Approved applications and renewal offers that need a confirmed payment.
            </p>
          </div>
          {awaitingPayment.length === 0 && renewalOffers.length === 0 && pendingExtra.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Nothing due" description="Approved applications and renewal premiums will appear here." />
          ) : (
            <ul className="divide-y divide-line">
              {awaitingPayment.map((application) => {
                const existing = pendingPremium.find(
                  (tx) => tx.applicationId === application._id,
                );
                return (
                  <li key={application._id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-ink">
                          {application.reference} · {application.productName}
                        </p>
                        <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                          Approved application · premium {formatMoney(application.premium, application.currency)}
                        </p>
                      </div>
                      <StatusPill status={existing ? existing.status : "pending"} />
                    </div>
                    {existing ? (
                      <div className="mt-2 rounded-lg border border-line bg-ice/40 px-3 py-2">
                        <p className="text-[0.62rem] text-muted-foreground">
                          Quote reference{" "}
                          <span className="font-semibold text-ink">{existing.reference}</span>
                        </p>
                        <p className="mt-0.5 text-[0.6rem] text-muted-foreground">
                          Awaiting finance confirmation. Bank details are below.
                        </p>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="mt-2 h-8 rounded-full px-3"
                        disabled={pending === application._id}
                        onClick={async () => {
                          setPending(application._id);
                          try {
                            const result = await initiatePremium({ applicationId: application._id });
                            toast.success("Payment instructions created.", {
                              description: result.reference,
                            });
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Could not create the payment.");
                          } finally {
                            setPending(null);
                          }
                        }}
                      >
                        {pending === application._id && <Loader2 className="size-3 animate-spin" />}
                        Create payment instructions
                      </Button>
                    )}
                  </li>
                );
              })}
              {pendingExtra.map((transaction) => (
                <li key={transaction._id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-medium text-ink">
                      {transaction.note ?? "Premium payment"}
                    </p>
                    <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                      Reference {transaction.reference} · {formatMoney(transaction.amount, transaction.currency)}
                      {transaction.dueDate ? ` · due ${formatDate(transaction.dueDate)}` : ""}
                    </p>
                  </div>
                  <StatusPill status={transaction.status} />
                </li>
              ))}
              {renewalOffers.map((request) => (
                <li key={request._id} className="px-5 py-4">
                  <p className="text-xs font-medium text-ink">
                    Renewal · {request.policyNumber}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-muted-foreground">{request.details}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 h-8 rounded-full bg-transparent px-3"
                    disabled={pending === request._id}
                    onClick={async () => {
                      setPending(request._id);
                      try {
                        const result = await initiateRenewal({ policyId: request.policyId });
                        toast.success("Renewal payment instructions ready.", {
                          description: result.reference,
                        });
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Could not start the renewal payment.");
                      } finally {
                        setPending(null);
                      }
                    }}
                  >
                    <RefreshCw className="size-3" /> Start renewal payment
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Bank transfer details</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Always quote the payment reference. Card acquiring is not configured for this
              deployment; the finance team confirms bank receipts.
            </p>
          </div>
          <div className="space-y-3 px-5 py-4">
            {publicInfo ? (
              <>
                <Detail label="Account name">{publicInfo.bankAccountName ?? "Configure in settings"}</Detail>
                <Detail label="IBAN">{publicInfo.bankIban ?? "Configure in settings"}</Detail>
                <Detail label="Sort code / SWIFT">
                  {[publicInfo.bankSortCode, publicInfo.bankSwift].filter(Boolean).join(" · ") || "—"}
                </Detail>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Payment details are not configured yet.</p>
            )}
            <div className="rounded-xl border border-dashed border-line px-3 py-2.5 text-[0.65rem] leading-5 text-muted-foreground">
              A recorded payment is marked confirmed only when an authorised finance user records the
              provider or bank reference. This is a documented integration boundary, not a gateway
              success.
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Transaction history</h2>
            <p className="mt-1 text-xs text-muted-foreground">Premiums, refunds, and settlement references.</p>
          </div>
          <Link to="/dashboard/documents" className="text-xs font-medium text-primary">
            Receipts & documents
          </Link>
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={CreditCard} title="No transactions" description="Payment instructions and receipts will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="border-b border-line px-5 py-2.5">Reference</th>
                  <th className="border-b border-line px-5 py-2.5">Type</th>
                  <th className="border-b border-line px-5 py-2.5">Amount</th>
                  <th className="border-b border-line px-5 py-2.5">Method</th>
                  <th className="border-b border-line px-5 py-2.5">Created</th>
                  <th className="border-b border-line px-5 py-2.5">Status</th>
                  <th className="border-b border-line px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((transaction) => (
                  <tr key={transaction._id} className="text-xs text-ink transition-colors hover:bg-primary/[0.02]">
                    <td className="border-b border-line/70 px-5 py-3 font-medium">{transaction.reference}</td>
                    <td className="border-b border-line/70 px-5 py-3 capitalize">
                      {transaction.type.replace("_", " ")}
                    </td>
                    <td className="border-b border-line/70 px-5 py-3 font-semibold">
                      {formatMoney(transaction.amount, transaction.currency)}
                    </td>
                    <td className="border-b border-line/70 px-5 py-3 capitalize">
                      {transaction.method.replace("_", " ")}
                    </td>
                    <td className="border-b border-line/70 px-5 py-3">{formatDate(transaction.createdAt)}</td>
                    <td className="border-b border-line/70 px-5 py-3">
                      <StatusPill status={transaction.status} />
                    </td>
                    <td className="border-b border-line/70 px-5 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full bg-transparent px-3"
                        onClick={() => setSelectedId(transaction._id)}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {selectedId && (
        <TransactionDialog
          transactionId={selectedId}
          open={Boolean(selectedId)}
          onOpenChange={(open) => !open && setSelectedId(null)}
        />
      )}
    </div>
  );
}

function TransactionDialog({
  transactionId,
  open,
  onOpenChange,
}: {
  transactionId: Id<"transactions">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const detail = useQuery(api.payments.get, { transactionId });
  const createTicket = useMutation(api.tickets.create);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[1.5rem] border-line bg-background sm:max-w-[600px]">
        {detail === undefined ? (
          <LoadingState label="Loading transaction" />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 tracking-[-0.02em]">
                {detail.transaction.reference} <StatusPill status={detail.transaction.status} />
              </DialogTitle>
              <DialogDescription>
                {detail.transaction.type.replace("_", " ")} ·{" "}
                {formatMoney(detail.transaction.amount, detail.transaction.currency)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Created">{formatDateTime(detail.transaction.createdAt)}</Detail>
                <Detail label="Method">{detail.transaction.method.replace("_", " ")}</Detail>
                <Detail label="Provider reference">{detail.transaction.providerRef ?? "—"}</Detail>
                <Detail label="Reconciled">
                  {detail.transaction.reconciled ? formatDateTime(detail.transaction.reconciledAt) : "Not yet"}
                </Detail>
                {detail.transaction.dueDate && (
                  <Detail label="Due">{formatDate(detail.transaction.dueDate)}</Detail>
                )}
                {detail.transaction.failureReason && (
                  <Detail label="Failure reason">{detail.transaction.failureReason}</Detail>
                )}
                {detail.policy && <Detail label="Policy">{detail.policy.policyNumber}</Detail>}
                {detail.application && <Detail label="Application">{detail.application.reference}</Detail>}
              </div>
              {detail.transaction.status === "pending" && (
                <div className="rounded-xl border border-line bg-ice/40 px-4 py-3">
                  <p className="text-xs font-medium text-ink">Quote this reference with your transfer</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="text-sm font-semibold text-primary">{detail.transaction.reference}</code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(detail.transaction.reference).catch(() => {});
                        toast.success("Reference copied.");
                      }}
                      className="text-muted-foreground hover:text-primary"
                      aria-label="Copy reference"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                  <p className="mt-1 text-[0.62rem] text-muted-foreground">
                    The payment is not confirmed until finance records the received funds.
                  </p>
                </div>
              )}
              <div className="rounded-xl border border-line p-4">
                <p className="text-xs font-medium text-ink">Query this transaction</p>
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="What would you like the payments team to check?"
                  className="mt-2 rounded-xl bg-card"
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full bg-transparent"
                    disabled={pending || message.trim().length < 10}
                    onClick={async () => {
                      setPending(true);
                      try {
                        const result = await createTicket({
                          category: "payment",
                          subject: `Query on transaction ${detail.transaction.reference}`,
                          message,
                          relatedType: "transactions",
                          relatedId: detail.transaction._id,
                        });
                        setMessage("");
                        toast.success("Query sent to support.", { description: result.reference });
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Could not send the query.");
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    Send query
                  </Button>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DocumentsPage() {
  const documents = useQuery(api.documents.mine, {});
  const download = useDocumentDownload();
  const [category, setCategory] = useState("all");

  if (documents === undefined) return <LoadingState label="Loading documents" />;

  const categories = ["all", "policy", "receipt", "invoice", "claim", "endorsement", "application", "other"];
  const filtered = category === "all" ? documents : documents.filter((doc) => doc.category === category);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Document library"
        title="Everything in one secure place."
        description="Policies, schedules, certificates, receipts, endorsements, and claim correspondence. Downloads are checked against your account on the server."
        actions={
          <select
            aria-label="Filter documents"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-9 rounded-full border border-line bg-card px-3 text-xs capitalize text-ink"
          >
            {categories.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All documents" : value}
              </option>
            ))}
          </select>
        }
      />

      {filtered.length === 0 ? (
        <Panel>
          <EmptyState
            icon={FolderOpen}
            title="No documents here"
            description="Policy documents are issued with your policy. Receipts are created when a payment is confirmed."
          />
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((document) => (
            <Panel key={document._id} className="flex items-start gap-3 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ice text-primary">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink">{document.name}</p>
                <p className="mt-0.5 text-[0.62rem] uppercase tracking-[0.1em] text-muted-foreground">
                  {document.category} · {formatDate(document.issuedAt)}
                  {document.size ? ` · ${Math.max(1, Math.round(document.size / 1024))} KB` : ""}
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await download(document._id);
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not open the document.");
                    }
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 text-[0.68rem] font-medium text-primary"
                >
                  <Download className="size-3.5" /> Download
                </button>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
