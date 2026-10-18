import {
  Callout,
  EmptyState,
  LoadingState,
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
import { formatDate, statusLabel } from "@/lib/format";
import { STAFF_PERMISSIONS, can } from "@/lib/permissions";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Plus, Store, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminBrokersPage() {
  const { user } = useAuth();
  const brokers = useQuery(api.brokers.list);
  const reference = useQuery(api.setup.referenceData);
  const createProfile = useMutation(api.brokers.createProfile);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignmentsFor, setAssignmentsFor] = useState<{
    profileId: Id<"brokerProfiles">;
    orgName: string;
  } | null>(null);
  const [form, setForm] = useState({
    email: "",
    orgName: "",
    contactName: "",
    phone: "",
    countries: ["GB"] as string[],
    agreementRef: "",
    commissionEnabled: false,
    commissionRate: "0",
  });
  const [pending, setPending] = useState(false);

  const canManage = can(user?.role, user?.permissions, STAFF_PERMISSIONS.BROKERS_MANAGE);

  if (brokers === undefined || reference === undefined) {
    return <LoadingState label="Loading brokers" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Broker management"
        title="Distribution partners, tightly scoped."
        description="Brokers see only customers explicitly assigned to their brokerage. They cannot decide underwriting or claims."
        actions={
          canManage ? (
            <Button className="h-10 rounded-[4px] px-5" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Add broker
            </Button>
          ) : undefined
        }
      />

      <Callout tone="info" title="Onboarding">
        The broker must first create an account with their email. Adding them here promotes that account
        to the broker role and creates the brokerage profile. Commission is disabled unless both the
        company setting and the broker record enable it.
      </Callout>

      {brokers.length === 0 ? (
        <Panel>
          <EmptyState icon={Store} title="No brokers" description="Add a broker account after they sign up." />
        </Panel>
      ) : (
        <Panel>
          <TableShell>
            <thead>
              <tr>
                <Th>Brokerage</Th>
                <Th>Contact</Th>
                <Th>Countries</Th>
                <Th>Customers</Th>
                <Th>Applications</Th>
                <Th>Active policies</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {brokers.map((broker) => (
                <tr key={broker._id} className="transition-colors hover:bg-primary/[0.02]">
                  <Td>
                    <p className="text-xs font-medium text-ink">{broker.orgName}</p>
                    <p className="text-[0.62rem] text-muted-foreground">{broker.reference} · {broker.email}</p>
                  </Td>
                  <Td>{broker.contactName}</Td>
                  <Td>{broker.countries.join(", ")}</Td>
                  <Td>{broker.assignedCustomers}</Td>
                  <Td>{broker.applications}</Td>
                  <Td>{broker.activePolicies}</Td>
                  <Td><StatusPill status={broker.status} /></Td>
                  <Td className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-[4px] bg-transparent px-3"
                      onClick={() => setAssignmentsFor({ profileId: broker._id, orgName: broker.orgName })}
                    >
                      Manage
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Panel>
      )}

      {/* Create broker */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>Add a broker</DialogTitle>
            <DialogDescription>
              The email must belong to an existing account. Their role changes to broker immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="b-email">Broker email</Label>
              <Input id="b-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="h-9 rounded-lg bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-org">Brokerage name</Label>
              <Input id="b-org" value={form.orgName} onChange={(event) => setForm({ ...form, orgName: event.target.value })} className="h-9 rounded-lg bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-contact">Contact name</Label>
              <Input id="b-contact" value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} className="h-9 rounded-lg bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-phone">Phone</Label>
              <Input id="b-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="h-9 rounded-lg bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-agreement">Agreement reference</Label>
              <Input id="b-agreement" value={form.agreementRef} onChange={(event) => setForm({ ...form, agreementRef: event.target.value })} className="h-9 rounded-lg bg-card" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Countries</Label>
              <div className="flex flex-wrap gap-2">
                {reference.countries.map((country) => {
                  const checked = form.countries.includes(country.code);
                  return (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          countries: checked
                            ? form.countries.filter((code) => code !== country.code)
                            : [...form.countries, country.code],
                        })
                      }
                      className={
                        checked
                          ? "rounded-[4px] bg-primary px-3 py-1.5 text-[0.62rem] font-medium text-primary-foreground"
                          : "rounded-[4px] border border-line px-3 py-1.5 text-[0.62rem] font-medium text-muted-foreground"
                      }
                    >
                      {country.code}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-rate">Commission rate (%)</Label>
              <Input id="b-rate" inputMode="decimal" value={form.commissionRate} onChange={(event) => setForm({ ...form, commissionRate: event.target.value })} className="h-9 rounded-lg bg-card" />
            </div>
            <label className="flex items-center gap-2 self-end text-xs text-muted-foreground">
              <input type="checkbox" checked={form.commissionEnabled} onChange={(event) => setForm({ ...form, commissionEnabled: event.target.checked })} className="accent-[var(--primary)]" />
              Commission enabled for this broker
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-[4px]" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              className="rounded-[4px]"
              disabled={pending || !form.email || !form.orgName || !form.contactName || form.countries.length === 0}
              onClick={async () => {
                setPending(true);
                try {
                  await createProfile({
                    email: form.email,
                    orgName: form.orgName,
                    contactName: form.contactName,
                    phone: form.phone || undefined,
                    countries: form.countries,
                    agreementRef: form.agreementRef || undefined,
                    commissionEnabled: form.commissionEnabled,
                    commissionRate: Number(form.commissionRate || 0),
                  });
                  toast.success("Broker created and notified.");
                  setCreateOpen(false);
                  setForm({ email: "", orgName: "", contactName: "", phone: "", countries: ["GB"], agreementRef: "", commissionEnabled: false, commissionRate: "0" });
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not create the broker.");
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Create broker
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {assignmentsFor && (
        <AssignmentsDialog
          profileId={assignmentsFor.profileId}
          orgName={assignmentsFor.orgName}
          open={Boolean(assignmentsFor)}
          onOpenChange={(open) => !open && setAssignmentsFor(null)}
        />
      )}
    </div>
  );
}

function AssignmentsDialog({
  profileId,
  orgName,
  open,
  onOpenChange,
}: {
  profileId: Id<"brokerProfiles">;
  orgName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const assignments = useQuery(api.brokers.assignments, { brokerProfileId: profileId });
  const brokers = useQuery(api.brokers.list);
  const directory = useQuery(api.customers.directory, { page: 1, pageSize: 50 });
  const assign = useMutation(api.customers.assignBroker);
  const revoke = useMutation(api.brokers.revokeAssignment);
  const setStatus = useMutation(api.brokers.setStatus);
  const [customerId, setCustomerId] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  if (assignments === undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background sm:max-w-[640px]">
          <LoadingState label="Loading assignments" />
        </DialogContent>
      </Dialog>
    );
  }

  const broker = brokers?.find((item) => item._id === profileId);
  const brokerUserId = broker?.userId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {orgName} <StatusPill status={broker?.status ?? "active"} />
          </DialogTitle>
          <DialogDescription>
            Assign customers or revoke access. Every assignment change is audited and notified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-2 rounded-xl border border-line p-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Assign a customer</h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                aria-label="Customer"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                className="h-9 flex-1 rounded-lg border border-line bg-card px-2 text-xs text-ink"
              >
                <option value="">Choose an existing customer…</option>
                {(directory?.rows ?? []).map((row) => (
                  <option key={row.userId} value={row.userId}>
                    {row.fullName} · {row.reference}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                className="h-9 rounded-[4px]"
                disabled={pending || !customerId || !brokerUserId}
                onClick={async () => {
                  setPending(true);
                  try {
                    await assign({ customerUserId: customerId as never, brokerUserId: brokerUserId! });
                    toast.success("Customer assigned.");
                    setCustomerId("");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not assign the customer.");
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <UserPlus className="size-3.5" /> Assign
              </Button>
            </div>
            <p className="text-[0.62rem] text-muted-foreground">
              Showing the first 50 customers. Search the customer directory for someone else.
            </p>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Current assignments</h3>
            {assignments.filter((assignment) => assignment.status === "active").length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No active assignments.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                {assignments
                  .filter((assignment) => assignment.status === "active")
                  .map((assignment) => (
                    <li key={assignment._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                      <div>
                        <p className="text-xs text-ink">{assignment.customerName}</p>
                        <p className="text-[0.6rem] text-muted-foreground">
                          {assignment.customerReference} · {assignment.customerCountry} · assigned{" "}
                          {formatDate(assignment.createdAt)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-[4px] border-destructive/40 bg-transparent text-destructive"
                        disabled={pending || reason.trim().length < 3}
                        onClick={async () => {
                          setPending(true);
                          try {
                            await revoke({ assignmentId: assignment._id, reason });
                            toast.success("Access revoked.");
                            setReason("");
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Could not revoke access.");
                          } finally {
                            setPending(false);
                          }
                        }}
                      >
                        Revoke
                      </Button>
                    </li>
                  ))}
              </ul>
            )}
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason for revoking access (required)"
              className="mt-2 h-9 rounded-lg bg-card text-xs"
            />
          </section>

          <section className="space-y-2 rounded-xl border border-line p-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Broker status</h3>
            <p className="text-[0.65rem] text-muted-foreground">
              Suspending blocks the broker account and all portal access. Assignments remain recorded.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-[4px] bg-transparent"
                disabled={pending || !broker}
                onClick={async () => {
                  setPending(true);
                  try {
                    await setStatus({ brokerProfileId: profileId, status: "active", reason: reason || "Reinstated by staff." });
                    toast.success("Broker reinstated.");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not update the broker.");
                  } finally {
                    setPending(false);
                  }
                }}
              >
                Reinstate
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-[4px] border-destructive/40 bg-transparent text-destructive"
                disabled={pending || reason.trim().length < 3}
                onClick={async () => {
                  setPending(true);
                  try {
                    await setStatus({ brokerProfileId: profileId, status: "suspended", reason });
                    toast.success("Broker suspended.");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not suspend the broker.");
                  } finally {
                    setPending(false);
                  }
                }}
              >
                Suspend
              </Button>
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
