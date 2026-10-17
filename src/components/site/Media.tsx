import type { VaultImage } from "@/lib/imagery";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ImageOff } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

type Overlay = "none" | "soft" | "strong" | "floor" | "cosmic";

const overlays: Record<Overlay, string> = {
  none: "",
  soft: "bg-gradient-to-t from-[#04101f]/55 via-transparent to-transparent",
  strong: "bg-gradient-to-t from-[#04101f]/88 via-[#04101f]/25 to-transparent",
  floor: "bg-gradient-to-t from-[#071227]/92 via-[#071227]/20 to-transparent",
  cosmic:
    "bg-[radial-gradient(circle_at_78%_12%,rgba(76,125,255,0.24),transparent_52%),linear-gradient(to_top,rgba(4,16,31,0.72),rgba(4,16,31,0.05))]",
};

/**
 * A photograph with the site's shared behaviour: a soft parallax drift, a slow
 * zoom when a parent `.group` is hovered or focused, and a gradient scrim.
 * Decorative alt text is honoured, so pass `alt: ""` for atmosphere images.
 */
export function Media({
  image,
  className,
  imgClassName,
  overlay = "none",
  parallax = 0,
  eager = false,
  children,
}: {
  image: VaultImage;
  className?: string;
  imgClassName?: string;
  overlay?: Overlay;
  /** Vertical drift in pixels across the viewport. 0 disables parallax. */
  parallax?: number;
  eager?: boolean;
  children?: ReactNode;
}) {
  const figureRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { scrollYProgress } = useScroll({
    target: figureRef,
    offset: ["start end", "end start"],
  });
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    parallax ? [`-${parallax}px`, `${parallax}px`] : ["0px", "0px"],
  );

  return (
    <div
      ref={figureRef}
      className={cn("relative overflow-hidden", className)}
      style={{ backgroundColor: image.tone ?? "#0b1526" }}
    >
      <motion.div
        style={reduceMotion || !parallax ? undefined : { y }}
        className={cn(
          "absolute inset-0",
          parallax > 0 && !reduceMotion && "-inset-y-[9%]",
        )}
      >
        {failed ? (
          <div className="starfield grid size-full place-items-center bg-[#071227] text-bone/40">
            <ImageOff className="size-6" aria-hidden="true" />
          </div>
        ) : (
          <img
            src={image.src}
            alt={image.alt}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={eager ? "high" : "auto"}
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            style={{ objectPosition: image.position ?? "50% 50%" }}
            className={cn(
              "size-full object-cover transition-[opacity,transform] duration-[1.4s] ease-[cubic-bezier(0.22,1,0.36,1)]",
              "group-hover:scale-[1.055] group-focus-visible:scale-[1.055]",
              loaded ? "opacity-100" : "opacity-0",
              imgClassName,
            )}
          />
        )}
      </motion.div>

      {overlay !== "none" && (
        <span aria-hidden="true" className={cn("absolute inset-0", overlays[overlay])} />
      )}
      {/* A faint inner rim keeps photographs sitting on the page, not on top of it. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10"
      />

      {children}
    </div>
  );
}
