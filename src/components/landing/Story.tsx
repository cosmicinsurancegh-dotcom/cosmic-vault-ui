import { CtaLink } from "@/components/site/Cta";
import { Reveal } from "@/components/site/Reveal";
import { SectionLabel } from "./SectionLabel";

const advisors = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80",
  "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=120&q=80",
];

export function Story() {
  return (
    <section id="about" className="relative mt-24 scroll-mt-28 sm:mt-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <Reveal>
          <SectionLabel index="01" className="text-ink/55">
            Our promise
          </SectionLabel>
        </Reveal>

        <div className="mt-8 grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
          <Reveal y={34} className="lg:col-span-5">
            <div className="relative">
              <div className="relative overflow-hidden rounded-[1.8rem] border border-ink/10 bg-muted">
                <img
                  src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1100&q=80"
                  alt="Two Cosmic Vault advisors meeting with a member"
                  loading="lazy"
                  className="aspect-[4/4.6] w-full object-cover transition-transform duration-[1.4s] ease-out hover:scale-[1.035]"
                />
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#071227]/60 to-transparent" />
                <p className="absolute bottom-4 left-4 text-[0.6rem] uppercase tracking-[0.26em] text-bone/75">
                  Meridian Wharf · London
                </p>
              </div>

              <div className="absolute -bottom-6 right-3 rounded-2xl border border-line bg-card px-5 py-4 sm:-right-6">
                <p className="font-display text-3xl italic leading-none text-electric">
                  Since 2009
                </p>
                <p className="mt-1.5 text-[0.6rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Quietly protecting 24,000 lives
                </p>
              </div>
            </div>
          </Reveal>

          <div className="lg:col-span-7">
            <Reveal delay={0.1}>
              <h2 className="text-balance text-[clamp(1.95rem,3.9vw,3.3rem)] font-semibold leading-[1.06] tracking-[-0.042em] text-ink">
                We believe cover should feel less like a contract and more like{" "}
                <span className="font-display font-normal italic tracking-[-0.015em] text-electric">
                  peace of mind.
                </span>
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
                <CtaLink href="#coverage" variant="ink">
                  Explore our cover
                </CtaLink>
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2.5">
                    {advisors.map((src, index) => (
                      <img
                        key={src}
                        src={src}
                        alt=""
                        loading="lazy"
                        className="size-9 rounded-full border-2 border-background object-cover"
                        style={{ zIndex: advisors.length - index }}
                      />
                    ))}
                  </div>
                  <p className="text-xs leading-4 text-muted-foreground">
                    Advisors, not
                    <br />
                    call centres.
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
