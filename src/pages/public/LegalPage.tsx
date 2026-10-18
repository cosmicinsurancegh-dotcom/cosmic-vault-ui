import {
  Callout,
  CtaPanel,
  PageHero,
  PageSection,
  RelatedLinks,
  SiteButton,
} from "@/components/site/PageShell";
import { usePageMeta } from "@/hooks/use-page-meta";
import { LEGAL_PAGES, legalPage } from "@/lib/legalPages";
import { Link } from "react-router";

export default function LegalPage({ slug }: { slug: string }) {
  const page = legalPage(slug);
  usePageMeta(
    page ? page.title : "Legal",
    page?.metaDescription ?? "Legal and trust information for Cosmic Vault.",
  );

  if (!page) {
    return (
      <PageSection title="That document could not be found.">
        <SiteButton to="/legal/regulatory">Regulatory information</SiteButton>
      </PageSection>
    );
  }

  const siblings = Object.values(LEGAL_PAGES).filter(
    (item) => item.slug !== page.slug,
  );

  return (
    <>
      <PageHero
        eyebrow={page.eyebrow}
        title={page.title}
        intro={page.intro}
        aside={{
          title: "Status",
          body:
            page.status === "draft"
              ? "This document is a working draft. It has not been approved by a qualified legal adviser and must not be relied on as a binding policy."
              : "This document has been reviewed and approved for publication.",
          items: [
            { label: "Contact us", href: "/contact" },
            { label: "Complaints procedure", href: "/legal/complaints" },
          ],
        }}
      />

      <PageSection>
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <Callout tone="warning" title="Draft - requires legal approval">
              This document is published so the platform is transparent about its
              current position. It has not been through legal review, and no part
              of it should be treated as legally approved wording. Where a fact
              could not be verified, the document says so instead of asserting it.
            </Callout>

            <div className="mt-10 space-y-10">
              {page.sections.map((section) => (
                <section key={section.heading}>
                  <h2 className="text-[1.15rem] font-semibold tracking-[-0.02em] text-ink">
                    {section.heading}
                  </h2>
                  {section.paragraphs?.map((paragraph) => (
                    <p
                      key={paragraph.slice(0, 32)}
                      className="mt-3 text-[0.88rem] leading-7 text-muted-foreground"
                    >
                      {paragraph}
                    </p>
                  ))}
                  {section.bullets && (
                    <ul className="mt-4 space-y-2.5">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-3">
                          <span className="mt-2 size-1.5 shrink-0 rounded-[4px] bg-electric/70" />
                          <span className="text-[0.85rem] leading-6 text-muted-foreground">
                            {bullet}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          </div>

          <aside className="lg:col-span-4">
            <div className="sticky top-28 rounded-[4px] border border-line bg-card p-5">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-ink/60">
                Other documents
              </p>
              <ul className="mt-4 space-y-2.5">
                {siblings.map((item) => (
                  <li key={item.slug}>
                    <Link
                      to={`/legal/${item.slug}`}
                      className="text-[0.82rem] text-muted-foreground transition-colors hover:text-ink"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-5 border-t border-line pt-5">
                <p className="text-[0.78rem] leading-6 text-muted-foreground">
                  Questions about this document, or about how it applies to you?
                  Ask support - we would rather explain it than have you guess.
                </p>
                <div className="mt-4">
                  <SiteButton to="/support/contact" variant="outline">
                    Contact support
                  </SiteButton>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </PageSection>

      <CtaPanel
        eyebrow="Clarity"
        title="Read the terms before you need them."
        body="Policy documents, complaints handling and accessibility are all documented. If something is unclear, ask and we will explain it in plain language."
        primary={{ label: "Contact support", to: "/support/contact" }}
        secondary={{ label: "Help centre", to: "/help" }}
      />

      <RelatedLinks
        title="Related"
        links={[
          { label: "Regulatory information", href: "/legal/regulatory" },
          { label: "Complaints procedure", href: "/legal/complaints" },
          { label: "Privacy notice", href: "/legal/privacy" },
        ]}
      />
    </>
  );
}
