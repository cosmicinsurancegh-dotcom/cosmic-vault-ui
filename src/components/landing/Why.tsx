import { Reveal } from "@/components/site/Reveal";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, ShieldCheck, Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const pillars = [
  {
    title: "Personal service",
    text: "Every plan is drawn up with a named advisor who knows your household, your history, and the details that actually matter. You'll never explain yourself twice.",
  },
  {
    title: "Fair, legible pricing",
    text: "One price, shown in full, before you decide. No teaser rates that double in year two and no commission buried in the fine print.",
  },
  {
    title: "Claims in 48 hours",
    text: "Nine in ten claims are assessed and settled within two working days. A real person owns your claim from first call to final payment.",
  },
  {
    title: "Always-on concierge",
    text: "Storm at 2am, diagnosis on a Friday, a fender bender abroad — your vault line is answered by a human, every hour of every day.",
  },
];

export function Why() {
  const [active, setActive] = useState(0);

  return (
    <section className="relative mt-24 sm:mt-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.30em] text-ink/50">
            02 — Why Cosmic Vault
          </p>
          <h2 className="mt-4 text-balance text-[clamp(2.1rem,4.6vw,3.7rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
            Why thousands{" "}
            <span className="font-display font-normal italic text-electric">
              trust
            </span>{" "}
            the vault.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[0.92rem] leading-6 text-muted-foreground">
            From first homes to final horizons, our members stay for one reason:
            when something goes wrong, we are already there.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            {pillars.map((pillar, index) => {
              const isOpen = active === index;
              return (
                <Reveal key={pillar.title} delay={index * 0.06}>
                  <div
                    className={cn(
                      "border-t border-line transition-colors",
                      index === pillars.length - 1 && "border-b",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setActive(isOpen ? -1 : index)}
                      aria-expanded={isOpen}
                      className="group flex w-full cursor-pointer items-start gap-4 py-6 text-left sm:gap-5"
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-9 shrink-0 place-items-center rounded-full text-[0.68rem] font-semibold transition-all duration-300",
                          isOpen
                            ? "bg-electric text-white"
                            : "bg-ink/[0.05] text-ink/55 group-hover:bg-ink/10",
                        )}
                      >
                        0{index + 1}
                      </span>
                      <span className="flex-1">
                        <span className="flex items-center justify-between gap-4">
                          <span
                            className={cn(
                              "text-lg font-medium tracking-[-0.02em] transition-colors sm:text-xl",
                              isOpen ? "text-ink" : "text-ink/75",
                            )}
                          >
                            {pillar.title}
                          </span>
                          <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line text-ink/50 transition-colors group-hover:border-ink/30 group-hover:text-ink">
                            {isOpen ? (
                              <Minus className="size-3.5" />
                            ) : (
                              <Plus className="size-3.5" />
                            )}
                          </span>
                        </span>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.span
                              key="content"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                              className="block overflow-hidden"
                            >
                              <span className="mt-2.5 block max-w-lg text-sm leading-6 text-muted-foreground">
                                {pillar.text}
                              </span>
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                    </button>
                  </div>
                </Reveal>
              );
            })}
          </div>

          <Reveal y={30} delay={0.1} className="lg:col-span-5">
            <div className="relative h-full">
              <div className="relative h-full min-h-[22rem] overflow-hidden rounded-[1.8rem] border border-ink/10">
                <img
                  src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1100&q=80"
                  alt="A Cosmic Vault advisor listening to a member"
                  loading="lazy"
                  className="size-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#071227]/80 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                  <div className="flex items-center gap-1 text-halo">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} className="size-3.5 fill-halo" />
                    ))}
                  </div>
                  <p className="mt-3 font-display text-[1.35rem] italic leading-snug text-bone">
                    &ldquo;They picked up at 11pm and had us sorted by
                    morning.&rdquo;
                  </p>
                  <p className="mt-2 text-[0.65rem] uppercase tracking-[0.2em] text-bone/60">
                    Member since 2016 · Bristol
                  </p>
                </div>
              </div>

              <div className="absolute -left-3 top-5 flex items-center gap-2.5 rounded-full border border-line bg-card/95 px-4 py-2.5 backdrop-blur sm:-left-5">
                <span className="grid size-8 place-items-center rounded-full bg-electric/10 text-electric">
                  <ShieldCheck className="size-4" />
                </span>
                <div className="pr-1">
                  <p className="text-sm font-semibold leading-none text-ink">98%</p>
                  <p className="mt-1 text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground">
                    Claims paid in full
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
