/** One day in milliseconds, for offsets that read as a duration. */
export const DAY = 86_400_000;

/**
 * A day `days` from today, at midnight UTC.
 *
 * The suites use this instead of a literal future date: a literal turns a green
 * test red once it passes, which is how the shipment-request case broke when
 * 2026-11-03 made its 2026-11-02 preferred date "the past".
 */
export function daysFromToday(days: number) {
  const now = new Date();
  return Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + days,
  );
}

/** The same day written the way a date input and the mutations accept it. */
export function isoDate(at: number) {
  return new Date(at).toISOString().slice(0, 10);
}
