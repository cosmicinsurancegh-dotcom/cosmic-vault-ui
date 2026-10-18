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
import { formatDateTime } from "@/lib/format";
import { isStaff } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { ArrowUpRight, Headset, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "policy", label: "Policy / cover" },
  { value: "claim", label: "Claim" },
  { value: "payment", label: "Payment or refund" },
  { value: "application", label: "Application" },
  { value: "account", label: "Account, data, or privacy" },
  { value: "complaint", label: "Complaint" },
  { value: "other", label: "Something else" },
];

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

      <CreateTicketDialog open={createOpen} onOpenChange={setCreateOpen} />
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useMutation(api.tickets.create);
  const { user } = useAuth();
  // Staff are not customers or brokers, so the self-service queries reject them.
  // Skip them until we know the viewer is a self-service account.
  const selfService = Boolean(user) && !isStaff(user?.role);
  const policies = useQuery(api.policies.mine, selfService ? {} : "skip");
  const claims = useQuery(api.claims.mine, selfService ? {} : "skip");
  const [category, setCategory] = useState("policy");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [relatedType, setRelatedType] = useState("");
  const [relatedId, setRelatedId] = useState("");
  const [pending, setPending] = useState(false);

  const options =
    relatedType === "policies"
      ? (policies ?? []).map((policy) => ({ id: policy._id, label: `${policy.policyNumber} · ${policy.productName}` }))
      : relatedType === "claims"
        ? (claims ?? []).map((claim) => ({ id: claim._id, label: `${claim.reference} · ${claim.productName}` }))
        : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="tracking-[-0.02em]">New support request</DialogTitle>
          <DialogDescription>
            Include the policy, claim, or payment reference where relevant. Never send card details or
            security codes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
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
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input
              id="ticket-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="h-10 rounded-xl bg-card"
              placeholder="A short summary"
            />
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
                }}
                className="h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink"
              >
                <option value="">Nothing specific</option>
                {selfService && <option value="policies">A policy</option>}
                {selfService && <option value="claims">A claim</option>}
              </select>
            </div>
            {relatedType && (
              <div className="space-y-1.5">
                <Label htmlFor="ticket-record">Record</Label>
                <select
                  id="ticket-record"
                  value={relatedId}
                  onChange={(event) => setRelatedId(event.target.value)}
                  className="h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink"
                >
                  <option value="">Choose…</option>
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-message">How can we help?</Label>
            <Textarea
              id="ticket-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="min-h-[110px] rounded-xl bg-card"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-[4px]" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-[4px]"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                try {
                  const result = await create({
                    category,
                    subject,
                    message,
                    relatedType: relatedType || undefined,
                    relatedId: relatedId || undefined,
                  });
                  toast.success("Support request created.", { description: result.reference });
                  setSubject("");
                  setMessage("");
                  setRelatedType("");
                  setRelatedId("");
                  onOpenChange(false);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not create the request.");
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send request
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [pending, setPending] = useState(false);

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
