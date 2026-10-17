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
import { IMAGES } from "@/lib/imagery";
import {
  Briefcase,
  Car,
  CreditCard,
  FileCheck2,
  FileSearch,
  FolderOpen,
  Handshake,
  HeartHandshake,
  HeartPulse,
  House,
  LifeBuoy,
  Plane,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link } from "react-router";

const SIGN_IN_CLAIMS = "/auth?returnTo=%2Fdashboard%2Fclaims";

export function ClaimsOverview() {
  usePageMeta(
    "Claims overview",
    "How claims work at Cosmic Vault: when you may need to claim, what information helps, how a handler reviews a claim, and how to follow an existing one.",
  );

  return (
    <>
      <PageHero
        eyebrow="Claims & support · Overview"
        title="When something goes wrong, this is the route."
        intro="A claim is a review, not an argument. You tell us what happened, a handler assesses it against the policy, and the decision is recorded with its reasons."
        media={{ image: IMAGES.claimReview, caption: "Assessed by a person, decided with reasons" }}
        aside={{
          title: "The essentials",
          body: "Have the policy, the date, a clear description and whatever evidence supports it. Everything else can follow.",
          items: [
            { label: "Make a claim", href: "/claims/make-a-claim" },
            { label: "Policy documents", href: "/claims/policy-documents" },
          ],
        }}
        actions={
          <>
            <SiteButton to="/claims/make-a-claim">Make a claim</SiteButton>
            <SiteButton to="/claims/track" variant="outline">
              Track a claim
            </SiteButton>
          </>
        }
      />

      <PageSection
        eyebrow="When you might claim"
        title="The situations people actually report."
        intro="Each cover line has its own pattern of losses. Recognising yours early makes the paperwork much shorter."
      >
        <FeatureGrid
          items={[
            {
              title: "Home",
              icon: House,
              body: "Storm or escape of water damage, theft, accidental damage to contents, or the boiler failing at the worst possible moment.",
            },
            {
              title: "Motor",
              icon: Car,
              body: "Collision damage, a stolen vehicle, windscreen damage, or an incident abroad where local repair or recovery is needed.",
            },
            {
              title: "Travel",
              icon: Plane,
              body: "Emergency medical treatment, a trip cancelled for an accepted reason, lost baggage, or a gadget damaged in transit.",
            },
            {
              title: "Health",
              icon: HeartPulse,
              body: "Diagnostics and consultant care, a course of treatment, or mental-health support where a referral would otherwise delay it.",
            },
            {
              title: "Life and family",
              icon: HeartHandshake,
              body: "A claim made by the people you have protected, or a critical-illness claim where that option is part of the policy.",
            },
            {
              title: "Business",
              icon: Briefcase,
              body: "A liability claim brought by a third party, an employee injury, or lost trading after an insured event.",
            },
          ]}
        />
      </PageSection>

      <PageSection
        tone="ice"
        eyebrow="Review process"
        title="How a claim is handled."
        intro="Claim decisions are manual by design. Nothing here is approved automatically, and no step hides behind a status you cannot see."
      >
        <StepList
          steps={[
            {
              title: "You submit the claim",
              body: "Against an active policy, with the incident date, location, description and the amount you are claiming.",
            },
            {
              title: "It is assigned to a handler",
              body: "A named person takes ownership. The assignment is recorded on the claim with the time it happened.",
            },
            {
              title: "The handler assesses it",
              body: "The claim is checked against the policy terms — cover, limits, excess, exclusions and conditions.",
            },
            {
              title: "You answer any request",
              body: "If information is missing, the request is written on the claim. You reply there, so the thread stays with the record.",
            },
            {
              title: "A decision is recorded",
              body: "Approved, partially approved, or declined — always with the reason and the person who decided.",
            },
            {
              title: "Settlement is tracked",
              body: "Where an amount is payable it is recorded as its own transaction against the claim, and you can follow it.",
            },
          ]}
        />
      </PageSection>

      <PageSection
        eyebrow="Getting it right"
        title="What helps a claim go smoothly."
      >
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <CheckList
              items={[
                "Report it as soon as you reasonably can — most policies set a limit on how long you have.",
                "Describe what happened plainly, in the order it happened, without deciding for us whether it is covered.",
                "Keep evidence: photographs before repairs, receipts, reports, and correspondence with third parties.",
                "Tell us about anything that has changed since the policy started, even if it feels minor.",
                "Do not arrange permanent repairs before we have seen the damage, unless it is urgent to make the property safe.",
              ]}
            />
          </div>
          <div className="space-y-5 lg:col-span-5">
            <Callout tone="warning" title="Submitting is not approving">
              A submitted claim is not an admission of cover. Cover depends on the
              policy terms in force on the date of the incident.
            </Callout>
            <Callout title="If in doubt, ask first">
              Unsure whether something is worth claiming, or whether an excess
              makes it pointless? Ask support before you submit. It costs nothing
              and often saves a wasted claim.
            </Callout>
          </div>
        </div>
      </PageSection>

      <PageSection
        tone="ice"
        eyebrow="Your claim"
        title="Accessing a claim you already have."
        intro="Claims, documents and settlement records are held against your account. Sign in to see the live position rather than waiting for an update."
      >
        <FeatureGrid
          columns={2}
          items={[
            {
              title: "Track progress",
              icon: FileSearch,
              body: "Every claim shows its status, its handler, what has happened so far, and anything waiting on you.",
            },
            {
              title: "Policy documents",
              icon: FolderOpen,
              body: "The schedule and wording for the policy being claimed against, available whenever you need them.",
            },
            {
              title: "Decision reasons",
              icon: FileCheck2,
              body: "A decision records why it was reached, so you know what to supply if you want it reviewed.",
            },
            {
              title: "Settlement and payments",
              icon: CreditCard,
              body: "Any settlement amount appears as a transaction against the claim, with its own reference and status.",
            },
          ]}
        />
        <div className="mt-8 flex flex-wrap gap-3">
          <SiteButton to="/claims/track">Track a claim</SiteButton>
          <SiteButton to="/support/contact" variant="outline">
            Contact support
          </SiteButton>
        </div>
      </PageSection>

      <PageSection
        eyebrow="Reaching a person"
        title="You can always ask a human."
        intro="If a claim decision seems wrong, or a request is unclear, you do not have to work it out alone."
      >
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-[1.3rem] border border-line bg-card p-6">
            <span className="grid size-10 place-items-center rounded-full bg-ice text-primary">
              <UserRound className="size-4" />
            </span>
            <p className="mt-5 text-[1rem] font-semibold text-ink">
              Ask about a decision
            </p>
            <p className="mt-2 text-[0.84rem] leading-6 text-muted-foreground">
              A handler can explain which term drove an outcome and what
              information would change it. If you disagree, you can dispute the
              decision with supporting evidence.
            </p>
            <div className="mt-5">
              <Link
                to="/support/contact"
                className="inline-flex items-center gap-2 text-[0.8rem] font-medium text-primary"
              >
                Contact support
                <LifeBuoy className="size-3.5" />
              </Link>
            </div>
          </div>
          <div className="rounded-[1.3rem] border border-line bg-card p-6">
            <span className="grid size-10 place-items-center rounded-full bg-ice text-primary">
              <ShieldCheck className="size-4" />
            </span>
            <p className="mt-5 text-[1rem] font-semibold text-ink">
              Escalate formally
            </p>
            <p className="mt-2 text-[0.84rem] leading-6 text-muted-foreground">
              If an explanation does not resolve it, the complaints procedure sets
              out how a complaint is recorded, reviewed and escalated.
            </p>
            <div className="mt-5">
              <Link
                to="/legal/complaints"
                className="inline-flex items-center gap-2 text-[0.8rem] font-medium text-primary"
              >
                Complaints procedure
                <Handshake className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </PageSection>

      <CtaPanel
        eyebrow="Start a claim"
        title="Submit a claim against your policy."
        body="Sign in to choose the policy, describe the incident, and attach what you have. You will see every update on the claim itself."
        primary={{ label: "Make a claim", to: "/claims/make-a-claim" }}
        secondary={{ label: "Help centre", to: "/help" }}
      />

      <RelatedLinks
        links={[
          {
            label: "Make a claim",
            href: "/claims/make-a-claim",
            description: "What to gather before you start",
          },
          {
            label: "Track a claim",
            href: "/claims/track",
            description: "Sign in to follow progress",
          },
          {
            label: "Payments and billing",
            href: "/claims/payments",
            description: "Premiums, refunds and settlements",
          },
        ]}
      />
    </>
  );
}

export function MakeClaim() {
  usePageMeta(
    "Make a claim",
    "How to make an insurance claim at Cosmic Vault: what to have ready, how submission works, and what happens during a manual review.",
  );

  return (
    <>
      <PageHero
        eyebrow="Claims & support · Make a claim"
        title="Tell us what happened."
        intro="A clear account, evidence and the right policy is usually all it takes to get a claim moving. This page explains exactly what to prepare before you open it."
        media={{ image: IMAGES.support, caption: "Everything you gather stays on the claim" }}
        aside={{
          title: "Where claims are submitted",
          body: "Claims are submitted inside your vault, against an active policy, so the whole review stays on the record.",
          items: [
            { label: "Claims overview", href: "/claims" },
            { label: "Policy documents", href: "/claims/policy-documents" },
          ],
        }}
        actions={
          <>
            <SiteButton to={SIGN_IN_CLAIMS}>Sign in to submit a claim</SiteButton>
            <SiteButton to="/support/contact" variant="outline">
              Ask before claiming
            </SiteButton>
          </>
        }
      />

      <PageSection
        eyebrow="Before you start"
        title="Have these to hand."
        intro="You can save a claim and return to it, but a claim with complete information is reviewed sooner."
      >
        <div className="grid gap-10 lg:grid-cols-2">
          <CheckList
            items={[
              "The policy you are claiming against, and its policy number.",
              "The date, time and location of the incident.",
              "A plain description of what happened and who was involved.",
              "The amount you are claiming, as accurately as you can state it.",
            ]}
          />
          <CheckList
            items={[
              "Photographs or video, ideally taken before any repair or clean-up.",
              "Receipts, invoices or valuations for damaged items.",
              "Any report — police, fire, medical, or a recovery service.",
              "Correspondence with anyone else involved, including their insurer.",
            ]}
          />
        </div>

        <div className="mt-8">
          <Callout tone="warning" title="Report it promptly">
            Policies set a limit on how long you have to report an insured event.
            If there is a reason you could not report it sooner, tell us that as
            part of the claim rather than leaving it out.
          </Callout>
        </div>
      </PageSection>

      <PageSection
        tone="ice"
        eyebrow="In your vault"
        title="How submission works."
      >
        <StepList
          steps={[
            {
              title: "Open the claim",
              body: "Choose the active policy, then the incident date, location and amount. A reference is created immediately.",
            },
            {
              title: "Describe the incident",
              body: "Write it in the order it happened. There is no format to learn and no wrong way to say it.",
            },
            {
              title: "Attach your evidence",
              body: "Upload photographs, receipts and reports. They are attached to the claim and to your document vault.",
            },
            {
              title: "Submit for review",
              body: "Submitting assigns the claim for assessment. It does not decide anything, and cover is not confirmed by it.",
            },
            {
              title: "Respond to requests",
              body: "If the handler needs something specific, it appears on the claim. Reply there and the thread stays with the record.",
            },
            {
              title: "Track to decision",
              body: "The claim shows its status, decision and reason, and any settlement recorded against it.",
            },
          ]}
        />
      </PageSection>

      <PageSection
        eyebrow="What to expect"
        title="The honest version."
      >
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="rounded-[1.3rem] border border-line bg-card p-6">
            <p className="text-[0.98rem] font-semibold text-ink">
              A person decides
            </p>
            <p className="mt-2 text-[0.84rem] leading-6 text-muted-foreground">
              Claims are assessed against the policy by an authorised handler.
              There is no automatic approval and no automatic decline.
            </p>
          </div>
          <div className="rounded-[1.3rem] border border-line bg-card p-6">
            <p className="text-[0.98rem] font-semibold text-ink">
              No invented timelines
            </p>
            <p className="mt-2 text-[0.84rem] leading-6 text-muted-foreground">
              We do not publish a settlement promise. How long a claim takes
              depends on the evidence and on third parties we do not control.
            </p>
          </div>
          <div className="rounded-[1.3rem] border border-line bg-card p-6">
            <p className="text-[0.98rem] font-semibold text-ink">
              Reasons, always
            </p>
            <p className="mt-2 text-[0.84rem] leading-6 text-muted-foreground">
              If part or all of a claim is not covered, the decision states the
              reason and what would change it, and you can respond.
            </p>
          </div>
        </div>
      </PageSection>

      <PageSection tone="ice" eyebrow="Questions" title="Claim questions, answered.">
        <div className="mx-auto max-w-3xl">
          <FaqList
            items={[
              {
                question: "I can't sign in — how do I claim?",
                answer:
                  "Contact support and explain that you need access. Claims are held against an account so that documents and decisions have an owner, so access has to be restored before a claim can be raised.",
              },
              {
                question: "Can I claim for something that happened before the policy started?",
                answer:
                  "Cover applies to incidents during the policy period. If an event happened before cover started, tell us anyway — a handler will explain the position rather than leaving you guessing.",
              },
              {
                question: "What if I disagree with the outcome?",
                answer:
                  "You can dispute a decision with supporting information, which is recorded on the claim. If that does not resolve it, the complaints procedure is the formal route.",
              },
              {
                question: "Will claiming affect my premium?",
                answer:
                  "Claims history can be a rating factor for some products, and it is one of the questions asked at quotation. How it applies depends on the product and is described in its terms.",
              },
            ]}
          />
        </div>
      </PageSection>

      <CtaPanel
        eyebrow="Next step"
        title="Open the claim when you're ready."
        body="Sign in, choose the policy, and describe what happened. You can attach what you have and add the rest afterwards."
        primary={{ label: "Sign in to submit a claim", to: SIGN_IN_CLAIMS }}
        secondary={{ label: "Track an existing claim", to: "/claims/track" }}
      />

      <RelatedLinks
        links={[
          { label: "Claims overview", href: "/claims" },
          { label: "Policy documents", href: "/claims/policy-documents" },
          { label: "Help centre", href: "/help" },
        ]}
      />
    </>
  );
}
