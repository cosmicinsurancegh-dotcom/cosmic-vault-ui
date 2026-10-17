import { Brand } from "@/components/site/Brand";
import { Media } from "@/components/site/Media";
import { COVERS } from "@/lib/covers";
import { coverImage } from "@/lib/imagery";
import { FOOTER_COLUMNS } from "@/lib/navigation";
import { ArrowRight, ArrowUp, ShieldCheck } from "lucide-react";
import { Link } from "react-router";

export function Footer() {
  return (
    <footer className="mt-20 bg-[#071227] text-bone/80 sm:mt-28">
      <div className="mx-auto max-w-[1180px] px-5 pb-10 pt-14 sm:px-8 sm:pt-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <Brand as="div" className="text-bone" />
            <p className="mt-5 max-w-[19rem] text-sm leading-6 text-bone/55">
              Insurance for the long horizon. Clear wording, careful
              underwriting, and a record you can always return to.
            </p>

            <div className="mt-6 flex flex-col items-start gap-2.5">
              <Link
                to="/quote"
                className="group inline-flex items-center gap-2 text-sm font-medium text-bone/80 transition-colors hover:text-bone"
              >
                Get a quote
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/support/contact"
                className="group inline-flex items-center gap-2 text-sm font-medium text-bone/80 transition-colors hover:text-bone"
              >
                Contact support
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            <p className="mt-6 flex items-start gap-2 text-[0.68rem] leading-5 text-bone/55">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              Final cover is always subject to eligibility, the policy schedule,
              and the policy wording in force at the time.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 sm:gap-x-6 lg:col-span-8 lg:grid-cols-4">
            {FOOTER_COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-bone/55">
                  {column.title}
                </p>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        to={link.href}
                        className="link-slide text-[0.8rem] leading-5 text-bone/60 transition-colors hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-soft/60"
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

        <div className="mt-12 flex flex-col gap-5 border-t border-white/10 pt-7 text-[0.7rem] text-bone/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Cosmic Vault</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link to="/legal/terms"              className="link-slide transition-colors hover:text-bone"
            >
              Terms
            </Link>
            <Link to="/legal/privacy"              className="link-slide transition-colors hover:text-bone"
            >
              Privacy
            </Link>
            <Link
              to="/legal/regulatory"
              className="link-slide transition-colors hover:text-bone"
            >
              Regulatory information
            </Link>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="group inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 text-bone/60 transition-colors hover:text-bone"
            >
              Back to top
              <ArrowUp className="size-3 transition-transform group-hover:-translate-y-0.5" />
            </button>
          </div>
        </div>

        <p className="mt-6 max-w-3xl text-[0.62rem] leading-5 text-bone/55">
          Cosmic Vault is a demonstration insurance platform built as a product
          concept. Company registration details, registered office, regulatory
          authorisation, and approved contact details are not published here
          because they have not been verified. See{" "}
          <Link
            to="/legal/regulatory"
            className="underline decoration-white/20 underline-offset-2 transition-colors hover:text-bone/70"
          >
            regulatory and company information
          </Link>{" "}
          for the current status.
        </p>
      </div>

      <div className="mx-auto max-w-[1180px] px-5 pb-10 sm:px-8">
        <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-7">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-bone/45">
            The cover lines
          </p>
          <Link
            to="/cover"
            className="group inline-flex items-center gap-1.5 text-[0.72rem] font-medium text-bone/60 transition-colors hover:text-bone"
          >
            <span className="link-slide">All six</span>
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {COVERS.map((cover) => (
            <Link
              key={cover.slug}
              to={`/cover/${cover.slug}`}
              className="group relative aspect-[4/3] overflow-hidden rounded-[0.85rem] border border-white/10 transition-transform duration-500 hover:-translate-y-1"
            >
              <Media image={coverImage(cover.slug)} overlay="strong" className="size-full" />
              <span className="absolute inset-x-2 bottom-1.5 block truncate text-[0.58rem] font-medium leading-4 tracking-[0.02em] text-bone">
                {cover.name.replace(" insurance", "")}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden border-t border-white/[0.06]">
        <p
          aria-hidden="true"
          className="mx-auto max-w-[1180px] translate-y-[16%] select-none whitespace-nowrap px-5 text-[clamp(2.1rem,12vw,10rem)] font-semibold leading-[0.8] tracking-[-0.06em] text-white/[0.05] sm:px-8"
        >
          COSMIC VAULT
        </p>
      </div>
    </footer>
  );
}
