import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssignMineralDialog } from "@/components/vault/AssignMineralDialog";
import {
  EmptyState,
  LoadingState,
  MetricTile,
  PageHeader,
  Panel,
  PanelHeader,
  StatusPill,
} from "@/components/dashboard/PlatformUI";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  type ShipmentStatus,
} from "@/convex/lib/shipments";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/format";
import { STAFF_PERMISSIONS, can } from "@/lib/permissions";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  AlertTriangle,
  ArrowRightLeft,
  Loader2,
  PackageCheck,
  Search,
  Truck,
  UserRoundPlus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type RegisterRow = FunctionReturnType<typeof api.minerals.list>[number];
type ShipmentRow = RegisterRow & { shipment: NonNullable<RegisterRow["shipment"]> };

function hasShipment(row: RegisterRow): row is ShipmentRow {
  return row.shipment !== null;
}

/**
 * Staff shipment control, backed by the live mineral register.
 *
 * A consignment belongs to a mineral, so assigning one to an account moves the
 * mineral and every shipment attached to it. The server records the change in
 * the audit log, emails the new owner and notifies the previous one.
 */
export default function AdminShipmentsPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const canManage = can(
    user?.role,
    user?.permissions,
    STAFF_PERMISSIONS.POLICIES_MANAGE,
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ShipmentStatus | "all">("all");
  const [assigningId, setAssigningId] = useState<Id<"minerals"> | null>(null);
  const [updatingId, setUpdatingId] = useState<Id<"shipments"> | null>(null);

  const rows = useQuery(api.minerals.list, canManage ? {} : "skip");
  const updateStatus = useMutation(api.minerals.updateShipmentStatus);

  const shipments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (rows ?? [])
      .filter(hasShipment)
      .filter((row) => status === "all" || row.shipment.status === status)
      .filter((row) => {
        if (!query) return true;
        return [
          row.shipment.reference,
          row.shipment.trackingNumber ?? "",
          row.shipment.carrier,
          row.shipment.origin,
          row.shipment.destination,
          row.mineral.name,
          row.mineral.reference,
          row.assignee?.name ?? "",
          row.assignee?.email ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort(
        (a, b) =>
          (a.shipment.estimatedArrivalAt ?? a.shipment.createdAt) -
          (b.shipment.estimatedArrivalAt ?? b.shipment.createdAt),
      );
  }, [rows, search, status]);

  const metrics = useMemo(() => {
    const all = (rows ?? []).filter(hasShipment);
    return {
      total: all.length,
      active: all.filter(
        (row) =>
          row.shipment.status !== "delivered" &&
          row.shipment.status !== "cancelled",
      ).length,
      attention: all.filter(
        (row) =>
          row.shipment.status === "customs_hold" ||
          row.shipment.status === "delayed",
      ).length,
      unassigned: all.filter((row) => !row.mineral.assignedUserId).length,
    };
  }, [rows]);

  const assigning =
    (rows ?? []).filter(hasShipment).find(
      (row) => row.mineral._id === assigningId,
    ) ?? null;

  const changeStatus = async ({
    mineral,
    shipment,
  }: Pick<ShipmentRow, "mineral" | "shipment">, next: ShipmentStatus) => {
    if (next === shipment.status) return;
    setUpdatingId(shipment._id);
    try {
      const result = await updateStatus({ shipmentId: shipment._id, status: next });
      const label = SHIPMENT_STATUS_LABELS[next].toLowerCase();
      if (result.notified) {
        toast.success(`${mineral.name} is now ${label}.`, {
          description: "The owner has been emailed.",
        });
      } else {
        toast.warning(`${mineral.name} is now ${label}.`, {
          description: "No owner is assigned, so no email was sent.",
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update the shipment status.",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  if (authLoading) return <LoadingState label="Loading shipments" />;

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Vault operations"
          title="Every consignment, under control."
          description="Shipment control reads the live mineral register and is limited to staff who can manage mineral records."
        />
        <Panel>
          <EmptyState
            icon={Truck}
            title="Access restricted"
            description="Ask a super admin to grant you the 'Issue & service policies' permission to view and assign consignments."
          />
        </Panel>
      </div>
    );
  }

  if (rows === undefined) {
    return <LoadingState label="Loading shipments" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            Vault operations
            <span className="size-1 rounded-[4px] bg-primary/60" />
            Shipment control
          </>
        }
        title="Every consignment, under control."
        description="Assign a consignment to the customer or broker who owns it, and move it through its journey. Assigning moves the mineral and every shipment attached to it, emails the new owner and notifies the previous one."
        actions={
          <Button
            variant="outline"
            className="h-10 rounded-[4px] bg-card px-4"
            onClick={() => navigate("/dashboard/admin/minerals")}
          >
            <PackageCheck className="size-3.5" />
            Mineral register
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Consignments"
          value={metrics.total}
          helper="Shipments on record"
          icon={Truck}
        />
        <MetricTile
          label="Active"
          value={metrics.active}
          helper="Not delivered or cancelled"
          icon={PackageCheck}
        />
        <MetricTile
          label="Needs attention"
          value={metrics.attention}
          helper="Held at customs or delayed"
          icon={AlertTriangle}
        />
        <MetricTile
          label="Unassigned"
          value={metrics.unassigned}
          helper="No owner to email yet"
          icon={UserRoundPlus}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Consignments"
          description="Every shipment in the register, newest journey first. Assign a record to the member it belongs to or change its published status."
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search shipment, mineral, owner"
                aria-label="Search consignments"
                className="h-9 w-full rounded-lg bg-card pl-8 text-xs sm:w-64"
              />
            </div>
          }
        />

        <div className="flex flex-wrap gap-1.5 border-b border-line px-5 py-3">
          {(["all", ...SHIPMENT_STATUSES] as (ShipmentStatus | "all")[]).map(
            (option) => {
              const count =
                option === "all"
                  ? (rows ?? []).filter(hasShipment).length
                  : (rows ?? []).filter(hasShipment).filter(
                      (row) => row.shipment.status === option,
                    ).length;
              const label =
                option === "all" ? "All" : SHIPMENT_STATUS_LABELS[option];
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatus(option)}
                  aria-pressed={status === option}
                  className={
                    status === option
                      ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-[0.62rem] font-medium leading-none text-primary-foreground"
                      : "rounded-full border border-line bg-card px-3 py-1.5 text-[0.62rem] font-medium leading-none text-muted-foreground transition-colors hover:border-primary/30 hover:text-ink"
                  }
                >
                  {label} ({count})
                </button>
              );
            },
          )}
        </div>

        {shipments.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={
              search.trim() || status !== "all"
                ? "No consignments match."
                : "No consignments recorded yet."
            }
            description={
              search.trim() || status !== "all"
                ? "Change the status filter, or search a different shipment, mineral or owner."
                : "A shipment is recorded with its mineral in the mineral register, then it appears here for assignment and tracking."
            }
            action={
              search.trim() || status !== "all" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-[4px] bg-transparent"
                  onClick={() => {
                    setStatus("all");
                    setSearch("");
                  }}
                >
                  Show every consignment
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y divide-line">
            {shipments.map(({ mineral, shipment, assignee }) => (
              <article
                key={shipment._id}
                className="grid gap-4 px-5 py-4 transition-colors hover:bg-ice/30 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_auto] lg:items-center lg:gap-6"
              >
                <div className="min-w-0">
                  <p className="text-[0.5rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Shipment
                  </p>
                  <p className="mt-0.5 truncate text-[0.8rem] font-semibold tracking-[-0.01em] text-ink">
                    {shipment.reference}
                  </p>
                  <p className="mt-0.5 truncate text-[0.62rem] text-muted-foreground">
                    {mineral.name} · {mineral.reference}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 truncate text-[0.6rem] text-muted-foreground">
                    {assignee ? (
                      <>
                        <UserRoundPlus className="size-3" />
                        {assignee.name} · {assignee.email}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[0.58rem] font-semibold text-amber-700 dark:text-amber-400">
                        <UserRoundPlus className="size-3" />
                        Unassigned
                      </span>
                    )}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="truncate text-[0.72rem] font-medium text-ink">
                    {shipment.origin} → {shipment.destination}
                  </p>
                  <p className="mt-0.5 truncate text-[0.6rem] text-muted-foreground">
                    {shipment.carrier}
                    {shipment.trackingNumber
                      ? ` · ${shipment.trackingNumber}`
                      : ""}
                    {shipment.estimatedArrivalAt
                      ? ` · ETA ${formatDate(shipment.estimatedArrivalAt)}`
                      : ""}
                  </p>
                  <p className="mt-0.5 truncate text-[0.58rem] text-muted-foreground/80">
                    {shipment.currentLocation
                      ? `Last seen · ${shipment.currentLocation}`
                      : "No location recorded"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <StatusPill status={shipment.status} />
                  <select
                    aria-label={`Update shipment status for ${mineral.name}`}
                    value={shipment.status}
                    disabled={updatingId === shipment._id}
                    onChange={(event) =>
                      changeStatus(
                        { mineral, shipment },
                        event.target.value as ShipmentStatus,
                      )
                    }
                    className="h-8 cursor-pointer rounded-lg border border-line bg-card px-2 text-[0.62rem] text-ink disabled:opacity-60"
                  >
                    {SHIPMENT_STATUSES.map((item) => (
                      <option key={item} value={item}>
                        {SHIPMENT_STATUS_LABELS[item]}
                      </option>
                    ))}
                  </select>
                  {updatingId === shipment._id && (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-[4px] bg-transparent px-2.5 text-[0.62rem]"
                    onClick={() => setAssigningId(mineral._id)}
                  >
                    <ArrowRightLeft className="size-3" />
                    {assignee ? "Reassign" : "Assign"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>

      <p className="px-1 text-[0.6rem] leading-5 text-muted-foreground">
        Ownership is held on the mineral, so assigning a consignment moves the
        mineral and every shipment attached to it. The change is written to the
        audit log, the new owner is emailed and the previous owner is notified in
        their dashboard. Status changes append to the shipment history and email
        the owner the new step.
      </p>

      <AssignMineralDialog
        key={assigning?.mineral._id ?? "none"}
        open={Boolean(assigning)}
        onOpenChange={(open) => !open && setAssigningId(null)}
        mineralId={assigning?.mineral._id ?? null}
        mineralName={assigning?.mineral.name ?? ""}
        mineralReference={assigning?.mineral.reference ?? ""}
        currentAssigneeId={assigning?.mineral.assignedUserId}
        shipmentCount={assigning ? 1 : 0}
        title="Assign this consignment"
      />
    </div>
  );
}
