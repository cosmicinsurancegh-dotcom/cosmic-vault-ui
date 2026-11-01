import { Button } from "@/components/ui/button";
import {
  probeConvexDeployment,
  type ConvexHealth,
} from "@/lib/convexHealth";
import { RELEASE_EXPECTATION } from "@/lib/releaseExpectation";
import { probeRelease, type ReleaseSkew } from "@/lib/releaseSkew";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  PauseCircle,
  RefreshCw,
  ServerCrash,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";

/** A backend restarts and deploys; one failed probe is not a verdict. */
const PROBE_ATTEMPTS = 3;
/** Long enough to outlast a deploy or a restart, short enough to stay unseen. */
const PROBE_RETRY_MS = 1200;
/** How many functions a banner names before it summarises the rest. */
const MAX_NAMED = 5;

type Banner = {
  title: string;
  body: string;
  /** The names or the deployment's own words, set in mono under the body. */
  detail: string;
  tone: "warning" | "danger";
  Icon: LucideIcon;
};

function nameList(names: string[]): string {
  if (names.length <= MAX_NAMED) return names.join(", ");
  return `${names.slice(0, MAX_NAMED).join(", ")} and ${names.length - MAX_NAMED} more`;
}

function healthBanner(
  health: Exclude<ConvexHealth, { state: "ok" }>,
  url: string,
): Banner {
  if (health.state === "paused") {
    return {
      title: "The Convex deployment is paused.",
      body: "No function can run until it is resumed, so every screen on this dashboard will keep failing. Resume it in the Convex dashboard, then check again.",
      detail: health.detail,
      tone: "warning",
      Icon: PauseCircle,
    };
  }
  if (health.state === "unavailable") {
    return {
      title: "The backend is not serving this app.",
      body: "The Convex deployment answers, but no function runs - its functions have not been published, or the deployment is broken. Publish them with the Deploy Convex functions workflow (target: prod), then check again.",
      detail: health.detail,
      tone: "danger",
      Icon: ServerCrash,
    };
  }
  return {
    title: "This dashboard cannot reach Convex.",
    body: `No usable response from ${url}. Check VITE_CONVEX_URL and the network, then check again.`,
    detail: health.detail,
    tone: "danger",
    Icon: AlertTriangle,
  };
}

/**
 * The release skew the publish gate exists to prevent, reported by the page
 * that would hit it. A deployment can be replaced or rolled back under a bundle
 * that is already published, and the failure looks exactly like every other one
 * from inside the app: a masked `Server Error` on the call, and nothing to say
 * which call or why.
 */
function skewBanner(skew: Extract<ReleaseSkew, { state: "skew" }>): Banner {
  const { missing, changed } = skew;
  const counts: string[] = [];
  if (missing.length > 0) {
    counts.push(`${missing.length} the deployment does not serve`);
  }
  if (changed.length > 0) {
    counts.push(`${changed.length} it validates differently than this build does`);
  }
  const detail = [
    missing.length > 0 ? `not published: ${nameList(missing)}` : "",
    changed.length > 0 ? `different shape: ${nameList(changed)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    title: "This site is ahead of the backend it talks to.",
    body: `The functions this bundle calls are not the ones the deployment runs: ${counts.join(" and ")}. Calls to them fail with a Server Error until the functions are published - Deploy Convex functions, target: prod - and the site is redeployed.`,
    detail,
    tone: "warning",
    Icon: ArrowUpRight,
  };
}

/**
 * Says why the dashboard cannot load, when the reason is the backend rather
 * than the page - and when the bundle is simply newer than the backend.
 *
 * It is mounted above the routes, because the failure it reports also breaks
 * the signed-in user query - a notice placed inside the dashboard shell would
 * never render, the shell would sit on its loading spinner instead.
 *
 * A Convex query cannot report either kind: the query is what failed, and the
 * client surfaces a bare "Server Error" with no cause. So the check calls the
 * deployment's public `setup:health` over HTTP (see `@/lib/convexHealth`), and
 * once that answers, asks `setup:release` what the deployment serves and
 * compares it with what this bundle was built against (`@/lib/releaseSkew`).
 */
export function BackendHealthNotice({ url }: { url: string }) {
  const location = useLocation();
  const onDashboard = location.pathname.startsWith("/dashboard");
  const [health, setHealth] = useState<ConvexHealth | null>(null);
  const [skew, setSkew] = useState<ReleaseSkew | null>(null);
  const [checking, setChecking] = useState(false);
  const [attempt, setAttempt] = useState(0);

  /* Retried, because a single probe can catch a deployment mid-restart or
     mid-deploy; the banner is an alarming claim to pin on one response. The
     release check runs only once the deployment is known to answer, so its
     silence is never mistaken for a healthy release. */
  useEffect(() => {
    if (!onDashboard) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      for (let index = 0; index < PROBE_ATTEMPTS; index += 1) {
        const result = await probeConvexDeployment(url);
        if (cancelled) return;
        if (result.state === "ok" || index === PROBE_ATTEMPTS - 1) {
          setHealth(result);
          if (result.state === "ok") {
            const release = await probeRelease(url, {
              expected: RELEASE_EXPECTATION,
            });
            if (cancelled) return;
            setSkew(release);
          }
          setChecking(false);
          return;
        }
        await new Promise<void>((resolve) => {
          timer = setTimeout(resolve, PROBE_RETRY_MS);
        });
        if (cancelled) return;
      }
    };

    void check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [attempt, onDashboard, url]);

  /* A tab left open while the backend was down - or while it was behind -
     keeps showing that verdict; re-check when the visitor comes back to it,
     but only while there is something to clear. */
  const latest = useRef<{ health: ConvexHealth | null; skew: ReleaseSkew | null }>({
    health: null,
    skew: null,
  });
  useEffect(() => {
    latest.current = { health, skew };
  }, [health, skew]);

  useEffect(() => {
    if (!onDashboard) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const current = latest.current;
      if (!current.health) return;
      const shown =
        current.health.state !== "ok" || current.skew?.state === "skew";
      if (!shown) return;
      setAttempt((value) => value + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [onDashboard]);

  const retry = useCallback(() => {
    setChecking(true);
    setAttempt((value) => value + 1);
  }, []);

  if (!onDashboard || !health) return null;

  const banner: Banner | null =
    health.state !== "ok"
      ? healthBanner(health, url)
      : skew?.state === "skew"
        ? skewBanner(skew)
        : null;

  if (!banner) return null;

  const { title, body, detail, tone, Icon } = banner;

  return (
    <div
      role="alert"
      className={cn(
        "sticky top-0 z-50 border-b px-4 py-3 backdrop-blur sm:px-6",
        tone === "warning"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
          : "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5">
          <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={1.9} />
          <div className="min-w-0">
            <p className="text-[0.72rem] font-semibold">{title}</p>
            <p className="mt-0.5 text-[0.65rem] leading-5 opacity-90">{body}</p>
            {detail && (
              <p className="mt-1 truncate font-mono text-[0.6rem] opacity-75">
                {detail}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={retry}
          disabled={checking}
          className="h-8 shrink-0 rounded-[4px] border-current bg-transparent px-3 text-[0.65rem] hover:bg-black/5 dark:hover:bg-white/10"
        >
          {checking ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          Check again
        </Button>
      </div>
    </div>
  );
}
