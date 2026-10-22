import { FinalCta } from "@/components/landing/FinalCta";
import { HeroBroadsheet } from "@/components/landing/heroes/HeroBroadsheet";
import { Plans } from "@/components/landing/Plans";
import { Process } from "@/components/landing/Process";
import { Solutions } from "@/components/landing/Solutions";
import { Story } from "@/components/landing/Story";
import { Testimonials } from "@/components/landing/Testimonials";
import { Why } from "@/components/landing/Why";
import { QuoteDialog } from "@/components/site/QuoteDialog";
import type { CoverageKey } from "@/lib/vault";
import { motion, useScroll, useSpring } from "framer-motion";
import { useState } from "react";

export default function Landing() {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteSession, setQuoteSession] = useState(0);
  const [coverage, setCoverage] = useState<CoverageKey>("home");

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 26,
    restDelta: 0.001,
  });

  const openQuote = (options?: { coverage?: CoverageKey }) => {
    setCoverage(options?.coverage ?? "home");
    setQuoteSession((session) => session + 1);
    setQuoteOpen(true);
  };

  return (
    <div className="relative">
      <motion.div
        aria-hidden="true"
        style={{ scaleX: progress }}
        className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-electric"
      />

      <HeroBroadsheet onQuote={() => openQuote()} />
      <Story />
      <Why />
      <Solutions />
      <Process onQuote={() => openQuote()} />
      <Plans onQuote={() => openQuote()} />
      <Testimonials />
      <FinalCta onQuote={() => openQuote()} />

      <QuoteDialog
        key={quoteSession}
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        defaultCoverage={coverage}
      />
    </div>
  );
}
