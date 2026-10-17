/**
 * Test double for `@convex-dev/auth/react` (aliased in the E2E Vite config).
 *
 * It mirrors the shape of the real sign-in flow without a deployment:
 *
 *  1. `signIn("email-otp", email only)` resolves, so the app moves to the
 *     "Check your inbox" step — exactly like a real code being sent.
 *  2. `signIn("email-otp", email + code)` signs the visitor in when the code
 *     matches VALID_CODE and rejects otherwise, so the error path is covered.
 *  3. `signIn("anonymous")` signs in a guest immediately.
 */
import { useMemo } from "react";
import type { ReactNode } from "react";
import { CUSTOMER_SESSION, VALID_CODE, setSession } from "./session";

const SEND_DELAY_MS = 60;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ConvexAuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAuthActions() {
  return useMemo(
    () => ({
      signIn: async (provider: string, params?: FormData) => {
        if (provider === "anonymous") {
          await delay(SEND_DELAY_MS);
          setSession(CUSTOMER_SESSION);
          return;
        }

        if (provider !== "email-otp") {
          throw new Error(`Unsupported sign-in provider in tests: ${provider}`);
        }

        const code = params?.get("code");
        await delay(SEND_DELAY_MS);

        if (code === null || code === undefined) return; // code "sent"
        if (code !== VALID_CODE) throw new Error("Invalid code");
        setSession(CUSTOMER_SESSION);
      },
      signOut: async () => {
        setSession(null);
      },
    }),
    [],
  );
}
