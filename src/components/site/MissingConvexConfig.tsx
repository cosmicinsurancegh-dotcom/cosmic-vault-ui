/**
 * Rendered instead of a blank white page when `VITE_CONVEX_URL` is missing for
 * the current environment. This is the usual cause of a Vercel preview that
 * loads but renders nothing: the Convex client throws before React mounts.
 */
export function MissingConvexConfig() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-ink">
      <div className="max-w-md">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-primary">
          Configuration required
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
          This deployment can&apos;t reach Convex yet.
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink/60">
          The variable{" "}
          <code className="rounded border border-line bg-muted px-1.5 py-0.5 text-ink/90">
            VITE_CONVEX_URL
          </code>{" "}
          is missing for this environment. Add it to the Vercel project for both
          Production and Preview, then redeploy.
        </p>
        <p className="mt-3 text-xs leading-5 text-ink/45">
          Vercel → Project → Settings → Environment Variables →
          VITE_CONVEX_URL, with Production and Preview ticked.
        </p>
      </div>
    </div>
  );
}
