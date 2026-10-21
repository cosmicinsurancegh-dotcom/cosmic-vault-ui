import { Media } from "@/components/site/Media";
import { Reveal } from "@/components/site/Reveal";
import { MINERAL_IMAGES, type VaultImage } from "@/lib/imagery";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const pillars: { title: string; text: string; image: VaultImage; caption: string }[] = [
  {
    title: "Dual-control access",
    text: "No drawer opens for one person. Two authorised custodians, separate credentials, and a log entry that names both — whether the visit is a deposit, an appraisal or a release.",
    image: MINERAL_IMAGES.bullionDetail,
    caption: "Two custodians on every opening",
  },
  {
    title: "Condition, not just security",
    text: "Bullion, gems and reactive specimens do not want the same air. Each class is held in monitored conditions, checked on a schedule, and any change in condition is recorded against the object.",
    image: MINERAL_IMAGES.diamonds,
    caption: "Monitored, class by class",
  },
  {
    title: "A chain of evidence",
    text: "Deposit photographs, seal numbers, assay cards, appraisals and every movement are attached to one record. It is the same file used to settle a claim, which is why nothing has to be reconstructed later.",
    image: MINERAL_IMAGES.rareEarth,
    caption: "One file from deposit to claim",
  },
  {
    title: "A custodian with a name",
    text: "Every record has a custodian accountable for it. Requests reference that person, not a queue, and a handover is recorded rather than implied.",
    image: MINERAL_IMAGES.platinum,
    caption: "Accountability, by name",
  },
];

export function Why() {
  const [active, setActive] = useState(0);
  const [visual, setVisual] = useState(0);
  const shown = pillars[visual];

  const select = (index: number) => {
    setVisual(index);
    setActive((current) => (current === index ? -1 : index));
  };

  return (
    <section id="standards" className="relative mt-24 scroll-mt-24 sm:mt-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.30em] text-ink/65">
            Vault standards
          </p>
          <h2 className="mt-4 text-balance text-[clamp(2.1rem,4.6vw,3.7rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
            The questions worth{" "}
            <span className="text-electric">asking.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[0.92rem] leading-6 text-muted-foreground">
            Anyone can show you a door. These are the four operating decisions
            that make the insurance behind it credible.
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
                      onClick={() => select(index)}
                      aria-expanded={isOpen}
                      className="group flex w-full cursor-pointer items-start gap-4 py-6 text-left sm:gap-5"
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-9 shrink-0 place-items-center rounded-[4px] text-[0.68rem] font-semibold transition-all duration-300",
                          isOpen
                            ? "bg-primary text-primary-foreground"
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
                          <span className="grid size-7 shrink-0 place-items-center rounded-[4px] border border-line text-ink/50 transition-colors group-hover:border-ink/30 group-hover:text-ink">
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
            <div className="sticky top-28 flex h-full flex-col">
              <div className="relative min-h-[22rem] flex-1 overflow-hidden rounded-[4px] border border-ink/10">
                <AnimatePresence initial={false}>
                  <motion.div
                    key={shown.image.src}
                    initial={{ opacity: 0, scale: 1.04 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0"
                  >
                    <Media image={shown.image} overlay="floor" className="size-full" />
                  </motion.div>
                </AnimatePresence>

                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={shown.caption}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.35 }}
                    >
                      <p className="font-display text-[1.35rem] italic leading-snug text-bone">
                        {shown.caption}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <p className="text-[0.65rem] uppercase tracking-[0.2em] text-bone/60">
                          Vault standards
                        </p>
                        <span className="h-px flex-1 bg-white/25" />
                        <p className="text-[0.65rem] uppercase tracking-[0.2em] text-bone/45">
                          0{visual + 1} / 0{pillars.length}
                        </p>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
