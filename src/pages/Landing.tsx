import { FinalCta } from "@/components/landing/FinalCta";
import { Hero } from "@/components/landing/Hero";
import { Plans } from "@/components/landing/Plans";
import { Process } from "@/components/landing/Process";
import { Solutions } from "@/components/landing/Solutions";
import { Story } from "@/components/landing/Story";
import { Testimonials } from "@/components/landing/Testimonials";
import { Why } from "@/components/landing/Why";
import { Footer } from "@/components/site/Footer";
import { Navbar } from "@/components/site/Navbar";
import { QuoteDialog } from "@/components/site/QuoteDialog";
import type { CoverageKey } from "@/lib/vault";
import { motion, useScroll, useSpring } from "framer-motion";
import { useState } from "react";

export default function Landing() {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteSession, setQuoteSession] = useState(0);
  const [coverage, setCoverage] = useState<CoverageKey>("health");
  const [plan, setPlan] = useState<string | undefined>(undefined);

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 26,
    restDelta: 0.001,
  });

  const openQuote = (options?: { coverage?: CoverageKey; plan?: string }) => {
    setCoverage(options?.coverage ?? "health");
    setPlan(options?.plan);
    setQuoteSession((session) => session + 1);
    setQuoteOpen(true);
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background">
      <motion.div
        aria-hidden="true"
        style={{ scaleX: progress }}
        className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-electric"
      />

      <Navbar onRequestQuote={() => openQuote()} />

      <main>
        <Hero onQuote={() => openQuote()} />
        <Story />
        <Why />
        <Solutions onQuote={(selected) => openQuote({ coverage: selected })} />
        <Process onQuote={() => openQuote()} />
        <Plans onQuote={(selectedPlan) => openQuote({ plan: selectedPlan })} />
        <Testimonials />
        <FinalCta onQuote={() => openQuote()} />
      </main>

      <Footer />

      <QuoteDialog
        key={quoteSession}
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        defaultCoverage={coverage}
        defaultPlan={plan}
      />
    </div>
  );
}
