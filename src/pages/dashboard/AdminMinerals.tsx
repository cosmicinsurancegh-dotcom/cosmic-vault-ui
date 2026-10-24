import {
  Callout,
  EmptyState,
  LoadingState,
  MetricTile,
  PageHeader,
  Panel,
  PanelHeader,
  StatusPill,
  TableShell,
  Td,
  Th,
  Timeline,
} from "@/components/dashboard/PlatformUI";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  SHIPMENT_STAGES,
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  shipmentProgress,
  type ShipmentStatus,
} from "@/convex/lib/shipments";
import { formatDate, formatMoney, toMinor } from "@/lib/format";
import { STAFF_PERMISSIONS, can } from "@/lib/permissions";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Gem, Loader2, Plus, Search, Truck, UserRoundPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const UNITS = ["kg", "t", "oz", "ct", "g"];

const COVERAGES = [
  { value: "cargo_transit", label: "Cargo & transit" },
  { value: "all_risk", label: "All risk" },
  { value: "storage", label: "Storage" },
  { value: "liability", label: "Liability" },
] as const;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function inAYear() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function emptyForm() {
  return {
    name: "",
    category: "",
    description: "",
    quantity: "1",
    unit: "kg",
    declaredValue: "",
    currency: "GBP",
    policyNumber: "",
    provider: "",
    coverage: "cargo_transit" as (typeof COVERAGES)[number]["value"],
    coverageLimit: "",
    premium: "",
    startDate: today(),
    endDate: inAYear(),
    policyStatus: "active" as "draft" | "active" | "expired" | "cancelled",
    policyNotes: "",
    carrier: "",
    trackingNumber: "",
    origin: "",
    destination: "",
    departureAt: today(),
    estimatedArrivalAt: "",
    shipmentStatus: "preparing" as ShipmentStatus,
    currentLocation: "",
    shipmentNotes: "",
    assignmentMode: "existing" as "existing" | "new",
    userId: "",
    newName: "",
    newEmail: "",
  };
}

export default function AdminMineralsPage() {
  const { user } = useAuth();
  const canManage = can(
    user?.role,
    user?.permissions,
    STAFF_PERMISSIONS.POLICIES_MANAGE,
  );
  const [search, setSearch] = useState("");
  const rows = useQuery(api.minerals.list, {
    search: search.trim() || undefined,
  });
  const reference = useQuery(api.setup.referenceData);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<Id<"minerals"> | null>(null);

  const stats = useMemo(() => {
    const list = rows ?? [];
    return {
      total: list.length,
      moving: list.filter(
        (row) =>
          row.shipment !== null &&
          row.shipment.status !== "delivered" &&
          row.shipment.status !== "cancelled",
      ).length,
      unassigned: list.filter((row) => !row.mineral.assignedUserId).length,
    };
  }, [rows]);

  if (rows === undefined || reference === undefined) {
    return <LoadingState label="Loading minerals" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mineral logistics"
        title="Insured minerals, tracked end to end."
        description="Record a mineral, bind its policy and shipment, and assign it to the member who owns it. Every shipment status change emails that member automatically."
        actions={
          canManage ? (
            <Button
              className="h-10 rounded-[4px] px-5"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" /> Add mineral
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile
          label="Minerals on record"
          value={stats.total}
          helper="Across every member"
          icon={Gem}
        />
        <MetricTile
          label="Shipments moving"
          value={stats.moving}
          helper="Not yet delivered or cancelled"
          icon={Truck}
        />
        <MetricTile
          label="Awaiting assignment"
          value={stats.unassigned}
          helper="No member attached yet"
          icon={Plus}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Mineral register"
          description="Open a record to update its shipment status. The assigned member is emailed on every change."
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, reference, member"
                aria-label="Search minerals"
                className="h-9 w-full rounded-lg bg-card pl-8 text-xs sm:w-64"
              />
            </div>
          }
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={Gem}
            title="No minerals recorded yet"
            description="Add the first mineral with its policy, shipment details and the member it belongs to."
            action={
              canManage ? (
                <Button
                  className="h-9 rounded-[4px]"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="size-3.5" /> Add mineral
                </Button>
              ) : undefined
            }
          />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Mineral</Th>
                <Th>Declared value</Th>
                <Th>Policy</Th>
                <Th>Shipment</Th>
                <Th>Assigned to</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ mineral, policy, shipment, assignee }) => (
                <tr
                  key={mineral._id}
                  className="transition-colors hover:bg-primary/[0.02]"
                >
                  <Td>
                    <p className="text-xs font-medium text-ink">
                      {mineral.name}
                    </p>
                    <p className="text-[0.62rem] text-muted-foreground">
                      {mineral.reference} · {mineral.category} ·{" "}
                      {mineral.quantity.toLocaleString("en-GB")} {mineral.unit}
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {formatMoney(mineral.declaredValue, mineral.currency)}
                  </Td>
                  <Td>
                    {policy ? (
                      <>
                        <p className="text-xs text-ink">
                          {policy.policyNumber}
                        </p>
                        <p className="text-[0.62rem] text-muted-foreground">
                          {policy.provider} · ends {formatDate(policy.endDate)}
                        </p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">No policy</span>
                    )}
                  </Td>
                  <Td>
                    {shipment ? (
                      <>
                        <p className="text-xs text-ink">
                          {SHIPMENT_STATUS_LABELS[shipment.status]}
                        </p>
                        <p className="text-[0.62rem] text-muted-foreground">
                          {shipment.origin} → {shipment.destination}
                        </p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">No shipment</span>
                    )}
                  </Td>
                  <Td>
                    {assignee ? (
                      <>
                        <p className="text-xs text-ink">{assignee.name}</p>
                        <p className="text-[0.62rem] text-muted-foreground">
                          {assignee.email}
                        </p>
                      </>
                    ) : canManage ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-[4px] bg-transparent px-2 text-[0.62rem]"
                        onClick={() => setDetailId(mineral._id)}
                        title={`Assign ${mineral.name} to a member`}
                      >
                        Assign
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </Td>
                  <Td>
                    <StatusPill status={shipment?.status ?? mineral.status} />
                  </Td>
                  <Td className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-[4px] bg-transparent px-3"
                      onClick={() => setDetailId(mineral._id)}
                    >
                      Manage
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>

      {detailId && (
        <MineralDetailDialog
          mineralId={detailId}
          canManage={canManage}
          onOpenChange={(open) => {
            if (!open) setDetailId(null);
          }}
        />
      )}

      <CreateMineralDialog
        open={createOpen}
        canManage={canManage}
        currencies={reference.currencies
          .filter((currency) => currency.active)
          .map((currency) => currency.code)}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}

function CreateMineralDialog({
  open,
  canManage,
  currencies,
  onOpenChange,
}: {
  open: boolean;
  canManage: boolean;
  currencies: string[];
  onOpenChange: (open: boolean) => void;
}) {
  const create = useMutation(api.minerals.create);
  const assignees = useQuery(api.minerals.assigneeOptions, {});
  const [form, setForm] = useState(emptyForm);
  const [pending, setPending] = useState(false);

  const set = <K extends keyof ReturnType<typeof emptyForm>>(
    key: K,
    value: ReturnType<typeof emptyForm>[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const ready =
    canManage &&
    form.name.trim().length > 1 &&
    form.category.trim().length > 0 &&
    Number(form.quantity) > 0 &&
    form.declaredValue.trim().length > 0 &&
    form.policyNumber.trim().length > 0 &&
    form.provider.trim().length > 0 &&
    form.coverageLimit.trim().length > 0 &&
    form.startDate.length > 0 &&
    form.endDate.length > 0 &&
    form.carrier.trim().length > 0 &&
    form.origin.trim().length > 0 &&
    form.destination.trim().length > 0 &&
    (form.assignmentMode === "existing"
      ? form.userId.length > 0
      : form.newName.trim().length > 1 && form.newEmail.trim().length > 3);

  const submit = async () => {
    setPending(true);
    try {
      await create({
        mineral: {
          name: form.name,
          category: form.category,
          description: form.description || undefined,
          quantity: Number(form.quantity),
          unit: form.unit,
          declaredValue: toMinor(form.declaredValue, "Declared value"),
          currency: form.currency,
        },
        policy: {
          policyNumber: form.policyNumber,
          provider: form.provider,
          coverage: form.coverage,
          coverageLimit: toMinor(form.coverageLimit, "Cover limit"),
          premium: form.premium.trim() ? toMinor(form.premium, "Premium") : 0,
          startDate: form.startDate,
          endDate: form.endDate,
          status: form.policyStatus,
          notes: form.policyNotes || undefined,
        },
        shipment: {
          carrier: form.carrier,
          trackingNumber: form.trackingNumber || undefined,
          origin: form.origin,
          destination: form.destination,
          departureAt: form.departureAt || undefined,
          estimatedArrivalAt: form.estimatedArrivalAt || undefined,
          status: form.shipmentStatus,
          currentLocation: form.currentLocation || undefined,
          notes: form.shipmentNotes || undefined,
        },
        assignment:
          form.assignmentMode === "existing"
            ? {
                mode: "existing" as const,
                userId: form.userId as Id<"users">,
              }
            : {
                mode: "new" as const,
                newUser: { name: form.newName, email: form.newEmail },
              },
      });
      toast.success("Mineral recorded. The assigned member has been emailed.");
      setForm(emptyForm());
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not record the mineral.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Add a mineral</DialogTitle>
          <DialogDescription>
            Record the mineral, its policy and its first shipment, then assign
            it to a member. Choose an existing account or create one from an
            email address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <section className="space-y-3 rounded-xl border border-line p-4">
            <h3 className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              1 · Mineral
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="m-name">Mineral name</Label>
                <Input
                  id="m-name"
                  value={form.name}
                  onChange={(event) => set("name", event.target.value)}
                  placeholder="Gold bullion, 999.9"
                  className="h-9 rounded-lg bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-category">Category</Label>
                <Input
                  id="m-category"
                  value={form.category}
                  onChange={(event) => set("category", event.target.value)}
                  placeholder="Precious metals"
                  className="h-9 rounded-lg bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-quantity">Quantity</Label>
                <div className="flex gap-2">
                  <Input
                    id="m-quantity"
                    inputMode="decimal"
                    value={form.quantity}
                    onChange={(event) => set("quantity", event.target.value)}
                    className="h-9 rounded-lg bg-card"
                  />
                  <select
                    aria-label="Unit"
                    value={form.unit}
                    onChange={(event) => set("unit", event.target.value)}
                    className="h-9 w-24 rounded-lg border border-line bg-card px-2 text-xs text-ink"
                  >
                    {UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-value">Declared value</Label>
                <div className="flex gap-2">
                  <Input
                    id="m-value"
                    inputMode="decimal"
                    value={form.declaredValue}
                    onChange={(event) =>
                      set("declaredValue", event.target.value)
                    }
                    placeholder="250000"
                    className="h-9 rounded-lg bg-card"
                  />
                  <select
                    aria-label="Currency"
                    value={form.currency}
                    onChange={(event) => set("currency", event.target.value)}
                    className="h-9 w-24 rounded-lg border border-line bg-card px-2 text-xs text-ink"
                  >
                    {(currencies.length > 0 ? currencies : ["GBP"]).map(
                      (currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="m-description">Description (optional)</Label>
                <Textarea
                  id="m-description"
                  value={form.description}
                  onChange={(event) => set("description", event.target.value)}
                  rows={2}
                  className="rounded-lg bg-card text-xs"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-line p-4">
            <h3 className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              2 · Policy
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-number">Policy number</Label>
                <Input
                  id="p-number"
                  value={form.policyNumber}
                  onChange={(event) => set("policyNumber", event.target.value)}
                  placeholder="CV-MIN-ROLL-2026-014"
                  className="h-9 rounded-lg bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-provider">Provider</Label>
                <Input
                  id="p-provider"
                  value={form.provider}
                  onChange={(event) => set("provider", event.target.value)}
                  placeholder="Cosmic Vault Insurance"
                  className="h-9 rounded-lg bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-coverage">Cover type</Label>
                <select
                  id="p-coverage"
                  value={form.coverage}
                  onChange={(event) =>
                    set("coverage", event.target.value as typeof form.coverage)
                  }
                  className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
                >
                  {COVERAGES.map((coverage) => (
                    <option key={coverage.value} value={coverage.value}>
                      {coverage.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-status">Policy status</Label>
                <select
                  id="p-status"
                  value={form.policyStatus}
                  onChange={(event) =>
                    set(
                      "policyStatus",
                      event.target.value as typeof form.policyStatus,
                    )
                  }
                  className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="expired">Expired</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-limit">Cover limit ({form.currency})</Label>
                <Input
                  id="p-limit"
                  inputMode="decimal"
                  value={form.coverageLimit}
                  onChange={(event) => set("coverageLimit", event.target.value)}
                  className="h-9 rounded-lg bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-premium">Premium ({form.currency})</Label>
                <Input
                  id="p-premium"
                  inputMode="decimal"
                  value={form.premium}
                  onChange={(event) => set("premium", event.target.value)}
                  className="h-9 rounded-lg bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-start">Cover starts</Label>
                <Input
                  id="p-start"
                  type="date"
                  value={form.startDate}
                  onChange={(event) => set("startDate", event.target.value)}
                  className="h-9 rounded-lg bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-end">Cover ends</Label>
                <Input
                  id="p-end"
                  type="date"
                  value={form.endDate}
                  onChange={(event) => set("endDate", event.target.value)}
                  className="h-9 rounded-lg bg-card"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="p-notes">Policy notes (optional)</Label>
                <Textarea
                  id="p-notes"
                  value={form.policyNotes}
                  onChange={(event) => set("policyNotes", event.target.value)}
                  rows={2}
                  className="rounded-lg bg-card text-xs"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-line p-4">
            <h3 className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              3 · Shipment
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="s-carrier">Carrier</Label>
                <Input
                  id="s-carrier"
                  value={form.carrier}
                  onChange={(event) => set("carrier", event.target.value)}
                  placeholder="Brink's Global Services"
                  className="h-9 rounded-lg bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-tracking">Tracking number (optional)</Label>
                <Input
                  id="s-tracking"
                  value={form.trackingNumber}
                  onChange={(event) =>
                    set("trackingNumber", event.target.value)
                  }
                  className="h-9 rounded-lg bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-origin">Origin</Label>
                <Input
                  id="s-origin"
                  value={form.origin}
                  onChange={(event) => set("origin", event.target.value)}
                  placeholder="Zurich, CH"
                  className="h-9 rounded-lg bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-destination">Destination</Label>
                <Input
                  id="s-destination"
                  value={form.destination}
                  onChange={(event) => set("destination", event.target.value)}
                  placeholder="London, GB"
                  className="h-9 rounded-lg bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-departure">Departure</Label>
                <Input
                  id="s-departure"
                  type="date"
                  value={form.departureAt}
                  onChange={(event) => set("departureAt", event.target.value)}
                  className="h-9 rounded-lg bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-eta">Estimated arrival</Label>
                <Input
                  id="s-eta"
                  type="date"
                  value={form.estimatedArrivalAt}
                  onChange={(event) =>
                    set("estimatedArrivalAt", event.target.value)
                  }
                  className="h-9 rounded-lg bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-status">Starting status</Label>
                <select
                  id="s-status"
                  value={form.shipmentStatus}
                  onChange={(event) =>
                    set("shipmentStatus", event.target.value as ShipmentStatus)
                  }
                  className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
                >
                  {SHIPMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {SHIPMENT_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-location">Current location (optional)</Label>
                <Input
                  id="s-location"
                  value={form.currentLocation}
                  onChange={(event) =>
                    set("currentLocation", event.target.value)
                  }
                  className="h-9 rounded-lg bg-card"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="s-notes">Shipment notes (optional)</Label>
                <Textarea
                  id="s-notes"
                  value={form.shipmentNotes}
                  onChange={(event) => set("shipmentNotes", event.target.value)}
                  rows={2}
                  className="rounded-lg bg-card text-xs"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-line p-4">
            <h3 className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              4 · Assign to a member
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => set("assignmentMode", "existing")}
                className={
                  form.assignmentMode === "existing"
                    ? "rounded-[4px] bg-primary px-3 py-1.5 text-[0.68rem] font-medium text-primary-foreground"
                    : "rounded-[4px] border border-line px-3 py-1.5 text-[0.68rem] font-medium text-muted-foreground"
                }
              >
                Choose an existing account
              </button>
              <button
                type="button"
                onClick={() => set("assignmentMode", "new")}
                className={
                  form.assignmentMode === "new"
                    ? "rounded-[4px] bg-primary px-3 py-1.5 text-[0.68rem] font-medium text-primary-foreground"
                    : "rounded-[4px] border border-line px-3 py-1.5 text-[0.68rem] font-medium text-muted-foreground"
                }
              >
                Create a new member
              </button>
            </div>

            {form.assignmentMode === "existing" ? (
              <div className="space-y-1.5">
                <Label htmlFor="a-user">Member</Label>
                <select
                  id="a-user"
                  value={form.userId}
                  onChange={(event) => set("userId", event.target.value)}
                  className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
                >
                  <option value="">Choose a customer or broker…</option>
                  {(assignees ?? []).map((assignee) => (
                    <option key={assignee.userId} value={assignee.userId}>
                      {assignee.name} · {assignee.email}
                      {assignee.role === "broker" ? " (broker)" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[0.62rem] text-muted-foreground">
                  Only customer and broker accounts can own a mineral.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="a-name">Full name</Label>
                  <Input
                    id="a-name"
                    value={form.newName}
                    onChange={(event) => set("newName", event.target.value)}
                    className="h-9 rounded-lg bg-card"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="a-email">Email</Label>
                  <Input
                    id="a-email"
                    type="email"
                    value={form.newEmail}
                    onChange={(event) => set("newEmail", event.target.value)}
                    className="h-9 rounded-lg bg-card"
                  />
                </div>
                <p className="text-[0.62rem] leading-5 text-muted-foreground sm:col-span-2">
                  The account is created now and becomes sign-in capable when
                  the member signs in with this email using a one-time code. If
                  the email already belongs to a member, that account is reused.
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="rounded-[4px]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="rounded-[4px]"
            disabled={pending || !ready}
            onClick={submit}
          >
            {pending && <Loader2 className="size-4 animate-spin" />} Add mineral
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Owner controls for a mineral that is already on record. Assignment travels
 * with the record: every shipment attached to the mineral moves too, the new
 * owner is emailed and the previous owner gets an in-app notice.
 */
function AssignmentSection({
  mineralId,
  currentAssigneeId,
  canManage,
}: {
  mineralId: Id<"minerals">;
  currentAssigneeId?: Id<"users">;
  canManage: boolean;
}) {
  const reassign = useMutation(api.minerals.reassign);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const options = useQuery(api.minerals.assigneeOptions, {
    search: search.trim() || undefined,
  });

  if (!canManage) return null;

  const selectedOption = (options ?? []).find(
    (option) => option.userId === userId,
  );
  const targetLabel =
    mode === "existing"
      ? selectedOption
        ? `${selectedOption.name} · ${selectedOption.email}`
        : ""
      : newName.trim()
        ? `${newName.trim()} · ${newEmail.trim()}`
        : "";
  const sameOwner =
    mode === "existing" && Boolean(userId) && userId === currentAssigneeId;
  const ready =
    mode === "existing"
      ? userId.length > 0 && !sameOwner
      : newName.trim().length > 1 && newEmail.includes("@");

  const submit = async () => {
    setPending(true);
    try {
      const result = await reassign({
        mineralId,
        assignment:
          mode === "existing"
            ? { mode: "existing" as const, userId: userId as Id<"users"> }
            : {
                mode: "new" as const,
                newUser: { name: newName, email: newEmail },
              },
        note: note.trim() || undefined,
      });
      toast.success(
        result.isNewAccount
          ? "Reassigned. A member account was created and invited."
          : result.notified
            ? "Reassigned. The new owner has been emailed."
            : "Reassigned. No owner email was sent.",
      );
      setUserId("");
      setNewName("");
      setNewEmail("");
      setNote("");
      setSearch("");
      setConfirmOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not reassign the mineral.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-line p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[4px] border border-line bg-card text-primary">
          <UserRoundPlus className="size-3.5" />
        </span>
        <div>
          <h3 className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Change owner
          </h3>
          <p className="mt-1 text-[0.65rem] leading-5 text-muted-foreground">
            Assign this mineral to another customer or broker. Every shipment
            attached to it moves with the record, and the new owner is emailed.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("existing")}
          className={
            mode === "existing"
              ? "rounded-[4px] bg-primary px-3 py-1.5 text-[0.68rem] font-medium text-primary-foreground"
              : "rounded-[4px] border border-line px-3 py-1.5 text-[0.68rem] font-medium text-muted-foreground"
          }
        >
          Choose an existing account
        </button>
        <button
          type="button"
          onClick={() => setMode("new")}
          className={
            mode === "new"
              ? "rounded-[4px] bg-primary px-3 py-1.5 text-[0.68rem] font-medium text-primary-foreground"
              : "rounded-[4px] border border-line px-3 py-1.5 text-[0.68rem] font-medium text-muted-foreground"
          }
        >
          Create a new member
        </button>
      </div>

      {mode === "existing" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email"
              aria-label="Search member accounts"
              className="h-9 rounded-lg bg-card pl-8 text-xs"
            />
          </div>
          <select
            aria-label="New owner"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
          >
            <option value="">Choose a customer or broker…</option>
            {(options ?? []).map((option) => (
              <option key={option.userId} value={option.userId}>
                {option.name} · {option.email}
                {option.role === "broker" ? " (broker)" : ""}
                {option.userId === currentAssigneeId ? " — current owner" : ""}
              </option>
            ))}
          </select>
          {sameOwner && (
            <p className="text-[0.62rem] text-muted-foreground sm:col-span-2">
              This account already owns the mineral.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="assign-new-name">Full name</Label>
            <Input
              id="assign-new-name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              className="h-9 rounded-lg bg-card text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assign-new-email">Email</Label>
            <Input
              id="assign-new-email"
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              className="h-9 rounded-lg bg-card text-xs"
            />
          </div>
          <p className="text-[0.62rem] leading-5 text-muted-foreground sm:col-span-2">
            The account is created now and becomes sign-in capable when the
            member signs in with this email using a one-time code. An existing
            account with the same email is reused.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="assign-note">Reason for the change (optional)</Label>
        <Input
          id="assign-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Recorded in the audit log"
          className="h-9 rounded-lg bg-card text-xs"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <p className="max-w-sm text-[0.62rem] leading-5 text-muted-foreground">
          The new owner is emailed immediately; the previous owner is notified
          in their dashboard.
        </p>
        <Button
          size="sm"
          className="h-9 rounded-[4px] px-4"
          disabled={!ready || pending}
          onClick={() => setConfirmOpen(true)}
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          Reassign mineral
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-[4px] border-line bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>Reassign this mineral?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be owned by {targetLabel || "the new account"}, and every
              shipment recorded against it moves as well. The previous owner
              loses access to it in their dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[4px]" disabled={pending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-[4px]"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              Reassign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function MineralDetailDialog({
  mineralId,
  canManage,
  onOpenChange,
}: {
  mineralId: Id<"minerals">;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const detail = useQuery(api.minerals.detail, { mineralId });
  const updateStatus = useMutation(api.minerals.updateShipmentStatus);
  const [status, setStatus] = useState<ShipmentStatus | "">("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  if (detail === undefined) {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background sm:max-w-[720px]">
          <LoadingState label="Loading mineral" />
        </DialogContent>
      </Dialog>
    );
  }
  if (detail === null) {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent className="rounded-[4px] border-line bg-background sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Mineral not found</DialogTitle>
            <DialogDescription>
              This record may have been removed. Close the dialog and refresh.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const { mineral, policy, shipment, events, assignee } = detail;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {mineral.name}
            <StatusPill status={shipment?.status ?? mineral.status} />
          </DialogTitle>
          <DialogDescription>
            {mineral.reference} · {mineral.category} ·{" "}
            {mineral.quantity.toLocaleString("en-GB")} {mineral.unit} ·{" "}
            {formatMoney(mineral.declaredValue, mineral.currency)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <section className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-2">
            <div>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Assigned to
              </p>
              <p className="mt-1 text-sm text-ink">
                {assignee ? assignee.name : "Unassigned"}
              </p>
              <p className="text-[0.65rem] text-muted-foreground">
                {assignee?.email ?? "No member attached to this mineral."}
              </p>
            </div>
            <div>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Policy
              </p>
              <p className="mt-1 text-sm text-ink">
                {policy ? policy.policyNumber : "No policy recorded"}
              </p>
              {policy && (
                <p className="text-[0.65rem] leading-5 text-muted-foreground">
                  {policy.provider} · cover limit{" "}
                  {formatMoney(policy.coverageLimit, policy.currency)} · ends{" "}
                  {formatDate(policy.endDate)}
                </p>
              )}
            </div>
          </section>

          <AssignmentSection
            mineralId={mineral._id}
            currentAssigneeId={mineral.assignedUserId}
            canManage={canManage}
          />

          {shipment && (
            <section className="space-y-3 rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Shipment {shipment.reference}
                  </p>
                  <p className="mt-1 text-sm text-ink">
                    {shipment.origin} → {shipment.destination}
                  </p>
                  <p className="text-[0.65rem] text-muted-foreground">
                    {shipment.carrier}
                    {shipment.trackingNumber
                      ? ` · ${shipment.trackingNumber}`
                      : ""}
                    {shipment.estimatedArrivalAt
                      ? ` · ETA ${formatDate(shipment.estimatedArrivalAt)}`
                      : ""}
                  </p>
                </div>
                <StatusPill status={shipment.status} />
              </div>

              <div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${shipmentProgress(shipment.status)}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="h-full rounded-full bg-primary"
                  />
                </div>
                <div className="mt-2 flex justify-between text-[0.58rem] uppercase tracking-[0.1em] text-muted-foreground">
                  {SHIPMENT_STAGES.map((stage) => (
                    <span key={stage.key}>{stage.label}</span>
                  ))}
                </div>
              </div>

              {canManage && (
                <div className="space-y-2 border-t border-line pt-3">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Update shipment status
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      aria-label="New shipment status"
                      value={status}
                      onChange={(event) =>
                        setStatus(event.target.value as ShipmentStatus | "")
                      }
                      className="h-9 rounded-lg border border-line bg-card px-2 text-xs text-ink"
                    >
                      <option value="">Choose the next status…</option>
                      {SHIPMENT_STATUSES.filter(
                        (option) => option !== shipment.status,
                      ).map((option) => (
                        <option key={option} value={option}>
                          {SHIPMENT_STATUS_LABELS[option]}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      placeholder={`Location (${shipment.currentLocation ?? "optional"})`}
                      aria-label="Shipment location"
                      className="h-9 rounded-lg bg-card text-xs"
                    />
                  </div>
                  <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Note for the member (optional)"
                    aria-label="Shipment note"
                    rows={2}
                    className="rounded-lg bg-card text-xs"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[0.62rem] leading-5 text-muted-foreground">
                      Saving emails {assignee?.email ?? "the assigned member"}{" "}
                      immediately with the shipment update.
                    </p>
                    <Button
                      size="sm"
                      className="h-9 rounded-[4px]"
                      disabled={pending || !status}
                      onClick={async () => {
                        if (!status) return;
                        setPending(true);
                        try {
                          const result = await updateStatus({
                            shipmentId: shipment._id,
                            status,
                            location: location.trim() || undefined,
                            note: note.trim() || undefined,
                          });
                          toast.success(
                            result.notified
                              ? "Status updated and the member was emailed."
                              : "Status updated. No member email was sent.",
                          );
                          setStatus("");
                          setLocation("");
                          setNote("");
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Could not update the shipment.",
                          );
                        } finally {
                          setPending(false);
                        }
                      }}
                    >
                      {pending && <Loader2 className="size-3.5 animate-spin" />}{" "}
                      Update status
                    </Button>
                  </div>
                </div>
              )}

              <div className="border-t border-line pt-3">
                <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Shipment history
                </p>
                <Timeline
                  items={events.map((event) => ({
                    title: SHIPMENT_STATUS_LABELS[event.status],
                    body: [event.location, event.note]
                      .filter(Boolean)
                      .join(" · "),
                    at: event.createdAt,
                  }))}
                />
              </div>
            </section>
          )}

          {mineral.description && (
            <Callout tone="info" title="Notes">
              {mineral.description}
            </Callout>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            variant="outline"
            className="rounded-[4px]"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
