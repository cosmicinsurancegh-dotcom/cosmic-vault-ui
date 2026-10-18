import {
  Callout,
  CtaPanel,
  FeatureGrid,
  PageHero,
  PageSection,
  RelatedLinks,
  SiteButton,
} from "@/components/site/PageShell";
import { usePageMeta } from "@/hooks/use-page-meta";
import { IMAGES } from "@/lib/imagery";
import {
  Handshake,
  Headset,
  Landmark,
  Mail,
  MessageSquareWarning,
  Scale,
} from "lucide-react";
import { Link } from "react-router";

export default function Contact() {
  usePageMeta(
    "Contact us",
    "How to contact Cosmic Vault: support, pre-sale questions, broker enquiries, complaints and data requests, and why approved contact details are not yet published.",
  );

  return (
    <>
      <PageHero
        eyebrow="About · Contact us"
        title="How to reach us."
        intro="Every route below reaches a monitored, recorded channel. There is no published telephone number or postal address on this page, and that is deliberate - see the note further down."
        media={{ image: IMAGES.support, caption: "Monitored, recorded, answered" }}
        aside={{
          title: "For account holders",
          body: "Signed-in members get the fastest route: a support request linked directly to the policy, claim or payment it concerns.",
          items: [
            { label: "Contact support", href: "/support/contact" },
            { label: "Report a problem", href: "/support/report" },
          ],
        }}
        actions={
          <>
            <SiteButton to="/support/contact">Contact support</SiteButton>
            <SiteButton to="/help" variant="outline">
              Search the help centre
            </SiteButton>
          </>
        }
      />

      <PageSection
        eyebrow="Routes"
        title="Pick the one that fits."
      >
        <FeatureGrid
          columns={2}
          items={[
            {
              title: "Support and existing cover",
              icon: Headset,
              body: "Questions about a policy, claim, payment or application. Sign in and open a request so it links to your record automatically.",
            },
            {
              title: "Before you buy",
              icon: Mail,
              body: "Ask about a product, an exclusion or a likely eligibility question. Send a quote request with your question included.",
            },
            {
              title: "Broker partnerships",
              icon: Handshake,
              body: "Intermediaries who want to work with the platform. The broker page explains the model and how assignments work.",
            },
            {
              title: "Something is broken",
              icon: MessageSquareWarning,
              body: "A page that fails, a record that is wrong, or service that fell short. Report it with the reference and what you expected.",
            },
            {
              title: "Complaints",
              icon: Scale,
              body: "If a problem is not resolved, the complaints procedure explains how a complaint is recorded, reviewed and escalated.",
            },
            {
              title: "Regulatory and company enquiries",
              icon: Landmark,
              body: "Registration, authorisation and approved contact details. The status of each is set out on the regulatory information page.",
            },
          ]}
        />
      </PageSection>

      <PageSection tone="ice" eyebrow="Transparency" title="Why there is no phone number.">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <p className="text-[0.92rem] leading-7 text-muted-foreground">
              An insurance company should publish a real telephone number, a
              registered address, and the regulator's reference for the entity
              behind it. Those details have to be verified against their primary
              sources before publication.
            </p>
            <p className="text-[0.92rem] leading-7 text-muted-foreground">
              Until that verification is complete, we will not print a placeholder
              number or a fictional address. A wrong number is worse than no
              number: it sends people somewhere they should not trust.
            </p>
            <p className="text-[0.92rem] leading-7 text-muted-foreground">
              Everything that would go on a contact page is listed on the{" "}
              <Link
                to="/legal/regulatory"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                regulatory and company information
              </Link>{" "}
              page, along with what will be published once confirmed.
            </p>
          </div>
          <div className="lg:col-span-5">
            <Callout tone="warning" title="Be wary of lookalike contact details">
              If you receive a message with a contact number, bank details or a
              request for a sign-in code, and it is not from a channel listed on
              this site, treat it as fraudulent and report it through support.
            </Callout>
          </div>
        </div>
      </PageSection>

      <PageSection eyebrow="Writing to us" title="A message that gets answered first time.">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Say which record",
              body: "A policy, claim, application or payment reference removes the guesswork immediately.",
            },
            {
              title: "Say what you need",
              body: "An answer, a change, a correction, or a decision explained - name the outcome you want.",
            },
            {
              title: "Keep it factual",
              body: "Dates, amounts and what happened. Context helps more than emphasis.",
            },
            {
              title: "Redact before attaching",
              body: "Send only what is needed, with anything sensitive covered or removed.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-[4px] border border-line bg-card p-5"
            >
              <p className="text-[0.9rem] font-semibold text-ink">{item.title}</p>
              <p className="mt-2 text-[0.8rem] leading-6 text-muted-foreground">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </PageSection>

      <CtaPanel
        eyebrow="Start here"
        title="Open a request, or ask a question."
        body="Support requests stay linked to the record they concern. If you are still deciding on cover, send a quote request with your question in it."
        primary={{ label: "Contact support", to: "/support/contact" }}
        secondary={{ label: "Get a quote", to: "/quote" }}
      />

      <RelatedLinks
        links={[
          { label: "Broker partnerships", href: "/about/brokers" },
          { label: "Complaints procedure", href: "/legal/complaints" },
          { label: "Regulatory information", href: "/legal/regulatory" },
        ]}
      />
    </>
  );
}
