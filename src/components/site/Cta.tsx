import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ink" | "light" | "outline";

const shell: Record<Variant, string> = {
  primary:
    "bg-electric text-white hover:bg-[#235fe8] border border-electric/60",
  ink: "bg-ink text-bone hover:bg-[#12203c] border border-ink",
  light: "bg-card text-ink hover:bg-white border border-line",
  outline:
    "bg-transparent text-ink border border-ink/20 hover:border-ink/45 hover:bg-ink/[0.03]",
};

const chip: Record<Variant, string> = {
  primary: "bg-white text-ink",
  ink: "bg-white/12 text-bone",
  light: "bg-ink text-bone",
  outline: "bg-ink text-bone",
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
  variant = "primary",
  icon = true,
  className,
}: {
  children: ReactNode;
  href: string;
  variant?: Variant;
  icon?: boolean;
  className?: string;
}) {
  return (
    <a href={href} className={cn(base, shell[variant], className)}>
      <Content variant={variant} icon={icon}>
        {children}
      </Content>
    </a>
  );
}
