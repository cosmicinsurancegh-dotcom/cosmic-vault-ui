import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { SHIPMENT_STATUS_LABELS } from "@/convex/lib/shipments";
import { formatMoney, formatMoneyList } from "@/lib/format";
import { useQuery } from "convex/react";
import {
  ArrowUpRight,
  Coins,
  Gem,
  Layers3,
  Loader2,
  Mountain,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";

/** The live register has no mineral "type", so the icon follows the category. */
function iconForCategory(category: string): LucideIcon {
  const value = category.toLowerCase();
  if (value.includes("gold")) return Layers3;
  if (value.includes("silver") || value.includes("platinum")) return Coins;
  if (value.includes("earth") || value.includes("ore")) return Mountain;
  return Gem;
}

/**
 * The vault band on a member's home, reading the same live minerals as
 * `/dashboard/vault`: assigned holdings, the policy covering them, and the
 * consignments still in motion. Nothing here is invented or stored locally.
 */
export function VaultHomeBand() {
  const rows = useQuery(api.minerals.mine);

  const stats = useMemo(() => {
    const list = rows ?? [];
    const insured = list.filter((row) => row.policy?.status === "active");
    const declared = new Map<string, number>();
    const covered = new Map<string, number>();
    for (const row of list) {
      declared.set(
        row.mineral.currency,
        (declared.get(row.mineral.currency) ?? 0) + row.mineral.declaredValue,
      );
    }
    for (const row of insured) {
      if (!row.policy) continue;
      covered.set(
        row.policy.currency,
        (covered.get(row.policy.currency) ?? 0) + row.policy.coverageLimit,
      );
    }
    return {
      holdings: list.length,
      insuredCount: insured.length,
      declared: [...declared.entries()].map(([currency, amount]) => ({
        currency,
        amount,
      })),
      covered: [...covered.entries()].map(([currency, amount]) => ({
        currency,
        amount,
      })),
      inMotion: list.filter(
        (row) =>
          row.shipment &&
          row.shipment.status !== "delivered" &&
          row.shipment.status !== "cancelled",
      ).length,
      featured: [...list]
        .sort((a, b) => b.mineral.declaredValue - a.mineral.declaredValue)
        .slice(0, 3),
    };
  }, [rows]);

  if (rows === undefined) {
    return (
      <div className="flex min-h-[166px] items-center justify-center gap-2 rounded-[4px] border border-line bg-card text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading your vault
      </div>
    );
  }

  if (stats.holdings === 0) {
    return (
      <section className="starfield relative overflow-hidden rounded-[4px] bg-[#071227] p-5 text-bone sm:p-6">
        <span className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.4),transparent_66%)]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="flex items-center gap-2 text-[0.55rem] font-semibold uppercase tracking-[0.24em] text-bone/45">
              <Gem className="size-3.5 text-electric-soft" />
              Your vault
            </p>
            <h2 className="mt-2.5 text-xl font-semibold tracking-[-0.035em]">
              The first object makes the record.
            </h2>
            <p className="mt-2 text-xs leading-5 text-bone/55">
              Once a piece is accepted into custody, its appraisal, policy and every
              movement lives here. Nothing is invented, and nothing moves without a
              person signing it off.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                asChild
                className="h-9 rounded-[4px] bg-primary px-4 text-primary-foreground hover:bg-primary/90"
              >
                <Link to="/dashboard/vault">
                  Open the vault
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-9 rounded-[4px] border-white/15 bg-white/[0.04] px-4 text-bone hover:bg-white/[0.08] hover:text-bone"
              >
                <Link to="/dashboard/support">Talk to the vault desk</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["Gold", "Diamonds", "Rare earth"].map((label) => (
              <div
                key={label}
                className="flex h-16 w-16 flex-col items-center justify-center rounded-[4px] border border-white/10 bg-white/[0.03] text-bone/35"
              >
                <Gem className="size-4" />
                <span className="mt-1 text-[0.46rem] uppercase tracking-[0.1em]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="starfield relative overflow-hidden rounded-[4px] bg-[#071227] p-5 text-bone sm:p-6">
      <span className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.38),transparent_66%)]" />
      <div className="relative grid gap-5 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-[0.55rem] font-semibold uppercase tracking-[0.22em] text-bone/45">
            <Gem className="size-3.5 text-electric-soft" />
            Vault holdings
            <span className="size-1 rounded-[4px] bg-bone/25" />
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-[4px] bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-[4px] bg-emerald-400" />
              </span>
              Live
            </span>
          </p>
          <h2 className="mt-2.5 text-[1.45rem] font-semibold leading-tight tracking-[-0.04em] sm:text-[1.65rem]">
            {stats.holdings} {stats.holdings === 1 ? "object" : "objects"}.{" "}
            <span className="text-electric-soft">
              {formatMoneyList(stats.covered, "Nothing")}
            </span>{" "}
            under cover.
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <p className="flex items-center gap-1 text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-bone/40">
                <ShieldCheck className="size-3" />
                Insured
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums">
                {stats.insuredCount}
                <span className="ml-1 text-[0.58rem] font-normal text-bone/45">
                  of {stats.holdings}
                </span>
              </p>
            </div>
            <div>
              <p className="text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-bone/40">
                Declared
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums">
                {formatMoneyList(stats.declared, "None")}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-bone/40">
                <Truck className="size-3" />
                In motion
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums">
                {stats.inMotion}
                <span className="ml-1 text-[0.58rem] font-normal text-bone/45">
                  shipment{stats.inMotion === 1 ? "" : "s"}
                </span>
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              asChild
              className="h-9 rounded-[4px] bg-primary px-4 text-primary-foreground hover:bg-primary/90"
            >
              <Link to="/dashboard/vault">
                Enter the vault
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-9 rounded-[4px] border-white/15 bg-white/[0.04] px-4 text-bone hover:bg-white/[0.08] hover:text-bone"
            >
              <Link to="/dashboard/shipments">Tracking</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {stats.featured.map(({ mineral, shipment }) => {
            const Icon = iconForCategory(mineral.category);
            return (
              <Link
                key={mineral._id}
                to="/dashboard/vault"
                className="group relative overflow-hidden rounded-[4px] border border-white/10 transition-colors hover:border-white/25"
              >
                <div className="starfield relative flex aspect-[4/5] flex-col justify-between bg-gradient-to-br from-[#12284a] via-[#0a1526] to-[#050b15] p-2.5">
                  <Icon className="size-4 text-electric-soft/80" strokeWidth={1.4} />
                  <div className="min-w-0">
                    <p className="truncate text-[0.56rem] font-semibold text-bone">
                      {mineral.name}
                    </p>
                    <p className="truncate text-[0.5rem] text-bone/55">
                      {formatMoney(mineral.declaredValue, mineral.currency)}
                    </p>
                    <p className="mt-1 truncate text-[0.46rem] uppercase tracking-[0.1em] text-bone/40">
                      {mineral.category}
                    </p>
                    <p className="truncate text-[0.46rem] uppercase tracking-[0.1em] text-electric-soft/70">
                      {shipment
                        ? SHIPMENT_STATUS_LABELS[shipment.status]
                        : "In vault"}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
