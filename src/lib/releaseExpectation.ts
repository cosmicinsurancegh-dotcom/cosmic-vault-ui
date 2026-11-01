/**
 * The functions this bundle calls, with the digest of the argument and return
 * validators it was compiled against.
 *
 * `vite.config.ts` captures them from this checkout with
 * `scripts/release-expectation.mjs` - the same capture that feeds the publish
 * gate - and inlines the result. Compiling it in rather than fetching it is the
 * point: it describes the bundle that is actually running, so it cannot drift
 * with the backend it is compared against.
 *
 * `null` when nothing was inlined (the Playwright config pins its own, and a
 * build whose capture failed inlines `null`). The runtime check then says
 * nothing, which is right: a guess would be a banner about a mistake that may
 * not exist.
 */
export const RELEASE_EXPECTATION: Record<string, string> | null = (() => {
  const raw: unknown = import.meta.env.VITE_RELEASE_EXPECTATION;
  // Vite parses a defined `import.meta.env` value, so the map arrives as an
  // object; JSON text is accepted too rather than silently switching the check
  // off if that changes.
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    Object.keys(parsed).length === 0
  ) {
    return null;
  }
  if (
    Object.values(parsed as Record<string, unknown>).some(
      (digest) => typeof digest !== "string",
    )
  ) {
    return null;
  }
  return parsed as Record<string, string>;
})();
