import { FinalCta } from "@/components/landing/FinalCta";
import { HeroBroadsheet } from "@/components/landing/heroes/HeroBroadsheet";
import { Plans } from "@/components/landing/Plans";
import { Process } from "@/components/landing/Process";
import { ReleaseTracking } from "@/components/landing/ReleaseTracking";
import { Solutions } from "@/components/landing/Solutions";
import { Story } from "@/components/landing/Story";
import { Testimonials } from "@/components/landing/Testimonials";
import { VaultReviewDialog } from "@/components/landing/VaultReviewDialog";
import { Why } from "@/components/landing/Why";
import { usePageMeta } from "@/hooks/use-page-meta";
import type { CoverageKey } from "@/lib/vault";
import { motion, useScroll, useSpring } from "framer-motion";
import { useState } from "react";

export default function Landing() {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSession, setReviewSession] = useState(0);
  const [coverage, setCoverage] = useState<CoverageKey>("home");

  usePageMeta(
    "Vault custody and object insurance for precious minerals",
    "Cosmic Vault stores gold, diamonds, gemstones and critical minerals under dual control, with a named insurance policy on every object and a five-stage tracked release.",
  );

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 26,
    restDelta: 0.001,
  });

  const openReview = (options?: { coverage?: CoverageKey }) => {
    setCoverage(options?.coverage ?? "home");
    setReviewSession((session) => session + 1);
    setReviewOpen(true);
  };

  return (
    <div className="relative">
      <motion.div
        aria-hidden="true"
        style={{ scaleX: progress }}
        className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-electric"
      />

      <HeroBroadsheet onQuote={() => openReview()} />
      <Story />
      <Solutions onReview={(key) => openReview({ coverage: key })} />
      <Plans onReview={() => openReview()} />
      <ReleaseTracking />
      <Process onReview={() => openReview()} />
      <Why />
      <Testimonials />
      <FinalCta onReview={() => openReview()} />

      <VaultReviewDialog
        key={reviewSession}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        defaultCoverage={coverage}
      />
    </div>
  );
}
