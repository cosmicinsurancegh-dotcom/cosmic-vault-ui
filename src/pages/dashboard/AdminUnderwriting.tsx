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
import { ArrowUpRight, ClipboardList, Download, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

const STATUSES = [
  "all",
  "submitted",
  "under_review",
  "additional_info_required",
  "approved",
  "declined",
  "withdrawn",
  "draft",
];

export default function AdminUnderwritingPage() {
  const [status, setStatus] = useState("submitted");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<Id<"applications"> | null>(null);
  const queue = useQuery(api.applications.queue, {
    status,
    search: search || undefined,
    page,
    pageSize: 10,
  });

  if (queue === undefined) return <LoadingState label="Loading underwriting queue" />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Underwriting"
        title="Manual review queue."
        description="Every decision is recorded with a reason, reviewer, and timestamp. Approval and policy issuance are separate steps."
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
              placeholder="Reference or product"
              className="h-9 rounded-full bg-card pl-9 text-xs"
            />
          </div>
          <select
            aria-label="Application status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-full border border-line bg-card px-3 text-xs text-ink"
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All statuses" : statusLabel(value)}
              </option>
            ))}
          </select>
        </div>

        {queue.rows.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Queue empty" description="No applications match the selected filters." />
        ) : (
          <>
            <TableShell>
              <thead>
                <tr>
                  <Th>Application</Th>
                  <Th>Customer</Th>
                  <Th>Product</Th>
                  <Th>Country</Th>
                  <Th>Premium</Th>
                  <Th>Submitted</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {queue.rows.map((application) => (
                  <tr key={application._id} className="transition-colors hover:bg-primary/[0.02]">
                    <Td>
                      <p className="text-xs font-medium text-ink">{application.reference}</p>
                      <p className="text-[0.62rem] text-muted-foreground">
                        {application.assignedTo ? "Assigned" : "Unassigned"}
                      </p>
                    </Td>
                    <Td>{application.customerName}</Td>
                    <Td>{application.productName}</Td>
                    <Td>{application.country}</Td>
                    <Td>{formatMoney(application.premium, application.currency)}</Td>
                    <Td>{formatDate(application.submittedAt ?? application.createdAt)}</Td>
                    <Td><StatusPill status={application.status} /></Td>
                    <Td className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full bg-transparent px-3"
                        onClick={() => setSelectedId(application._id)}
                      >
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
        <ReviewDialog
          applicationId={selectedId}
          open={Boolean(selectedId)}
          onOpenChange={(open) => !open && setSelectedId(null)}
        />
      )}
    </div>
  );
}

function ReviewDialog({
  applicationId,
  open,
  onOpenChange,
}: {
  applicationId: Id<"applications">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const detail = useQuery(api.applications.get, { applicationId });
  const docs = useQuery(api.documents.forRecord, { applicationId });
  const assign = useMutation(api.applications.assign);
  const requestInfo = useMutation(api.applications.requestInfo);
  const note = useMutation(api.applications.note);
  const decide = useMutation(api.applications.decide);
  const issuePolicy = useMutation(api.applications.issuePolicy);
  const download = useDocumentDownload();

  const [info, setInfo] = useState("");
  const [noteText, setNoteText] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  if (detail === undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[1.5rem] border-line bg-background sm:max-w-[840px]">
          <LoadingState label="Loading application" />
        </DialogContent>
      </Dialog>
    );
  }

  const { application, product, customer, policy, transactions, events, canReview, canIssue } = detail;
  const reviewable = ["submitted", "under_review", "additional_info_required"].includes(application.status);
  const confirmedPayment = transactions.find(
    (tx) => tx.type === "premium" && tx.status === "succeeded",
  );
  const pendingPayment = transactions.find(
    (tx) => tx.type === "premium" && tx.status === "pending",
  );
  const canDecide = canReview && !application.decision && reviewable;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[1.5rem] border-line bg-background p-0 sm:max-w-[860px]">
        <div className="border-b border-line px-5 py-5 sm:px-7">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-lg tracking-[-0.02em]">
              {application.reference} <StatusPill status={application.status} />
              {application.decision && <StatusPill status={application.decision} />}
            </DialogTitle>
            <DialogDescription>
              {application.productName} · v{application.productVersion} ·{" "}
              {formatMoney(application.premium, application.currency)} · {application.country}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 px-5 py-5 sm:px-7">
          <section className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Detail label="Customer">{customer?.fullName ?? "—"}</Detail>
            <Detail label="Customer reference">{customer?.reference ?? "—"}</Detail>
            <Detail label="Submitted">
              {application.submittedAt ? formatDateTime(application.submittedAt) : "Not submitted"}
            </Detail>
            <Detail label="Assigned to">
              {application.assignedTo === user?._id ? "You" : application.assignedTo ? "Another reviewer" : "Unassigned"}
            </Detail>
            <Detail label="Broker-assisted">{application.brokerUserId ? "Yes" : "No"}</Detail>
            <Detail label="Country">{application.country}</Detail>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Submitted answers
            </h3>
            <dl className="mt-2 divide-y divide-line rounded-xl border border-line">
              {product?.questions.map((question) => (
                <div key={question.key} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:justify-between sm:gap-4">
                  <dt className="text-[0.68rem] text-muted-foreground">{question.label}</dt>
                  <dd className="text-xs text-ink sm:max-w-[60%] sm:text-right">
                    {String((application.answers as Record<string, string | number>)?.[question.key] ?? "—")}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Evidence
            </h3>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {(docs ?? []).length === 0 ? (
                <li className="px-4 py-3 text-xs text-muted-foreground">No documents uploaded.</li>
              ) : (
                (docs ?? []).map((document) => (
                  <li key={document._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div>
                      <p className="text-xs text-ink">{document.name}</p>
                      <p className="text-[0.6rem] text-muted-foreground">
                        {document.category} · {formatDate(document.issuedAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await download(document._id);
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Could not open the file.");
                        }
                      }}
                      className="inline-flex items-center gap-1 text-[0.65rem] font-medium text-primary"
                    >
                      <Download className="size-3.5" /> Open
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>

          {application.infoRequest && (
            <Callout tone="warning" title="Information requested">
              {application.infoRequest}
              {application.customerResponse && (
                <p className="mt-2">
                  <span className="font-semibold text-ink">Customer response:</span>{" "}
                  {application.customerResponse}
                </p>
              )}
            </Callout>
          )}

          {application.decision && (
            <Callout tone={application.decision === "approved" ? "success" : "danger"} title={`Decision: ${statusLabel(application.decision)}`}>
              {application.decisionReason}
              <p className="mt-1 text-[0.65rem]">
                Recorded {formatDateTime(application.decidedAt)}. This decision cannot be overwritten;
                any correction must be separately authorised and audited.
              </p>
            </Callout>
          )}

          {reviewable && (
            <section className="space-y-4 rounded-xl border border-line p-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Review actions
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full bg-transparent"
                  disabled={pending || application.assignedTo === user?._id}
                  onClick={async () => {
                    setPending(true);
                    try {
                      await assign({ applicationId, staffUserId: user!._id });
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

              <div className="space-y-2 rounded-lg border border-dashed border-line p-3">
                <Label htmlFor="info-request" className="text-[0.65rem]">Request more information</Label>
                <Textarea id="info-request" value={info} onChange={(event) => setInfo(event.target.value)} className="rounded-lg bg-card text-xs" placeholder="Tell the customer exactly what is missing." />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-full bg-transparent"
                    disabled={pending || info.trim().length < 5}
                    onClick={async () => {
                      setPending(true);
                      try {
                        await requestInfo({ applicationId, message: info });
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
              </div>

              <div className="space-y-2 rounded-lg border border-dashed border-line p-3">
                <Label htmlFor="internal-note" className="text-[0.65rem]">Internal underwriting note</Label>
                <Textarea id="internal-note" value={noteText} onChange={(event) => setNoteText(event.target.value)} className="rounded-lg bg-card text-xs" placeholder="Never shown to the customer." />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 rounded-full"
                    disabled={pending || noteText.trim().length < 3}
                    onClick={async () => {
                      setPending(true);
                      try {
                        await note({ applicationId, message: noteText });
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

              {canDecide && (
                <div className="space-y-2 rounded-lg border border-primary/25 bg-primary/[0.03] p-3">
                  <Label htmlFor="decision-reason" className="text-[0.65rem]">Decision reason (required)</Label>
                  <Textarea id="decision-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="rounded-lg bg-card text-xs" placeholder="Record the underwriting basis for the decision." />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-full border-destructive/40 bg-transparent text-destructive"
                      disabled={pending || reason.trim().length < 5}
                      onClick={async () => {
                        setPending(true);
                        try {
                          await decide({ applicationId, decision: "declined", reason });
                          setReason("");
                          toast.success("Application declined.");
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
                      size="sm"
                      className="h-8 rounded-full"
                      disabled={pending || reason.trim().length < 5}
                      onClick={async () => {
                        setPending(true);
                        try {
                          await decide({ applicationId, decision: "approved", reason });
                          setReason("");
                          toast.success("Application approved. Payment is now due.");
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Could not record the decision.");
                        } finally {
                          setPending(false);
                        }
                      }}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}

          {application.status === "approved" && !policy && (
            <section className="space-y-2 rounded-xl border border-primary/25 bg-primary/[0.03] p-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Issue policy
              </h3>
              {confirmedPayment ? (
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Premium confirmed ({confirmedPayment.reference}, {formatMoney(confirmedPayment.amount, confirmedPayment.currency)}).
                </p>
              ) : pendingPayment ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Payment {pendingPayment.reference} is awaiting finance confirmation.{" "}
                  <Link to="/dashboard/admin/payments" className="font-medium text-primary underline-offset-2 hover:underline">
                    Open payments
                  </Link>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No premium payment has been initiated. The customer creates payment instructions from
                  their application.
                </p>
              )}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="h-8 rounded-full"
                  disabled={pending || !confirmedPayment || !canIssue}
                  onClick={async () => {
                    setPending(true);
                    try {
                      const result = await issuePolicy({ applicationId });
                      toast.success(`Policy ${result.policyNumber} issued.`);
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not issue the policy.");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  {pending && <Loader2 className="size-3.5 animate-spin" />} Issue policy
                </Button>
              </div>
            </section>
          )}

          {policy && (
            <Callout tone="success" title={`Policy ${policy.policyNumber} issued`}>
              {formatMoney(policy.premium, policy.currency)} · {formatDate(policy.startDate)} –{" "}
              {formatDate(policy.endDate)}.{" "}
              <Link to="/dashboard/admin/policies" className="font-medium text-primary underline-offset-2 hover:underline">
                Policy register
              </Link>
            </Callout>
          )}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">History</h3>
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

          <div className="flex items-center justify-between">
            <Link to="/dashboard/admin/payments" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
              Finance queue <ArrowUpRight className="size-3.5" />
            </Link>
            <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
