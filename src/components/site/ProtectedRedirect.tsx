import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router";

/**
 * Used for navigation destinations that are really authenticated functions
 * (for example "Track a claim" or "Policy documents").
 *
 * Signed-out visitors are sent to the existing sign-in flow with the private
 * destination preserved, so they land on the page they actually asked for.
 * Signed-in visitors are passed straight through to it.
 */
export function ProtectedRedirect({ to }: { to: string }) {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/auth?returnTo=${encodeURIComponent(to)}`} replace />;
  }

  return <Navigate to={to} replace />;
}
