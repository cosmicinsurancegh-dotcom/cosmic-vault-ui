import { CtaButton, CtaLink } from "@/components/site/Cta";
import { Media } from "@/components/site/Media";
import { MINERAL_IMAGES } from "@/lib/imagery";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  Fingerprint,
  MapPin,
  ScanLine,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Link } from "react-router";

const EASE = [0.22, 1, 0.36, 1] as const;

const RELEASE_STEPS = [
  { label: "Pending", state: "done" },
  { label: "In Progress", state: "done" },
  { label: "On Hold", state: "skipped" },
  { label: "In Transit", state: "active" },
  { label: "Shipped", state: "next" },
] as const;

const LEDGER = [
  { value: "£1.99m", label: "insured across the ledger" },
  { value: "14", label: "objects in custody" },
  { value: "3", label: "private collections" },
  { value: "5", label: "releases in motion" },
];

const TRUST = [
  { Icon: ShieldCheck, label: "A policy per object" },
  { Icon: Fingerprint, label: "Dual-control access" },
  { Icon: Truck, label: "Five-stage release" },
];

export function HeroVaultRecord({ onReview }: { onReview: () => void }) {
  const reduce = useReducedMotion();

  const line = (text: string, delay: number) => (
    <span className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
      <motion.span
        initial={reduce ? false : { y: "112%" }}
        animate={{ y: "0%" }}
        transition={{ duration: 1, delay, ease: EASE }}
        className="block"
      >
        {text}
      </motion.span>
    </span>
  );

  return (
    <section
      id="top"
      className="relative isolate overflow-hidden bg-background text-ink"
    >
      {/* Paper field: a warm vault glow on the right and one cold rim light. */}
      <div
        aria-hidden="true"
        className="vault-grid pointer-events-none absolute inset-0 -z-20 opacity-70 [mask-image:radial-gradient(ellipse_at_62%_24%,black,transparent_76%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-32 -z-10 size-[46rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(10,18,36,0.05),transparent_62%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-56 left-[18%] -z-10 size-[38rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.10),transparent_64%)]"
      />

      {/* A vault door, drawn in rings rather than photographed. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-14rem] top-1/2 hidden -z-10 size-[52rem] -translate-y-1/2 lg:block"
      >
        <div className="absolute inset-0 rounded-full border border-ink/[0.07]" />
        <div className="absolute inset-[4.5rem] rounded-full border border-ink/[0.06]" />
        <div className="absolute inset-[9rem] rounded-full border border-ink/[0.05]" />
        <div className="absolute inset-[13.5rem] rounded-full border border-ink/[0.12]" />
        {[0, 90, 180, 270].map((angle) => (
          <span
            key={angle}
            className="absolute left-1/2 top-1/2 h-[26rem] w-px origin-top bg-gradient-to-b from-ink/[0.09] to-transparent"
            style={{ transform: `rotate(${angle}deg)` }}
          />
        ))}
      </div>

      <div className="relative mx-auto max-w-[1240px] px-5 pb-14 pt-28 sm:px-8 sm:pt-32 lg:pb-20 lg:pt-36">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div className="max-w-[40rem]">
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.6rem] font-semibold uppercase tracking-[0.26em] text-ink/50"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-ink/75 shadow-[0_1px_2px_rgba(10,18,36,0.04)]">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/50" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
                </span>
                Vault custody · object insurance
              </span>
              <span className="inline-flex items-center gap-1.5 text-ink/45">
                <MapPin className="size-3" />
                London, EC2
              </span>
            </motion.div>

            <h1 className="mt-7 text-[clamp(2.2rem,4.35vw,3.85rem)] font-semibold leading-[1.03] tracking-[-0.05em] text-ink">
              {line("Stored in the vault.", 0.12)}
              <span className="block overflow-hidden pb-[0.1em] -mb-[0.1em]">
                <motion.span
                  initial={reduce ? false : { y: "112%" }}
                  animate={{ y: "0%" }}
                  transition={{ duration: 1, delay: 0.22, ease: EASE }}
                  className="block"
                >
                  Covered to the{" "}
                  <span className="text-primary">gram.</span>
                </motion.span>
              </span>
            </h1>

            <motion.div
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.46, ease: EASE }}
            >
              <p className="mt-7 max-w-[30rem] text-[0.98rem] leading-7 text-ink/65">
                Gold, diamonds, gemstones and critical minerals, held under
                dual control — and insured on their own named policy before the
                drawer closes. One custodian, one underwriter, one record.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <CtaButton
                  onClick={onReview}
                  className="shadow-[0_20px_44px_-26px_rgba(29,74,214,0.65)]"
                >
                  Request a vault review
                </CtaButton>
                <CtaLink href="#store" variant="outline" className="border-ink/15 text-ink hover:border-ink/35 hover:bg-ink/[0.04]">
                  See what we store
                </CtaLink>
              </div>

              <ul className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-6">
                {TRUST.map(({ Icon, label }) => (
                  <li
                    key={label}
                    className="inline-flex items-center gap-2 text-[0.72rem] font-medium text-ink/60"
                  >
                    <Icon className="size-3.5 text-primary" strokeWidth={1.8} />
                    {label}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          {/* The record itself is the hero image. */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: EASE }}
            className="relative mx-auto w-full max-w-[26.5rem] lg:max-w-none"
          >
            <div
              aria-hidden="true"
              className="absolute -inset-4 -z-10 rounded-[4px] border border-line bg-card/50"
            />
            <article className="relative overflow-hidden rounded-[4px] border border-line bg-card shadow-[0_44px_90px_-52px_rgba(10,18,36,0.45)]">
              <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                <div>
                  <p className="text-[0.52rem] font-semibold uppercase tracking-[0.24em] text-ink/45">
                    Vault record
                  </p>
                  <p className="mt-0.5 font-mono text-[0.68rem] tracking-[0.08em] text-ink/75">
                    CV-A-1042
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/25 bg-emerald-500/10 px-2.5 py-1 text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  <span className="size-1.5 rounded-full bg-emerald-600" />
                  Insured
                </span>
              </header>

              <div className="group relative">
                <Media
                  image={MINERAL_IMAGES.bullion}
                  overlay="strong"
                  className="aspect-[16/10] w-full"
                />
                <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-[4px] border border-white/20 bg-black/35 px-2 py-1 text-[0.5rem] font-semibold uppercase tracking-[0.16em] text-bone/85 backdrop-blur">
                    <ScanLine className="size-2.5" />
                    LBMA · 24 ct
                  </span>
                  <span className="rounded-[4px] border border-white/20 bg-black/35 px-2 py-1 text-[0.5rem] font-semibold uppercase tracking-[0.16em] text-bone/85 backdrop-blur">
                    Vault A · 12
                  </span>
                </div>
                <div className="absolute inset-x-4 bottom-3">
                  <p className="text-[1.18rem] font-semibold leading-tight tracking-[-0.025em] text-bone">
                    Sovereign 1 kg Gold Bar
                  </p>
                  <p className="mt-0.5 text-[0.6rem] text-bone/55">
                    Certificate COA-8842-1190 · deposited 26 Aug 2025
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-px border-y border-line bg-line/60">
                <div className="bg-card px-4 py-3">
                  <p className="text-[0.48rem] font-semibold uppercase tracking-[0.18em] text-ink/45">
                    Insured value
                  </p>
                  <p className="mt-1 text-[0.98rem] font-semibold tabular-nums tracking-[-0.02em] text-ink">
                    £786,400
                  </p>
                </div>
                <div className="bg-card px-4 py-3">
                  <p className="text-[0.48rem] font-semibold uppercase tracking-[0.18em] text-ink/45">
                    Policy
                  </p>
                  <p className="mt-1 text-[0.72rem] font-medium text-ink/85">
                    Cosmic All-Risk
                  </p>
                  <p className="text-[0.55rem] font-mono text-ink/45">
                    CV-P-8842
                  </p>
                </div>
              </div>

              {/* The cover travels with the object; say so on the record itself. */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-ice/60 px-4 py-2.5">
                <span className="text-[0.48rem] font-semibold uppercase tracking-[0.18em] text-primary">
                  Cover attached
                </span>
                <span className="text-[0.6rem] text-ink/65">
                  Theft, damage, flood, transit loss
                </span>
                <span className="ml-auto font-mono text-[0.52rem] text-ink/45">
                  £7,850 deductible
                </span>
              </div>

              <div className="px-4 pb-4 pt-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-[0.48rem] font-semibold uppercase tracking-[0.18em] text-ink/45">
                    Release
                  </p>
                  <span className="inline-flex items-center gap-1 text-[0.52rem] font-medium text-[#6b4296] dark:text-[#c9a6ea]">
                    <span className="size-1.5 rounded-full bg-[#7b4fae]" />
                    In Transit
                  </span>
                </div>
                <ol className="mt-3 grid grid-cols-5 items-start">
                  {RELEASE_STEPS.map((step, index) => (
                    <li key={step.label} className="relative flex flex-col items-center text-center">
                      {index > 0 && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute right-1/2 top-[5px] h-px w-full",
                            step.state === "next" ? "bg-ink/15" : "bg-primary/40",
                          )}
                        />
                      )}
                      <span
                        className={cn(
                          "relative z-10 grid size-[11px] place-items-center rounded-full border",
                          step.state === "done" && "border-primary bg-primary",
                          step.state === "active" &&
                            "border-[#7b4fae] bg-card ring-2 ring-[#7b4fae]/20",
                          step.state === "skipped" && "border-dashed border-ink/30 bg-card",
                          step.state === "next" && "border-ink/20 bg-card",
                        )}
                      >
                        {step.state === "active" && (
                          <span className="size-[5px] rounded-full bg-[#7b4fae]" />
                        )}
                      </span>
                      <span
                        className={cn(
                          "mt-2 text-[0.46rem] font-medium leading-[1.3] tracking-[0.01em]",
                          step.state === "active"
                            ? "text-[#6b4296] dark:text-[#c9a6ea]"
                            : step.state === "done"
                              ? "text-ink/70"
                              : "text-ink/35",
                        )}
                      >
                        {step.label}
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                  <p className="text-[0.52rem] text-ink/45">
                    Updated 18 Oct 2026 · 09:00
                  </p>
                  <Link
                    to="/dashboard/vault"
                    className="group inline-flex items-center gap-1 text-[0.58rem] font-semibold text-primary"
                  >
                    Open record
                    <ArrowUpRight className="size-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            </article>

          </motion.div>
        </div>

        <div className="mt-16 border-t border-line pt-6 lg:mt-20">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            {LEDGER.map((item) => (
              <div key={item.label}>
                <dd className="text-[1.35rem] font-semibold tabular-nums tracking-[-0.03em] text-ink">
                  {item.value}
                </dd>
                <dt className="mt-1 text-[0.62rem] uppercase tracking-[0.16em] text-ink/45">
                  {item.label}
                </dt>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-[0.58rem] leading-4 text-ink/35">
            Demonstration ledger, updated 20 Oct 2026. Figures describe the
            demonstration records, not a live book of business.
          </p>
        </div>
      </div>
    </section>
  );
}
