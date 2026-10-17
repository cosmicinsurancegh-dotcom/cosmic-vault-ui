import { PageHero, PageSection, SiteButton } from "@/components/site/PageShell";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Link } from "react-router";

const SUGGESTIONS = [
  { label: "All insurance products", href: "/cover", description: "Every cover line we offer" },
  { label: "How it works", href: "/how-it-works", description: "The process, start to finish" },
  { label: "Claims and support", href: "/claims", description: "Reporting and following a claim" },
  { label: "Help centre", href: "/help", description: "Search answers by topic" },
  { label: "Contact support", href: "/support/contact", description: "Reach a person" },
  { label: "Frequently asked questions", href: "/faqs", description: "The questions people ask most" },
];

export default function NotFound() {
  usePageMeta(
    "Page not found",
    "That page could not be found. Browse insurance cover, guidance, claims and support, or contact Cosmic Vault directly.",
  );

  return (
    <>
      <PageHero
        eyebrow="Error 404"
        title="This page has drifted out of orbit."
        intro="The address you followed does not exist — it may have been renamed, or a link may be out of date. Nothing is broken on your account, and your policy records are unaffected."
        actions={
          <>
            <SiteButton to="/">Back to the homepage</SiteButton>
            <SiteButton to="/support/contact" variant="outline">
              Report a broken link
            </SiteButton>
          </>
        }
      />

      <PageSection
        eyebrow="Try one of these"
        title="Where most people were heading."
      >
        <div className="grid gap-px overflow-hidden rounded-[1.2rem] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {SUGGESTIONS.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="group bg-background px-5 py-4 transition-colors hover:bg-ice"
            >
              <span className="block text-[0.88rem] font-medium text-ink">
                {item.label}
              </span>
              <span className="mt-1 block text-[0.75rem] leading-5 text-muted-foreground">
                {item.description}
              </span>
            </Link>
          ))}
        </div>
      </PageSection>
    </>
  );
}
