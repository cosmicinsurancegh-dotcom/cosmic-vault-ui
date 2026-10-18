import http from "k6/http";
import { check, fail } from "k6";

/**
 * Abuse check for the public lead form (`quotes:requestQuote`).
 *
 * It uses a unique address per run and asserts the server accepts at most
 * three requests per email per ten-minute window, keeps rejecting the rest
 * instead of erroring at the transport layer, and leaves a different address
 * unaffected. It writes up to three throwaway leads, so run it against staging.
 *
 * Env: CONVEX_URL (required).
 */

const BASE = (__ENV.CONVEX_URL ?? "").replace(/\/+$/, "");
if (!BASE) {
  throw new Error(
    "CONVEX_URL is required, for example https://<deployment>.convex.cloud",
  );
}

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ["rate==1"],
  },
};

function requestQuote(email, label) {
  const response = http.post(
    `${BASE}/api/mutation`,
    JSON.stringify({
      path: "quotes:requestQuote",
      args: {
        name: "Load Test",
        email,
        coverage: "home",
        message: "Automated rate-limit verification.",
      },
      format: "json",
    }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { endpoint: "quotes:requestQuote", case: label },
    },
  );

  let body = null;
  try {
    body = response.json();
  } catch {
    body = null;
  }

  return {
    httpStatus: response.status,
    status: body?.status,
    error: body?.errorMessage ?? "",
    reference: body?.value?.reference ?? null,
  };
}

export default function () {
  const runId = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const email = `loadtest+${runId}@example.com`;
  const otherEmail = `loadtest+other-${runId}@example.com`;

  const accepted = [];
  const rejected = [];

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = requestQuote(email, "same-email");
    if (result.status === "success") accepted.push(result);
    else rejected.push(result);
  }

  check(accepted, {
    "first three requests are accepted": (rows) => rows.length === 3,
    "accepted requests return a reference": (rows) =>
      rows.every((row) => typeof row.reference === "string" && row.reference),
  });

  check(rejected, {
    "later requests are rejected": (rows) => rows.length === 2,
    "rejections are user-facing, not transport failures": (rows) =>
      rows.every((row) => row.httpStatus === 200 && row.error.length > 0),
    "rejections explain the limit": (rows) =>
      rows.every((row) => /too many requests/i.test(row.error)),
  });

  const other = requestQuote(otherEmail, "other-email");
  check(other, {
    "a different address is not blocked": (row) => row.status === "success",
  });

  if (
    accepted.length !== 3 ||
    rejected.length !== 2 ||
    other.status !== "success"
  ) {
    fail(
      `rate-limit invariant violated: accepted=${accepted.length} rejected=${rejected.length} other=${other.status}`,
    );
  }

  console.log(
    `rate limit verified: ${accepted.length} accepted, ${rejected.length} rejected for ${email}`,
  );
}
