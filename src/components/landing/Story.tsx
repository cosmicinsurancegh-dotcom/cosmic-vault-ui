import { CtaLink } from "@/components/site/Cta";
import { Media } from "@/components/site/Media";
import { Reveal } from "@/components/site/Reveal";
import { MINERAL_IMAGES } from "@/lib/imagery";
import { Fingerprint, ScanLine, ShieldCheck, Truck } from "lucide-react";
import { SectionLabel } from "./SectionLabel";

const evidence = [
  {
    Icon: ScanLine,
    title: "Photographed and sealed",
    body: "Every object is imaged, weighed and closed into a tamper-evident case at the deposit table.",
  },
  {
    Icon: Fingerprint,
    title: "Two people, every time",
    body: "No drawer opens alone. Access is dual-control and every movement is attributed to a named custodian.",
  },
  {
    Icon: ShieldCheck,
    title: "Cover before storage",
    body: "The policy is bound against the appraised object, not a contents estimate — and it follows it in transit.",
  },
  {
    Icon: Truck,
    title: "Released on the record",
    body: "Five tracked stages, each with a timestamp and a note, visible to you the moment it changes.",
  },
];

export function Story() {
  return (
    <section id="custody" className="relative mt-24 scroll-mt-28 sm:mt-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <Reveal>
          <SectionLabel className="text-ink/65">Why one record</SectionLabel>
        </Reveal>

        <div className="mt-8 grid gap-12 lg:grid-cols-12 lg:items-start lg:gap-16">
          <Reveal y={34} className="lg:col-span-5">
            <div className="group relative">
              <div className="media-frame relative overflow-hidden rounded-[4px] border border-ink/10">
                <Media
                  image={MINERAL_IMAGES.bullionDetail}
                  parallax={16}
                  overlay="floor"
                  className="aspect-[4/4.4] w-full"
                />
                <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2">
                  <span className="rounded-[4px] border border-white/20 bg-black/30 px-2.5 py-1 text-[0.52rem] font-semibold uppercase tracking-[0.18em] text-bone/85 backdrop-blur">
                    Vault A · Drawer 12
                  </span>
                  <span className="rounded-[4px] border border-white/20 bg-black/30 px-2.5 py-1 text-[0.52rem] font-semibold uppercase tracking-[0.18em] text-bone/85 backdrop-blur">
                    Sealed
                  </span>
                </div>
                <p className="absolute bottom-4 right-4 max-w-[10.5rem] text-right text-[0.62rem] leading-5 text-bone/75">
                  The bar, its assay card, its appraisal and its policy — one
                  drawer, one reference.
                </p>
              </div>

              <div className="absolute -bottom-10 -left-3 hidden w-32 overflow-hidden rounded-[4px] border-[5px] border-background shadow-[0_24px_44px_-28px_rgba(8,18,39,0.65)] transition-transform duration-500 ease-out group-hover:-translate-y-1.5 sm:block lg:-left-6 lg:w-36">
                <Media image={MINERAL_IMAGES.diamonds} className="aspect-square w-full" />
              </div>
            </div>

            <div className="mt-16 flex items-center gap-3 rounded-[4px] border border-line bg-card px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-[4px] bg-ice font-mono text-[0.66rem] font-semibold text-primary">
                IC
              </span>
              <div className="min-w-0">
                <p className="truncate text-[0.74rem] font-semibold text-ink">
                  Iris Chen · Custodian, Vault A
                </p>
                <p className="text-[0.64rem] text-muted-foreground">
                  Named on every deposit and release record
                </p>
              </div>
            </div>
          </Reveal>

          <div className="lg:col-span-7">
            <Reveal delay={0.1}>
              <h2 className="text-balance text-[clamp(1.95rem,3.9vw,3.3rem)] font-semibold leading-[1.06] tracking-[-0.042em] text-ink">
                Custody and cover should never be{" "}
                <span className="text-electric">two companies.</span>
              </h2>
            </Reveal>

            <Reveal delay={0.18}>
              <p className="mt-6 max-w-xl text-[0.95rem] leading-7 text-muted-foreground">
                A storage provider holds the object. An insurer prices the risk.
                The gap between them is where claims quietly fail — who had it
                when, what it weighed, which seal was intact. Cosmic Vault closes
                that gap by doing both against one record.
              </p>
              <p className="mt-4 max-w-xl text-[0.95rem] leading-7 text-muted-foreground">
                The deposit photograph, the assay, the appraisal, the policy
                number and every release movement sit on the same certificate.
                When something moves, the insurance moves with it.
              </p>
            </Reveal>

            <Reveal delay={0.24}>
              <ul className="mt-8 grid gap-x-6 gap-y-5 sm:grid-cols-2">
                {evidence.map(({ Icon, title, body }) => (
                  <li key={title} className="flex gap-3">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[4px] bg-primary/[0.07] text-primary">
                      <Icon className="size-3.5" strokeWidth={1.9} />
                    </span>
                    <div>
                      <p className="text-[0.82rem] font-semibold text-ink">{title}</p>
                      <p className="mt-1 text-[0.76rem] leading-5 text-muted-foreground">
                        {body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.3}>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <CtaLink href="#standards" variant="primary">
                  Read the custody standard
                </CtaLink>
                <a
                  href="#process"
                  className="link-slide text-sm font-medium text-ink/70 transition-colors hover:text-primary"
                >
                  How a deposit works
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
