import type { ReactNode } from "react";
import { lazy } from "react";
import { ProtectedRedirect } from "@/components/site/ProtectedRedirect";
import { COVERS } from "@/lib/covers";
import { contentPage } from "@/lib/contentPages";
import { LEGAL_SLUGS } from "@/lib/legalPages";

const AllCover = lazy(() => import("@/pages/public/AllCover"));
const CoverDetail = lazy(() => import("@/pages/public/CoverDetail"));
const ContentPage = lazy(() => import("@/pages/public/ContentPage"));
const QuotePage = lazy(() => import("@/pages/public/QuotePage"));
const ClaimsOverview = lazy(() =>
  import("@/pages/public/ClaimsPages").then((module) => ({
    default: module.ClaimsOverview,
  })),
);
const MakeClaim = lazy(() =>
  import("@/pages/public/ClaimsPages").then((module) => ({
    default: module.MakeClaim,
  })),
);
const HelpCentre = lazy(() =>
  import("@/pages/public/HelpPages").then((module) => ({
    default: module.HelpCentre,
  })),
);
const Faqs = lazy(() =>
  import("@/pages/public/HelpPages").then((module) => ({
    default: module.Faqs,
  })),
);
const ContactSupport = lazy(() => import("@/pages/public/ContactSupport"));
const Contact = lazy(() => import("@/pages/public/Contact"));
const BrokerPartnerships = lazy(() => import("@/pages/public/BrokerPartnerships"));
const LegalPage = lazy(() => import("@/pages/public/LegalPage"));

export type PublicRoute = { path: string; element: ReactNode };

/** Every public marketing, guidance, claims, support, company and legal route. */
export const PUBLIC_ROUTES: PublicRoute[] = [
  /* Cover */
  { path: "cover", element: <AllCover /> },
  ...COVERS.map((cover) => ({
    path: `cover/${cover.slug}`,
    element: <CoverDetail slug={cover.slug} />,
  })),
  {
    path: "cover/understanding",
    element: <ContentPage config={contentPage("cover-understanding")} />,
  },
  {
    path: "cover/limits-and-exclusions",
    element: <ContentPage config={contentPage("cover-limits")} />,
  },

  /* How it works */
  {
    path: "how-it-works",
    element: <ContentPage config={contentPage("how-it-works")} />,
  },
  {
    path: "how-it-works/apply",
    element: <ContentPage config={contentPage("how-it-works-apply")} />,
  },
  {
    path: "how-it-works/your-policy",
    element: <ContentPage config={contentPage("how-it-works-policy")} />,
  },
  {
    path: "how-it-works/renewals",
    element: <ContentPage config={contentPage("how-it-works-renewals")} />,
  },
  { path: "quote", element: <QuotePage /> },

  /* Claims and support */
  { path: "claims", element: <ClaimsOverview /> },
  { path: "claims/make-a-claim", element: <MakeClaim /> },
  {
    path: "claims/track",
    element: <ProtectedRedirect to="/dashboard/claims" />,
  },
  {
    path: "claims/policy-documents",
    element: <ProtectedRedirect to="/dashboard/documents" />,
  },
  {
    path: "claims/payments",
    element: <ContentPage config={contentPage("claims-payments")} />,
  },
  { path: "help", element: <HelpCentre /> },
  { path: "faqs", element: <Faqs /> },
  { path: "support/contact", element: <ContactSupport /> },
  {
    path: "support/report",
    element: <ContentPage config={contentPage("support-report")} />,
  },

  /* Company */
  { path: "about", element: <ContentPage config={contentPage("about")} /> },
  {
    path: "about/principles",
    element: <ContentPage config={contentPage("about-principles")} />,
  },
  {
    path: "about/commitment",
    element: <ContentPage config={contentPage("about-commitment")} />,
  },
  { path: "about/brokers", element: <BrokerPartnerships /> },
  { path: "contact", element: <Contact /> },

  /* Legal and trust */
  ...LEGAL_SLUGS.map((slug) => ({
    path: `legal/${slug}`,
    element: <LegalPage slug={slug} />,
  })),
];
