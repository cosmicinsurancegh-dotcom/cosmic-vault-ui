import { Brand } from "@/components/site/Brand";
import { Media } from "@/components/site/Media";
import { requestCookieSettings } from "@/lib/consent";
import { MINERAL_IMAGES, type VaultImage } from "@/lib/imagery";
import { FOOTER_COLUMNS } from "@/lib/navigation";
import { ArrowRight, ArrowUp, ShieldCheck } from "lucide-react";
import { Link } from "react-router";

const CLASSES: { label: string; href: string; image: VaultImage }[] = [
  { label: "Bullion & bars", href: "/#store", image: MINERAL_IMAGES.bullion },
  { label: "Diamonds", href: "/#store", image: MINERAL_IMAGES.diamonds },
  { label: "Gemstones", href: "/#store", image: MINERAL_IMAGES.emerald },
  { label: "Rare earths", href: "/#store", image: MINERAL_IMAGES.rareEarth },
  { label: "Platinum", href: "/#store", image: MINERAL_IMAGES.platinum },
  { label: "Collections", href: "/#store", image: MINERAL_IMAGES.ruby },
];

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-muted text-ink/80 sm:mt-28">
      <div className="mx-auto max-w-[1180px] px-5 pb-10 pt-14 sm:px-8 sm:pt-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <Brand as="div" className="text-ink" />
            <p className="mt-5 max-w-[19rem] text-sm leading-6 text-ink/60">
              Vault custody and object insurance for precious minerals. Stored
              under dual control, appraised at the desk, and covered on a named
              policy from deposit to signature.
            </p>

            <div className="mt-6 flex flex-col items-start gap-2.5">
              <Link
                to="/#review"
                className="group inline-flex items-center gap-2 text-sm font-medium text-ink/80 transition-colors hover:text-primary"
              >
                Request a vault review
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/support/contact"
                className="group inline-flex items-center gap-2 text-sm font-medium text-ink/80 transition-colors hover:text-primary"
              >
                Contact the vault desk
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            <p className="mt-6 flex items-start gap-2 text-[0.68rem] leading-5 text-ink/50">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-ink/45" />
              Custody is subject to the deposit agreement; cover is subject to
              the appraisal, the policy schedule and the wording in force.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 sm:gap-x-6 lg:col-span-8 lg:grid-cols-4">
            {FOOTER_COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-ink/45">
                  {column.title}
                </p>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        to={link.href}
                        className="link-slide text-[0.8rem] leading-5 text-ink/65 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-5 border-t border-line pt-7 text-[0.7rem] text-ink/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Cosmic Vault</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link to="/legal/terms" className="link-slide transition-colors hover:text-primary">
              Terms
            </Link>
            <Link to="/legal/privacy" className="link-slide transition-colors hover:text-primary">
              Privacy
            </Link>
            <Link
              to="/legal/regulatory"
              className="link-slide transition-colors hover:text-primary"
            >
              Regulatory information
            </Link>
            <button
              type="button"
              onClick={requestCookieSettings}
              className="link-slide transition-colors hover:text-primary"
            >
              Cookie settings
            </button>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="group inline-flex items-center gap-1.5 rounded-[4px] border border-line bg-card px-3 py-1.5 text-ink/60 transition-colors hover:border-ink/25 hover:text-ink"
            >
              Back to top
              <ArrowUp className="size-3 transition-transform group-hover:-translate-y-0.5" />
            </button>
          </div>
        </div>

        <p className="mt-6 max-w-3xl text-[0.62rem] leading-5 text-ink/50">
          Cosmic Vault is a demonstration custody and insurance platform built as
          a product concept. Company registration details, registered office,
          regulatory authorisation, and approved contact details are not
          published here because they have not been verified. See{" "}
          <Link
            to="/legal/regulatory"
            className="underline decoration-ink/25 underline-offset-2 transition-colors hover:text-ink"
          >
            regulatory and company information
          </Link>{" "}
          for the current status.
        </p>
      </div>

      <div className="mx-auto max-w-[1180px] px-5 pb-10 sm:px-8">
        <div className="flex items-center justify-between gap-4 border-t border-line pt-7">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-ink/45">
            Inside the vault
          </p>
          <Link
            to="/#store"
            className="group inline-flex items-center gap-1.5 text-[0.72rem] font-medium text-ink/60 transition-colors hover:text-primary"
          >
            <span className="link-slide">What we store</span>
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {CLASSES.map((item) => (
            <Link
              key={item.label}
              to={item.href}
              className="group relative aspect-[4/3] overflow-hidden rounded-[4px] border border-line transition-transform duration-500 hover:-translate-y-1"
            >
              <Media image={item.image} overlay="strong" className="size-full" />
              <span className="absolute inset-x-2 bottom-1.5 block truncate text-[0.58rem] font-medium leading-4 tracking-[0.02em] text-bone">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden border-t border-line">
        <p
          aria-hidden="true"
          className="mx-auto max-w-[1180px] translate-y-[16%] select-none whitespace-nowrap px-5 text-[clamp(2.1rem,12vw,10rem)] font-semibold leading-[0.8] tracking-[-0.06em] text-ink/[0.06] sm:px-8"
        >
          COSMIC VAULT
        </p>
      </div>
    </footer>
  );
}
