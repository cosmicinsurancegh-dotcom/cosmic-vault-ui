import {
  Callout,
  CtaPanel,
  FaqList,
  PageHero,
  PageSection,
  RelatedLinks,
  SiteButton,
  type FaqEntry,
} from "@/components/site/PageShell";
import { Input } from "@/components/ui/input";
import { usePageMeta } from "@/hooks/use-page-meta";
import { FAQS, FAQ_CATEGORIES, type FaqCategory } from "@/lib/faqs";
import { IMAGES } from "@/lib/imagery";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  CircleHelp,
  CreditCard,
  LifeBuoy,
  ListChecks,
  Lock,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";

const CATEGORY_ICONS: Record<FaqCategory, typeof BookOpen> = {
  "Quotes and applications": ListChecks,
  "Policies and coverage": BookOpen,
  "Payments and billing": CreditCard,
  Claims: LifeBuoy,
  "Accounts and security": Lock,
  "Renewals and changes": RefreshCw,
};

const CATEGORY_SUMMARY: Record<FaqCategory, string> = {
  "Quotes and applications": "Indicative pricing, question sets, and how applications progress.",
  "Policies and coverage": "Schedules, wording, excesses, exclusions and conditions.",
  "Payments and billing": "Premiums, renewals, refunds and what a failed payment means.",
  Claims: "Reporting an incident, review, decisions, and disputing an outcome.",
  "Accounts and security": "Signing in, data access and privacy requests.",
  "Renewals and changes": "Renewal notices, endorsements, cancellations and changes of circumstance.",
};

const CATEGORY_LINKS: Record<FaqCategory, { label: string; href: string }[]> = {
  "Quotes and applications": [
    { label: "Getting a quote", href: "/quote" },
    { label: "Applying for cover", href: "/how-it-works/apply" },
  ],
  "Policies and coverage": [
    { label: "Understanding coverage", href: "/cover/understanding" },
    { label: "Limits and exclusions", href: "/cover/limits-and-exclusions" },
  ],
  "Payments and billing": [
    { label: "Payments and billing", href: "/claims/payments" },
    { label: "Renewals", href: "/how-it-works/renewals" },
  ],
  Claims: [
    { label: "Claims overview", href: "/claims" },
    { label: "Make a claim", href: "/claims/make-a-claim" },
  ],
  "Accounts and security": [
    { label: "Privacy notice", href: "/legal/privacy" },
    { label: "Report a problem", href: "/support/report" },
  ],
  "Renewals and changes": [
    { label: "Renewals and policy changes", href: "/how-it-works/renewals" },
    { label: "Understanding your policy", href: "/how-it-works/your-policy" },
  ],
};

function matches(query: string, faq: (typeof FAQS)[number]) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    faq.question.toLowerCase().includes(needle) ||
    faq.answer.toLowerCase().includes(needle) ||
    faq.category.toLowerCase().includes(needle)
  );
}

export function HelpCentre() {
  usePageMeta(
    "Help centre",
    "Search Cosmic Vault's help centre: answers on quotes, applications, policies, payments, claims, accounts, renewals and security.",
  );

  const [query, setQuery] = useState("");
  const results = useMemo(
    () => (query.trim().length < 2 ? [] : FAQS.filter((faq) => matches(query, faq))),
    [query],
  );
  const searching = query.trim().length >= 2;

  return (
    <>
      <PageHero
        eyebrow="Claims & support · Help centre"
        title="Find the answer, or reach a person."
        intro="Every answer below is drawn from the same library the FAQ page uses, so search results are real content rather than placeholder text."
        media={{ image: IMAGES.support, caption: "Search first, then reach a person" }}
        aside={{
          title: "Still stuck?",
          body: "Support requests are recorded against your account, so the thread stays with the policy, claim or application it concerns.",
          items: [
            { label: "Contact support", href: "/support/contact" },
            { label: "Report a problem", href: "/support/report" },
          ],
        }}
        actions={
          <>
            <SiteButton to="/faqs">Search all FAQs</SiteButton>
            <SiteButton to="/support/contact" variant="outline">
              Contact support
            </SiteButton>
          </>
        }
      />

      <PageSection
        eyebrow="Search"
        title="What do you need to know?"
        intro="Type at least two characters. Results appear directly below, filtered from the full answer library."
      >
        <div className="max-w-2xl">
          <label htmlFor="help-search" className="sr-only">
            Search help topics
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="help-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try “excess”, “refund”, “renewal”…"
              className="h-12 rounded-[4px] bg-card pl-11 pr-11"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-[4px] text-muted-foreground transition-colors hover:bg-ink/[0.05] hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <p aria-live="polite" className="mt-3 text-[0.75rem] text-muted-foreground">
            {searching
              ? `${results.length} ${results.length === 1 ? "answer" : "answers"} matching “${query.trim()}”.`
              : `${FAQS.length} answers across ${FAQ_CATEGORIES.length} topics.`}
          </p>
        </div>

        {searching && (
          <div className="mt-8 max-w-3xl">
            {results.length === 0 ? (
              <Callout title="Nothing matched that search">
                Try a broader term, or{" "}
                <Link
                  to="/support/contact"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  ask support directly
                </Link>
                . We will answer the question properly rather than pointing you
                back at a search box.
              </Callout>
            ) : (
              <FaqList items={results as FaqEntry[]} />
            )}
          </div>
        )}
      </PageSection>

      <PageSection
        tone="ice"
        eyebrow="Browse by topic"
        title="Six areas, all of them covered."
        intro="Each topic collects the questions people ask most, with links to the page that explains it in full."
      >
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
          {FAQ_CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICONS[category];
            const count = FAQS.filter((faq) => faq.category === category).length;
            return (
              <div
                key={category}
                className="flex flex-col rounded-[4px] border border-line bg-card p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="grid size-10 place-items-center rounded-[4px] bg-ice text-primary">
                    <Icon className="size-4" strokeWidth={1.8} />
                  </span>
                  <span className="text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
                    {count} answers
                  </span>
                </div>
                <h3 className="mt-5 text-[1.05rem] font-semibold tracking-[-0.02em] text-ink">
                  {category}
                </h3>
                <p className="mt-2 flex-1 text-[0.84rem] leading-6 text-muted-foreground">
                  {CATEGORY_SUMMARY[category]}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
                  <Link
                    to={`/faqs?category=${encodeURIComponent(category)}`}
                    className="text-[0.78rem] font-medium text-primary hover:underline"
                  >
                    Read the FAQs
                  </Link>
                  {CATEGORY_LINKS[category].map((link) => (
                    <Link
                      key={link.href}
                      to={link.href}
                      className="text-[0.78rem] text-muted-foreground transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </PageSection>

      <PageSection
        eyebrow="Talk to someone"
        title="When a page is not enough."
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Contact support",
              body: "Open a request in your vault, attach the record it concerns, and follow every reply in one thread.",
              to: "/support/contact",
            },
            {
              title: "Report a problem",
              body: "Tell us about a broken page, a wrong record, or service that fell short - including what you expected.",
              to: "/support/report",
            },
            {
              title: "Make a complaint",
              body: "If a problem is not resolved, the complaints procedure explains how it is reviewed and escalated.",
              to: "/legal/complaints",
            },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group rounded-[4px] border border-line bg-card p-6 transition-colors hover:border-primary/30"
            >
              <CircleHelp className="size-4 text-primary" />
              <p className="mt-5 text-[0.98rem] font-semibold text-ink">
                {item.title}
              </p>
              <p className="mt-2 text-[0.82rem] leading-6 text-muted-foreground">
                {item.body}
              </p>
            </Link>
          ))}
        </div>
      </PageSection>

      <CtaPanel
        eyebrow="Answers first"
        title="Search every answer in one place."
        body="The FAQ library covers quotes, policies, payments, claims, accounts and renewals, and it is the same content the help centre searches."
        primary={{ label: "Open the FAQs", to: "/faqs" }}
        secondary={{ label: "Contact support", to: "/support/contact" }}
      />

      <RelatedLinks
        links={[
          { label: "Frequently asked questions", href: "/faqs" },
          { label: "Claims overview", href: "/claims" },
          { label: "Report a problem", href: "/support/report" },
        ]}
      />
    </>
  );
}

export function Faqs() {
  usePageMeta(
    "Frequently asked questions",
    "Answers to the questions people ask most about Cosmic Vault insurance: quotes, applications, policies, coverage, payments, claims, accounts and renewals.",
  );

  const [params, setParams] = useSearchParams();
  const initialCategory = params.get("category");
  const [category, setCategory] = useState<FaqCategory | "all">(
    FAQ_CATEGORIES.includes(initialCategory as FaqCategory)
      ? (initialCategory as FaqCategory)
      : "all",
  );
  const [query, setQuery] = useState(params.get("q") ?? "");

  const filtered = useMemo(
    () =>
      FAQS.filter(
        (faq) =>
          (category === "all" || faq.category === category) &&
          matches(query, faq),
      ),
    [category, query],
  );

  const grouped = useMemo(() => {
    const map = new Map<FaqCategory, typeof FAQS>();
    for (const faq of filtered) {
      map.set(faq.category, [...(map.get(faq.category) ?? []), faq]);
    }
    return [...map.entries()];
  }, [filtered]);

  const updateParams = (nextCategory: FaqCategory | "all", nextQuery: string) => {
    const next = new URLSearchParams();
    if (nextCategory !== "all") next.set("category", nextCategory);
    if (nextQuery.trim()) next.set("q", nextQuery.trim());
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHero
        eyebrow="Support · Frequently asked questions"
        title="Questions, answered properly."
        intro={`${FAQS.length} answers covering the whole relationship - from what a quotation really is, to what happens when a payment fails or a claim is declined.`}
        media={{ image: IMAGES.workspaces, caption: "Answers kept in one library" }}
        aside={{
          title: "If it is not here",
          body: "Search first, then ask. Support requests are recorded against your account so nothing is repeated twice.",
          items: [
            { label: "Help centre", href: "/help" },
            { label: "Contact support", href: "/support/contact" },
          ],
        }}
      />

      <PageSection
        eyebrow="Search and filter"
        title="Find the answer you need."
      >
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-5">
            <label htmlFor="faq-search" className="sr-only">
              Search FAQs
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="faq-search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  updateParams(category, event.target.value);
                }}
                placeholder="Search every answer"
                className="h-12 rounded-[4px] bg-card pl-11"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setCategory("all");
                  updateParams("all", query);
                }}
                aria-pressed={category === "all"}
                className={cn(
                  "rounded-[4px] border px-3.5 py-2 text-[0.75rem] font-medium transition-colors",
                  category === "all"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-line bg-card text-ink/60 hover:border-ink/25 hover:text-ink",
                )}
              >
                All topics
              </button>
              {FAQ_CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setCategory(item);
                    updateParams(item, query);
                  }}
                  aria-pressed={category === item}
                  className={cn(
                    "rounded-[4px] border px-3.5 py-2 text-[0.75rem] font-medium transition-colors",
                    category === item
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-line bg-card text-ink/60 hover:border-ink/25 hover:text-ink",
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p aria-live="polite" className="mt-5 text-[0.75rem] text-muted-foreground">
          Showing {filtered.length} of {FAQS.length} answers.
        </p>

        <div className="mt-8 space-y-12">
          {grouped.length === 0 ? (
            <Callout title="No answers matched">
              Try a different word, or{" "}
              <Link
                to="/support/contact"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                ask support
              </Link>{" "}
              - we will answer it and add it to this library if it is missing.
            </Callout>
          ) : (
            grouped.map(([group, items]) => (
              <section key={group}>
                <h3 className="text-[0.62rem] font-semibold uppercase tracking-[0.26em] text-ink/60">
                  {group}
                </h3>
                <div className="mt-4">
                  <FaqList items={items as FaqEntry[]} />
                </div>
              </section>
            ))
          )}
        </div>
      </PageSection>

      <PageSection tone="ice" eyebrow="Still unanswered" title="Ask us directly.">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <p className="text-[0.92rem] leading-7 text-muted-foreground">
              If a question is missing from this library, that is useful
              information. Ask it through support and we will answer it properly
              - and add it here so the next person finds it.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <SiteButton to="/support/contact">Contact support</SiteButton>
              <SiteButton to="/help" variant="outline">
                Help centre
              </SiteButton>
            </div>
          </div>
          <Callout title="Our policy documents answer more than we can here">
            Schedules, wording and endorsements are specific to you. Where a
            question depends on your own policy, the answer is in your documents
            rather than in a general FAQ.
          </Callout>
        </div>
      </PageSection>

      <CtaPanel
        eyebrow="Next step"
        title="Ready to look at cover?"
        body="Browse the cover lines, or send a quote request describing what you want to protect."
        primary={{ label: "Get a quote", to: "/quote" }}
        secondary={{ label: "All insurance products", to: "/cover" }}
      />

      <RelatedLinks
        links={[
          { label: "Help centre", href: "/help" },
          { label: "Claims overview", href: "/claims" },
          { label: "Understanding coverage", href: "/cover/understanding" },
        ]}
      />
    </>
  );
}
