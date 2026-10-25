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
import { ShipmentRouteRail } from "@/components/dashboard/ShipmentRouteRail";
import { ShipmentFormDialog } from "@/components/vault/ShipmentFormDialog";
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
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  type ShipmentStatus,
} from "@/convex/lib/shipments";
import { formatDate, formatMoney, toMinor } from "@/lib/format";
import { STAFF_PERMISSIONS, can } from "@/lib/permissions";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Gem,
  Loader2,
  Plus,
  Search,
  Truck,
  UserRoundPlus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const UNITS = ["kg", "t", "oz", "ct", "g"];

const COVERAGES = [
  { value: "cargo_transit", label: "Cargo & transit" },
  { value: "all_risk", label: "All risk" },
  { value: "storage", label: "Storage" },
  { value: "liability", label: "Liability" },
] as const;

/**
 * The create flow runs one step at a time: the mineral itself, its policy, and
 * the member who owns it. A shipment is not part of recording a holding - it is
 * booked later, either from the member's request or on staff instruction.
 */
const CREATE_STEPS = [
  { key: "mineral", label: "Mineral" },
  { key: "policy", label: "Policy" },
  { key: "member", label: "Member" },
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
              {rows.map(({ mineral, policy, shipment, request, assignee }) => (
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
                    ) : request?.status === "pending" ? (
                      <>
                        <p className="text-xs text-ink">Requested</p>
                        <p className="text-[0.62rem] text-muted-foreground">
                          {request.destination}
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
  const [step, setStep] = useState(0);

  const set = <K extends keyof ReturnType<typeof emptyForm>>(
    key: K,
    value: ReturnType<typeof emptyForm>[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const stepChecks: Record<
    (typeof CREATE_STEPS)[number]["key"],
    () => boolean
  > = {
    mineral: () =>
      form.name.trim().length > 1 &&
      form.category.trim().length > 0 &&
      Number(form.quantity) > 0 &&
      form.declaredValue.trim().length > 0,
    policy: () =>
      form.policyNumber.trim().length > 0 &&
      form.provider.trim().length > 0 &&
      form.coverageLimit.trim().length > 0 &&
      form.startDate.length > 0 &&
      form.endDate.length > 0,
    member: () =>
      form.assignmentMode === "existing"
        ? form.userId.length > 0
        : form.newName.trim().length > 1 && form.newEmail.trim().length > 3,
  };

  const lastStep = CREATE_STEPS.length - 1;
  const stepReady = (index: number) =>
    canManage && stepChecks[CREATE_STEPS[index].key]();
  const ready = CREATE_STEPS.every((_, index) => stepReady(index));

  const handleOpenChange = (next: boolean) => {
    if (!next && !pending) setStep(0);
    onOpenChange(next);
  };

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
      setStep(0);
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Add a mineral</DialogTitle>
          <DialogDescription>
            Three short steps: the mineral, its policy and the member who owns
            it. A shipment is booked separately, once the member asks for one.
            Move back at any point before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <ol className="grid grid-cols-3 gap-2">
            {CREATE_STEPS.map((entry, index) => {
              const complete = index < step && stepReady(index);
              const current = index === step;
              const reachable = CREATE_STEPS.every(
                (_, earlier) => earlier >= index || stepReady(earlier),
              );
              return (
                <li key={entry.key}>
                  <button
                    type="button"
                    aria-current={current ? "step" : undefined}
                    disabled={!reachable || pending}
                    onClick={() => setStep(index)}
                    className={`flex w-full items-center gap-2 rounded-[4px] border px-2.5 py-1.5 text-[0.68rem] font-medium transition-colors disabled:cursor-not-allowed ${
                      current
                        ? "border-primary/40 bg-primary/5 text-ink"
                        : complete || reachable
                          ? "border-line text-muted-foreground hover:bg-muted/60"
                          : "border-line text-muted-foreground/50"
                    }`}
                  >
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-full border text-[0.6rem] ${
                        complete
                          ? "border-primary bg-primary text-primary-foreground"
                          : current
                            ? "border-primary text-primary"
                            : "border-line"
                      }`}
                    >
                      {complete ? (
                        <Check className="size-3" />
                      ) : (
                        (index + 1).toString()
                      )}
                    </span>
                    <span className="truncate">{entry.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="h-0.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{
                width: `${((step + 1) / CREATE_STEPS.length) * 100}%`,
              }}
            />
          </div>
        </div>

        <div className="space-y-3">
          {step === 0 && (
            <section className="space-y-3 rounded-xl border border-line p-4">
              <h3 className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Mineral details
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
          )}

          {step === 1 && (
            <section className="space-y-3 rounded-xl border border-line p-4">
              <h3 className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Policy details
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="p-number">Policy number</Label>
                  <Input
                    id="p-number"
                    value={form.policyNumber}
                    onChange={(event) =>
                      set("policyNumber", event.target.value)
                    }
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
                      set(
                        "coverage",
                        event.target.value as typeof form.coverage,
                      )
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
                    onChange={(event) =>
                      set("coverageLimit", event.target.value)
                    }
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
          )}

          {step === 2 && (
            <section className="space-y-3 rounded-xl border border-line p-4">
              <h3 className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Assign to a member
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
                    the member signs in with this email using a one-time code.
                    If the email already belongs to a member, that account is
                    reused.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>

        {!stepReady(step) && (
          <p className="text-[0.62rem] leading-5 text-muted-foreground">
            Complete the required fields on this step to continue.
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="outline"
            className="rounded-[4px]"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {step > 0 && (
              <Button
                variant="outline"
                className="rounded-[4px]"
                disabled={pending}
                onClick={() => setStep((current) => current - 1)}
              >
                <ArrowLeft className="size-4" /> Back
              </Button>
            )}
            {step < lastStep ? (
              <Button
                className="rounded-[4px]"
                disabled={!stepReady(step)}
                onClick={() => setStep((current) => current + 1)}
              >
                Next <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                className="rounded-[4px]"
                disabled={pending || !ready}
                onClick={submit}
              >
                {pending && <Loader2 className="size-4 animate-spin" />} Add
                mineral
              </Button>
            )}
          </div>
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
  /* Reassigning is rare: the form stays folded until staff ask for it, so the
     record reads as policy, shipment and history. */
  const [expanded, setExpanded] = useState(false);
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
      setMode("existing");
      setConfirmOpen(false);
      setExpanded(false);
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

  /** Closing the form discards the draft, so a half-filled move never lingers. */
  const collapse = () => {
    if (pending) return;
    setExpanded(false);
    setMode("existing");
    setUserId("");
    setNewName("");
    setNewEmail("");
    setNote("");
    setSearch("");
  };

  return (
    <section className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Change owner
          </h3>
          <p className="mt-0.5 text-[0.62rem] leading-5 text-muted-foreground">
            The policy and every consignment move with it.
          </p>
        </div>
        {!expanded && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-[4px] bg-transparent px-3 text-[0.65rem]"
            onClick={() => setExpanded(true)}
          >
            <UserRoundPlus className="size-3.5" />
            Reassign
          </Button>
        )}
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div
            role="group"
            aria-label="Assignment mode"
            className="flex flex-wrap gap-1.5"
          >
            <button
              type="button"
              onClick={() => setMode("existing")}
              aria-pressed={mode === "existing"}
              className={
                mode === "existing"
                  ? "rounded-[4px] bg-primary px-2.5 py-1 text-[0.6rem] font-medium text-primary-foreground"
                  : "rounded-[4px] border border-line px-2.5 py-1 text-[0.6rem] font-medium text-muted-foreground transition-colors hover:text-ink"
              }
            >
              Choose an existing account
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              aria-pressed={mode === "new"}
              className={
                mode === "new"
                  ? "rounded-[4px] bg-primary px-2.5 py-1 text-[0.6rem] font-medium text-primary-foreground"
                  : "rounded-[4px] border border-line px-2.5 py-1 text-[0.6rem] font-medium text-muted-foreground transition-colors hover:text-ink"
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
                    {option.userId === currentAssigneeId
                      ? " — current owner"
                      : ""}
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
                Created now; an account with this email is reused instead.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="assign-note">
              Reason for the change (optional)
            </Label>
            <Input
              id="assign-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Recorded in the audit log"
              className="h-9 rounded-lg bg-card text-xs"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="h-8 rounded-[4px] bg-transparent px-3 text-[0.65rem]"
              disabled={pending}
              onClick={collapse}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 rounded-[4px] px-3 text-[0.65rem]"
              disabled={!ready || pending}
              onClick={() => setConfirmOpen(true)}
            >
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              Reassign mineral
            </Button>
          </div>
        </div>
      )}

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
  const createShipment = useMutation(api.minerals.createShipment);
  const [status, setStatus] = useState<ShipmentStatus | "">("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [booking, setBooking] = useState(false);
  /* A status change is only relevant while the consignment moves, so the
     fields stay folded until staff need to publish one. */
  const [updating, setUpdating] = useState(false);
  /* The history is reference: its last entry stands in until it is opened. */
  const [historyOpen, setHistoryOpen] = useState(false);

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
  /* A closed consignment does not stop the mineral being shipped again. */
  const activeShipment =
    shipment &&
    shipment.status !== "delivered" &&
    shipment.status !== "cancelled"
      ? shipment
      : null;

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

          {shipment && (
            <section className="space-y-3 rounded-xl border border-line p-4">
              {/* The rail below carries the route, carrier and estimate, so the
                  header only names the consignment and its tracking number. */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Shipment {shipment.reference}
                  </p>
                  <p className="mt-1 truncate text-[0.65rem] text-muted-foreground">
                    {shipment.carrier}
                    {shipment.trackingNumber
                      ? ` · ${shipment.trackingNumber}`
                      : ""}
                  </p>
                </div>
                {/* The pill stands beside an action, so it takes the same height
                    as the button rather than sitting short against it. */}
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill
                    status={shipment.status}
                    className="h-8 text-[0.65rem]"
                  />
                  {canManage && !updating && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-[4px] bg-transparent px-3 text-[0.65rem]"
                      onClick={() => setUpdating(true)}
                    >
                      Update status
                    </Button>
                  )}
                </div>
              </div>

              <ShipmentRouteRail shipment={shipment} events={events} />

              {canManage && updating && (
                <div className="space-y-2 border-t border-line pt-3">
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
                      Emailed to {assignee?.email ?? "the assigned member"}.
                      Failed sends are under Settings → Email delivery.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="h-8 rounded-[4px] bg-transparent px-3 text-[0.65rem]"
                        disabled={pending}
                        onClick={() => {
                          setUpdating(false);
                          setStatus("");
                          setLocation("");
                          setNote("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 rounded-[4px] px-3 text-[0.65rem]"
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
                                ? `Status updated. The email is queued to ${assignee?.email ?? "the member"}.`
                                : "Status updated. No member email was sent.",
                            );
                            setStatus("");
                            setLocation("");
                            setNote("");
                            setUpdating(false);
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
                        {pending && (
                          <Loader2 className="size-3.5 animate-spin" />
                        )}{" "}
                        Update status
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-line pt-3">
                <button
                  type="button"
                  aria-expanded={historyOpen}
                  onClick={() => setHistoryOpen((open) => !open)}
                  className="flex w-full items-start justify-between gap-2 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Shipment history
                    </span>
                    {/* The latest entry stands in for the timeline until it is
                        opened, so the record stays short by default. */}
                    <span className="mt-0.5 block truncate text-[0.62rem] leading-5 text-muted-foreground">
                      {events.length === 0
                        ? "No updates recorded yet."
                        : [
                            SHIPMENT_STATUS_LABELS[events[0].status],
                            events[0].location,
                            formatDate(events[0].createdAt),
                            `${events.length} update${events.length === 1 ? "" : "s"}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                    </span>
                  </span>
                  <ChevronDown
                    className={
                      historyOpen
                        ? "mt-1 size-3.5 shrink-0 rotate-180 text-muted-foreground transition-transform"
                        : "mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform"
                    }
                  />
                </button>

                {historyOpen && (
                  <div className="mt-3">
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
                )}
              </div>
            </section>
          )}

          {canManage && !activeShipment && (
            <section className="space-y-3 rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Shipment
                  </h3>
                  <p className="mt-1 text-[0.65rem] leading-5 text-muted-foreground">
                    {shipment
                      ? "The last consignment is closed. Book another one if this mineral needs to move again."
                      : "Nothing is booked for this mineral. Members request a shipment themselves; record one here for an instruction taken off the system."}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-9 rounded-[4px] px-4"
                  onClick={() => setBooking(true)}
                >
                  <Truck className="size-3.5" /> Record shipment
                </Button>
              </div>
            </section>
          )}

          {mineral.description && (
            <Callout tone="info" title="Notes">
              {mineral.description}
            </Callout>
          )}

          {/* Ownership last: it is the least frequent change on a record, so it
              sits below the policy and shipment staff usually come here for. */}
          <AssignmentSection
            mineralId={mineral._id}
            currentAssigneeId={mineral.assignedUserId}
            canManage={canManage}
          />
        </div>

        {booking && (
          <ShipmentFormDialog
            open
            title="Record a shipment"
            description={`${mineral.name} · ${mineral.reference}. The owner is emailed the route, carrier and dates as soon as it is booked.`}
            submitLabel="Book shipment"
            onSubmit={async (values) => {
              await createShipment({
                mineralId: mineral._id,
                shipment: values,
              });
              toast.success("Shipment booked.", {
                description: assignee
                  ? `Email queued to ${assignee.email}.`
                  : "No owner is assigned, so no email was sent.",
              });
              setBooking(false);
            }}
            onOpenChange={(open) => {
              if (!open) setBooking(false);
            }}
          />
        )}

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
