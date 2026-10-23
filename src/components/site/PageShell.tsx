import { Media } from "@/components/site/Media";
import { Reveal } from "@/components/site/Reveal";
import type { VaultImage } from "@/lib/imagery";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Info,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type ActionVariant = "primary" | "outline" | "light";

const actionStyles: Record<ActionVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/60",
  outline:
    "bg-transparent text-ink border border-ink/20 hover:border-ink/40 hover:bg-ink/[0.03]",
  light: "bg-card text-ink border border-line hover:bg-accent",
};

const actionChip: Record<ActionVariant, string> = {
  primary: "bg-primary-foreground/20 text-primary-foreground",
  outline: "bg-primary text-primary-foreground",
  light: "bg-primary text-primary-foreground",
};

export function SiteButton({
  children,
  to,
  href,
  onClick,
  variant = "primary",
  className,
  icon = true,
}: {
  children: ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  variant?: ActionVariant;
  className?: string;
  icon?: boolean;
}) {
  const classes = cn(
    "group inline-flex h-11 items-center justify-between gap-3 rounded-[4px] pl-5 pr-2 text-[0.88rem] font-medium tracking-[-0.01em] transition-all duration-300 active:scale-[0.975] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    actionStyles[variant],
    className,
  );

  const content = (
    <>
      <span>{children}</span>
      {icon && (
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-[4px] transition-transform duration-500 group-hover:rotate-45",
            actionChip[variant],
          )}
        >
          <ArrowUpRight className="size-3.5" strokeWidth={2.2} />
        </span>
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={classes}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Page header                                                         */
/* ------------------------------------------------------------------ */

export function PageHero({
  eyebrow,
  title,
  intro,
  actions,
  aside,
  media,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  intro: string;
  actions?: ReactNode;
  aside?: { title: string; body: string; items?: { label: string; href: string }[] };
  /** A wide photograph under the heading, with an optional caption. */
  media?: { image: VaultImage; caption?: string };
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-line/70">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-48 size-[32rem] rounded-[4px] bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.16),transparent_66%)] blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-1/2 size-[22rem] rounded-[4px] bg-[radial-gradient(circle_at_center,rgba(10,18,36,0.05),transparent_70%)] blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-6%] top-16 hidden size-[22rem] rounded-[4px] border border-electric/10 lg:block"
      >
        <span className="absolute inset-12 rounded-[4px] border border-ink/[0.05]" />
        <span className="absolute left-1/2 top-0 size-1.5 -translate-x-1/2 rounded-[4px] bg-electric/60" />
      </div>

      <div className="relative mx-auto max-w-[1240px] px-5 pb-12 pt-10 sm:pb-16 sm:pt-14">
        <Reveal y={12}>
          <p className="flex items-center gap-3 text-[0.64rem] font-semibold uppercase tracking-[0.28em] text-ink/60">
            <span className="h-px w-7 bg-electric/60" />
            {eyebrow}
          </p>
        </Reveal>

        <div
          className={cn(
            "mt-5 gap-10",
            aside
              ? "grid lg:grid-cols-[1.35fr_0.65fr] lg:items-end"
              : "max-w-3xl",
          )}
        >
          <div>
            <Reveal y={18}>
              <h1 className="text-balance text-[clamp(2.35rem,5vw,4rem)] font-semibold leading-[0.98] tracking-[-0.045em] text-ink">
                {title}
              </h1>
            </Reveal>
            <Reveal y={18} delay={0.08}>
              <p className="mt-6 max-w-xl text-[0.98rem] leading-7 text-muted-foreground">
                {intro}
              </p>
            </Reveal>
            {actions && (
              <Reveal y={16} delay={0.14}>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  {actions}
                </div>
              </Reveal>
            )}
          </div>

          {aside && (
            <Reveal y={20} delay={0.12}>
              <aside className="rounded-[4px] border border-line bg-card/80 p-5 backdrop-blur">
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-ink/55">
                  {aside.title}
                </p>
                <p className="mt-3 text-[0.83rem] leading-6 text-muted-foreground">
                  {aside.body}
                </p>
                {aside.items && aside.items.length > 0 && (
                  <ul className="mt-4 space-y-2 border-t border-line pt-4">
                    {aside.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          to={item.href}
                          className="group flex items-center justify-between gap-3 text-[0.8rem] font-medium text-ink transition-colors hover:text-primary"
                        >
                          {item.label}
                          <ArrowUpRight className="size-3.5 text-ink/35 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </aside>
            </Reveal>
          )}
        </div>

        {children}

        {media && (
          <Reveal y={24} delay={0.18}>
            <figure className="group media-frame relative mt-10 overflow-hidden rounded-[4px] border border-ink/10 sm:mt-12">
              <Media
                image={media.image}
                eager
                parallax={18}
                overlay="strong"
                className="aspect-[4/3] w-full sm:aspect-[16/7]"
              />
              {media.caption && (
                <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 sm:p-5">
                  <span className="flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-bone/80">
                    <span className="h-px w-6 bg-electric-soft" />
                    {media.caption}
                  </span>
                  <span className="hidden text-[0.6rem] uppercase tracking-[0.2em] text-bone/45 sm:block">
                    Cosmic Vault
                  </span>
                </figcaption>
              )}
            </figure>
          </Reveal>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                           */
/* ------------------------------------------------------------------ */

export function PageSection({
  eyebrow,
  title,
  intro,
  children,
  tone = "default",
  className,
  id,
}: {
  eyebrow?: string;
  title?: ReactNode;
  intro?: string;
  children?: ReactNode;
  tone?: "default" | "ice";
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "py-14 sm:py-20",
        tone === "ice" && "bg-ice",
        className,
      )}
    >
      <div className="relative mx-auto max-w-[1240px] px-5">
        {(eyebrow || title || intro) && (
          <div className="grid gap-5 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              {eyebrow && (
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-ink/60">
                  {eyebrow}
                </p>
              )}
              {title && (
                <h2 className="mt-4 text-balance text-[clamp(1.9rem,3.7vw,2.9rem)] font-semibold leading-[1.04] tracking-[-0.04em] text-ink">
                  {title}
                </h2>
              )}
            </div>
            {intro && (
              <p className="max-w-md text-[0.9rem] leading-7 text-muted-foreground lg:col-span-5 lg:pb-1">
                {intro}
              </p>
            )}
          </div>
        )}
        {children && <div className={cn((eyebrow || title || intro) && "mt-10 sm:mt-12")}>{children}</div>}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Content patterns                                                    */
/* ------------------------------------------------------------------ */

export function FeatureGrid({
  items,
  columns = 3,
}: {
  items: { title: string; body: string; icon?: LucideIcon }[];
  columns?: 2 | 3;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:gap-5",
        columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2",
      )}
    >
      {items.map(({ title, body, icon: Icon }) => (
        <div
          key={title}
          className="group rounded-[4px] border border-line bg-card p-6 transition-[transform,border-color,box-shadow] duration-500 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_24px_50px_-44px_rgba(8,18,39,0.5)]"
        >
          {Icon && (
            <span className="grid size-10 place-items-center rounded-[4px] bg-ice text-primary transition-colors duration-500 group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="size-4 transition-transform duration-500 group-hover:scale-110" strokeWidth={1.8} />
            </span>
          )}
          <h3 className="mt-5 text-[1.02rem] font-semibold tracking-[-0.02em] text-ink">
            {title}
          </h3>
          <p className="mt-2 text-[0.85rem] leading-6 text-muted-foreground">
            {body}
          </p>
        </div>
      ))}
    </div>
  );
}

export function StepList({
  steps,
}: {
  steps: { title: string; body: string }[];
}) {
  return (
    <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {steps.map((step, index) => (
        <li key={step.title} className="border-t border-line pt-5">
          <span className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-electric">
            Step {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="mt-3 text-[1.05rem] font-semibold tracking-[-0.02em] text-ink">
            {step.title}
          </h3>
          <p className="mt-2 text-[0.85rem] leading-6 text-muted-foreground">
            {step.body}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-[4px] bg-primary/10 text-primary">
            <Check className="size-3" strokeWidth={3} />
          </span>
          <span className="text-[0.88rem] leading-6 text-ink/75">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Callout({
  title,
  children,
  tone = "note",
}: {
  title?: string;
  children: ReactNode;
  tone?: "note" | "warning";
}) {
  const warning = tone === "warning";
  return (
    <div
      className={cn(
        "flex gap-3 rounded-[4px] border px-4 py-3.5",
        warning
          ? "border-ink/15 bg-muted"
          : "border-line bg-card",
      )}
    >
      {warning ? (
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-ink/55" />
      ) : (
        <Info className="mt-0.5 size-4 shrink-0 text-electric" />
      )}
      <div>
        {title && (
          <p className="text-[0.8rem] font-semibold text-ink">{title}</p>
        )}
        <div className="text-[0.78rem] leading-6 text-muted-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}

export type FaqEntry = { question: string; answer: string };

export function FaqList({ items }: { items: FaqEntry[] }) {
  return (
    <div className="border-b border-line">
      {items.map((item) => (
        <details key={item.question} className="group border-t border-line py-5">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-[0.98rem] font-medium tracking-[-0.01em] text-ink marker:hidden [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[4px] border border-line text-ink/50 transition-transform duration-300 group-open:rotate-180">
              <ChevronDown className="size-3.5" />
            </span>
          </summary>
          <p className="mt-3 max-w-3xl whitespace-pre-line text-[0.85rem] leading-6 text-muted-foreground">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}

export function CtaPanel({
  eyebrow,
  title,
  body,
  primary,
  secondary,
}: {
  eyebrow: string;
  title: ReactNode;
  body: string;
  primary: { label: string; to: string };
  secondary?: { label: string; to: string };
}) {
  return (
    <div className="mx-auto max-w-[1240px] px-5 pb-4">
      <div className="relative overflow-hidden rounded-[4px] border border-line bg-card px-6 py-12 text-ink shadow-[0_30px_70px_-52px_rgba(10,18,36,0.4)] sm:px-10 sm:py-14">
        <div
          aria-hidden="true"
          className="vault-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_85%_0%,black,transparent_72%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-[24rem] rounded-[4px] bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.10),transparent_65%)]"
        />
        <div className="relative grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-ink/45">
              {eyebrow}
            </p>
            <h2 className="mt-4 max-w-lg text-balance text-[clamp(1.9rem,3.6vw,2.8rem)] font-semibold leading-[1.04] tracking-[-0.04em] text-ink">
              {title}
            </h2>
            <p className="mt-4 max-w-md text-[0.88rem] leading-6 text-ink/60">
              {body}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
            <SiteButton to={primary.to} className="w-full sm:w-auto">
              {primary.label}
            </SiteButton>
            {secondary && (
              <Link
                to={secondary.to}
                className="group inline-flex items-center justify-center gap-2 rounded-[4px] border border-ink/15 px-5 py-2.5 text-[0.82rem] font-medium text-ink/75 transition-colors hover:border-ink/35 hover:text-ink"
              >
                {secondary.label}
                <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RelatedLinks({
  title = "Keep reading",
  links,
}: {
  title?: string;
  links: { label: string; href: string; description?: string }[];
}) {
  return (
    <div className="mx-auto max-w-[1240px] px-5 py-12 sm:py-16">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-ink/60">
        {title}
      </p>
      <div className="mt-6 grid gap-px overflow-hidden rounded-[4px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <Link
            key={link.href}
            to={link.href}
            className="group flex items-start justify-between gap-4 bg-background px-5 py-4 transition-colors hover:bg-ice"
          >
            <span>
              <span className="block text-[0.88rem] font-medium text-ink">
                {link.label}
              </span>
              {link.description && (
                <span className="mt-1 block text-[0.75rem] leading-5 text-muted-foreground">
                  {link.description}
                </span>
              )}
            </span>
            <ArrowUpRight className="mt-1 size-3.5 shrink-0 text-ink/30 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function LegalReviewNote({ children }: { children?: ReactNode }) {
  return (
    <Callout tone="warning" title="Draft - requires legal approval">
      {children ??
        "This document is a working draft prepared for the Cosmic Vault product. It has not been reviewed or approved by a qualified legal adviser and must not be relied on as a legally binding policy."}
    </Callout>
  );
}
