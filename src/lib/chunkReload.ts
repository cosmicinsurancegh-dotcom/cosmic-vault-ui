/**
 * Recovery from a deployment that replaced a chunk a tab still expects.
 *
 * Routes here are code-split, so opening one loads `assets/<Page>-<hash>.js`.
 * A tab loaded before a deploy asks for the previous build's hash; that file is
 * gone, and the request fails (`'text/html' is not a valid JavaScript MIME
 * type` when the host answers with the SPA document). Vite reports the failed
 * dynamic import as `vite:preloadError`; reloading fetches the current
 * `index.html` and with it the current hashes.
 *
 * The reload happens at most once per window, so a chunk that is genuinely
 * missing from the running build cannot loop the page.
 */

export const CHUNK_RELOAD_KEY = "cv.chunk-reload-at";

/** How long after a reload another chunk failure is treated as a new deploy. */
export const CHUNK_RELOAD_WINDOW_MS = 30_000;

/** True when a failed preload should trigger a reload. */
export function shouldReloadForChunkError(
  now: number,
  lastReloadAt: number | null,
): boolean {
  if (lastReloadAt === null) return true;
  if (!Number.isFinite(lastReloadAt)) return true;
  return now - lastReloadAt >= CHUNK_RELOAD_WINDOW_MS;
}

/** The parts of `window` the listener touches, so it can be exercised in a test. */
export type ChunkReloadTarget = {
  addEventListener: (type: string, listener: (event: Event) => void) => void;
  sessionStorage: Pick<Storage, "getItem" | "setItem">;
  location: { reload: () => void };
};

/**
 * Installs the listener. Without usable session storage there is no loop guard,
 * so it deliberately does nothing rather than risk reloading forever.
 */
export function installChunkReloadOnPreloadError(
  target: ChunkReloadTarget,
): void {
  target.addEventListener("vite:preloadError", (event) => {
    let lastReloadAt: number | null = null;
    try {
      const raw = target.sessionStorage.getItem(CHUNK_RELOAD_KEY);
      lastReloadAt = raw === null ? null : Number(raw);
      if (!shouldReloadForChunkError(Date.now(), lastReloadAt)) return;
      target.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    } catch {
      return;
    }

    event.preventDefault();
    target.location.reload();
  });
}
