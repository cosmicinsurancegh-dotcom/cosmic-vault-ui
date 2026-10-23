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
import { IMAGES } from "@/lib/imagery";
import { useAuth } from "@/hooks/use-auth";
import {
  CreditCard,
  FileText,
  Handshake,
  LifeBuoy,
  Lock,
  MessagesSquare,
  ScrollText,
  UserRound,
} from "lucide-react";
import { Link } from "react-router";

const SIGN_IN_SUPPORT = "/auth?returnTo=%2Fdashboard%2Fsupport";

export default function ContactSupport() {
  usePageMeta(
    "Contact support",
    "How to contact Cosmic Vault support: what to include, which route to use for a policy, claim, payment or complaint, and what happens next.",
  );

  const { isAuthenticated } = useAuth();

  return (
    <>
      <PageHero
        eyebrow="Claims & support · Contact support"
        title="Reach a person, not a phone tree."
        intro="Support requests are recorded against your account and linked to the policy, claim, application or payment they concern. That means the person answering already has the context."
        media={{ image: IMAGES.advisor, caption: "The context travels with the request" }}
        aside={{
          title: "Fastest route",
          body: "Sign in and open a request from your vault. It creates a reference, keeps the thread together, and links the record.",
          items: [
            { label: "Report a problem", href: "/support/report" },
            { label: "Help centre", href: "/help" },
          ],
        }}
        actions={
          <>
            <SiteButton to={isAuthenticated ? "/dashboard/support" : SIGN_IN_SUPPORT}>
              {isAuthenticated ? "Open support in my vault" : "Sign in to contact support"}
            </SiteButton>
            <SiteButton to="/help" variant="outline">
              Search the help centre
            </SiteButton>
          </>
        }
      />

      <PageSection
        eyebrow="Choose the right route"
        title="What do you need help with?"
        intro="Each route goes to the same support team, but routing a request correctly means it reaches someone who can actually act on it."
      >
        <FeatureGrid
          columns={2}
          items={[
            {
              title: "A policy or cover question",
              icon: ScrollText,
              body: "Ask about a limit, an exclusion, or whether something is covered. Include the policy number and the situation you are asking about.",
            },
            {
              title: "A claim",
              icon: LifeBuoy,
              body: "Ask about a decision, a request for information, or next steps. The claim reference keeps the whole history in view.",
            },
            {
              title: "A payment or refund",
              icon: CreditCard,
              body: "Query a figure, a status, or an outstanding premium. Quote the transaction reference so it can be traced exactly.",
            },
            {
              title: "An application",
              icon: FileText,
              body: "Ask what is missing, how long a review might take, or whether a decision can be reconsidered.",
            },
            {
              title: "Account, data or privacy",
              icon: Lock,
              body: "Access problems, data requests, or a security concern. Never send sign-in codes or card details in a message.",
            },
            {
              title: "A complaint",
              icon: Handshake,
              body: "Service or a decision you are unhappy with. Complaints are recorded with high priority and reviewed under a documented procedure.",
            },
          ]}
        />
      </PageSection>

      <PageSection
        tone="ice"
        eyebrow="Before you write"
        title="What to include."
        intro="A complete first message usually removes a whole round of questions."
      >
        <div className="grid gap-10 lg:grid-cols-2">
          <CheckList
            items={[
              "The reference: policy number, claim, application, quotation or transaction.",
              "What you expected to happen, and what actually happened.",
              "Relevant dates, amounts, and the names of anyone else involved.",
              "Screenshots or documents that support the request, with personal details redacted.",
            ]}
          />
          <div className="space-y-5">
            <Callout tone="warning" title="Never send credentials">
              We will never ask for your one-time sign-in code, full card numbers,
              or bank credentials. If someone claiming to be Cosmic Vault asks for
              those, treat it as fraudulent and report it through support.
            </Callout>
            <Callout title="Urgent safety issues">
              If someone is in danger, contact the emergency services first. We can
              help with the insurance consequences, but not with an emergency
              response.
            </Callout>
          </div>
        </div>
      </PageSection>

      <PageSection
        eyebrow="What happens next"
        title="How a request is handled."
      >
        <div className="grid gap-8 lg:grid-cols-3">
          {[
            {
              title: "It is recorded",
              body: "Your request gets a reference and sits against the record it concerns. Nothing depends on an inbox.",
            },
            {
              title: "A person reads it",
              body: "Requests are handled by a human with access to the relevant policy, claim or payment history.",
            },
            {
              title: "You get an answer in writing",
              body: "We reply on the thread so the exchange stays with the record and can be revisited later.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-[4px] border border-line bg-card p-6"
            >
              <span className="grid size-10 place-items-center rounded-[4px] bg-ice text-primary">
                <UserRound className="size-4" />
              </span>
              <p className="mt-5 text-[0.98rem] font-semibold text-ink">
                {item.title}
              </p>
              <p className="mt-2 text-[0.84rem] leading-6 text-muted-foreground">
                {item.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Callout title="Why there is no phone number here">
            An approved, monitored contact number and address have not yet been
            verified for publication. Rather than print a placeholder that might
            mislead you, this page routes everything through the recorded support
            channel. The{" "}
            <Link
              to="/legal/regulatory"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              regulatory information page
            </Link>{" "}
            explains what will be published once confirmed.
          </Callout>
        </div>
      </PageSection>

      <PageSection tone="ice" eyebrow="Questions" title="About support.">
        <div className="mx-auto max-w-3xl">
          <FaqList
            items={[
              {
                question: "Do I need an account to get support?",
                answer:
                  "Support requests are held against an account so the conversation, the record and any decision stay together. If you do not have an account - for example you are a visitor asking a pre-sale question - reply to the email address you used for your quote request and we will answer there.",
              },
              {
                question: "Can I ask about cover before buying?",
                answer:
                  "Yes, and it is a good idea. Ask which exclusion would apply to a specific situation before you apply, rather than after an incident.",
              },
              {
                question: "How do I follow up?",
                answer:
                  "Reply on the same request. That keeps the whole thread - including anything a handler recorded - in one place rather than splitting it across messages.",
              },
              {
                question: "Who can see my support request?",
                answer:
                  "You, and the staff who need it to act on your request. Internal notes are separated from the conversation and are not visible to you, and access is enforced on the server.",
              },
            ]}
          />
        </div>
      </PageSection>

      <CtaPanel
        eyebrow="Open a request"
        title="Tell us what you need."
        body="Sign in to raise a support request linked to the right policy, claim or payment, and follow every reply in one thread."
        primary={{
          label: isAuthenticated ? "Open support in my vault" : "Sign in to contact support",
          to: isAuthenticated ? "/dashboard/support" : SIGN_IN_SUPPORT,
        }}
        secondary={{ label: "Report a problem", to: "/support/report" }}
      />

      <RelatedLinks
        links={[
          {
            label: "Report a problem",
            href: "/support/report",
            description: "Something broken or incorrect",
          },
          {
            label: "Help centre",
            href: "/help",
            description: "Search guides by topic",
          },
          {
            label: "Complaints procedure",
            href: "/legal/complaints",
            description: "Escalating a service issue",
          },
        ]}
      />

      <div className="mx-auto -mt-4 max-w-[1240px] px-5 pb-14">
        <p className="flex items-center gap-2 text-[0.75rem] text-muted-foreground">
          <MessagesSquare className="size-3.5 text-electric" />
          Requests raised while signed in are linked to your record automatically.
        </p>
      </div>
    </>
  );
}
