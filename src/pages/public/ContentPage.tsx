import {
  Callout,
  CtaPanel,
  FaqList,
  FeatureGrid,
  PageHero,
  PageSection,
  RelatedLinks,
  SiteButton,
  StepList,
} from "@/components/site/PageShell";
import { usePageMeta } from "@/hooks/use-page-meta";
import type { ContentBlock, ContentPageConfig } from "@/lib/contentPages";
import { IMAGES, type VaultImage } from "@/lib/imagery";

/** Editorial photography per guidance page, with a caption that carries the idea. */
const PAGE_MEDIA: Record<string, { image: VaultImage; caption: string }> = {
  "cover-understanding": { image: IMAGES.homeInterior, caption: "Limits, excess, exclusion, disclosure" },
  "cover-limits": { image: IMAGES.claimReview, caption: "The parts worth reading twice" },
  "how-it-works": { image: IMAGES.workspaces, caption: "Manual where it matters" },
  "how-it-works-apply": { image: IMAGES.story, caption: "From quotation to policy" },
  "how-it-works-policy": { image: IMAGES.support, caption: "A schedule you can actually read" },
  "how-it-works-renewals": { image: IMAGES.auth, caption: "Keeping cover up to date" },
  "claims-payments": { image: IMAGES.earth, caption: "Every movement, on the record" },
  "support-report": { image: IMAGES.claimReview, caption: "Tell us what went wrong" },
  about: { image: IMAGES.story, caption: "Built for the decades, not the quarter" },
  "about-principles": { image: IMAGES.workspaces, caption: "The standards we hold" },
  "about-commitment": { image: IMAGES.advisor, caption: "A person at the end of every route" },
};

function Block({ block }: { block: ContentBlock }) {
  switch (block.kind) {
    case "cards":
      return (
        <PageSection
          eyebrow={block.eyebrow}
          title={block.title}
          intro={block.intro}
          tone={block.tone}
        >
          <FeatureGrid items={block.items} columns={block.columns ?? 3} />
        </PageSection>
      );
    case "steps":
      return (
        <PageSection
          eyebrow={block.eyebrow}
          title={block.title}
          intro={block.intro}
          tone={block.tone}
        >
          <StepList steps={block.steps} />
        </PageSection>
      );
    case "prose":
      return (
        <PageSection eyebrow={block.eyebrow} title={block.title} tone={block.tone}>
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              {(block.paragraphs ?? []).map((paragraph) => (
                <p
                  key={paragraph.slice(0, 32)}
                  className="text-[0.92rem] leading-7 text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
            </div>
            {block.bullets && (
              <dl className="space-y-5 lg:col-span-5">
                {block.bullets.map((item) => (
                  <div
                    key={item.term}
                    className="border-t border-line pt-4 first:border-t-0 first:pt-0"
                  >
                    <dt className="text-[0.88rem] font-semibold text-ink">
                      {item.term}
                    </dt>
                    <dd className="mt-1 text-[0.82rem] leading-6 text-muted-foreground">
                      {item.body}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </PageSection>
      );
    case "callout":
      return (
        <PageSection tone={block.tone}>
          <div className="mx-auto max-w-3xl">
            <Callout title={block.title} tone={block.severity ?? "note"}>
              {block.body}
            </Callout>
          </div>
        </PageSection>
      );
    case "faqs":
      return (
        <PageSection
          eyebrow={block.eyebrow}
          title={block.title}
          intro={block.intro}
          tone={block.tone}
        >
          <div className="mx-auto max-w-3xl">
            <FaqList items={block.items} />
          </div>
        </PageSection>
      );
    default:
      return null;
  }
}

export default function ContentPage({ config }: { config: ContentPageConfig }) {
  usePageMeta(config.title, config.metaDescription);

  return (
    <>
      <PageHero
        eyebrow={config.eyebrow}
        title={config.title}
        intro={config.intro}
        media={PAGE_MEDIA[config.slug]}
        aside={config.aside}
        actions={
          <>
            <SiteButton to={config.cta.primary.to}>
              {config.cta.primary.label}
            </SiteButton>
            {config.cta.secondary && (
              <SiteButton to={config.cta.secondary.to} variant="outline">
                {config.cta.secondary.label}
              </SiteButton>
            )}
          </>
        }
      />
      {config.blocks.map((block, index) => (
        <Block key={`${block.kind}-${index}`} block={block} />
      ))}
      <CtaPanel
        eyebrow={config.cta.eyebrow}
        title={config.cta.title}
        body={config.cta.body}
        primary={config.cta.primary}
        secondary={config.cta.secondary}
      />
      <RelatedLinks links={config.related} />
    </>
  );
}
