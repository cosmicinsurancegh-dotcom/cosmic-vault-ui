const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function reference(prefix: string) {
  let suffix = "";
  for (let index = 0; index < 5; index += 1) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-4)}${suffix}`;
}

export const DAY = 24 * 60 * 60 * 1000;

export function addMonths(from: number, months: number) {
  const date = new Date(from);
  const target = new Date(date);
  target.setMonth(target.getMonth() + months);
  return target.getTime();
}

export function startOfToday() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function startOfMonth(offsetMonths = 0) {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1);
}

export function parseDateInput(value: string, field: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`${field} must be a valid date.`);
  }
  return parsed;
}

export function cleanText(value: string | undefined, field: string, max = 4000) {
  const trimmed = (value ?? "").trim();
  if (trimmed.length > max) {
    throw new Error(`${field} is too long (max ${max.toLocaleString()} characters).`);
  }
  return trimmed;
}

export function requiredText(value: string | undefined, field: string, max = 4000) {
  const trimmed = cleanText(value, field, max);
  if (!trimmed) throw new Error(`${field} is required.`);
  return trimmed;
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function money(amount: number, field: string) {
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 0) {
    throw new Error(`${field} must be a positive amount in minor currency units.`);
  }
  return amount;
}

export function maxDate() {
  return Date.UTC(2100, 0, 1);
}

export function clampPage(page: number | undefined, pageSize: number) {
  const safePage = Math.max(1, Math.min(1000, Math.floor(page ?? 1)));
  const safeSize = Math.max(5, Math.min(100, Math.floor(pageSize)));
  return { page: safePage, pageSize: safeSize, offset: (safePage - 1) * safeSize };
}
