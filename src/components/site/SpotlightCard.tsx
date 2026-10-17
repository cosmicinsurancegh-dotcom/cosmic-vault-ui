import { cn } from "@/lib/utils";
import type { PointerEvent, ReactNode } from "react";
import { Link } from "react-router";

type Props = {
  children: ReactNode;
  className?: string;
  to?: string;
  href?: string;
  /** Extra classes for the pointer-following highlight. */
  spotClassName?: string;
};

/**
 * A card whose border and surface catch a soft light that follows the pointer.
 * Falls back to a plain hover on touch, where there is no pointer to follow.
 */
export function SpotlightCard({ children, className, to, href, spotClassName }: Props) {
  const track = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse") return;
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    target.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    target.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };

  const content = (
    <>
      {children}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-100",
          spotClassName,
        )}
        style={{
          background:
            "radial-gradient(260px circle at var(--spot-x, 50%) var(--spot-y, 0%), rgba(76,125,255,0.16), transparent 72%)",
        }}
      />
    </>
  );

  const shared = {
    className: cn("group relative overflow-hidden", className),
    onPointerMove: track,
  };

  if (to) {
    return (
      <Link to={to} {...shared}>
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} {...shared}>
        {content}
      </a>
    );
  }

  return <div {...shared}>{content}</div>;
}
