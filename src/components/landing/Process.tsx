import { CtaButton } from "@/components/site/Cta";
import { Media } from "@/components/site/Media";
import { Reveal } from "@/components/site/Reveal";
import { MINERAL_IMAGES } from "@/lib/imagery";
import { SectionLabel } from "./SectionLabel";
import { LockKeyhole } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Deposit at the desk",
    text: "Arrive with the object or consign it under seal. It is photographed, weighed and referenced at the table before anything else happens.",
    image: MINERAL_IMAGES.bullion,
  },
  {
    number: "02",
    title: "Appraise and document",
    text: "Assay for bullion, stone-by-stone appraisal for gems. The certificate, images and declared value attach to the record.",
    image: MINERAL_IMAGES.diamonds,
  },
  {
    number: "03",
    title: "Bind the policy",
    text: "A named, agreed-value policy is issued before the drawer closes — premium, deductible and perils written into the schedule.",
    image: MINERAL_IMAGES.platinum,
  },
  {
    number: "04",
    title: "Store, release, track",
    text: "Dual-control custody with a timestamped release. You see every stage, and the cover travels with the object.",
    image: MINERAL_IMAGES.emerald,
  },
];

export function Process({ onReview }: { onReview: () => void }) {
  return (
    <section id="process" className="mt-24 scroll-mt-24 sm:mt-32">
      <div className="mx-auto max-w-[1240px] px-5">
        <Reveal y={36}>
          <div className="relative overflow-hidden rounded-[4px] border border-line bg-card px-6 py-12 text-ink shadow-[0_30px_70px_-52px_rgba(10,18,36,0.4)] sm:px-10 sm:py-14">
            <div
              aria-hidden="true"
              className="vault-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_20%_0%,black,transparent_72%)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-24 -top-24 size-[26rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.10),transparent_65%)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 top-1/2 hidden size-[24rem] -translate-y-1/2 rounded-full border border-ink/[0.07] xl:block"
            >
              <span className="absolute inset-12 rounded-full border border-ink/[0.05]" />
              <span className="absolute left-1/2 top-0 size-1.5 -translate-x-1/2 rounded-full bg-primary" />
            </div>

            <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="max-w-2xl">
                <SectionLabel className="text-ink/45">The deposit</SectionLabel>
                <h2 className="mt-4 text-balance text-[clamp(2.1rem,4.6vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
                  From the desk to the drawer,{" "}
                  <span className="text-electric">in one file.</span>
                </h2>
                <p className="mt-3 max-w-lg text-[0.92rem] leading-7 text-ink/55">
                  No hand-off between a storage company and an insurance company.
                  The same team that seals the case writes the cover.
                </p>
              </div>
              <p className="flex items-center gap-2 text-[0.68rem] text-ink/45 lg:pb-2">
                <LockKeyhole className="size-3.5 text-ink/45" />
                Vault access is dual-control at every stage
              </p>
            </div>

            <div className="relative mt-10 grid gap-7 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
              {steps.map((step, index) => (
                <Reveal key={step.number} delay={index * 0.08}>
                  <div className="group relative border-t border-line pt-5">
                    <span className="absolute -top-[3px] left-0 size-1.5 rounded-full bg-primary transition-transform duration-500 group-hover:scale-150" />
                    <div className="flex items-baseline justify-between">
                      <span className="font-display text-4xl italic leading-none text-ink/20 transition-colors duration-500 group-hover:text-primary">
                        {step.number}
                      </span>
                    </div>
                    <Media
                      image={step.image}
                      overlay="soft"
                      className="mt-4 aspect-[16/10] w-full rounded-[4px] border border-line opacity-95 transition-opacity duration-500 group-hover:opacity-100"
                      imgClassName="grayscale-[12%]"
                    />
                    <h3 className="mt-4 text-[1.02rem] font-medium tracking-[-0.02em] text-ink">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-[0.82rem] leading-6 text-ink/55">
                      {step.text}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>

            <div className="relative mt-9 flex flex-col items-start justify-between gap-4 border-t border-line pt-6 sm:flex-row sm:items-center">
              <p className="max-w-md text-[0.78rem] leading-6 text-ink/45">
                Remote deposits are accepted where the object already carries an
                independent assay or appraisal. The record starts the moment it
                is referenced, not when it reaches a drawer.
              </p>
              <CtaButton onClick={onReview}>Start a vault review</CtaButton>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
