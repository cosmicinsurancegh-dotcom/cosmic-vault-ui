import { PageHeader, Panel, PanelHeader } from "@/components/dashboard/PlatformUI";
import { Button } from "@/components/ui/button";
import { formatMoneyValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useVaultActor, useVaultData, useVaultMineral } from "@/lib/vault/useVault";
import type { Mineral } from "@/lib/vault/types";
import { insuranceStatus } from "@/lib/vault/types";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Gem,
  PackageCheck,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Truck,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { AdminMineralDialog } from "./AdminMineralDialog";
import { ShippingBadgeForMineral } from "./StatusBadges";
import { VaultActivityFeed } from "./VaultActivityFeed";
import { VaultPulse } from "./VaultPulse";
import { VaultSkeleton } from "./VaultSkeleton";
import { MineralVisual } from "./MineralVisual";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function isRenewalDue(mineral: Mineral) {
  const policy = mineral.insurancePolicy;
  return (
    policy?.status === "active" &&
    policy.endDate < Date.now() + 90 * 24 * 60 * 60 * 1000
  );
}

function AttentionRow({
  icon: Icon,
  label,
  detail,
  count,
  to,
  tone = "default",
}: {
  icon: typeof AlertTriangle;
  label: string;
  detail: string;
  count: number;
  to: string;
  tone?: "default" | "warning" | "positive";
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-primary/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-[4px]",
          tone === "warning"
            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
            : tone === "positive"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-ice text-primary",
        )}
      >
        <Icon className="size-3.5" strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.72rem] font-semibold text-ink">{label}</span>
        <span className="mt-0.5 block text-[0.62rem] leading-4 text-muted-foreground">
          {detail}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 text-lg font-semibold tabular-nums tracking-[-0.03em]",
          count > 0 && tone === "warning" ? "text-amber-700 dark:text-amber-400" : "text-ink",
        )}
      >
        {count}
      </span>
      <ArrowUpRight className="size-3 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </Link>
  );
}

function HoldingRow({
  mineral,
  onOpen,
}: {
  mineral: Mineral;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 border-b border-line/70 px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-primary/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
    >
      <MineralVisual
        mineral={mineral}
        className="aspect-square size-10 shrink-0 rounded-[4px]"
        overlay={false}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.7rem] font-semibold text-ink">
          {mineral.name}
        </span>
        <span className="mt-0.5 block truncate text-[0.58rem] text-muted-foreground">
          {mineral.ownerName} · {mineral.vaultId}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[0.68rem] font-semibold tabular-nums text-ink">
          {formatMoneyValue(mineral.estimatedValue, mineral.currency)}
        </span>
        <span className="mt-1 flex justify-end">
          <ShippingBadgeForMineral mineral={mineral} />
        </span>
      </span>
    </button>
  );
}

/**
 * The operations home for a guest preview. Real staff keep the insurance-wide
 * Command Centre; this view stays deliberately scoped to the vault, where the
 * same records and controls are available as on the register and shipment pages.
 */
export function OperationsOverview() {
  const navigate = useNavigate();
  const { actor, canSwitchDemoRole, setDemoOperations } = useVaultActor();
  const { ready, minerals, metrics, activities } = useVaultData(actor);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedMineral = useVaultMineral(actor, selectedId);

  if (!ready) return <VaultSkeleton />;

  const uninsured = minerals.filter(
    (mineral) => insuranceStatus(mineral) === "uninsured",
  );
  const pendingPolicies = minerals.filter(
    (mineral) => insuranceStatus(mineral) === "pending",
  );
  const onHold = minerals.filter(
    (mineral) => mineral.shipping?.currentStatus === "on_hold",
  );
  const renewals = minerals.filter(isRenewalDue);
  const topHoldings = [...minerals]
    .sort((a, b) => b.estimatedValue - a.estimatedValue)
    .slice(0, 4);
  const insuredPercent = minerals.length
    ? Math.round((metrics.insuredCount / minerals.length) * 100)
    : 0;
  const firstName = (actor.name || "there").split(" ")[0];

  return (
    <div className="space-y-6">
      {canSwitchDemoRole && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/[0.035] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[4px] border border-primary/20 bg-card text-primary">
              <Sparkles className="size-3.5" />
            </span>
            <div>
              <p className="text-[0.72rem] font-semibold text-ink">
                Operations preview · demonstration data
              </p>
              <p className="mt-0.5 text-[0.64rem] leading-5 text-muted-foreground">
                You are signed in as Iris Chen, vault operations. Every change is
                visible immediately in the member view.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 rounded-[4px] bg-card px-3 text-[0.65rem]"
            onClick={() => {
              setDemoOperations(false);
              navigate("/dashboard/vault");
            }}
          >
            Member view
            <ArrowUpRight className="size-3" />
          </Button>
        </div>
      )}

      <PageHeader
        eyebrow={
          <>
            Vault operations
            <span className="size-1 rounded-[4px] bg-primary/60" />
            {new Intl.DateTimeFormat("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(new Date())}
            <span className="size-1 rounded-[4px] bg-primary/60" />
            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-[4px] bg-emerald-500 opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-[4px] bg-emerald-500" />
              </span>
              Live ledger
            </span>
          </>
        }
        title={`${greeting()}, ${firstName}.`}
        description="The vault floor at a glance: what is stored, what is covered, and what needs an operator before the next consignment moves."
        actions={
          <>
            <Button asChild variant="outline" className="h-10 rounded-[4px] bg-card px-4">
              <Link to="/dashboard/admin/vault">
                <Gem className="size-3.5" />
                Vault register
              </Link>
            </Button>
            <Button asChild className="h-10 rounded-[4px] px-4">
              <Link to="/dashboard/admin/shipments">
                <Truck className="size-3.5" />
                Shipment control
              </Link>
            </Button>
          </>
        }
      />

      <VaultPulse
        items={[
          {
            label: "Minerals stored",
            value: metrics.holdings,
            helper: `${metrics.clientCount} ${
              metrics.clientCount === 1 ? "client" : "clients"
            } · ${metrics.uninsuredCount} without active cover`,
            icon: Gem,
          },
          {
            label: "Insured value",
            value: formatMoneyValue(metrics.totalInsuredValue, metrics.currency),
            helper: `${metrics.insuredCount} active ${
              metrics.insuredCount === 1 ? "policy" : "policies"
            }`,
            icon: ShieldCheck,
          },
          {
            label: "Active shipments",
            value: metrics.activeShipments,
            helper: `${metrics.onHoldShipments} on hold · ${metrics.deliveredShipments} delivered`,
            icon: Truck,
            tone: metrics.onHoldShipments > 0 ? "warning" : "default",
          },
          {
            label: "Pending shipments",
            value: metrics.pendingShipments,
            helper: "Awaiting collection or packing",
            icon: PackageCheck,
            tone: metrics.pendingShipments > 0 ? "warning" : "default",
          },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)]">
        <div className="min-w-0 space-y-5">
          <Panel>
            <PanelHeader
              title="Needs an operator"
              description="The queue that would hold up a release or a clean audit."
              action={
                <Link
                  to="/dashboard/admin/vault"
                  className="text-[0.63rem] font-semibold text-primary"
                >
                  Open register
                </Link>
              }
            />
            <div className="divide-y divide-line">
              <AttentionRow
                icon={ShieldAlert}
                label="Uninsured pieces"
                detail={
                  uninsured.length
                    ? `${uninsured.map((mineral) => mineral.name).join(", ")}`
                    : "Every stored piece has active cover."
                }
                count={uninsured.length}
                tone={uninsured.length ? "warning" : "positive"}
                to="/dashboard/admin/vault"
              />
              <AttentionRow
                icon={AlertTriangle}
                label="Shipments on hold"
                detail={
                  onHold.length
                    ? onHold.map((mineral) => mineral.name).join(", ")
                    : "Nothing is waiting on a customs or operational check."
                }
                count={onHold.length}
                tone={onHold.length ? "warning" : "positive"}
                to="/dashboard/admin/shipments"
              />
              <AttentionRow
                icon={CalendarClock}
                label="Renewals in 90 days"
                detail={
                  renewals.length
                    ? renewals
                        .map((mineral) => mineral.insurancePolicy?.policyNumber)
                        .filter(Boolean)
                        .join(", ")
                    : "No policy reaches its renewal window this quarter."
                }
                count={renewals.length}
                to="/dashboard/admin/vault"
              />
              <AttentionRow
                icon={Wallet}
                label="Policies awaiting sign-off"
                detail={
                  pendingPolicies.length
                    ? pendingPolicies.map((mineral) => mineral.name).join(", ")
                    : "No underwriting decisions are outstanding."
                }
                count={pendingPolicies.length}
                tone={pendingPolicies.length ? "warning" : "positive"}
                to="/dashboard/admin/vault"
              />
            </div>
          </Panel>

          <VaultActivityFeed
            activities={activities}
            limit={6}
            showOwner
            href="/dashboard/admin/shipments"
            onOpenMineral={(id) => setSelectedId(id)}
          />
        </div>

        <div className="min-w-0 space-y-5">
          <Panel>
            <PanelHeader
              title="Cover position"
              description="Agreed cover against the latest appraisals."
            />
            <div className="px-5 py-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Insured
                  </p>
                  <p className="mt-1 text-xl font-semibold tracking-[-0.04em] text-ink">
                    {formatMoneyValue(metrics.totalInsuredValue, metrics.currency)}
                  </p>
                </div>
                <span className="rounded-[4px] border border-line bg-ice/50 px-2 py-0.5 text-[0.6rem] font-semibold tabular-nums text-ink">
                  {insuredPercent}%
                </span>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-[4px] bg-ink/[0.07] dark:bg-white/10">
                <div
                  className="h-full rounded-[4px] bg-emerald-500 transition-[width] duration-700"
                  style={{ width: `${Math.max(3, insuredPercent)}%` }}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
                <div>
                  <p className="text-[0.52rem] uppercase tracking-[0.12em] text-muted-foreground">
                    Appraised book
                  </p>
                  <p className="mt-1 text-[0.74rem] font-semibold tabular-nums text-ink">
                    {formatMoneyValue(metrics.totalAppraisedValue, metrics.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[0.52rem] uppercase tracking-[0.12em] text-muted-foreground">
                    Cover gap
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-[0.74rem] font-semibold tabular-nums",
                      metrics.uninsuredCount
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-emerald-700 dark:text-emerald-400",
                    )}
                  >
                    {metrics.uninsuredCount}{" "}
                    {metrics.uninsuredCount === 1 ? "piece" : "pieces"}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[0.6rem] leading-4 text-muted-foreground">
                {metrics.uninsuredCount === 0
                  ? "Every record has active cover. Renewals are tracked from the register."
                  : `${uninsured.length} uninsured${
                      pendingPolicies.length
                        ? ` · ${pendingPolicies.length} awaiting sign-off`
                        : ""
                    }. Open a record to compare the recommended policies.`}
              </p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Highest-value holdings"
              description="Ranked by the latest recorded appraisal."
              action={
                <Link
                  to="/dashboard/admin/vault"
                  className="text-[0.63rem] font-semibold text-primary"
                >
                  View all
                </Link>
              }
            />
            <div>
              {topHoldings.map((mineral) => (
                <HoldingRow
                  key={mineral.id}
                  mineral={mineral}
                  onOpen={() => setSelectedId(mineral.id)}
                />
              ))}
            </div>
          </Panel>

          <div className="starfield relative overflow-hidden rounded-[4px] bg-[#071227] p-5 text-bone">
            <span className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.4),transparent_66%)]" />
            <p className="relative flex items-center gap-2 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-bone/45">
              <Truck className="size-3.5 text-electric-soft" />
              Shipment control
            </p>
            <p className="relative mt-2 max-w-[16rem] text-[0.78rem] font-medium leading-5 text-bone/85">
              Initiate a consignment, move a status, or leave a note the member reads
              with the next scan.
            </p>
            <Link
              to="/dashboard/admin/shipments"
              className="relative mt-3 inline-flex items-center gap-1 text-[0.66rem] font-semibold text-electric-soft transition-colors hover:text-bone"
            >
              Open shipment control
              <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </div>
      </div>

      {selectedMineral && (
        <AdminMineralDialog
          key={selectedMineral.id}
          mineral={selectedMineral}
          actor={actor}
          open={Boolean(selectedMineral)}
          onOpenChange={(open) => !open && setSelectedId(null)}
        />
      )}
    </div>
  );
}
