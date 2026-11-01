/**
 * Whether the bundle a browser is running was built for the backend it is
 * talking to.
 *
 * The build gate refuses to publish a bundle whose functions production does
 * not serve, but a gate only describes the moment of publishing: a deployment
 * can be rolled back or replaced underneath a bundle that has already been
 * published, and nothing in the browser would notice. That is the same failure
 * the gate exists for - on 2026-10-30 the site was published about a minute
 * ahead of `tickets.queueSummary` and every staff dashboard load died on a
 * masked `Server Error` - so the running app answers it too.
 *
 * The bundle carries what it expects: the functions it calls, each with the
 * digest of the argument and return validators it was compiled against.
 * `vite.config.ts` takes that from `scripts/release-expectation.mjs`, the same
 * capture the gate uses, so the two can never disagree about what this build
 * needs. `setup:release` returns what the deployment actually runs (the stamp
 * the `Deploy Convex functions` workflow writes after publishing), and this
 * module compares them.
 *
 * Only a definite answer is a warning. A deployment that has never been
 * stamped, one that predates `setup:release`, and one that cannot be reached
 * all read as `unknown` and say nothing here: the point of the banner is to
 * name a skew an operator can act on, not to speculate about a backend that is
 * already explained by the health notice beside it.
 *
 * The comparison itself is `scripts/release-skew.mjs`, shared with
 * `scripts/smoke-live.mjs` - the same verdict, asked from outside the browser
 * after a release.
 */

import {
  compareRelease as compare,
  type ReleaseSkew,
} from "../../scripts/release-skew.mjs";

export type { ReleaseSkew };

/** Function that answers with what the deployment serves. Public, no arguments. */
export const RELEASE_PROBE_FUNCTION = "setup:release";

/** Names of the functions this bundle calls, with the shapes it was built for. */
export type ReleaseExpectation = Record<string, string>;

/**
 * The verdict, separated from the network call so it can be tested without a
 * deployment.
 */
export function compareRelease(
  expected: ReleaseExpectation | null,
  payload: unknown,
): ReleaseSkew {
  return compare(expected, payload);
}

/** A network failure, an abort or a malformed body - never a verdict. */
function unanswerable(error: unknown): ReleaseSkew {
  const detail =
    error instanceof Error && error.name === "AbortError"
      ? "The deployment did not answer in time."
      : error instanceof Error
        ? error.message
        : "The request failed.";
  return { state: "unknown", detail };
}

/**
 * Asks the deployment what it serves and compares the answer with what this
 * build expects. Never throws: a check that cannot be answered is a result, and
 * one that says nothing.
 */
export async function probeRelease(
  deploymentUrl: string,
  options: {
    expected?: ReleaseExpectation | null;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<ReleaseSkew> {
  const expected = options.expected ?? null;
  if (!expected || Object.keys(expected).length === 0) {
    return {
      state: "unknown",
      detail: "This build did not record the functions it calls.",
    };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);

  try {
    const response = await fetchImpl(
      `${deploymentUrl.replace(/\/+$/, "")}/api/query`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: RELEASE_PROBE_FUNCTION,
          args: {},
          format: "json",
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return {
        state: "unknown",
        detail: `The deployment answered HTTP ${response.status}.`,
      };
    }

    const body: unknown = await response.json();
    if (body === null || typeof body !== "object") {
      return {
        state: "unknown",
        detail: "The deployment answered with something that is not a Convex response.",
      };
    }
    const status = (body as { status?: unknown }).status;
    // `value` is the WebSocket protocol's spelling; neither shape is mistaken
    // for a deployment that answered.
    if (status !== "success" && status !== "value") {
      return {
        state: "unknown",
        detail: `The deployment did not answer ${RELEASE_PROBE_FUNCTION}.`,
      };
    }
    return compareRelease(expected, (body as { value?: unknown }).value);
  } catch (error) {
    return unanswerable(error);
  } finally {
    clearTimeout(timer);
  }
}
