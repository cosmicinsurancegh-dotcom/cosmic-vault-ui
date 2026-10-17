import { CtaButton } from "@/components/site/Cta";
import { Reveal } from "@/components/site/Reveal";
import {
  PLANS,
  planPrice,
  YEARLY_DISCOUNT,
  formatGBP,
} from "@/lib/vault";
import { cn } from "@/lib/utils";
import { Check, Leaf, PhoneCall, ShieldCheck, Timer } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { SectionLabel } from "./SectionLabel";

const assurances = [
  { Icon: ShieldCheck, label: "No exit fees, ever" },
  { Icon: Timer, label: "48-hour claim promise" },
  { Icon: PhoneCall, label: "Human line, 24/7" },
  { Icon: Leaf, label: "Carbon-neutral cover" },
];

export function Plans({
  onQuote,
}: {
  onQuote: (plan?: string) => void;
}) {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="plans" className="mt-24 scroll-mt-24 sm:mt-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <Reveal>
            <SectionLabel index="05" className="text-ink/55">
              Plans
            </SectionLabel>
            <h2 className="mt-4 max-w-xl text-balance text-[clamp(2.1rem,4.5vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
              Cover that grows{" "}
              <span className="text-electric">with you.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.1} className="flex flex-col items-start gap-3 lg:items-end">
            <p className="max-w-xs text-[0.9rem] leading-6 text-muted-foreground lg:text-right">
              Simple monthly pricing. Switch plans whenever life changes — your
              advisor handles the paperwork.
            </p>
            <div className="flex items-center gap-2.5">
              <div className="relative inline-flex items-center rounded-full border border-line bg-card p-1">
                {[
                  { label: "Monthly", value: false },
                  { label: "Yearly", value: true },
                ].map((option) => {
                  const isActive = yearly === option.value;
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setYearly(option.value)}
                      className={cn(
                        "relative rounded-full px-4 py-2 text-xs font-medium transition-colors duration-300",
                        isActive ? "text-white" : "text-ink/55 hover:text-ink",
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="billing-pill"
                          className="absolute inset-0 rounded-full bg-ink"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        />
                      )}
                      <span className="relative">{option.label}</span>
                    </button>
                  );
                })}
              </div>
              <span className="rounded-full border border-electric/20 bg-electric/[0.07] px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-electric">
                Save {Math.round(YEARLY_DISCOUNT * 100)}%
              </span>
            </div>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-4 sm:gap-5 lg:grid-cols-2">
          {PLANS.map((plan, index) => {
            const price = planPrice(plan.monthly, yearly);
            const featured = Boolean(plan.featured);
            const saved = plan.monthly * 12 - price * 12;

            return (
              <Reveal key={plan.id} delay={index * 0.07}>
                <article
                  className={cn(
                    "group relative flex h-full flex-col overflow-hidden rounded-[1.6rem] border p-6 transition-all duration-500 hover:-translate-y-1 sm:p-8",
                    featured
                      ? "starfield border-[#132648] bg-[#071227] text-bone"
                      : "border-line bg-card text-ink hover:border-ink/20",
                  )}
                >
                  {featured && (
                    <span className="absolute right-5 top-5 rounded-full bg-electric px-3 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white">
                      Most chosen
                    </span>
                  )}

                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-semibold tracking-[-0.03em]">
                        {plan.name}
                      </h3>
                      <p
                        className={cn(
                          "mt-1 max-w-[17rem] text-[0.82rem] leading-5",
                          featured ? "text-bone/55" : "text-muted-foreground",
                        )}
                      >
                        {plan.tagline}
                      </p>
                    </div>
                    {!featured && (
                      <span className="text-[0.6rem] font-semibold tracking-[0.2em] text-ink/20">
                        0{index + 1}
                      </span>
                    )}
                  </div>

                  <div className="mt-7 flex items-end gap-2">
                    <span className="text-[2.9rem] font-semibold leading-none tracking-[-0.055em]">
                      {formatGBP(price)}
                    </span>
                    <span
                      className={cn(
                        "pb-1.5 text-xs",
                        featured ? "text-bone/45" : "text-muted-foreground",
                      )}
                    >
                      / month
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-1.5 text-[0.7rem]",
                      featured ? "text-bone/40" : "text-muted-foreground",
                    )}
                  >
                    {yearly
                      ? `Billed ${formatGBP(price * 12)} yearly · save ${formatGBP(saved)}`
                      : "Billed monthly · cancel anytime"}
                  </p>

                  <div
                    className={cn(
                      "my-6 h-px w-full",
                      featured ? "bg-white/10" : "bg-line",
                    )}
                  />

                  <ul className="flex-1 space-y-3">
                    {plan.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-2.5">
                        <span
                          className={cn(
                            "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full",
                            featured
                              ? "bg-electric/25 text-electric-soft"
                              : "bg-electric/10 text-electric",
                          )}
                        >
                          <Check className="size-2.5" strokeWidth={3} />
                        </span>
                        <span
                          className={cn(
                            "text-[0.85rem] leading-5",
                            featured ? "text-bone/70" : "text-ink/70",
                          )}
                        >
                          {perk}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8">
                    <CtaButton
                      variant={featured ? "light" : "outline"}
                      onClick={() => onQuote(plan.name)}
                      className="w-full justify-between"
                    >
                      Choose {plan.name}
                    </CtaButton>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.1}>
          <div className="mt-10 grid gap-4 border-t border-line pt-7 sm:grid-cols-2 lg:grid-cols-4">
            {assurances.map(({ Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-full bg-ink/[0.045] text-ink/60">
                  <Icon className="size-4" strokeWidth={1.8} />
                </span>
                <span className="text-[0.8rem] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
