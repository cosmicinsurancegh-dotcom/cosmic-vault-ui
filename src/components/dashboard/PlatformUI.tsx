import { cn } from "@/lib/utils";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  statusLabel,
  toneForStatus,
} from "@/lib/format";
import { Loader2 } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="flex flex-wrap items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.26em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2.5 text-[clamp(1.7rem,3.2vw,2.4rem)] font-semibold leading-none tracking-[-0.045em] text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 self-start">{actions}</div>}
    </header>
  );
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[4px] border border-line bg-card", className)}>
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {description && (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function MetricTile({
  label,
  value,
  helper,
  icon: Icon,
  to,
  onClick,
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  to?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
        {Icon && <Icon className="size-4 shrink-0 text-primary" />}
      </div>
      <p className="mt-4 text-[1.7rem] font-semibold leading-none tracking-[-0.04em] text-ink">
        {value}
      </p>
      {helper && <p className="mt-2 text-[0.7rem] leading-4 text-muted-foreground">{helper}</p>}
    </>
  );
  const className =
    "block rounded-[4px] border border-line bg-card p-5 transition-colors hover:border-primary/30";
  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(className, "text-left")}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}

export function StatusPill({ status }: { status?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-[4px] border px-2.5 py-0.5 text-[0.62rem] font-semibold",
        toneForStatus(status),
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {Icon && (
        <span className="grid size-11 place-items-center rounded-[4px] bg-ice text-primary">
          <Icon className="size-5" />
        </span>
      )}
      <p className="mt-4 text-sm font-semibold text-ink">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}…
    </div>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "success" | "danger";
  title?: ReactNode;
  children: ReactNode;
}) {
  const tones = {
    info: "border-primary/25 bg-primary/[0.04] text-ink",
    warning: "border-amber-500/30 bg-amber-500/[0.07] text-ink",
    success: "border-emerald-500/30 bg-emerald-500/[0.07] text-ink",
    danger: "border-destructive/30 bg-destructive/[0.06] text-ink",
  };
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-xs leading-5", tones[tone])}>
      {title && <p className="text-xs font-semibold">{title}</p>}
      <div className={cn(title && "mt-1", "text-xs leading-5 text-muted-foreground")}>
        {children}
      </div>
    </div>
  );
}

export function Detail({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm leading-6 text-ink">{children}</div>
    </div>
  );
}

export function MoneyByCurrency({
  values,
  empty = "None",
}: {
  values: { currency: string; amount: number }[] | undefined;
  empty?: string;
}) {
  if (!values || values.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="space-y-1">
      {values.map((value) => (
        <p key={value.currency} className="text-sm font-semibold text-ink">
          {formatMoney(value.amount, value.currency)}
        </p>
      ))}
    </div>
  );
}

export function Timeline({
  items,
}: {
  items: {
    title?: string;
    body: string;
    at: number;
    internal?: boolean;
  }[];
}) {
  if (items.length === 0) {
    return <p className="px-5 py-6 text-xs text-muted-foreground">No history yet.</p>;
  }
  return (
    <ol className="space-y-4">
      {items.map((item, index) => (
        <li key={`${item.at}-${index}`} className="relative pl-5">
          <span className="absolute left-0 top-1.5 size-1.5 rounded-[4px] bg-primary" />
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {formatDateTime(item.at)}
            {item.internal && " · internal"}
          </p>
          {item.title && <p className="mt-1 text-sm font-medium text-ink">{item.title}</p>}
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-xs text-muted-foreground">
      <p>
        Page {page} of {pages} · {total} record{total === 1 ? "" : "s"}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-[4px] border border-line px-3 py-1.5 font-medium transition-colors hover:border-primary/40 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="rounded-[4px] border border-line px-3 py-1.5 font-medium transition-colors hover:border-primary/40 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "border-b border-line px-5 py-2.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <td className={cn("border-b border-line/70 px-5 py-3 align-middle text-xs text-ink", className)}>
      {children}
    </td>
  );
}

export function DateCell({ value, timeZone }: { value?: number; timeZone?: string }) {
  return <span className="whitespace-nowrap">{formatDate(value, "en-GB", timeZone)}</span>;
}
