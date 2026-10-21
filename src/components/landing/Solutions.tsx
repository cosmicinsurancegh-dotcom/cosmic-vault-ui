import { Media } from "@/components/site/Media";
import { Reveal } from "@/components/site/Reveal";
import { SpotlightCard } from "@/components/site/SpotlightCard";
import { MINERAL_IMAGES } from "@/lib/imagery";
import type { CoverageKey } from "@/lib/vault";
import { ArrowUpRight, Plus } from "lucide-react";
import { SectionLabel } from "./SectionLabel";

const CLASSES: {
  key: CoverageKey;
  index: string;
  title: string;
  examples: string;
  units: string;
  cover: string;
  image: (typeof MINERAL_IMAGES)[keyof typeof MINERAL_IMAGES];
}[] = [
  {
    key: "home",
    index: "01",
    title: "Bullion & bars",
    examples: "Fine gold, silver, platinum, sovereign coins",
    units: "Weighed in g · oz · kg",
    cover: "Insured to the assayed weight",
    image: MINERAL_IMAGES.bullion,
  },
  {
    key: "life",
    index: "02",
    title: "Diamonds & gemstones",
    examples: "Loose stones, parcels, finished high jewellery",
    units: "Graded per stone in ct",
    cover: "Insured to the independent appraisal",
    image: MINERAL_IMAGES.diamonds,
  },
  {
    key: "health",
    index: "03",
    title: "Rare earths & critical metals",
    examples: "Specimens, oxides, certified reference samples",
    units: "Recorded to the certificate",
    cover: "Insured to the documented grade",
    image: MINERAL_IMAGES.rareEarth,
  },
  {
    key: "auto",
    index: "04",
    title: "Collections & heirlooms",
    examples: "Single-owner collections, signed pieces, family pieces",
    units: "One record per object",
    cover: "Insured piece by piece, not as contents",
    image: MINERAL_IMAGES.ruby,
  },
];

export function Solutions({ onReview }: { onReview: (coverage?: CoverageKey) => void }) {
  return (
    <section
      id="store"
      className="relative mt-24 scroll-mt-24 overflow-hidden border-y border-line bg-muted py-20 sm:mt-32 sm:py-24"
    >
      <div
        aria-hidden="true"
        className="vault-grid pointer-events-none absolute inset-0 opacity-45 [mask-image:radial-gradient(ellipse_at_50%_18%,black,transparent_72%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-40 size-[34rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(10,18,36,0.05),transparent_66%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 bottom-0 size-[28rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.08),transparent_68%)]"
      />

      <div className="relative mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-7">
            <SectionLabel className="text-ink/45">What we store</SectionLabel>
            <h2 className="mt-4 text-balance text-[clamp(2.1rem,4.6vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
              Four classes.
              <br />
              One standard of{" "}
              <span className="text-primary">custody.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-5 lg:pb-2">
            <p className="max-w-md text-[0.92rem] leading-7 text-ink/60">
              If it can be weighed, assayed or certified, it can be held here.
              Each class is appraised by the same desk that writes the policy, so
              the declared value and the insured value are the same number.
            </p>
            <button
              type="button"
              onClick={() => onReview()}
              className="link-slide group mt-4 inline-flex w-fit items-center gap-1.5 pb-0.5 text-sm font-medium text-primary transition-colors hover:text-ink"
            >
              Ask about another material
              <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </button>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 sm:gap-5">
          {CLASSES.map((item, index) => (
            <Reveal key={item.key} delay={index * 0.07}>
              <SpotlightCard className="flex h-full w-full flex-col rounded-[4px] border border-line bg-card text-left shadow-[0_1px_2px_rgba(10,18,36,0.04)] transition-[transform,border-color,box-shadow] duration-500 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_24px_50px_-32px_rgba(10,18,36,0.35)]">
                <button
                  type="button"
                  onClick={() => onReview(item.key)}
                  className="flex h-full w-full cursor-pointer flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="relative w-full shrink-0 overflow-hidden">
                    <Media
                      image={item.image}
                      overlay="strong"
                      className="aspect-[16/9] w-full"
                    />
                    <span className="absolute left-5 top-5 text-[0.55rem] font-semibold tracking-[0.24em] text-bone/60">
                      {item.index}
                    </span>
                    <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-[4px] border border-white/20 bg-black/35 px-2 py-1 text-[0.5rem] font-semibold uppercase tracking-[0.16em] text-bone/80 backdrop-blur">
                      Covered
                    </span>
                    <h3 className="absolute inset-x-5 bottom-4 text-[1.3rem] font-semibold leading-tight tracking-[-0.025em] text-bone">
                      {item.title}
                    </h3>
                  </div>

                  <div className="flex flex-1 flex-col p-6 sm:p-7">
                    <p className="text-[0.84rem] leading-6 text-ink/60">
                      {item.examples}
                    </p>
                    <dl className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
                      <div>
                        <dt className="text-[0.5rem] font-semibold uppercase tracking-[0.18em] text-ink/40">
                          Recorded
                        </dt>
                        <dd className="mt-1 text-[0.76rem] text-ink/75">{item.units}</dd>
                      </div>
                      <div>
                        <dt className="text-[0.5rem] font-semibold uppercase tracking-[0.18em] text-ink/40">
                          Cover
                        </dt>
                        <dd className="mt-1 text-[0.76rem] text-ink/75">{item.cover}</dd>
                      </div>
                    </dl>
                    <span className="mt-6 inline-flex items-center justify-between">
                      <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-ink/50 transition-colors group-hover:text-primary">
                        Request this class
                      </span>
                      <span className="grid size-8 place-items-center rounded-[4px] border border-ink/15 text-ink/70 transition-all duration-500 group-hover:rotate-45 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                        <ArrowUpRight className="size-3.5" />
                      </span>
                    </span>
                  </div>
                </button>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.12}>
          <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-[4px] border border-line bg-card px-6 py-5 sm:flex-row sm:items-center">
            <p className="text-sm text-ink/60">
              <span className="font-medium text-ink">Something harder to classify?</span>{" "}
              Meteorites, signed pieces and prototype alloys have all passed
              through the appraisal desk. Ask before you assume.
            </p>
            <button
              type="button"
              onClick={() => onReview()}
              className="group inline-flex shrink-0 items-center gap-2 text-sm font-medium text-primary"
            >
              <span className="link-slide">Talk to the vault desk</span>
              <span className="grid size-7 place-items-center rounded-[4px] bg-primary text-primary-foreground transition-transform duration-300 group-hover:rotate-45">
                <Plus className="size-3.5" />
              </span>
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
