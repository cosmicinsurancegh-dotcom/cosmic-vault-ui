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
import { TicketDialog } from "@/pages/dashboard/SupportPage";
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
import { formatDate, formatDateTime, formatMoney, statusLabel } from "@/lib/format";
import { STAFF_PERMISSIONS, can } from "@/lib/permissions";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Search, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function AdminCustomersPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [country, setCountry] = useState("all");
  const [verification, setVerification] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);
  const reference = useQuery(api.setup.referenceData);
  const directory = useQuery(api.customers.directory, {
    search: search || undefined,
    status,
    country,
    verificationStatus: verification,
    page,
    pageSize: 10,
  });

  if (directory === undefined) return <LoadingState label="Loading customers" />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer management"
        title="The customer directory."
        description="Search, verify, and service customer accounts. Suspension never deletes policies or financial records."
      />

      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Name, email, reference, or policy number"
              className="h-9 rounded-[4px] bg-card pl-9 text-xs"
            />
          </div>
          <select
            aria-label="Account status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-[4px] border border-line bg-card px-3 text-xs text-ink"
          >
            <option value="all">All account states</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <select
            aria-label="Country"
            value={country}
            onChange={(event) => {
              setCountry(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-[4px] border border-line bg-card px-3 text-xs text-ink"
          >
            <option value="all">All countries</option>
            {(reference?.countries ?? []).map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Verification"
            value={verification}
            onChange={(event) => {
              setVerification(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-[4px] border border-line bg-card px-3 text-xs text-ink"
          >
            <option value="all">All verification</option>
            <option value="unverified">Unverified</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
          </select>
        </div>

        {directory.rows.length === 0 ? (
          <EmptyState icon={Users} title="No customers match" description="Adjust the filters or search a different reference." />
        ) : (
          <>
            <TableShell>
              <thead>
                <tr>
                  <Th>Customer</Th>
                  <Th>Reference</Th>
                  <Th>Country</Th>
                  <Th>Registered</Th>
                  <Th>Verification</Th>
                  <Th>Account</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {directory.rows.map((row) => (
                  <tr key={row._id} className="transition-colors hover:bg-primary/[0.02]">
                    <Td>
                      <p className="text-xs font-medium text-ink">{row.fullName}</p>
                      <p className="mt-0.5 text-[0.62rem] text-muted-foreground">{row.email}</p>
                    </Td>
                    <Td>{row.reference}</Td>
                    <Td>{row.country}</Td>
                    <Td>{formatDate(row.createdAt)}</Td>
                    <Td><StatusPill status={row.verificationStatus} /></Td>
                    <Td><StatusPill status={row.accountStatus} /></Td>
                    <Td className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-[4px] bg-transparent px-3"
                        onClick={() => setSelectedUserId(row.userId)}
                      >
                        Open
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
            <Pagination page={directory.page} pageSize={directory.pageSize} total={directory.total} onPage={setPage} />
          </>
        )}
      </Panel>

      {selectedUserId && (
        <CustomerDialog
          userId={selectedUserId}
          open={Boolean(selectedUserId)}
          onOpenChange={(open) => !open && setSelectedUserId(null)}
          canManage={can(user?.role, user?.permissions, STAFF_PERMISSIONS.CUSTOMERS_MANAGE)}
          canAssignBroker={can(user?.role, user?.permissions, STAFF_PERMISSIONS.BROKERS_MANAGE)}
        />
      )}
    </div>
  );
}

function CustomerDialog({
  userId,
  open,
  onOpenChange,
  canManage,
  canAssignBroker,
}: {
  userId: Id<"users">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  canAssignBroker: boolean;
}) {
  const detail = useQuery(api.customers.detail, { userId });
  const reference = useQuery(api.setup.referenceData);
  const brokerOptions = useQuery(api.customers.brokerOptions);
  const update = useMutation(api.customers.updateStaff);
  const suspension = useMutation(api.customers.setSuspension);
  const assignBroker = useMutation(api.customers.assignBroker);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [verification, setVerification] = useState<"unverified" | "pending" | "verified">("unverified");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [brokerId, setBrokerId] = useState("");
  const [pending, setPending] = useState(false);

  if (detail === undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[1.5rem] border-line bg-background sm:max-w-[820px]">
          <LoadingState label="Loading customer" />
        </DialogContent>
      </Dialog>
    );
  }

  const { profile, user, applications, policies, claims, transactions, documents, tickets, audit, assignments } = detail;
  const startEdit = () => {
    setFullName(profile?.fullName ?? "");
    setPhone(profile?.phone ?? "");
    setCountry(profile?.country ?? "GB");
    setVerification((profile?.verificationStatus ?? "unverified") as "unverified" | "pending" | "verified");
    setNotes(profile?.notes ?? "");
    setEditing(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[1.5rem] border-line bg-background p-0 sm:max-w-[840px]">
        <div className="border-b border-line px-5 py-5 sm:px-7">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-lg tracking-[-0.02em]">
              {profile?.fullName ?? user?.name ?? "Customer"}
              <StatusPill status={user?.status ?? "active"} />
              {profile && <StatusPill status={profile.verificationStatus} />}
            </DialogTitle>
            <DialogDescription>
              {profile?.reference ?? "No profile"} · {profile?.email ?? user?.email ?? "-"} · joined{" "}
              {formatDate(profile?.createdAt)}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 px-5 py-5 sm:px-7">
          {user?.status === "suspended" && (
            <Callout tone="danger" title="Account suspended">
              {user.suspendedReason ?? "No reason recorded."}
            </Callout>
          )}

          <section className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Detail label="Country">{profile?.country ?? "-"}</Detail>
            <Detail label="Currency">{profile?.currency ?? "-"}</Detail>
            <Detail label="Phone">{profile?.phone ?? "-"}</Detail>
            <Detail label="Language / locale">
              {profile?.preferredLanguage ?? "-"} / {profile?.locale ?? "-"}
            </Detail>
            <Detail label="Address">
              {[profile?.addressLine, profile?.city, profile?.postalCode].filter(Boolean).join(", ") || "-"}
            </Detail>
            <Detail label="Preferred timezone">{profile?.timezone ?? "-"}</Detail>
            <Detail label="Broker">
              {assignments.length === 0
                ? "Not assigned"
                : assignments
                    .map((assignment) => brokerOptions?.find((broker) => broker.userId === assignment.brokerUserId)?.orgName ?? "Broker")
                    .join(", ")}
            </Detail>
            <Detail label="Marketing consent">{profile?.marketingOptIn ? "Opted in" : "Not opted in"}</Detail>
          </section>

          {canManage && (
            <section className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Account controls
                </h3>
                {!editing && (
                  <Button size="sm" variant="outline" className="h-8 rounded-[4px] bg-transparent" onClick={startEdit}>
                    Edit profile
                  </Button>
                )}
              </div>

              {editing ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cust-name">Full name</Label>
                    <Input id="cust-name" value={fullName} onChange={(event) => setFullName(event.target.value)} className="h-9 rounded-lg bg-card" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cust-phone">Phone</Label>
                    <Input id="cust-phone" value={phone} onChange={(event) => setPhone(event.target.value)} className="h-9 rounded-lg bg-card" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cust-country">Country</Label>
                    <select
                      id="cust-country"
                      value={country}
                      onChange={(event) => setCountry(event.target.value)}
                      className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
                    >
                      {(reference?.countries ?? []).map((item) => (
                        <option key={item.code} value={item.code}>{item.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cust-verification">Verification</Label>
                    <select
                      id="cust-verification"
                      value={verification}
                      onChange={(event) => setVerification(event.target.value as "unverified" | "pending" | "verified")}
                      className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
                    >
                      <option value="unverified">Unverified</option>
                      <option value="pending">Pending</option>
                      <option value="verified">Verified</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="cust-notes">Internal notes</Label>
                    <Textarea id="cust-notes" value={notes} onChange={(event) => setNotes(event.target.value)} className="rounded-lg bg-card text-xs" />
                  </div>
                  <div className="flex gap-2 sm:col-span-2">
                    <Button
                      size="sm"
                      className="rounded-[4px]"
                      disabled={pending}
                      onClick={async () => {
                        setPending(true);
                        try {
                          await update({ userId, fullName, phone, country, verificationStatus: verification, notes });
                          toast.success("Customer record updated.");
                          setEditing(false);
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Could not update the customer.");
                        } finally {
                          setPending(false);
                        }
                      }}
                    >
                      {pending && <Loader2 className="size-3.5 animate-spin" />} Save changes
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-[4px]" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {profile?.notes && (
                    <p className="text-[0.68rem] leading-5 text-muted-foreground">Internal note: {profile.notes}</p>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Reason for suspension or reinstatement"
                      className="h-9 rounded-lg bg-card text-xs"
                    />
                    <Button
                      size="sm"
                      variant={user?.status === "suspended" ? "outline" : "destructive"}
                      className="h-9 shrink-0 rounded-[4px]"
                      disabled={pending || reason.trim().length < 3}
                      onClick={async () => {
                        setPending(true);
                        try {
                          await suspension({ userId, suspended: user?.status !== "suspended", reason });
                          toast.success(user?.status === "suspended" ? "Account reinstated." : "Account suspended.");
                          setReason("");
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Could not change the account.");
                        } finally {
                          setPending(false);
                        }
                      }}
                    >
                      {user?.status === "suspended" ? "Reinstate account" : "Suspend account"}
                    </Button>
                  </div>
                  <p className="text-[0.62rem] text-muted-foreground">
                    Suspension blocks customer actions but preserves policies, claims, and financial
                    records. The customer is notified with the reason.
                  </p>
                </div>
              )}

              {canAssignBroker && (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="text-xs font-medium text-ink">Assign a broker</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <select
                      aria-label="Broker"
                      value={brokerId}
                      onChange={(event) => setBrokerId(event.target.value)}
                      className="h-9 flex-1 rounded-lg border border-line bg-card px-2 text-xs text-ink"
                    >
                      <option value="">Choose a broker…</option>
                      {(brokerOptions ?? []).map((broker) => (
                        <option key={broker.userId} value={broker.userId}>
                          {broker.orgName} · {broker.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 rounded-[4px] bg-transparent"
                      disabled={pending || !brokerId}
                      onClick={async () => {
                        setPending(true);
                        try {
                          await assignBroker({ customerUserId: userId, brokerUserId: brokerId as never });
                          toast.success("Broker assigned and notified.");
                          setBrokerId("");
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Could not assign the broker.");
                        } finally {
                          setPending(false);
                        }
                      }}
                    >
                      Assign
                    </Button>
                  </div>
                  {assignments.length > 0 && (
                    <p className="mt-2 text-[0.62rem] text-muted-foreground">
                      Active:{" "}
                      {assignments
                        .map((assignment) => brokerOptions?.find((broker) => broker.userId === assignment.brokerUserId)?.orgName ?? "Broker")
                        .join(", ")}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <RecordList
              title="Applications"
              rows={applications.map((app) => ({
                id: app._id,
                label: `${app.reference} · ${app.productName}`,
                meta: formatDate(app.submittedAt ?? app.createdAt),
                status: app.status,
              }))}
            />
            <RecordList
              title="Policies"
              rows={policies.map((policy) => ({
                id: policy._id,
                label: `${policy.policyNumber} · ${policy.productName}`,
                meta: `${formatMoney(policy.premium, policy.currency)} · ${formatDate(policy.endDate)}`,
                status: policy.status,
              }))}
            />
            <RecordList
              title="Claims"
              rows={claims.map((claim) => ({
                id: claim._id,
                label: `${claim.reference} · ${claim.productName}`,
                meta: `${formatMoney(claim.amountClaimed, claim.currency)} claimed`,
                status: claim.status,
              }))}
            />
            <RecordList
              title="Transactions"
              rows={transactions.map((tx) => ({
                id: tx._id,
                label: `${tx.reference} · ${tx.type}`,
                meta: tx.method.replace("_", " "),
                status: tx.status,
              }))}
            />
            <RecordList
              title="Documents"
              rows={documents.map((document) => ({
                id: document._id,
                label: document.name,
                meta: `${document.category} · ${formatDate(document.issuedAt)}`,
                status: document.category,
              }))}
            />
            <RecordList
              title="Support tickets"
              rows={tickets.map((ticket) => ({
                id: ticket._id,
                label: `${ticket.reference} · ${ticket.subject}`,
                meta: ticket.category,
                status: ticket.status,
              }))}
            />
          </div>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Audit history
            </h3>
            {audit.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No sensitive changes recorded.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                {audit.map((entry) => (
                  <li key={entry._id} className="px-4 py-2.5">
                    <p className="text-xs font-medium text-ink">{entry.action.replace(/[._]/g, " ")}</p>
                    <p className="mt-0.5 text-[0.62rem] text-muted-foreground">
                      {formatDateTime(entry.at)}
                      {entry.reason ? ` · ${entry.reason}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex justify-end">
            <Button variant="outline" className="rounded-[4px]" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecordList({
  title,
  rows,
}: {
  title: string;
  rows: { id: string; label: string; meta: string; status: string }[];
}) {
  return (
    <div className="rounded-xl border border-line">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
        <span className="text-[0.6rem] text-muted-foreground">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-[0.68rem] text-muted-foreground">None</p>
      ) : (
        <ul className="max-h-[180px] divide-y divide-line overflow-y-auto">
          {rows.slice(0, 10).map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2 px-4 py-2">
              <div className="min-w-0">
                <p className="truncate text-[0.68rem] text-ink">{row.label}</p>
                <p className="text-[0.6rem] text-muted-foreground">{row.meta}</p>
              </div>
              <StatusPill status={row.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminSupportPage() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<Id<"tickets"> | null>(null);
  const tickets = useQuery(api.tickets.staffList, {
    status,
    search: search || undefined,
    page,
    pageSize: 10,
  });

  if (tickets === undefined) return <LoadingState label="Loading support queue" />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support queue"
        title="Customer enquiries and complaints."
        description="Complaints carry higher priority. Internal notes are never shown to the customer."
      />
      <Panel>
        <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Reference or subject"
            className="h-9 min-w-[220px] flex-1 rounded-[4px] bg-card text-xs"
          />
          <select
            aria-label="Ticket status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-[4px] border border-line bg-card px-3 text-xs text-ink"
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="awaiting_customer">Awaiting customer</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        {tickets.rows.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No tickets match" />
        ) : (
          <>
            <TableShell>
              <thead>
                <tr>
                  <Th>Ticket</Th>
                  <Th>Customer</Th>
                  <Th>Category</Th>
                  <Th>Priority</Th>
                  <Th>Updated</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {tickets.rows.map((ticket) => (
                  <tr key={ticket._id} className="transition-colors hover:bg-primary/[0.02]">
                    <Td>
                      <p className="text-xs font-medium text-ink">{ticket.subject}</p>
                      <p className="text-[0.62rem] text-muted-foreground">{ticket.reference}</p>
                    </Td>
                    <Td>{ticket.customerName}</Td>
                    <Td className="capitalize">{ticket.category}</Td>
                    <Td><StatusPill status={ticket.priority} /></Td>
                    <Td>{formatDate(ticket.updatedAt)}</Td>
                    <Td><StatusPill status={ticket.status} /></Td>
                    <Td className="text-right">
                      <Button size="sm" variant="outline" className="h-8 rounded-[4px] bg-transparent px-3" onClick={() => setSelectedId(ticket._id)}>
                        Open
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
            <Pagination page={tickets.page} pageSize={tickets.pageSize} total={tickets.total} onPage={setPage} />
          </>
        )}
      </Panel>
      {selectedId && (
        <TicketDialog ticketId={selectedId} open={Boolean(selectedId)} onOpenChange={(open) => !open && setSelectedId(null)} staff />
      )}
    </div>
  );
}
