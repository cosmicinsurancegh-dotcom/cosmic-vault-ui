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
  preparing: "Preparing",
  in_transit: "In transit",
  customs_hold: "Held at customs",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  delayed: "Delayed",
};

export function statusLabel(value?: string) {
  if (!value) return "-";
  return STATUS_LABELS[value] ?? value.replace(/_/g, " ");
}

/**
 * Status colour as a label tone: the dot inherits it with `bg-current`, so a
 * status reads as a tinted word rather than a chip boxed off from the row.
 */
const STATUS_TONES: Record<string, string> = {
  active: "text-emerald-700 dark:text-emerald-400",
  succeeded: "text-emerald-700 dark:text-emerald-400",
  paid: "text-emerald-700 dark:text-emerald-400",
  approved: "text-emerald-700 dark:text-emerald-400",
  verified: "text-emerald-700 dark:text-emerald-400",
  sent: "text-emerald-700 dark:text-emerald-400",
  delivered: "text-emerald-700 dark:text-emerald-400",
  quoted: "text-primary dark:text-electric-soft",
  under_assessment: "text-primary dark:text-electric-soft",
  in_transit: "text-primary dark:text-electric-soft",
  out_for_delivery: "text-primary dark:text-electric-soft",
  submitted: "text-[#7a5a1c] dark:text-halo",
  under_review: "text-[#7a5a1c] dark:text-halo",
  preparing: "text-[#7a5a1c] dark:text-halo",
  additional_info_required: "text-amber-700 dark:text-amber-400",
  pending: "text-amber-700 dark:text-amber-400",
  payment_pending: "text-amber-700 dark:text-amber-400",
  renewal_pending: "text-amber-700 dark:text-amber-400",
  awaiting_customer: "text-amber-700 dark:text-amber-400",
  customs_hold: "text-amber-700 dark:text-amber-400",
  delayed: "text-amber-700 dark:text-amber-400",
  declined: "text-destructive",
  failed: "text-destructive",
  cancelled: "text-destructive",
  suspended: "text-destructive",
  disputed: "text-destructive",
  expired: "text-muted-foreground",
  withdrawn: "text-muted-foreground",
  closed: "text-muted-foreground",
  draft: "text-muted-foreground",
  refunded: "text-muted-foreground",
};

export function statusTone(value?: string) {
  return STATUS_TONES[value ?? ""] ?? "text-muted-foreground";
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

/** Format a major-unit amount, optionally in compact notation (for axes). */
export function formatMoneyValue(
  value: number,
  currency: string,
  options: { compact?: boolean } = {},
) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      notation: options.compact ? "compact" : "standard",
      maximumFractionDigits: options.compact ? 1 : 0,
    }).format(value);
  } catch {
    return options.compact
      ? `${Math.round(value).toLocaleString("en-GB")}`
      : `${currency} ${Math.round(value).toLocaleString("en-GB")}`;
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
