/**
 * The identifier an email sign-in is keyed by: trimmed and lower-cased.
 *
 * Convex Auth looks accounts up with an exact match on `providerAccountId`, and
 * the email providers store the address exactly as it was typed. Two spellings
 * that differ only in case are therefore two accounts — the second one with an
 * empty dashboard — so every email sign-in must normalise before it calls
 * `signIn`, and the code sent afterwards must verify against the same value.
 *
 * This mirrors `normalizeAccountEmail` in `src/convex/lib/account.ts`, which is
 * what the server-side email-change and invite flows already use.
 */
export function normalizeEmailIdentifier(value: string): string {
  return value.trim().toLowerCase();
}
