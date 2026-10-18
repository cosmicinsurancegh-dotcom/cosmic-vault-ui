import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function Reveal({
  children,
  delay = 0,
  y = 26,
  className,
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  /* Any part of the block counts as in view. The old "-80px" margin meant
     content resting in the last 80px of the viewport never triggered, so
     blocks at the foot of a tall panel stayed at opacity 0. */
  const inView = useInView(ref, { once, margin: "0px", amount: "some" });
  const [revealed, setRevealed] = useState(false);
  const shown = revealed || inView;

  /* Safety net: an observer can miss a block while a smooth scroll is being
     redirected (anchor jump interrupted by a wheel scroll), which used to
     leave entire sections invisible. Geometry is the source of truth - if
     the block is on screen, it is shown. */
  useEffect(() => {
    if (shown) return;

    let frame = 0;
    const check = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) setRevealed(true);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [shown]);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y }}
      animate={reduceMotion || shown ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
