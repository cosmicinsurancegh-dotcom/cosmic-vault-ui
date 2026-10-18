import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

/**
 * Read-only load profile for the Cosmic Vault API (Convex).
 *
 * `AUTH_TOKEN` is optional; without it the script exercises the only
 * unauthenticated query the marketing site can call and logs a warning. With a
 * member token it round-robins the dashboard queries a signed-in session opens,
 * which is the workload the capacity target is about.
 *
 * Run against staging. Never point this at production without an agreed window,
 * monitoring and stop conditions (see loadtest/README.md).
 */

const BASE = (__ENV.CONVEX_URL ?? "").replace(/\/+$/, "");
if (!BASE) {
  throw new Error(
    "CONVEX_URL is required, for example https://<deployment>.convex.cloud",
  );
}

const TOKEN = __ENV.AUTH_TOKEN ?? "";
const PROFILE = __ENV.PROFILE ?? "baseline";

const PROFILES = {
  // Establish normal behaviour.
  baseline: [
    { duration: "30s", target: 5 },
    { duration: "4m", target: 10 },
    { duration: "30s", target: 0 },
  ],
  // Common bottlenecks at expected traffic.
  expected: [
    { duration: "1m", target: 10 },
    { duration: "2m", target: 25 },
    { duration: "10m", target: 50 },
    { duration: "1m", target: 0 },
  ],
  // The agreed peak target: 100 virtual users for 10-15 minutes.
  peak: [
    { duration: "1m", target: 10 },
    { duration: "2m", target: 50 },
    { duration: "10m", target: 100 },
    { duration: "1m", target: 0 },
  ],
  // Controlled burst: 10 -> 100 -> 10 in about a minute.
  spike: [
    { duration: "10s", target: 10 },
    { duration: "20s", target: 100 },
    { duration: "30s", target: 100 },
    { duration: "20s", target: 10 },
  ],
  // Return to low load and prove the service settles.
  recovery: [
    { duration: "15s", target: 100 },
    { duration: "1m", target: 5 },
    { duration: "4m", target: 5 },
    { duration: "15s", target: 0 },
  ],
};

if (!PROFILES[PROFILE]) {
  throw new Error(
    `Unknown PROFILE "${PROFILE}". Use ${Object.keys(PROFILES).join(", ")}.`,
  );
}

const functionErrors = new Rate("function_errors");

export const options = {
  scenarios: {
    reads: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: PROFILES[PROFILE],
      gracefulRampDown: "15s",
    },
  },
  thresholds: {
    // Acceptance targets from the brief; failed thresholds fail the run.
    http_req_failed: ["rate<0.01"],
    function_errors: ["rate<0.01"],
    http_req_duration: ["p(95)<500", "p(99)<1500"],
    checks: ["rate>0.99"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};

const PUBLIC_QUERIES = ["quotes:myQuotes"];

/** Queries a signed-in member dashboard subscribes to. No arguments. */
const MEMBER_QUERIES = [
  "customers:me",
  "setup:referenceData",
  "policies:mine",
  "applications:mine",
  "claims:mine",
  "payments:mine",
  "documents:mine",
  "notifications:unreadCount",
  "tickets:mine",
];

const headers = {
  "Content-Type": "application/json",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

function callQuery(path) {
  const response = http.post(
    `${BASE}/api/query`,
    JSON.stringify({ path, args: {}, format: "json" }),
    { headers, tags: { endpoint: path } },
  );

  let body = null;
  try {
    body = response.json();
  } catch {
    body = null;
  }

  const ok =
    response.status === 200 && body !== null && body.status === "success";

  functionErrors.add(!ok);
  check(response, {
    [`${path} answered`]: () => ok,
  });

  return ok;
}

export default function () {
  // A signed-out visitor cannot read member data; without a token the mix is
  // only the public query, which the summary makes obvious.
  const paths = TOKEN ? MEMBER_QUERIES : PUBLIC_QUERIES;
  const path = paths[Math.floor(Math.random() * paths.length)];
  callQuery(path);

  if (!TOKEN && __VU === 1 && __ITER === 0) {
    console.warn(
      "AUTH_TOKEN is not set - this run only measures the public query path.",
    );
  }

  // Realistic pacing: a person reads a page, then opens another.
  sleep(0.8 + Math.random() * 1.2);
}
