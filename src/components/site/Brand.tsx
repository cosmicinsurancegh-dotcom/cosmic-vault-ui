import { cn } from "@/lib/utils";
import { Link } from "react-router";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={cn("size-9 shrink-0", className)}
      fill="none"
    >
      <circle
        cx="20"
        cy="20"
        r="10.5"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity="0.9"
      />
      <ellipse
        cx="20"
        cy="20"
        rx="17"
        ry="6"
        stroke="var(--electric)"
        strokeWidth="1.6"
        transform="rotate(-28 20 20)"
      />
      <circle cx="20" cy="20" r="3.9" fill="var(--electric)" />
      <circle cx="20" cy="20" r="1.35" fill="currentColor" />
      <circle cx="34" cy="12.2" r="1.7" fill="currentColor" />
    </svg>
  );
}

export function Brand({
  className,
  compact = false,
  as = "a",
  href = "/",
}: {
  className?: string;
  compact?: boolean;
  as?: "a" | "div";
  href?: string;
}) {
  const content = (
    <>
      <BrandMark className={cn(compact ? "size-8" : "size-9")} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-semibold tracking-[-0.03em] text-current",
            compact ? "text-[1.02rem]" : "text-[1.15rem]",
          )}
        >
          Cosmic Vault
        </span>
        {!compact && (
          <span className="mt-1 text-[0.55rem] font-medium uppercase tracking-[0.34em] opacity-55">
            Insurance
          </span>
        )}
      </span>
    </>
  );

  const classes = cn(
    "inline-flex items-center gap-2.5 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    className,
  );

  if (as === "div") {
    return <div className={classes}>{content}</div>;
  }

  return (
    <Link to={href} className={classes} aria-label="Cosmic Vault home">
      {content}
    </Link>
  );
}
