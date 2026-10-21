import { cn } from "@/lib/utils";
import { Link } from "react-router";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn("size-9 shrink-0", className)}
      fill="none"
    >
      <defs>
        <linearGradient
          id="cosmic-mark-blue"
          x1="10"
          y1="8"
          x2="54"
          y2="58"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#4CB6FF" />
          <stop offset="0.45" stopColor="#1D74F5" />
          <stop offset="1" stopColor="#0A3BCB" />
        </linearGradient>
        <linearGradient
          id="cosmic-mark-orbit"
          x1="4"
          y1="42"
          x2="60"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FF7A00" />
          <stop offset="0.55" stopColor="#FFA11A" />
          <stop offset="1" stopColor="#FFC400" />
        </linearGradient>
      </defs>

      {/* Orbit passing behind the planet */}
      <g transform="rotate(-14 32 32)">
        <path
          d="M2 32A30 8.5 0 0 1 62 32"
          stroke="url(#cosmic-mark-orbit)"
          strokeWidth="4.6"
          strokeLinecap="round"
        />
      </g>

      {/* Blue C */}
      <path
        d="M47.6 46.05A21 21 0 1 1 51.2 23.5"
        stroke="url(#cosmic-mark-blue)"
        strokeWidth="13"
        strokeLinecap="round"
      />

      {/* Orbit passing in front of the planet */}
      <g transform="rotate(-14 32 32)">
        <path
          d="M62 32A30 8.5 0 0 1 2 32"
          stroke="url(#cosmic-mark-orbit)"
          strokeWidth="4.6"
          strokeLinecap="round"
        />
      </g>
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
      <BrandMark className={cn(compact ? "size-9" : "size-11")} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-extrabold tracking-[-0.015em] text-current",
            compact ? "text-[1.05rem]" : "text-[1.3rem]",
          )}
        >
          COSMIC
        </span>          <span
            className={cn(
              "mt-[0.3em] font-semibold uppercase text-current opacity-75",
              compact
                ? "text-[0.42rem] tracking-[0.28em]"
                : "text-[0.5rem] tracking-[0.32em]",
            )}
          >
          Mineral Vault
        </span>
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
