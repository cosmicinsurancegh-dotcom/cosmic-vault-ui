import { Button } from "@/components/ui/button";
import { formatMoneyValue } from "@/lib/format";
import { seedDemoCollection } from "@/lib/vault/store";
import { useVaultActor, useVaultData } from "@/lib/vault/useVault";
import { ArrowUpRight, Gem, Loader2, PackagePlus, ShieldCheck, Truck } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { MineralVisual } from "./MineralVisual";

export function VaultHomeBand() {
  const { actor } = useVaultActor();
  const { ready, minerals, metrics } = useVaultData(actor);

  if (!ready) {
    return (
      <div className="flex min-h-[166px] items-center justify-center gap-2 rounded-[4px] border border-line bg-card text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading your vault
      </div>
    );
  }

  if (minerals.length === 0) {
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
                variant="outline"
                className="h-9 rounded-[4px] border-white/15 bg-white/[0.04] px-4 text-bone hover:bg-white/[0.08] hover:text-bone"
                onClick={() => {
                  const count = seedDemoCollection(actor);
                  toast.success(
                    count
                      ? `${count} demonstration records loaded.`
                      : "A demonstration collection is already loaded.",
                  );
                }}
              >
                <PackagePlus className="size-3.5" />
                Load demonstration collection
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

  const featured = [...minerals]
    .sort((a, b) => b.estimatedValue - a.estimatedValue)
    .slice(0, 3);

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
            {metrics.holdings} {metrics.holdings === 1 ? "object" : "objects"}.{" "}
            <span className="text-electric-soft">
              {formatMoneyValue(metrics.totalInsuredValue, metrics.currency)}
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
                {metrics.insuredCount}
                <span className="ml-1 text-[0.58rem] font-normal text-bone/45">
                  of {metrics.holdings}
                </span>
              </p>
            </div>
            <div>
              <p className="text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-bone/40">
                Appraised
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums">
                {formatMoneyValue(metrics.totalAppraisedValue, metrics.currency)}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-bone/40">
                <Truck className="size-3" />
                In motion
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums">
                {metrics.activeShipments}
                <span className="ml-1 text-[0.58rem] font-normal text-bone/45">
                  shipment{metrics.activeShipments === 1 ? "" : "s"}
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
          {featured.map((mineral) => (
            <Link
              key={mineral.id}
              to="/dashboard/vault"
              className="group relative overflow-hidden rounded-[4px] border border-white/10 transition-colors hover:border-white/25"
            >
              <MineralVisual
                mineral={mineral}
                className="aspect-[4/5]"
                overlay
                imageClassName="opacity-90"
              />
              <div className="absolute inset-x-2 bottom-2">
                <p className="truncate text-[0.56rem] font-semibold text-bone">
                  {mineral.name}
                </p>
                <p className="truncate text-[0.5rem] text-bone/55">
                  {formatMoneyValue(mineral.estimatedValue, mineral.currency)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
