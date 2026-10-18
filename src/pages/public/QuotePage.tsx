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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { usePageMeta } from "@/hooks/use-page-meta";
import { IMAGES } from "@/lib/imagery";
import { useAuth } from "@/hooks/use-auth";
import { COVERAGE_ICONS, COVERAGE_OPTIONS, type CoverageKey } from "@/lib/vault";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ClipboardList,
  FileSearch,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

export default function QuotePage() {
  usePageMeta(
    "Getting a quote",
    "How to get an insurance quotation from Cosmic Vault: request a quote by email, or build a quotation in your vault from the published product rules.",
  );

  const { isAuthenticated } = useAuth();
  const requestQuote = useMutation(api.quotes.requestQuote);
  const [coverage, setCoverage] = useState<CoverageKey>("home");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await requestQuote({
        name,
        email,
        coverage,
        message: message.trim() || undefined,
      });
      setReference(result.reference);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We could not record that request. Please try again.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="How it works · Getting a quote"
        title="A quote without the theatre."
        intro="There are two honest ways to get terms from us: ask an advisor, or answer the product questions yourself and receive an indicative premium calculated from the published rating rules."
        media={{ image: IMAGES.hero, caption: "A conversation, then a number" }}
        aside={{
          title: "Neither route is binding",
          body: "A quotation records an indicative premium for a specific product version. Cover begins only after underwriting approval, payment, and policy issue.",
          items: [
            { label: "Applying for cover", href: "/how-it-works/apply" },
            { label: "What coverage means", href: "/cover/understanding" },
          ],
        }}
        actions={
          <>
            <SiteButton to="/cover">Browse cover lines</SiteButton>
            <SiteButton to="/how-it-works" variant="outline">
              How it works
            </SiteButton>
          </>
        }
      />

      <PageSection
        eyebrow="Two routes"
        title="Choose the one that suits you."
        intro="If you want to think it through with a person, ask. If you want a figure to compare against your own answers, build a quotation."
      >
        <FeatureGrid
          columns={2}
          items={[
            {
              title: "Ask an advisor",
              icon: Mail,
              body: "Send a request with what you want to protect. It is recorded with a reference, works whether or not you have an account, and an advisor reviews it.",
            },
            {
              title: "Build a quotation in your vault",
              icon: ClipboardList,
              body: "Answer the question set for the product you are considering, and the configured rating rules calculate an indicative premium you can keep on file.",
            },
            {
              title: "What the quote is based on",
              icon: FileSearch,
              body: "Declared ratings factors such as mileage, property details, age band, or turnover - exactly what the published product rules use, nothing invented.",
            },
            {
              title: "What happens after",
              icon: ArrowRight,
              body: "You can convert a quotation into a draft application, upload the required documents, and submit it for underwriting review when you are ready.",
            },
          ]}
        />
      </PageSection>

      <PageSection tone="ice" eyebrow="Quote request" title="Tell us what you want to protect.">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            {reference ? (
              <div className="rounded-[1.4rem] border border-line bg-card p-6 sm:p-8">
                <span className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-5" strokeWidth={2.6} />
                </span>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-ink">
                  Your request is recorded.
                </h3>
                <p className="mt-3 max-w-md text-[0.88rem] leading-6 text-muted-foreground">
                  Reference{" "}
                  <span className="font-semibold tracking-[0.08em] text-ink">
                    {reference}
                  </span>
                  . An advisor will review it and reply to the email address you
                  gave. Keep the reference - it is how the request is traced.
                </p>
                <div className="mt-5 space-y-3 rounded-xl border border-dashed border-line px-4 py-3 text-[0.78rem] leading-6 text-muted-foreground">
                  <p>
                    This is a request, not a quotation. No price is fixed by this
                    form, nothing has been charged, and no cover exists until a
                    policy has been issued.
                  </p>
                  <p>
                    If you sign in with the same email address, the request stays
                    with your record so you can follow it alongside any quotation
                    you build yourself.
                  </p>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <SiteButton
                    to={isAuthenticated ? "/dashboard" : "/auth?returnTo=%2Fdashboard"}
                  >
                    {isAuthenticated ? "Open my vault" : "Create your vault"}
                  </SiteButton>
                  <Button
                    variant="outline"
                    className="h-11 rounded-full px-5"
                    onClick={() => {
                      setReference(null);
                      setMessage("");
                    }}
                  >
                    Send another request
                  </Button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={submit}
                className="rounded-[1.4rem] border border-line bg-card p-6 sm:p-8"
              >
                <div>
                  <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    What should we protect?
                  </Label>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {COVERAGE_OPTIONS.map((option) => {
                      const Icon = COVERAGE_ICONS[option.key];
                      const active = coverage === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setCoverage(option.key)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-[0.82rem] font-medium transition-colors",
                            active
                              ? "border-electric bg-electric/[0.07] text-ink"
                              : "border-line bg-background text-muted-foreground hover:border-ink/25 hover:text-ink",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-7 shrink-0 place-items-center rounded-full transition-colors",
                              active
                                ? "bg-primary text-primary-foreground"
                                : "bg-ink/[0.05] text-ink/60",
                            )}
                          >
                            <Icon className="size-3.5" />
                          </span>
                          {option.short}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="quote-name">Full name</Label>
                    <Input
                      id="quote-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Ada Lovelace"
                      className="h-11 rounded-xl bg-background"
                      required
                      minLength={2}
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quote-email">Email</Label>
                    <Input
                      id="quote-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="ada@example.com"
                      className="h-11 rounded-xl bg-background"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Label htmlFor="quote-message">
                    Anything we should know? (optional)
                  </Label>
                  <Textarea
                    id="quote-message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="A three-bedroom semi, two drivers, and a dog with strong opinions about the sofa."
                    className="min-h-[96px] resize-none rounded-xl bg-background"
                  />
                </div>

                {error && (
                  <p className="mt-4 rounded-xl bg-destructive/8 px-3 py-2 text-[0.75rem] text-destructive">
                    {error}
                  </p>
                )}

                <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-start gap-2 text-[0.72rem] leading-5 text-muted-foreground">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-electric" />
                    Your details are used to answer this request, and are held
                    under the privacy notice.
                  </p>
                  <Button
                    type="submit"
                    disabled={pending}
                    className="h-11 w-full rounded-full px-6 sm:w-auto"
                  >
                    {pending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Sending request
                      </>
                    ) : (
                      <>
                        Send request
                        <ArrowUpRight className="size-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>

          <div className="space-y-5 lg:col-span-5">
            <Callout title="What we will do with it">
              The request is recorded with a reference and reviewed by a person -
              not routed into a numbering queue. If you have questions before
              applying, ask them here rather than guessing at the terms.
            </Callout>

            <div className="rounded-[1.3rem] border border-line bg-card p-6">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-ink/60">
                Faster if you have it
              </p>
              <div className="mt-4">
                <CheckList
                  items={[
                    "The cover line you are considering, and why.",
                    "Rough figures - a rebuild estimate, mileage, turnover, or term length.",
                    "Anything unusual an underwriter would need to know.",
                    "Whether you are applying for yourself, a family, or a business.",
                  ]}
                />
              </div>
            </div>

            <div className="rounded-[1.3rem] border border-line bg-card p-6">
              <p className="text-[0.82rem] font-semibold text-ink">
                Prefer to browse first?
              </p>
              <p className="mt-2 text-[0.82rem] leading-6 text-muted-foreground">
                Each cover page explains what the product is for, who it suits,
                and the limitations worth understanding before you apply.
              </p>
              <div className="mt-4">
                <Link
                  to="/cover"
                  className="inline-flex items-center gap-2 text-[0.8rem] font-medium text-primary"
                >
                  Look at the cover lines
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </PageSection>

      <PageSection
        eyebrow="Being straight"
        title="What this page will never do."
      >
        <div className="grid gap-8 lg:grid-cols-2">
          <CheckList
            items={[
              "Show a headline price before we know anything about the risk.",
              "Guarantee that an application will be accepted.",
              "Claim an approval, partnership or accreditation we cannot evidence.",
            ]}
          />
          <CheckList
            items={[
              "Add your details to a marketing list you did not ask for.",
              "Share your enquiry with anyone outside the people who need to act on it.",
              "Charge anything at the quotation stage - there is nothing to pay yet.",
            ]}
          />
        </div>
      </PageSection>

      <PageSection tone="ice" eyebrow="Questions" title="Before you ask.">
        <div className="mx-auto max-w-3xl">
          <FaqList
            items={[
              {
                question: "Do I need an account to send a request?",
                answer:
                  "No. A request works signed out, and if you later sign in with the same email address the request stays with your record. Building a full quotation and applying for cover do require an account, because documents and decisions need an owner.",
              },
              {
                question: "How quickly will I hear back?",
                answer:
                  "We deliberately do not publish a response time we cannot control. Requests are reviewed by a person, and if a request needs more information we will ask rather than guess at an answer.",
              },
              {
                question: "Can you give me a price straight away?",
                answer:
                  "A pricing figure only means something once the product's rating questions have been answered, which is what the quotation flow in your vault does. This form records a request; it does not calculate a premium.",
              },
            ]}
          />
        </div>
      </PageSection>

      <CtaPanel
        eyebrow="Continue"
        title="Carry the quote through to cover."
        body="Once you have terms you are happy with, convert the quotation into an application and upload the documents the product needs."
        primary={{ label: "Applying for cover", to: "/how-it-works/apply" }}
        secondary={{ label: "Contact support", to: "/support/contact" }}
      />

      <RelatedLinks
        links={[
          { label: "All insurance products", href: "/cover" },
          { label: "Understanding your coverage", href: "/cover/understanding" },
          { label: "Payments and billing", href: "/claims/payments" },
        ]}
      />
    </>
  );
}
