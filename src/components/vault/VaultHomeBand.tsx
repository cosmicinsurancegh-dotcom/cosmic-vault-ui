import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { SHIPMENT_STATUS_LABELS } from "@/convex/lib/shipments";
import { formatMoney, formatMoneyValue } from "@/lib/format";
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

const ROW_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-soft/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071227]";

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
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-[166px] items-center justify-center gap-2 rounded-[4px] border border-line bg-card text-xs text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin" />
        Loading your vault
      </div>
    );
  }

  if (stats.holdings === 0) {
    return (
      <section className="starfield relative overflow-hidden rounded-[4px] bg-[#071227] p-5 text-bone sm:p-7">
        <span className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.4),transparent_66%)]" />
        <div className="rise-in relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-bone/60">
              <Gem className="size-3.5 text-electric-soft" />
              Your vault
            </p>
            <h2 className="mt-2.5 text-[1.35rem] font-semibold leading-tight tracking-[-0.035em] text-balance sm:text-[1.5rem]">
              The first object makes the record.
            </h2>
            <p className="mt-2 max-w-prose text-[0.8rem] leading-6 text-bone/70">
              Once a piece is accepted into custody, its appraisal, policy and every
              movement lives here. Nothing is invented, and nothing moves without a
              person signing it off.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                asChild
                className="press h-10 rounded-[4px] bg-primary px-4 text-[0.8rem] text-primary-foreground hover:bg-primary/90 sm:h-9"
              >
                <Link to="/dashboard/vault">
                  Open the vault
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="press h-10 rounded-[4px] border-white/20 bg-white/[0.04] px-4 text-[0.8rem] text-bone hover:bg-white/[0.09] hover:text-bone sm:h-9"
              >
                <Link to="/dashboard/support">Talk to the vault desk</Link>
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            {["Gold", "Diamonds", "Rare earth"].map((label) => (
              <div
                key={label}
                className="flex h-16 w-16 flex-col items-center justify-center rounded-[4px] border border-white/10 bg-white/[0.03] text-bone/60"
              >
                <Gem className="size-4" />
                <span className="mt-1 text-[0.52rem] uppercase tracking-[0.1em]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const uncovered = stats.covered.length === 0;
  /* One currency reads exactly at any width. It is the second amount that
     overflows a phone heading, so only then does the headline abbreviate. */
  const compactTotals = stats.covered.length > 1;

  return (
    <section
      aria-labelledby="vault-band-title"
      className="starfield relative overflow-hidden rounded-[4px] bg-[#071227] p-5 text-bone sm:p-7"
    >
      <span className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.32),transparent_66%)]" />
      {/* The mobile track is pinned to the available width: an auto track sizes
          to the nowrap names inside the register and pushes the money values
          past the panel edge. */}
      <div className="relative grid grid-cols-[minmax(0,1fr)] gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-12">
        <div className="rise-in min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-bone/60">
            <Gem className="size-3.5 text-electric-soft" />
            Vault holdings
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Live
            </span>
          </p>
          {/* Phones read compact money (US$9.4M), so the headline keeps its
              size: exact figures in a 248px panel pushed it to four lines.
              The precise total is in the declared row directly below. */}
          <h2
            id="vault-band-title"
            className="mt-3 text-[1.5rem] font-semibold leading-[1.15] tracking-[-0.04em] text-balance sm:text-[1.85rem]"
          >
            {stats.holdings} {stats.holdings === 1 ? "object" : "objects"}.{" "}
            {uncovered ? (
              <span className="text-halo">No cover in force.</span>
            ) : (
              <>
                {/* Same rule as the declared total below: each amount is
                    unbreakable and carries the separator that follows it, so
                    a wrapped heading never strands a dot on its own line. */}
                <span className="text-electric-soft">
                  {stats.covered.map((value, index) => (
                    <span key={value.currency}>
                      {index > 0 && " "}
                      <span className="whitespace-nowrap">
                        {index > 0 && <span aria-hidden>· </span>}
                        {compactTotals ? (
                          <>
                            <span className="sm:hidden">
                              {formatMoneyValue(
                                value.amount / 100,
                                value.currency,
                                { compact: true },
                              )}
                            </span>
                            <span className="hidden sm:inline">
                              {formatMoney(value.amount, value.currency)}
                            </span>
                          </>
                        ) : (
                          formatMoney(value.amount, value.currency)
                        )}
                      </span>
                    </span>
                  ))}
                </span>{" "}
                under cover.
              </>
            )}
          </h2>
          {uncovered && (
            <p className="mt-2 max-w-md text-[0.8rem] leading-6 text-bone/70">
              Uninsured until a policy is bound on it.
            </p>
          )}

          <dl className="mt-5 divide-y divide-white/10 border-t border-white/10 sm:mt-6 sm:grid sm:grid-cols-3 sm:divide-y-0">
            <div className="flex items-baseline justify-between gap-3 py-2.5 sm:block sm:py-3 sm:pr-5">
              <dt className="flex items-center gap-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-bone/60">
                <ShieldCheck className="size-3" />
                Insured
              </dt>
              <dd className="mt-1 text-[0.95rem] font-semibold tabular-nums">
                {stats.insuredCount}
                <span className="ml-1 text-[0.65rem] font-normal text-bone/70">
                  of {stats.holdings}
                </span>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-2.5 sm:block sm:border-l sm:border-white/10 sm:py-3 sm:pl-5">
              <dt className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-bone/60">
                Declared
              </dt>
              {/* Each amount is unbreakable and the separator rides with the
                  amount that follows it, so a narrow row breaks between
                  amounts instead of leaving a dot dangling at the line end. */}
              <dd className="mt-1 flex flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5 text-[0.95rem] font-semibold tabular-nums sm:justify-start">
                {stats.declared.map((value, index) => (
                  <span key={value.currency} className="whitespace-nowrap">
                    {index > 0 && (
                      <span aria-hidden className="mr-2 text-bone/40">
                        ·
                      </span>
                    )}
                    {formatMoney(value.amount, value.currency)}
                  </span>
                ))}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-2.5 sm:block sm:border-l sm:border-white/10 sm:py-3 sm:pl-5">
              <dt className="flex items-center gap-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-bone/60">
                <Truck className="size-3" />
                In motion
              </dt>
              <dd className="mt-1 text-[0.95rem] font-semibold tabular-nums">
                {stats.inMotion}
                <span className="ml-1 text-[0.65rem] font-normal text-bone/70">
                  shipment{stats.inMotion === 1 ? "" : "s"}
                </span>
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              asChild
              className="press h-10 rounded-[4px] bg-primary px-4 text-[0.8rem] text-primary-foreground hover:bg-primary/90 sm:h-9"
            >
              <Link to="/dashboard/vault">
                Enter the vault
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="press h-10 rounded-[4px] border-white/20 bg-white/[0.04] px-4 text-[0.8rem] text-bone hover:bg-white/[0.09] hover:text-bone sm:h-9"
            >
              <Link to="/dashboard/shipments">Tracking</Link>
            </Button>
          </div>
        </div>

        {/* A register rather than a poster grid: one holding and three should
            both read as a record, not as a mostly empty card. */}
        <div
          className="rise-in min-w-0"
          style={{ animationDelay: "80ms" }}
        >
          <p className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-bone/55">
            Largest holdings
          </p>
          <ul className="mt-2 @container divide-y divide-white/10 border-t border-white/10">
            {stats.featured.map(({ mineral, policy, shipment }) => {
              const Icon = iconForCategory(mineral.category);
              const insured = policy?.status === "active";
              const moving =
                shipment &&
                shipment.status !== "delivered" &&
                shipment.status !== "cancelled";
              /* Custody and cover are separate facts: a piece can sit in the
                 vault and still be uninsured, so both are named. */
              const state =
                moving && shipment
                  ? SHIPMENT_STATUS_LABELS[shipment.status]
                  : "In vault";
              return (
                <li key={mineral._id}>
                  <Link
                    to="/dashboard/vault"
                    aria-label={`${mineral.name}, ${mineral.category}, ${formatMoney(mineral.declaredValue, mineral.currency)}, ${state}${insured ? "" : ", no cover"}. Open in the vault.`}
                    className={`group flex flex-wrap items-center gap-x-3 gap-y-1 py-3 transition-colors hover:bg-white/[0.03] ${ROW_FOCUS}`}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-[4px] border border-white/10 bg-white/[0.04] text-electric-soft">
                      <Icon className="size-4" strokeWidth={1.5} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[0.85rem] font-medium leading-tight">
                        {mineral.name}
                      </span>                        <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.12em] text-bone/60">
                        {/* The category is the first thing to go when the row
                            is narrow: the state and the value are not. */}
                        <span className="hidden truncate sm:inline">
                          {mineral.category}
                        </span>
                        <span className="hidden size-[3px] shrink-0 rounded-full bg-bone/30 sm:inline-block" />
                        <span className="shrink-0">{state}</span>
                        {!insured && (
                          <>
                            <span className="size-[3px] shrink-0 rounded-full bg-bone/30" />
                            <span className="shrink-0 text-halo">No cover</span>
                          </>
                        )}
                      </span>
                    </span>
                    {/* Below 17.5rem the value drops to its own line, indented
                        under the name: sharing the row leaves the name about
                        two words wide, and a register of records has to read
                        by name. 52px is the icon plus the gap. */}
                    <span className="shrink-0 text-right text-[0.78rem] font-semibold tabular-nums @max-[17.5rem]:w-full @max-[17.5rem]:pl-[52px] @max-[17.5rem]:text-left">
                      {formatMoney(mineral.declaredValue, mineral.currency)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
