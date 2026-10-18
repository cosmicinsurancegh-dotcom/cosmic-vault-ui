import { CtaLink } from "@/components/site/Cta";
import { Media } from "@/components/site/Media";
import { Reveal } from "@/components/site/Reveal";
import { ADVISOR_FACES, IMAGES } from "@/lib/imagery";
import { SectionLabel } from "./SectionLabel";

export function Story() {
  return (
    <section id="about" className="relative mt-24 scroll-mt-28 sm:mt-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <Reveal>
          <SectionLabel className="text-ink/65">
            Our promise
          </SectionLabel>
        </Reveal>

        <div className="mt-8 grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
          <Reveal y={34} className="lg:col-span-5">
            <div className="group relative">
              <div className="media-frame relative overflow-hidden rounded-[1.8rem] border border-ink/10">
                <Media
                  image={IMAGES.story}
                  parallax={16}
                  overlay="floor"
                  className="aspect-[4/4.6] w-full"
                />
                <p className="absolute bottom-4 left-4 text-[0.6rem] uppercase tracking-[0.26em] text-bone/75">
                  Insurance for the long horizon
                </p>
              </div>

              <div className="absolute -bottom-10 -left-3 hidden w-28 overflow-hidden rounded-[1.3rem] border-[5px] border-background transition-transform duration-500 ease-out group-hover:-translate-y-1.5 sm:block lg:-left-6 lg:w-32">
                <Media image={IMAGES.storyDetail} className="aspect-square w-full" />
              </div>

              <div className="absolute -bottom-6 right-3 rounded-2xl border border-line bg-card px-5 py-4 transition-transform duration-500 ease-out group-hover:-translate-y-1 sm:-right-6">
                <p className="font-display text-3xl italic leading-none text-electric">
                  Clear terms
                </p>
                <p className="mt-1.5 text-[0.6rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Written to be read, not skimmed
                </p>
              </div>
            </div>
          </Reveal>

          <div className="lg:col-span-7">
            <Reveal delay={0.1}>
              <h2 className="text-balance text-[clamp(1.95rem,3.9vw,3.3rem)] font-semibold leading-[1.06] tracking-[-0.042em] text-ink">
                We believe cover should feel less like a contract and more like{" "}
                <span className="text-electric">peace of mind.</span>
              </h2>
            </Reveal>

            <Reveal delay={0.18}>
              <p className="mt-6 max-w-xl text-[0.95rem] leading-7 text-muted-foreground">
                Most insurers sell you a policy and disappear. We stay. Every
                Cosmic Vault plan is built around your actual life — the home,
                the health, the people, the plans you haven&apos;t made yet —
                and looked after by a named advisor who answers their own phone.
              </p>
              <p className="mt-4 max-w-xl text-[0.95rem] leading-7 text-muted-foreground">
                No call queues. No invented jargon. No quiet exclusions buried
                on page nineteen. Just careful protection, transparently priced.
              </p>
            </Reveal>

            <Reveal delay={0.26}>
              <div className="mt-8 flex flex-wrap items-center gap-6">
                <CtaLink to="/cover" variant="primary">
                  Explore our cover
                </CtaLink>
                <div className="flex items-center gap-3">
                  <div className="group flex -space-x-2.5">
                    {ADVISOR_FACES.map((face) => (
                      <Media
                        key={face.src}
                        image={face}
                        className="size-9 rounded-full border-2 border-background transition-transform duration-300 hover:-translate-y-1"
                        imgClassName="scale-105"
                      />
                    )).reverse()}
                  </div>
                  <p className="text-xs leading-4 text-muted-foreground">
                    Real people,
                    <br />
                    on the record.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
