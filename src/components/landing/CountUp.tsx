import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { useEffect, useMemo, useRef } from "react";

export function CountUp({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  delay = 0,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduceMotion = useReducedMotion();

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat("en-GB", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
    [decimals],
  );

  const count = useMotionValue(reduceMotion ? value : 0);
  const display = useTransform(count, (latest) => formatter.format(latest));
  const finalLabel = `${prefix}${formatter.format(value)}${suffix}`;

  useEffect(() => {
    if (!inView) return;

    if (reduceMotion) {
      count.set(value);
      return;
    }

    const controls = animate(count, value, {
      duration: 1.7,
      delay,
      ease: [0.16, 1, 0.3, 1],
    });

    return () => controls.stop();
  }, [count, delay, inView, reduceMotion, value]);

  return (
    <span ref={ref} className={className} aria-label={finalLabel}>
      <span aria-hidden="true">
        {prefix}
        <motion.span>{display}</motion.span>
        {suffix}
      </span>
    </span>
  );
}
