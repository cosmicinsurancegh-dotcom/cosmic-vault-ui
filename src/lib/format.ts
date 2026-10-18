export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  additional_info_required: "Information required",
  under_assessment: "Under assessment",
  approved: "Approved",
  partially_approved: "Partially approved",
  declined: "Declined",
  withdrawn: "Withdrawn",
  pending_approval: "Pending approval",
  active: "Active",
  renewal_pending: "Renewal pending",
  expired: "Expired",
  cancelled: "Cancelled",
  suspended: "Suspended",
  pending: "Pending",
  succeeded: "Confirmed",
  failed: "Failed",
  refunded: "Refunded",
  disputed: "Disputed",
  payment_pending: "Payment pending",
  paid: "Paid",
  closed: "Closed",
  quoted: "Quoted",
  accepted: "Accepted",
  in_review: "In review",
  unverified: "Unverified",
  verified: "Verified",
  open: "Open",
  awaiting_customer: "Awaiting customer",
  resolved: "Resolved",
  archived: "Archived",
  published: "Published",
  sent: "Sent",
  skipped: "Not sent",
  queued: "Queued",
  approved_short: "Approved",
  low: "Low",
  normal: "Normal",
  high: "High",
};

export function statusLabel(value?: string) {
  if (!value) return "-";
  return STATUS_LABELS[value] ?? value.replace(/_/g, " ");
}

const TONES: Record<string, string> = {
  active: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  succeeded: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  paid: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  approved: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  verified: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  sent: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  quoted: "border-primary/25 bg-primary/10 text-primary dark:text-electric-soft",
  under_assessment:
    "border-primary/25 bg-primary/10 text-primary dark:text-electric-soft",
  submitted: "border-halo/50 bg-halo/20 text-[#7a5a1c] dark:text-halo",
  under_review: "border-halo/50 bg-halo/20 text-[#7a5a1c] dark:text-halo",
  additional_info_required:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  payment_pending:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  renewal_pending:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  awaiting_customer:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  declined: "border-destructive/30 bg-destructive/10 text-destructive",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
  suspended: "border-destructive/30 bg-destructive/10 text-destructive",
  disputed: "border-destructive/30 bg-destructive/10 text-destructive",
  expired: "border-line bg-muted text-muted-foreground",
  withdrawn: "border-line bg-muted text-muted-foreground",
  closed: "border-line bg-muted text-muted-foreground",
  draft: "border-line bg-muted text-muted-foreground",
  refunded: "border-line bg-muted text-muted-foreground",
};

export function toneForStatus(value?: string) {
  return TONES[value ?? ""] ?? "border-line bg-muted text-muted-foreground";
}

export function formatMoney(
  minorUnits: number | undefined | null,
  currency = "GBP",
  locale = "en-GB",
) {
  if (minorUnits === undefined || minorUnits === null) return "-";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(minorUnits / 100);
  } catch {
    return `${(minorUnits / 100).toFixed(2)} ${currency}`;
  }
}

export function formatMoneyList(
  values: { currency: string; amount: number }[] | undefined,
  empty = "None",
) {
  if (!values || values.length === 0) return empty;
  return values
    .map((value) => formatMoney(value.amount, value.currency))
    .join(" · ");
}

export function formatDate(
  value: number | undefined | null,
  locale = "en-GB",
  timeZone?: string,
) {
  if (value === undefined || value === null) return "-";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone,
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleDateString();
  }
}

export function formatDateTime(
  value: number | undefined | null,
  locale = "en-GB",
  timeZone?: string,
) {
  if (value === undefined || value === null) return "-";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}

export function daysUntil(value: number) {
  return Math.ceil((value - Date.now()) / (24 * 60 * 60 * 1000));
}

export function csvEscape(value: string | number) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv(
  filename: string,
  columns: { key: string; label: string }[],
  rows: Record<string, string | number>[],
) {
  const header = columns.map((column) => csvEscape(column.label)).join(",");
  const body = rows
    .map((row) => columns.map((column) => csvEscape(row[column.key])).join(","))
    .join("\n");
  const blob = new Blob([`${header}\n${body}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadText(filename: string, body: string) {
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function toMinor(value: string, label: string) {
  const numeric = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`Enter a valid ${label.toLowerCase()}.`);
  }
  return Math.round(numeric * 100);
}
