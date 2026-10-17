import {
  Callout,
  CheckList,
  CtaPanel,
  FeatureGrid,
  PageHero,
  PageSection,
  RelatedLinks,
  SiteButton,
} from "@/components/site/PageShell";
import { usePageMeta } from "@/hooks/use-page-meta";
import { COVERS } from "@/lib/covers";
import {
  ClipboardCheck,
  FileCheck2,
  Handshake,
  ScanLine,
  ScrollText,
  UserRound,
} from "lucide-react";
import { Link } from "react-router";

export default function AllCover() {
  usePageMeta(
    "All insurance products",
    "Browse every cover line available from Cosmic Vault — home, motor, travel, health, life and business — and see what each is designed to protect.",
  );

  return (
    <>
      <PageHero
        eyebrow="Cover · All products"
        title="Every cover line, in one place."
        intro="Six products are configured in the platform today. Each has its own questions, rating rules, limits and exclusions — so the terms you are quoted are the terms that apply."
        aside={{
          title: "Only what exists",
          body: "We advertise the cover lines that are genuinely configured and available for application. There are no coming-soon products on this page.",
          items: [
            { label: "Understanding your coverage", href: "/cover/understanding" },
            { label: "Coverage limits and exclusions", href: "/cover/limits-and-exclusions" },
          ],
        }}
        actions={
          <>
            <SiteButton to="/quote">Get a quote</SiteButton>
            <SiteButton to="/how-it-works" variant="outline">
              How it works
            </SiteButton>
          </>
        }
      />

      <PageSection
        eyebrow="The catalogue"
        title="Choose the cover you're considering."
        intro="Open a cover line to see what it is for, who it may suit, what an underwriter will ask for, and the limitations worth understanding before you apply."
      >
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
          {COVERS.map((cover, index) => (
            <Link
              key={cover.slug}
              to={`/cover/${cover.slug}`}
              className="group relative flex flex-col overflow-hidden rounded-[1.5rem] border border-line bg-card p-6 transition-all duration-500 hover:-translate-y-1 hover:border-primary/30 sm:p-7"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.10),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
              <div className="relative flex items-start justify-between gap-4">
                <span className="rounded-full border border-line bg-ice px-2.5 py-1 text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-primary">
                  {cover.productName}
                </span>
                <span className="text-[0.58rem] font-semibold tracking-[0.18em] text-ink/25">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>

              <h2 className="relative mt-6 text-[1.35rem] font-semibold tracking-[-0.03em] text-ink">
                {cover.name}
              </h2>
              <p className="relative mt-2 max-w-[26rem] flex-1 text-[0.86rem] leading-6 text-muted-foreground">
                {cover.summary}
              </p>

              <span className="relative mt-6 inline-flex items-center gap-2 text-[0.8rem] font-medium text-ink transition-colors group-hover:text-primary">
                Explore this cover
                <span className="grid size-7 place-items-center rounded-full border border-ink/12 transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                  <ScanLine className="size-3.5" />
                </span>
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-6">
          <Callout title="Nothing here is a price promise">
            Every premium shown during a quotation is indicative and calculated
            from the published rating rules for that product. Final terms depend
            on underwriting, the policy schedule, and the policy wording in force
            when cover starts.
          </Callout>
        </div>
      </PageSection>

      <PageSection
        tone="ice"
        eyebrow="Common ground"
        title="What every application has in common."
        intro="The cover lines differ, but the way we assess them does not."
      >
        <FeatureGrid
          items={[
            {
              title: "A question set per product",
              icon: ClipboardCheck,
              body: "Each product asks about the specific risk it covers, rather than forcing every applicant through the same generic form.",
            },
            {
              title: "Manual underwriting",
              icon: UserRound,
              body: "A person reviews the application, may request more information, and records a decision with reasons.",
            },
            {
              title: "Documents on the record",
              icon: FileCheck2,
              body: "Identification and evidence are attached to the application and stay in your document vault.",
            },
            {
              title: "The wording governs",
              icon: ScrollText,
              body: "Our pages summarise how a product is built. Your schedule, wording, and endorsements decide any claim.",
            },
            {
              title: "Consent is explicitly recorded",
              icon: Handshake,
              body: "Nothing is submitted on your behalf. Submitting an application records your own consent, with the date.",
            },
          ]}
          columns={3}
        />
      </PageSection>

      <PageSection
        eyebrow="Before you apply"
        title="Three things worth doing first."
      >
        <div className="grid gap-8 lg:grid-cols-2">
          <CheckList
            items={[
              "Read the guidance on limits and exclusions — it is shorter than the policy and covers the decisive points.",
              "Check that the cover you are considering responds to the most likely thing to go wrong, not the most dramatic.",
              "Gather the documents the product lists, so an information request does not stall your application.",
            ]}
          />
          <div className="rounded-[1.3rem] border border-line bg-card p-6">
            <p className="text-[0.82rem] font-semibold text-ink">
              Not sure which cover you need?
            </p>
            <p className="mt-2 text-[0.82rem] leading-6 text-muted-foreground">
              Send us a request describing what you want to protect. An advisor
              will tell you which cover line fits and which does not — including
              when the answer is that you need less than you thought.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <SiteButton to="/quote" variant="primary">
                Request a quote
              </SiteButton>
              <SiteButton to="/help" variant="outline">
                Visit the help centre
              </SiteButton>
            </div>
          </div>
        </div>
      </PageSection>

      <CtaPanel
        eyebrow="Next step"
        title="Start with the cover closest to your life."
        body="Quotations are held on your record, so you can compare cover lines before committing to an application."
        primary={{ label: "Get a quote", to: "/quote" }}
        secondary={{ label: "How cover is priced", to: "/how-it-works" }}
      />

      <RelatedLinks
        title="Useful next"
        links={[
          {
            label: "Understanding your coverage",
            href: "/cover/understanding",
            description: "Limits, excesses, exclusions and disclosure",
          },
          {
            label: "Coverage limits and exclusions",
            href: "/cover/limits-and-exclusions",
            description: "The parts worth reading twice",
          },
          {
            label: "Frequently asked questions",
            href: "/faqs",
            description: "Search every answer",
          },
        ]}
      />
    </>
  );
}
