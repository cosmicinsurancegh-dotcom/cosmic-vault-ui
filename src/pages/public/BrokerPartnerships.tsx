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
  StepList,
} from "@/components/site/PageShell";
import { usePageMeta } from "@/hooks/use-page-meta";
import {
  ClipboardList,
  Handshake,
  Lock,
  ScrollText,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";

export default function BrokerPartnerships() {
  usePageMeta(
    "Broker partnerships",
    "How Cosmic Vault works with brokers: assigned customers, recorded consent, quotations and applications prepared on a customer's behalf, and enforced data access.",
  );

  return (
    <>
      <PageHero
        eyebrow="About · Broker partnerships"
        title="Working with intermediaries."
        intro="The broker desk is part of the platform rather than a separate system: brokers work with customers assigned to them, record consent before preparing terms, and see only what the assignment allows."
        aside={{
          title: "The model in one line",
          body: "A broker prepares and progresses a customer's quotation and application, with the customer's consent recorded and the customer retaining full visibility in their own vault.",
          items: [
            { label: "Contact us about a partnership", href: "/support/contact" },
            { label: "Our principles", href: "/about/principles" },
          ],
        }}
        actions={
          <>
            <SiteButton to="/support/contact">Enquire about partnering</SiteButton>
            <SiteButton to="/cover" variant="outline">
              See the cover lines
            </SiteButton>
          </>
        }
      />

      <PageSection
        eyebrow="What the broker desk does"
        title="Built for the way brokers actually work."
        intro="Everything below exists today. Nothing on this page describes a capability that is still to be built."
      >
        <FeatureGrid
          items={[
            {
              title: "Assigned customers",
              icon: Users,
              body: "An assignment links a broker to a specific customer. Without an active assignment, the customer's records are not reachable.",
            },
            {
              title: "Recorded consent",
              icon: Handshake,
              body: "Preparing a quotation on someone's behalf requires the broker to confirm the customer asked for it, and that consent is recorded with a timestamp.",
            },
            {
              title: "Quotations in the customer's name",
              icon: ClipboardList,
              body: "Brokers build quotations and convert them into applications, with the product version, answers and calculated premium all kept.",
            },
            {
              title: "Servicing visibility",
              icon: ScrollText,
              body: "Policies and servicing requests for assigned customers are visible to the allocation, so a broker can answer questions without asking the customer to repeat themselves.",
            },
            {
              title: "Commission configuration",
              icon: Store,
              body: "Commission handling and rates are configured per broker profile by an administrator, and only where the platform operator has enabled it.",
            },
            {
              title: "Workload and activity",
              icon: ShieldCheck,
              body: "Allocations, assignments and the work attached to them are recorded, so accountability is not based on recollection.",
            },
          ]}
        />
      </PageSection>

      <PageSection
        tone="ice"
        eyebrow="Access boundaries"
        title="What a broker cannot do."
        intro="Data access is enforced on the server for each record. Hiding a link is presentation; permission checks are the actual control."
      >
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <CheckList
              items={[
                "See a customer who is not assigned to them, or any record belonging to one.",
                "Continue to see a customer after an assignment is revoked.",
                "Decide a claim, approve an application, or confirm a payment.",
                "Change a policy directly — servicing goes through the same request and approval route as a customer's own request.",
                "Access staff areas, reports, or settings beyond what their own role permits.",
              ]}
            />
          </div>
          <div className="space-y-5">
            <Callout title="The customer keeps their own view">
              A customer always has their own account with their own documents,
              payments and claims. Working through a broker does not remove that:
              the same records are visible to both sides.
            </Callout>
            <Callout tone="warning" title="Claims stay independent">
              Where a broker can see claim information for an assigned customer,
              it is for support only. Decisions are made by authorised staff, so
              the person handling the relationship is never also the approving
              authority.
            </Callout>
          </div>
        </div>
      </PageSection>

      <PageSection eyebrow="Getting started" title="How a partnership begins.">
        <StepList
          steps={[
            {
              title: "Tell us about your practice",
              body: "Get in touch through support with the markets you write in, the cover lines you need, and how you handle customer consent.",
            },
            {
              title: "A profile is created",
              body: "An administrator creates the broker profile, sets the territories, and enables commission handling only if the operator uses it.",
            },
            {
              title: "Customers are assigned",
              body: "Assignments are created deliberately rather than by default. Each one records who created it and when.",
            },
            {
              title: "You work the allocation",
              body: "Prepare quotations, build applications, upload documents, and track progress — all within the assignment.",
            },
            {
              title: "Access is reviewed",
              body: "Assignments can be revoked, and a revoked assignment removes access to the customer's records from that point on.",
            },
          ]}
        />
      </PageSection>

      <PageSection tone="ice" eyebrow="Questions" title="Broker questions.">
        <div className="mx-auto max-w-3xl">
          <FaqList
            items={[
              {
                question: "Do customers need their own account?",
                answer:
                  "The records are held against the customer so they can see their own quotations, policies and documents. A broker prepares and progresses the work; the customer is never locked out of their own file.",
              },
              {
                question: "Can a broker see claims?",
                answer:
                  "Where the allocation permits it and the claim belongs to an assigned customer, yes — for supporting the customer. Claim decisions remain with authorised staff and cannot be influenced by the assigned broker.",
              },
              {
                question: "How is consent recorded?",
                answer:
                  "Before a quotation is created on a customer's behalf, the broker confirms the customer has asked for it. That confirmation is stored with the quotation, including when it was given.",
              },
              {
                question: "Is commission always paid?",
                answer:
                  "Commission handling is configured per broker profile and can be disabled entirely by the platform operator. Where it is used, the rate is set on the profile rather than assumed.",
              },
            ]}
          />
        </div>
      </PageSection>

      <CtaPanel
        eyebrow="Partner with us"
        title="Start a conversation."
        body="Tell us about your practice and the cover lines you need. We will explain the onboarding steps and what an assignment involves."
        primary={{ label: "Contact us", to: "/support/contact" }}
        secondary={{ label: "Our commitment to customers", to: "/about/commitment" }}
      />

      <RelatedLinks
        links={[
          { label: "Our story", href: "/about" },
          { label: "Our principles", href: "/about/principles" },
          { label: "Regulatory information", href: "/legal/regulatory" },
        ]}
      />

      <div className="mx-auto -mt-4 max-w-[1180px] px-5 pb-14 sm:px-8">
        <p className="flex items-center gap-2 text-[0.75rem] text-muted-foreground">
          <Lock className="size-3.5 text-electric" />
          Assignment, consent and permission checks are enforced by the backend,
          not by the interface alone.
        </p>
      </div>
    </>
  );
}
