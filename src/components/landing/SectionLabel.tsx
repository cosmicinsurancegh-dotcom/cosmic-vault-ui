import { cn } from "@/lib/utils";

export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[0.66rem] font-semibold uppercase tracking-[0.30em]",
        className,
      )}
    >
      {children}
    </p>
  );
}
