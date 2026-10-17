import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Brand } from "./Brand";

const LINKS = [
  { label: "Home", href: "#top" },
  { label: "About", href: "#about" },
  { label: "Coverage", href: "#coverage" },
  { label: "Process", href: "#process" },
  { label: "Plans", href: "#plans" },
  { label: "Stories", href: "#stories" },
];

export function Navbar({ onRequestQuote }: { onRequestQuote: () => void }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState("#top");
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = LINKS.map((link) =>
      document.getElementById(link.href.slice(1)),
    ).filter((element): element is HTMLElement => Boolean(element));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(`#${visible.target.id}`);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.15, 0.4] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const ctaLabel = isAuthenticated ? "Enter my vault" : "Book a call";
  const handleCta = () => {
    if (isAuthenticated) {
      navigate("/dashboard");
    } else {
      onRequestQuote();
    }
  };

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-5">
      <div
        className={cn(
          "relative mx-auto flex max-w-[1180px] items-center justify-between gap-4 rounded-full border border-ink/10 px-3 py-2 backdrop-blur-xl transition-colors duration-500 sm:px-4",
          scrolled ? "bg-bone/90" : "bg-bone/70",
        )}
      >
        <Brand compact className="pl-1.5 text-ink" />

        <nav
          aria-label="Primary"
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 lg:flex"
        >
          {LINKS.map((link) => {
            const isActive = active === link.href;
            return (
              <a
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-4 py-2 text-[0.83rem] font-medium transition-colors duration-300",
                  isActive
                    ? "bg-ink text-bone"
                    : "text-ink/65 hover:bg-ink/[0.055] hover:text-ink",
                )}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCta}
            className="group hidden items-center gap-2 rounded-full bg-electric px-5 py-2.5 text-[0.83rem] font-medium text-white transition-colors duration-300 hover:bg-[#235fe8] sm:inline-flex"
          >
            {ctaLabel}
            <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="grid size-10 place-items-center rounded-full border border-ink/12 text-ink transition-colors hover:bg-ink/[0.045] lg:hidden"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="absolute inset-x-0 top-[calc(100%+10px)] rounded-[1.5rem] border border-ink/10 bg-bone/95 p-3 backdrop-blur-xl lg:hidden"
            >
              <nav aria-label="Mobile" className="flex flex-col">
                {LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                      active === link.href
                        ? "bg-ink text-bone"
                        : "text-ink/75 hover:bg-ink/[0.05] hover:text-ink",
                    )}
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  handleCta();
                }}
                className="mt-2 flex w-full items-center justify-between rounded-xl bg-electric px-4 py-3.5 text-sm font-medium text-white"
              >
                {ctaLabel}
                <ArrowUpRight className="size-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
