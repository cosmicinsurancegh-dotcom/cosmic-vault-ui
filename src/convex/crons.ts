import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Expires lapsed policies, sends renewal and overdue-payment notices, and
// prunes rate-limit rows older than a week. Every step is idempotent through
// dedupe keys, so a retried run cannot notify twice.
crons.daily(
  "insurance-daily-maintenance",
  { hourUTC: 6, minuteUTC: 0 },
  internal.maintenance.daily,
);

export default crons;
