import { cn } from "@/lib/utils";

export function SectionLabel({
  index,
  children,
  className,
}: {
  index: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-3 text-[0.66rem] font-semibold uppercase tracking-[0.30em]",
        className,
      )}
    >
      <span className="opacity-60">{index}</span>
      <span className="h-px w-7 bg-current opacity-30" />
      <span>{children}</span>
    </p>
  );
}
