import {
  Callout,
  CheckList,
  CtaPanel,
  FaqList,
  FeatureGrid,
  PageHero,
  PageSection,
  RelatedLinks,
  SiteButton,
} from "@/components/site/PageShell";
import { usePageMeta } from "@/hooks/use-page-meta";
import { COVERS, coverBySlug } from "@/lib/covers";
import { coverImage } from "@/lib/imagery";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router";

export default function CoverDetail({ slug }: { slug: string }) {
  const cover = coverBySlug(slug);
  usePageMeta(
    cover ? cover.name : "Cover",
    cover?.metaDescription ?? "Insurance cover from Cosmic Vault.",
  );

  if (!cover) {
    return (
      <PageSection title="This cover could not be found.">
        <SiteButton to="/cover">Back to all cover</SiteButton>
      </PageSection>
    );
  }

  const others = COVERS.filter((item) => item.slug !== cover.slug).slice(0, 3);

  return (
    <>
      <PageHero
        eyebrow={cover.eyebrow}
        title={cover.headline}
        intro={cover.intro}
        media={{ image: coverImage(cover.slug), caption: cover.productName }}
        aside={{
          title: "At a glance",
          body: cover.summary,
          items: [
            { label: "Get a quote", href: "/quote" },
            { label: "How applying works", href: "/how-it-works/apply" },
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
      >
        <p className="mt-8 inline-flex items-center gap-2 rounded-[4px] border border-line bg-card px-4 py-2 text-[0.72rem] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-electric" />
          Configured product: {cover.productName}
        </p>
      </PageHero>

      <PageSection
        eyebrow="What it covers"
        title={`What ${cover.name.toLowerCase()} is for.`}
        intro="These are the coverage areas designed into this product. Limits, excesses and optional elements are stated in your schedule and the policy wording."
      >
        <FeatureGrid items={cover.coverageAreas} columns={2} />
      </PageSection>

      <PageSection
        tone="ice"
        eyebrow="Fit and readiness"
        title="Who it may suit, and what to have ready."
        intro="Applications move fastest when the details are already to hand. Neither list is a guarantee of acceptance - underwriting decides."
      >
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-ink/60">
              Who it may suit
            </p>
            <div className="mt-4">
              <CheckList items={cover.suitableFor} />
            </div>
          </div>
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-ink/60">
              What to have ready
            </p>
            <div className="mt-4">
              <CheckList items={cover.beforeYouApply} />
            </div>
          </div>
        </div>
      </PageSection>

      <PageSection
        eyebrow="Important limitations"
        title="What this cover does not do."
        intro="These are the limitations built into the product design. They are summarised here so they are not a surprise later, and stated in full in the policy wording."
      >
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <ul className="space-y-4">
              {cover.limitations.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 border-b border-line pb-4 last:border-b-0"
                >
                  <span className="mt-2 size-1.5 shrink-0 rounded-[4px] bg-electric" />
                  <span className="text-[0.88rem] leading-6 text-ink/75">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-5">
            <Callout tone="warning" title="The wording decides">
              Product pages describe how a product is configured at the date of
              reading. The policy wording in force when your cover starts, and
              the schedule issued to you, are what determine whether a claim is
              paid.
            </Callout>
          </div>
        </div>
      </PageSection>

      <PageSection
        tone="ice"
        eyebrow="Pricing"
        title="How the premium is calculated."
      >
        <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
          <div className="space-y-4 lg:col-span-7">
            <p className="text-[0.92rem] leading-7 text-muted-foreground">
              {cover.pricing}
            </p>
            <p className="text-[0.92rem] leading-7 text-muted-foreground">
              Nothing is charged at the quotation stage. A premium becomes real
              only when an application is approved, the payment clears, and a
              policy is issued with its start date.
            </p>
          </div>
          <div className="lg:col-span-5">
            <Callout title="Indicative means indicative">
              We deliberately do not display a headline price for this cover
              line. A figure that ignored your own answers would be a marketing
              number, not your premium.
            </Callout>
          </div>
        </div>
      </PageSection>

      <PageSection eyebrow="Questions" title="Frequently asked.">
        <div className="mx-auto max-w-3xl">
          <FaqList items={cover.faqs} />
          <p className="mt-5 text-[0.8rem] text-muted-foreground">
            More answers in the{" "}
            <Link
              to="/faqs"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              full FAQ library
            </Link>
            .
          </p>
        </div>
      </PageSection>

      <CtaPanel
        eyebrow="Next step"
        title={`See what ${cover.name.toLowerCase()} might cost.`}
        body="Answer the product questions to see an indicative premium. Underwriting stays manual, and nothing is charged until a policy is issued."
        primary={{ label: "Get a quote", to: "/quote" }}
        secondary={{ label: "Applying for cover", to: "/how-it-works/apply" }}
      />

      <RelatedLinks
        title="Other cover lines"
        links={[
          ...others.map((item) => ({
            label: item.name,
            href: `/cover/${item.slug}`,
            description: item.summary,
          })),
          {
            label: "All insurance products",
            href: "/cover",
            description: "See the full catalogue",
          },
        ]}
      />

      <div className="mx-auto -mt-6 max-w-[1240px] px-5 pb-14">
        <Link
          to="/cover"
          className="group inline-flex items-center gap-2 text-[0.82rem] font-medium text-ink/60 transition-colors hover:text-primary"
        >
          Back to all cover
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </>
  );
}
