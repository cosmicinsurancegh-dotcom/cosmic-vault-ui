import { Reveal } from "@/components/site/Reveal";
import { cn } from "@/lib/utils";
import {
  Check,
  MapPin,
  Minus,
  PackageCheck,
  Radar,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { SectionLabel } from "./SectionLabel";

const STAGES = [
  {
    label: "Pending",
    time: "18 Oct · 09:00",
    note: "Outbound request recorded. Destination and carrier confirmed.",
    state: "done",
  },
  {
    label: "In Progress",
    time: "19 Oct · 09:00",
    note: "Sealed in a tamper-evident case and assigned to the carrier.",
    state: "done",
  },
  {
    label: "On Hold",
    time: "—",
    note: "Skipped. Would pause the release for an operational check.",
    state: "skipped",
  },
  {
    label: "In Transit",
    time: "19 Oct · 09:00",
    note: "Collected by Malca-Amit. Air waybill CVX-8842-1190-GB active.",
    state: "active",
  },
  {
    label: "Shipped",
    time: "Est. 22 Oct",
    note: "Awaiting delivery signature and photo evidence.",
    state: "next",
  },
] as const;

type StageState = (typeof STAGES)[number]["state"];

/** One marker per stage: charged, live, skipped, or still to come. */
function StageMarker({ state }: { state: StageState }) {
  return (
    <span
      className={cn(
        "relative z-10 grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-card",
        state === "done" &&
          "bg-primary text-primary-foreground shadow-[0_6px_14px_-8px_var(--electric)]",
        state === "active" &&
          "bg-primary text-primary-foreground ring-primary/20 shadow-[0_6px_14px_-8px_var(--electric)]",
        state === "skipped" &&
          "border border-dashed border-ink/25 bg-card text-muted-foreground/70",
        state === "next" && "border border-line bg-card",
      )}
    >
      {state === "done" ? (
        <Check className="size-4" strokeWidth={2.6} />
      ) : state === "active" ? (
        <Truck className="size-4" strokeWidth={2.2} />
      ) : state === "skipped" ? (
        <Minus className="size-3.5" strokeWidth={2.4} />
      ) : (
        <span className="size-1.5 rounded-full bg-line" />
      )}
    </span>
  );
}

const FACTS = [
  {
    Icon: Radar,
    title: "Five states, no invented ones",
    body: "Pending, In Progress, On Hold, In Transit, Shipped. The vocabulary is fixed so a status always means the same thing.",
  },
  {
    Icon: ShieldCheck,
    title: "Operations sets the state",
    body: "Only vault staff can move a release. Every change stores a timestamp, a note and the person accountable.",
  },
  {
    Icon: PackageCheck,
    title: "Cover runs until signature",
    body: "The policy stays in force on the road and in the air. Delivery is not complete until someone signs for it.",
  },
];

export function ReleaseTracking() {
  const activeIndex = STAGES.findIndex((stage) => stage.state === "active");
  const travelled =
    activeIndex === -1 ? 0 : ((activeIndex + 0.5) / STAGES.length) * 100 - 10;

  return (
    <section
      id="tracking"
      className="mt-24 scroll-mt-24 bg-ice py-20 sm:mt-32 sm:py-24"
    >
      <div className="mx-auto max-w-[1240px] px-5">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-7">
            <SectionLabel className="text-ink/60">
              Release & tracking
            </SectionLabel>
            <h2 className="mt-4 text-balance text-[clamp(2.1rem,4.6vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
              A release you can <span className="text-electric">watch.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="lg:col-span-5 lg:pb-2">
            <p className="max-w-md text-[0.92rem] leading-7 text-ink/60">
              A withdrawal is not a favour. It is an operational process with
              five defined stages, published to the member the moment each one
              happens — and covered the whole way.
            </p>
          </Reveal>
        </div>

        <Reveal y={26}>
          <div className="mt-10 overflow-hidden rounded-[4px] border border-line bg-card shadow-[0_30px_60px_-50px_rgba(8,18,39,0.5)]">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-7">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_20px_-12px_var(--electric)]">
                  <MapPin className="size-5" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Release record
                  </p>
                  <p className="mt-0.5 text-[0.92rem] font-semibold tracking-[-0.02em] text-ink">
                    Sovereign 1 kg Gold Bar
                  </p>
                  <p className="text-[0.65rem] text-muted-foreground">
                    CV-A-1042 · Malca-Amit · ETA 22 Oct 2026
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[0.6rem] font-semibold leading-none text-primary">
                <Truck className="size-3" strokeWidth={2.4} />
                In Transit
              </span>
            </div>

            {/* Desktop rail */}
            <div className="hidden px-7 pb-8 pt-9 md:block">
              <ol
                className="relative grid grid-cols-5"
                aria-label="Release stages"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-[10%] right-[10%] top-4 h-0 -translate-y-1/2 border-t-2 border-dashed border-muted-foreground/30"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-[10%] top-4 h-[3px] -translate-y-1/2 rounded-full bg-primary shadow-[0_2px_7px_-1px_var(--electric)]"
                  style={{ width: `${travelled}%` }}
                />
                {STAGES.map((stage) => (
                  <li
                    key={stage.label}
                    className="relative flex min-w-0 flex-col items-center px-2 text-center"
                    aria-current={stage.state === "active" ? "step" : undefined}
                  >
                    <StageMarker state={stage.state} />
                    <p
                      className={cn(
                        "mt-3 text-[0.72rem] font-semibold tracking-[-0.01em]",
                        stage.state === "active"
                          ? "text-primary"
                          : stage.state === "done"
                            ? "text-ink"
                            : "text-muted-foreground/70",
                      )}
                    >
                      {stage.label}
                    </p>
                    <p className="mt-1 text-[0.6rem] tabular-nums text-muted-foreground">
                      {stage.time}
                    </p>
                    <p
                      className={cn(
                        "mt-1.5 max-w-[12rem] text-[0.65rem] leading-5",
                        stage.state === "skipped" || stage.state === "next"
                          ? "text-muted-foreground/60"
                          : "text-muted-foreground",
                      )}
                    >
                      {stage.note}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Mobile stack */}
            <ol className="px-5 py-6 md:hidden" aria-label="Release stages">
              {STAGES.map((stage, index) => (
                <li
                  key={stage.label}
                  className={cn(
                    "relative flex gap-3.5",
                    index === STAGES.length - 1 ? "pb-0" : "pb-5",
                  )}
                  aria-current={stage.state === "active" ? "step" : undefined}
                >
                  {index < STAGES.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute left-[15px] top-8 h-[calc(100%-32px)] border-l-2 border-dashed border-muted-foreground/30"
                    />
                  )}
                  <StageMarker state={stage.state} />
                  <div className="min-w-0 pt-0.5">
                    <p className="flex flex-wrap items-baseline gap-2">
                      <span
                        className={cn(
                          "text-[0.74rem] font-semibold tracking-[-0.01em]",
                          stage.state === "active"
                            ? "text-primary"
                            : stage.state === "done"
                              ? "text-ink"
                              : "text-muted-foreground/70",
                        )}
                      >
                        {stage.label}
                      </span>
                      <span className="text-[0.58rem] tabular-nums text-muted-foreground">
                        {stage.time}
                      </span>
                    </p>
                    <p className="mt-1 text-[0.66rem] leading-5 text-muted-foreground">
                      {stage.note}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-ice/40 px-5 py-3 sm:px-7">
              <p className="text-[0.6rem] text-muted-foreground">
                Origin: Cosmic Vault, 18 Finsbury Circus, London EC2M 7EB
              </p>
              <p className="text-[0.6rem] text-muted-foreground">
                Destination: Noor Haddad, Bristol BS1 4TT
              </p>
            </div>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {FACTS.map(({ Icon, title, body }, index) => (
            <Reveal key={title} delay={index * 0.06}>
              <div className="border-t border-ink/10 pt-5">
                <Icon className="size-4 text-primary" strokeWidth={1.8} />
                <h3 className="mt-3 text-[0.9rem] font-semibold text-ink">
                  {title}
                </h3>
                <p className="mt-1.5 text-[0.78rem] leading-6 text-muted-foreground">
                  {body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
