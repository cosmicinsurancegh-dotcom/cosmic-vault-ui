import { Button } from "@/components/ui/button";
import {
  probeConvexDeployment,
  type ConvexHealth,
} from "@/lib/convexHealth";
import { cn } from "@/lib/utils";
import { AlertTriangle, Loader2, PauseCircle, RefreshCw, ServerCrash } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router";

/**
 * Says why the dashboard cannot load, when the reason is the backend rather
 * than the page.
 *
 * It is mounted above the routes, because the failure it reports also breaks
 * the signed-in user query - a notice placed inside the dashboard shell would
 * never render, the shell would sit on its loading spinner instead.
 *
 * A Convex query cannot report this: the query is what failed, and the client
 * surfaces a bare "Server Error" with no cause. So the check calls the
 * deployment's public `setup:health` over HTTP (see `@/lib/convexHealth`).
 */
export function BackendHealthNotice({ url }: { url: string }) {
  const location = useLocation();
  const onDashboard = location.pathname.startsWith("/dashboard");
  const [health, setHealth] = useState<ConvexHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!onDashboard) return;
    let cancelled = false;
    probeConvexDeployment(url).then((result) => {
      if (cancelled) return;
      setHealth(result);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt, onDashboard, url]);

  const retry = useCallback(() => {
    setChecking(true);
    setAttempt((value) => value + 1);
  }, []);

  if (!onDashboard || !health || health.state === "ok") return null;

  const { title, body, tone, Icon } =
    health.state === "paused"
      ? {
          title: "The Convex deployment is paused.",
          body: "No function can run until it is resumed, so every screen on this dashboard will keep failing. Resume it in the Convex dashboard, then check again.",
          tone: "warning" as const,
          Icon: PauseCircle,
        }
      : health.state === "unavailable"
        ? {
            title: "The backend is not serving this app.",
            body: "The Convex deployment answers, but no function runs - its functions have not been published, or the deployment is broken. Publish them with the Deploy Convex functions workflow (target: prod), then check again.",
            tone: "danger" as const,
            Icon: ServerCrash,
          }
        : {
            title: "This dashboard cannot reach Convex.",
            body: `No usable response from ${url}. Check VITE_CONVEX_URL and the network, then check again.`,
            tone: "danger" as const,
            Icon: AlertTriangle,
          };

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
            {health.detail && (
              <p className="mt-1 truncate font-mono text-[0.6rem] opacity-75">
                {health.detail}
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
