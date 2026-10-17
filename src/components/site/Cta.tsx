import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ink" | "light" | "outline";

const shell: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/60",
  ink: "bg-foreground text-background hover:bg-foreground/90 border border-foreground/80",
  light: "bg-card text-ink hover:bg-accent border border-line",
  outline:
    "bg-transparent text-ink border border-ink/20 hover:border-ink/45 hover:bg-ink/[0.03]",
};

const chip: Record<Variant, string> = {
  primary: "bg-primary-foreground text-primary",
  ink: "bg-background/15 text-background",
  light: "bg-foreground text-background",
  outline: "bg-foreground text-background",
};

function Content({
  children,
  variant,
  icon,
}: {
  children: ReactNode;
  variant: Variant;
  icon: boolean;
}) {
  return (
    <>
      <span className="pl-1">{children}</span>
      {icon && (
        <span
          className={cn(
            "grid size-8 place-items-center rounded-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-45",
            chip[variant],
          )}
        >
          <ArrowUpRight className="size-4" strokeWidth={2} />
        </span>
      )}
    </>
  );
}

const base =
  "group inline-flex items-center gap-3 rounded-full py-1.5 pl-5 pr-1.5 text-[0.92rem] font-medium tracking-[-0.01em] transition-all duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60";

export function CtaButton({
  children,
  onClick,
  variant = "primary",
  icon = true,
  className,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  icon?: boolean;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(base, shell[variant], className)}
    >
      <Content variant={variant} icon={icon}>
        {children}
      </Content>
    </button>
  );
}

export function CtaLink({
  children,
  href,
  to,
  variant = "primary",
  icon = true,
  className,
}: {
  children: ReactNode;
  /** External or same-page anchor target. */
  href?: string;
  /** Internal route target, rendered as a client-side link. */
  to?: string;
  variant?: Variant;
  icon?: boolean;
  className?: string;
}) {
  const classes = cn(base, shell[variant], className);
  const content = (
    <Content variant={variant} icon={icon}>
      {children}
    </Content>
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <a href={href ?? "#"} className={classes}>
      {content}
    </a>
  );
}
