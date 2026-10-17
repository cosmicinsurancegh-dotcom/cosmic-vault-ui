import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "insurance-daily-maintenance",
  { hourUTC: 6, minuteUTC: 0 },
  internal.maintenance.daily,
);

export default crons;
