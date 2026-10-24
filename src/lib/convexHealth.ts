/**
 * Deployment health, probed over the Convex HTTP API rather than through the
 * Convex client.
 *
 * The failure this exists for: the host answers, `/version` responds, and every
 * function call fails. A query cannot report that - the query is the thing that
 * failed - so the check is a plain `fetch` of the deployment's health query,
 * whose response is classified here. That keeps the result independent of the
 * client, the auth session and the router.
 *
 * `setup:health` takes no arguments and requires no session on purpose.
 * Production redacts every failure to a bare `[Request ID: …] Server Error`, so
 * probing a function that needs a signed-in viewer makes a healthy deployment
 * indistinguishable from one that runs nothing; an argument-free constant has
 * no way to fail on its own, which makes a value response meaningful.
 */

/** Function used as the probe. Public, argument-free, and present in every release. */
export const HEALTH_PROBE_FUNCTION = "setup:health";

/** Convex prefixes server errors with the request id; it is noise in the UI. */
const REQUEST_ID_PREFIX = /^\[Request ID: [^\]]+\]\s*/;

export type ConvexHealth =
  /** The deployment ran the probe and returned a value. */
  | { state: "ok" }
  /** The deployment is paused, so no function can run at all. */
  | { state: "paused"; detail: string }
  /** The deployment answered but no function ran (nothing deployed, or broken). */
  | { state: "unavailable"; detail: string }
  /** No usable response: DNS, network, HTTP error, timeout or a non-JSON body. */
  | { state: "unreachable"; detail: string };

/** Normalises a Convex error message by dropping the request id. */
export function cleanProbeMessage(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(REQUEST_ID_PREFIX, "").trim();
}

/**
 * Classifies the JSON body of a probe call. Convex answers `{"status":"value",
 * "value":…}` on success and `{"status":"error","errorMessage":…}` otherwise;
 * the message is what separates a paused deployment from one that runs nothing.
 */
export function classifyProbePayload(payload: unknown): ConvexHealth {
  if (payload === null || typeof payload !== "object") {
    return {
      state: "unreachable",
      detail: "The deployment answered with something that is not a Convex response.",
    };
  }

  const body = payload as Record<string, unknown>;
  if (body.status === "value") return { state: "ok" };

  if (body.status !== "error") {
    return {
      state: "unreachable",
      detail: "The deployment answered without a Convex response.",
    };
  }

  const message = cleanProbeMessage(body.errorMessage);
  if (/paused/i.test(message)) return { state: "paused", detail: message };

  return {
    state: "unavailable",
    detail: message || "The deployment answered without running the query.",
  };
}

/** A network failure, an abort or a malformed response - never a function error. */
function unreachable(error: unknown): ConvexHealth {
  const detail =
    error instanceof Error && error.name === "AbortError"
      ? "The deployment did not answer in time."
      : error instanceof Error
        ? error.message
        : "The request failed.";
  return { state: "unreachable", detail };
}

/** `https://x.convex.cloud` -> `https://x.convex.cloud/api/query`, without a double slash. */
export function probeUrl(deploymentUrl: string): string {
  return `${deploymentUrl.replace(/\/+$/, "")}/api/query`;
}

/**
 * Calls `setup:health` over HTTP and classifies the answer. Never throws: a
 * failed check is itself a result the dashboard can explain.
 */
export async function probeConvexDeployment(
  deploymentUrl: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<ConvexHealth> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(probeUrl(deploymentUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: HEALTH_PROBE_FUNCTION,
        args: {},
        format: "json",
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        state: "unreachable",
        detail: `The deployment answered HTTP ${response.status}.`,
      };
    }

    return classifyProbePayload(await response.json());
  } catch (error) {
    return unreachable(error);
  } finally {
    clearTimeout(timer);
  }
}
