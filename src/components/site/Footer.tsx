import { Brand } from "./Brand";
import { ArrowRight, ArrowUp, Instagram, Linkedin, Twitter } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const columns = [
  {
    title: "Coverage",
    links: [
      { label: "Health", href: "#coverage" },
      { label: "Home", href: "#coverage" },
      { label: "Auto", href: "#coverage" },
      { label: "Life", href: "#coverage" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", href: "#about" },
      { label: "How it works", href: "#process" },
      { label: "Plans", href: "#plans" },
      { label: "Member stories", href: "#stories" },
    ],
  },
];

export function Footer() {
  const [email, setEmail] = useState("");

  const subscribe = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    toast.success("You're on the list.", {
      description: "A monthly note on protecting what matters. No noise.",
    });
    setEmail("");
  };

  return (
    <footer className="mt-24 bg-[#071227] text-bone/80">
      <div className="mx-auto max-w-[1180px] px-5 pb-10 pt-16 sm:px-8 sm:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1.15fr]">
          <div>
            <Brand as="div" className="text-bone" />
            <p className="mt-5 max-w-[19rem] text-sm leading-6 text-bone/55">
              Modern insurance for everything you&apos;re building. Human
              advice, honest pricing, and cover that holds when it matters.
            </p>
            <div className="mt-6 flex gap-2">
              {[
                { Icon: Instagram, label: "Instagram" },
                { Icon: Linkedin, label: "LinkedIn" },
                { Icon: Twitter, label: "X" },
              ].map(({ Icon, label }) => (
                <a
                  key={label}
                  href="#top"
                  aria-label={label}
                  className="grid size-9 place-items-center rounded-full border border-white/12 text-bone/70 transition-colors hover:border-white/30 hover:text-bone"
                >
                  <Icon className="size-3.5" />
                </a>
              ))}
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.26em] text-bone/40">
                {column.title}
              </p>
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-bone/65 transition-colors hover:text-bone"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.26em] text-bone/40">
              The monthly brief
            </p>
            <p className="mt-5 text-sm leading-6 text-bone/55">
              One calm email a month on protecting your future. No sales slides.
            </p>
            <form onSubmit={subscribe} className="mt-4 flex items-center gap-2">
              <label htmlFor="footer-email" className="sr-only">
                Email address
              </label>
              <input
                id="footer-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="h-11 min-w-0 flex-1 rounded-full border border-white/14 bg-white/[0.04] px-4 text-sm text-bone placeholder:text-bone/35 focus:border-electric-soft/70 focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Subscribe"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-electric text-white transition-colors hover:bg-[#235fe8]"
              >
                <ArrowRight className="size-4" />
              </button>
            </form>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-white/10 pt-8 text-xs text-bone/45 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <p>© {new Date().getFullYear()} Cosmic Vault Insurance Ltd.</p>
            <p>
              12 Meridian Wharf, London SE1 · 020 7946 0958 ·
              concierge@cosmicvault.co
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <a href="#top" className="transition-colors hover:text-bone">
              Privacy
            </a>
            <a href="#top" className="transition-colors hover:text-bone">
              Terms
            </a>
            <a href="#top" className="transition-colors hover:text-bone">
              Complaints
            </a>
            <a
              href="#top"
              className="group inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 text-bone/65 transition-colors hover:text-bone"
            >
              Back to top
              <ArrowUp className="size-3 transition-transform group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>

        <p className="mt-6 text-[0.65rem] leading-5 text-bone/30">
          Cosmic Vault is a trading name of Cosmic Vault Insurance Ltd, authorised
          and regulated by the Financial Conduct Authority (FRN 928104). Cover is
          subject to policy terms and exclusions. This page is a design concept.
        </p>
      </div>

      <div className="overflow-hidden border-t border-white/[0.06]">
        <p className="mx-auto max-w-[1180px] translate-y-[16%] select-none whitespace-nowrap px-5 text-[clamp(2.1rem,12vw,10rem)] font-semibold leading-[0.8] tracking-[-0.06em] text-white/[0.05] sm:px-8">
          COSMIC VAULT
        </p>
      </div>
    </footer>
  );
}
