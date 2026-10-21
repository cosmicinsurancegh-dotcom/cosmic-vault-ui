import { Reveal } from "@/components/site/Reveal";
import { cn } from "@/lib/utils";
import { MapPin, PackageCheck, Radar, ShieldCheck } from "lucide-react";
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
  return (
    <section id="tracking" className="mt-24 scroll-mt-24 bg-ice py-20 sm:mt-32 sm:py-24">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-7">
            <SectionLabel className="text-ink/60">Release & tracking</SectionLabel>
            <h2 className="mt-4 text-balance text-[clamp(2.1rem,4.6vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
              A release you can{" "}
              <span className="text-electric">watch.</span>
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
                <span className="grid size-10 shrink-0 place-items-center rounded-[4px] bg-navy text-bone">
                  <MapPin className="size-4" strokeWidth={1.8} />
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
              <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#a06bd4]/30 bg-[#a06bd4]/10 px-2.5 py-1 text-[0.58rem] font-semibold text-[#7c4cb4]">
                <span className="size-1.5 rounded-full bg-[#a06bd4]" />
                In Transit
              </span>
            </div>

            {/* Desktop rail */}
            <div className="hidden px-7 py-7 md:block">
              <ol className="grid grid-cols-5">
                {STAGES.map((stage, index) => (
                  <li key={stage.label} className="relative pr-3 last:pr-0">
                    <div className="relative flex items-center">
                      {index > 0 && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute right-[calc(100%-0.5rem)] top-[9px] h-px w-[calc(100%-0.75rem)]",
                            stage.state === "next" ? "bg-line" : "bg-primary/60",
                          )}
                        />
                      )}
                      <span
                        className={cn(
                          "relative z-10 grid size-[19px] place-items-center rounded-full border-2",
                          stage.state === "done" && "border-primary bg-primary",
                          stage.state === "active" &&
                            "border-[#a06bd4] bg-card ring-4 ring-[#a06bd4]/15",
                          stage.state === "skipped" &&
                            "border-dashed border-ink/25 bg-card",
                          stage.state === "next" && "border-line bg-card",
                        )}
                      >
                        {stage.state === "active" && (
                          <span className="size-2 rounded-full bg-[#a06bd4]" />
                        )}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "mt-3 text-[0.68rem] font-semibold uppercase tracking-[0.1em]",
                        stage.state === "active"
                          ? "text-[#7c4cb4]"
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
                    <p className="mt-1.5 max-w-[12rem] text-[0.65rem] leading-5 text-muted-foreground">
                      {stage.note}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Mobile stack */}
            <ol className="divide-y divide-line px-5 py-2 md:hidden">
              {STAGES.map((stage) => (
                <li key={stage.label} className="flex gap-3 py-3">
                  <span
                    className={cn(
                      "mt-1 grid size-4 shrink-0 place-items-center rounded-full border-2",
                      stage.state === "done" && "border-primary bg-primary",
                      stage.state === "active" && "border-[#a06bd4] bg-[#a06bd4]/20",
                      stage.state === "skipped" && "border-dashed border-ink/25",
                      stage.state === "next" && "border-line",
                    )}
                  />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-baseline gap-2">
                      <span className="text-[0.72rem] font-semibold text-ink">
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
                <h3 className="mt-3 text-[0.9rem] font-semibold text-ink">{title}</h3>
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
