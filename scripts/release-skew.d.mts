/** Types for `scripts/release-skew.mjs`, so the app and the gate can import it. */

export type ReleaseSkew =
  /** The deployment serves every function this build calls, with those shapes. */
  | { state: "match"; checked: number }
  /** It does not: calls to these fail, and a person can fix it. */
  | { state: "skew"; missing: string[]; changed: string[] }
  /** No definite answer, so nothing is claimed either way. */
  | { state: "unknown"; detail: string };

export function compareRelease(
  expected: Record<string, string> | null | undefined,
  payload: unknown,
): ReleaseSkew;
