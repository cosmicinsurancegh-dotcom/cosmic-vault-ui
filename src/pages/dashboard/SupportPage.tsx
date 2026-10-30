import {
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, formatMoney } from "@/lib/format";
import { isStaff, normalizeRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowUpRight,
  ClipboardCheck,
  ClipboardList,
  Copy,
  FileText,
  Headset,
  Loader2,
  Receipt,
  Send,
  UserRound,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

/** The linked record as `tickets.get` resolves it for the thread. */
type RelatedRecord = {
  type: "policies" | "claims" | "applications" | "transactions";
  reference: string;
  title: string;
  status: string;
  amount?: number;
  currency?: string;
};

const RELATED_META = {
  policies: { label: "Policy", icon: FileText },
  claims: { label: "Claim", icon: ClipboardList },
  applications: { label: "Application", icon: ClipboardCheck },
  transactions: { label: "Payment", icon: Receipt },
} as const;

/** Where the linked record lives for this viewer: the staff queue, or the
 *  member's own screen. A broker has no claims screen, so that link is dropped
 *  rather than pointing at a route they cannot open. */
function relatedHref(type: keyof typeof RELATED_META, role?: string | null) {
  const staff = isStaff(role);
  if (type === "policies") {
    return staff ? "/dashboard/admin/policies" : "/dashboard/policies";
  }
  if (type === "claims") {
    if (staff) return "/dashboard/admin/claims";
    return normalizeRole(role) === "customer" ? "/dashboard/claims" : null;
  }
  if (type === "applications") {
    return staff ? "/dashboard/admin/applications" : "/dashboard/applications";
  }
  return staff ? "/dashboard/admin/payments" : "/dashboard/payments";
}

const CATEGORIES = [
  { value: "policy", label: "Policy / cover" },
  { value: "claim", label: "Claim" },
  { value: "payment", label: "Payment or refund" },
  { value: "application", label: "Application" },
  { value: "account", label: "Account, data, or privacy" },
  { value: "complaint", label: "Complaint" },
  { value: "other", label: "Something else" },
];

/** The same caps `tickets.create` enforces, so the form fails here first
 *  instead of after a round trip. */
const SUBJECT_MAX = 160;
const MESSAGE_MAX = 4000;
const MESSAGE_MIN = 10;

type TicketErrors = {
  subject?: string;
  related?: string;
  message?: string;
};

export default function SupportPage() {
  const tickets = useQuery(api.tickets.mine);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<Id<"tickets"> | null>(null);

  if (tickets === undefined) return <LoadingState label="Loading support" />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title="A person, not a phone tree."
        description="Tickets stay separate from claim decisions and payments, but can be linked to the record in question."
        actions={
          <Button className="h-10 rounded-[4px] px-5" onClick={() => setCreateOpen(true)}>
            New request <ArrowUpRight className="size-4" />
          </Button>
        }
      />

      {tickets.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Headset}
            title="No support requests"
            description="Questions about a payment, a policy change, a claim, or your data all start here."
            action={
              <Button size="sm" className="rounded-[4px]" onClick={() => setCreateOpen(true)}>
                Contact support
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Panel key={ticket._id} className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{ticket.subject}</p>
                    <StatusPill status={ticket.status} />
                    {ticket.priority === "high" && (
                      <span className="rounded-[4px] border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[0.58rem] font-semibold text-destructive">
                        High priority
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ticket.reference} · {ticket.category} · updated {formatDateTime(ticket.updatedAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-[4px] bg-transparent px-4"
                  onClick={() => setSelectedId(ticket._id)}
                >
                  Open thread
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <CreateTicketDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onOpenThread={(ticketId) => setSelectedId(ticketId)}
      />
      {selectedId && (
        <TicketDialog
          ticketId={selectedId}
          open={Boolean(selectedId)}
          onOpenChange={(open) => !open && setSelectedId(null)}
        />
      )}
    </div>
  );
}

function CreateTicketDialog({
  open,
  onOpenChange,
  onOpenThread,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenThread: (ticketId: Id<"tickets">) => void;
}) {
  const create = useMutation(api.tickets.create);
  const { user } = useAuth();
  // Staff are not customers or brokers, so the self-service queries reject them.
  // Skip them until we know the viewer is a self-service account.
  const selfService = Boolean(user) && !isStaff(user?.role);
  const policies = useQuery(api.policies.mine, selfService ? {} : "skip");
  const claims = useQuery(api.claims.mine, selfService ? {} : "skip");
  const applications = useQuery(
    api.applications.mine,
    selfService ? {} : "skip",
  );
  const payments = useQuery(api.payments.mine, selfService ? {} : "skip");
  const [category, setCategory] = useState("policy");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [relatedType, setRelatedType] = useState("");
  const [relatedId, setRelatedId] = useState("");
  const [errors, setErrors] = useState<TicketErrors>({});
  const [pending, setPending] = useState(false);
  /** Set once the request exists, so the dialog confirms instead of vanishing. */
  const [created, setCreated] = useState<{
    ticketId: Id<"tickets">;
    reference: string;
  } | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const recordRef = useRef<HTMLSelectElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const options =
    relatedType === "policies"
      ? (policies ?? []).map((policy) => ({ id: policy._id, label: `${policy.policyNumber} · ${policy.productName}` }))
      : relatedType === "claims"
        ? (claims ?? []).map((claim) => ({ id: claim._id, label: `${claim.reference} · ${claim.productName}` }))
        : relatedType === "applications"
          ? (applications ?? []).map((application) => ({ id: application._id, label: `${application.reference} · ${application.productName}` }))
          : relatedType === "transactions"
            ? (payments ?? []).map((payment) => ({ id: payment._id, label: `${payment.reference} · ${formatMoney(payment.amount, payment.currency)}` }))
            : [];

  /** The rows behind the current choice, or undefined while it is loading. */
  const relatedRows =
    relatedType === "policies"
      ? policies
      : relatedType === "claims"
        ? claims
        : relatedType === "applications"
          ? applications
          : relatedType === "transactions"
            ? payments
            : undefined;

  const clearError = (field: keyof TicketErrors) =>
    setErrors((current) => ({ ...current, [field]: undefined }));

  /** Mirrors the server's rules, worded for the person filling the form. */
  const validate = (): TicketErrors => {
    const next: TicketErrors = {};
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();
    if (!cleanSubject) {
      next.subject = "Add a short subject so the team knows what this is about.";
    } else if (cleanSubject.length > SUBJECT_MAX) {
      next.subject = `Keep the subject under ${SUBJECT_MAX} characters.`;
    }
    if (relatedType && !relatedId) {
      next.related = "Choose the record this is about, or clear the Related to field.";
    }
    if (!cleanMessage) {
      next.message = "Tell us what you need help with.";
    } else if (cleanMessage.length < MESSAGE_MIN) {
      next.message = `Add a little more detail (at least ${MESSAGE_MIN} characters).`;
    } else if (cleanMessage.length > MESSAGE_MAX) {
      next.message = `Keep this under ${MESSAGE_MAX.toLocaleString()} characters.`;
    }
    return next;
  };

  const reset = () => {
    setCategory("policy");
    setSubject("");
    setMessage("");
    setRelatedType("");
    setRelatedId("");
    setErrors({});
    setCreated(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = async () => {
    if (pending) return;
    const found = validate();
    setErrors(found);
    if (found.subject) {
      subjectRef.current?.focus();
      return;
    }
    if (found.related) {
      recordRef.current?.focus();
      return;
    }
    if (found.message) {
      messageRef.current?.focus();
      return;
    }

    setPending(true);
    try {
      const result = await create({
        category,
        subject: subject.trim(),
        message: message.trim(),
        relatedType: relatedType || undefined,
        relatedId: relatedId || undefined,
      });
      setSubject("");
      setMessage("");
      setRelatedType("");
      setRelatedId("");
      setCreated(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the request.");
    } finally {
      setPending(false);
    }
  };

  const copyReference = () => {
    if (!created) return;
    const copied = navigator.clipboard?.writeText(created.reference);
    if (!copied) {
      toast.error("Could not reach the clipboard.");
      return;
    }
    copied
      .then(() => toast.success("Reference copied."))
      .catch(() => toast.error("Could not reach the clipboard."));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background sm:max-w-[600px]"
        onOpenAutoFocus={(event) => {
          // Land in the first field, not on the dialog's close button.
          if (created) return;
          event.preventDefault();
          subjectRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="tracking-[-0.02em]">
            {created ? "Request received" : "New support request"}
          </DialogTitle>
          <DialogDescription>
            {created
              ? "Your ticket is open. Replies arrive in its thread, and by email when your address is on file."
              : "Include the policy, claim, or payment reference where relevant. Never send card details or security codes."}
          </DialogDescription>
        </DialogHeader>
        {created ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-card px-4 py-3">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Your reference
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <p className="font-mono text-sm font-semibold text-ink">{created.reference}</p>
                <button
                  type="button"
                  onClick={copyReference}
                  className="inline-flex cursor-pointer items-center gap-1 text-[0.65rem] font-medium text-muted-foreground hover:text-ink"
                >
                  <Copy className="size-3" /> Copy
                </button>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                The support queue has been notified. Keep this reference for your records.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-[4px]"
                onClick={() => handleOpenChange(false)}
              >
                Close
              </Button>
              <Button
                className="rounded-[4px]"
                onClick={() => {
                  const ticketId = created.ticketId;
                  reset();
                  onOpenChange(false);
                  onOpenThread(ticketId);
                }}
              >
                Open thread <ArrowUpRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="ticket-category">Category</Label>
              <select
                id="ticket-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink"
              >
                {CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="ticket-subject">Subject</Label>
                <span className="text-[0.6rem] tabular-nums text-muted-foreground">
                  {subject.length}/{SUBJECT_MAX}
                </span>
              </div>
              <Input
                id="ticket-subject"
                ref={subjectRef}
                value={subject}
                maxLength={SUBJECT_MAX}
                aria-invalid={Boolean(errors.subject)}
                aria-describedby={errors.subject ? "ticket-subject-error" : undefined}
                onChange={(event) => {
                  setSubject(event.target.value);
                  clearError("subject");
                }}
                className="h-10 rounded-xl bg-card"
                placeholder="A short summary"
              />
              {errors.subject && (
                <p
                  id="ticket-subject-error"
                  role="alert"
                  className="text-[0.65rem] text-destructive"
                >
                  {errors.subject}
                </p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ticket-related">Related to</Label>
                <select
                  id="ticket-related"
                  value={relatedType}
                  onChange={(event) => {
                    setRelatedType(event.target.value);
                    setRelatedId("");
                    clearError("related");
                  }}
                  className="h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink"
                >
                  <option value="">Nothing specific</option>
                  {selfService && <option value="policies">A policy</option>}
                  {selfService && <option value="claims">A claim</option>}
                  {selfService && (
                    <option value="applications">An application</option>
                  )}
                  {selfService && (
                    <option value="transactions">A payment</option>
                  )}
                </select>
              </div>
              {relatedType && (
                <div className="space-y-1.5">
                  <Label htmlFor="ticket-record">Record</Label>
                  <select
                    id="ticket-record"
                    ref={recordRef}
                    value={relatedId}
                    aria-invalid={Boolean(errors.related)}
                    aria-describedby={errors.related ? "ticket-record-error" : undefined}
                    onChange={(event) => {
                      setRelatedId(event.target.value);
                      clearError("related");
                    }}
                    className="h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink"
                  >
                    <option value="">Choose…</option>
                    {options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {relatedRows?.length === 0 && (
                    <p className="text-[0.65rem] text-muted-foreground">
                      {relatedType === "policies"
                        ? "You do not have a policy yet."
                        : relatedType === "claims"
                          ? "You have not filed a claim yet."
                          : relatedType === "applications"
                            ? "You have no applications yet."
                            : "You have no payments yet."}
                    </p>
                  )}
                </div>
              )}
            </div>
            {errors.related && (
              <p id="ticket-record-error" role="alert" className="text-[0.65rem] text-destructive">
                {errors.related}
              </p>
            )}
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="ticket-message">How can we help?</Label>
                <span className="text-[0.6rem] tabular-nums text-muted-foreground">
                  {message.length}/{MESSAGE_MAX}
                </span>
              </div>
              <Textarea
                id="ticket-message"
                ref={messageRef}
                value={message}
                maxLength={MESSAGE_MAX}
                aria-invalid={Boolean(errors.message)}
                aria-describedby={
                  errors.message ? "ticket-message-error" : "ticket-message-hint"
                }
                onChange={(event) => {
                  setMessage(event.target.value);
                  clearError("message");
                }}
                className="min-h-[110px] rounded-xl bg-card"
                placeholder="What happened, when, and what would you like us to do?"
              />
              {errors.message ? (
                <p
                  id="ticket-message-error"
                  role="alert"
                  className="text-[0.65rem] text-destructive"
                >
                  {errors.message}
                </p>
              ) : (
                <p id="ticket-message-hint" className="text-[0.65rem] text-muted-foreground">
                  At least {MESSAGE_MIN} characters. Include dates, amounts and what you have already
                  tried.
                </p>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-[4px]"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-[4px]" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Send request
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The policy, claim or payment the ticket was filed about, shown to the
 *  customer and to staff so neither side has to guess which record it means. */
function RelatedRecordRow({
  related,
  role,
}: {
  related: RelatedRecord;
  role?: string | null;
}) {
  const meta = RELATED_META[related.type];
  const Icon = meta.icon;
  const href = relatedHref(related.type, role);

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-ice/60 px-3 py-2">
      <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {meta.label}
      </span>
      <span className="text-xs font-medium text-ink">{related.reference}</span>
      <span className="text-xs text-muted-foreground">· {related.title}</span>
      {related.amount !== undefined && (
        <span className="text-xs text-muted-foreground">
          · {formatMoney(related.amount, related.currency)}
        </span>
      )}
      <StatusPill status={related.status} />
      {href && (
        <Link
          to={href}
          className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-[0.65rem] font-medium text-primary hover:underline"
        >
          Open <ArrowUpRight className="size-3" />
        </Link>
      )}
    </div>
  );
}

export function TicketDialog({
  ticketId,
  open,
  onOpenChange,
  staff = false,
}: {
  ticketId: Id<"tickets">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff?: boolean;
}) {
  const detail = useQuery(api.tickets.get, { ticketId });
  const reply = useMutation(api.tickets.reply);
  const setStatus = useMutation(api.tickets.setStatus);
  const assign = useMutation(api.tickets.assign);
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [pending, setPending] = useState(false);
  const [assignPending, setAssignPending] = useState(false);
  const myId = user?._id;

  const setOwner = async (assigneeId?: Id<"users">) => {
    setAssignPending(true);
    try {
      await assign({ ticketId, assigneeId });
      toast.success(
        assigneeId ? "Ticket assigned to you." : "Ticket returned to the queue.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not change the owner.",
      );
    } finally {
      setAssignPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background sm:max-w-[680px]">
        {detail === undefined ? (
          <LoadingState label="Loading ticket" />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 tracking-[-0.02em]">
                {detail.ticket.reference} <StatusPill status={detail.ticket.status} />
              </DialogTitle>
              <DialogDescription>
                {detail.ticket.subject} · {detail.ticket.category}
                {detail.user?.name ? ` · ${detail.user.name}` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {staff && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-ice/60 px-3 py-2">
                  <UserRound aria-hidden className="size-3.5 text-muted-foreground" />
                  <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Owner
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      detail.assignee
                        ? "text-ink"
                        : "text-amber-700 dark:text-amber-400",
                    )}
                  >
                    {detail.assignee?.name ??
                      detail.assignee?.email ??
                      "Unassigned"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-8 shrink-0 rounded-[4px] bg-transparent px-3"
                    disabled={assignPending || !myId}
                    onClick={() =>
                      setOwner(
                        detail.ticket.assignedTo === myId ? undefined : myId,
                      )
                    }
                  >
                    {assignPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <UserRound className="size-3.5" />
                    )}
                    {detail.ticket.assignedTo === myId
                      ? "Release"
                      : detail.assignee
                        ? "Take over"
                        : "Assign to me"}
                  </Button>
                </div>
              )}
              {detail.related && (
                <RelatedRecordRow related={detail.related} role={user?.role} />
              )}
              <div className="max-h-[320px] space-y-3 overflow-y-auto rounded-xl border border-line p-3">
                {detail.messages.map((message) => {
                  const isStaff = message.authorRole === "admin" || message.authorRole === "super_admin";
                  return (
                    <div
                      key={message._id}
                      className={cn(
                        "rounded-xl border px-3 py-2.5",
                        isStaff ? "border-primary/20 bg-primary/[0.04]" : "border-line bg-card",
                        message.internal && "border-dashed",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {message.internal ? "Internal note" : isStaff ? "Support" : "You"}
                        </p>
                        <p className="text-[0.58rem] text-muted-foreground">{formatDateTime(message.createdAt)}</p>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-ink">{message.body}</p>
                    </div>
                  );
                })}
              </div>

              {detail.ticket.status !== "closed" && (
                <div className="space-y-2">
                  <Textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    className="rounded-xl bg-card"
                    placeholder="Write a reply…"
                  />
                  {staff && (
                    <label className="flex items-center gap-2 text-[0.65rem] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={internal}
                        onChange={(event) => setInternal(event.target.checked)}
                        className="accent-[var(--primary)]"
                      />
                      Internal note (not visible to the customer)
                    </label>
                  )}
                  <div className="flex flex-wrap justify-end gap-2">
                    {staff && (
                      <select
                        aria-label="Ticket status"
                        value={detail.ticket.status}
                        onChange={async (event) => {
                          try {
                            await setStatus({
                              ticketId,
                              status: event.target.value as "open" | "awaiting_customer" | "resolved" | "closed",
                            });
                            toast.success("Ticket status updated.");
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Could not update the ticket.");
                          }
                        }}
                        className="h-9 rounded-[4px] border border-line bg-card px-3 text-xs text-ink"
                      >
                        <option value="open">Open</option>
                        <option value="awaiting_customer">Awaiting customer</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    )}
                    <Button
                      size="sm"
                      className="rounded-[4px]"
                      disabled={pending || body.trim().length < 2}
                      onClick={async () => {
                        setPending(true);
                        try {
                          await reply({ ticketId, body, internal });
                          setBody("");
                          setInternal(false);
                          toast.success("Reply sent.");
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Could not send the reply.");
                        } finally {
                          setPending(false);
                        }
                      }}
                    >
                      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                      Reply
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button variant="outline" className="rounded-[4px]" onClick={() => onOpenChange(false)}>
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
