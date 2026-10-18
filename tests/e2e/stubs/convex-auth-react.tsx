/**
 * Test double for `@convex-dev/auth/react` (aliased in the E2E Vite config).
 *
 * It mirrors the shape of the real sign-in flow without a deployment:
 *
 *  1. `signIn("email-otp", email only)` resolves, so the app moves to the
 *     "Check your inbox" step - exactly like a real code being sent.
 *  2. `signIn("email-otp", email + code)` signs the visitor in when the code
 *     matches VALID_CODE and rejects otherwise, so the error path is covered.
 *  3. `signIn("anonymous")` signs in a guest immediately.
 *  4. `signIn("password", ...)` mirrors the real API: a sign-up needs a code
 *     before it signs in, and reset only works for `TEST_PASSWORD` accounts.
 *
 * Like the real client, `signIn` takes either a `FormData` or a plain params
 * object (see `signIn` in `@convex-dev/auth/react`).
 */
import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  CUSTOMER_SESSION,
  TEST_PASSWORD,
  VALID_CODE,
  setSession,
} from "./session";

const SEND_DELAY_MS = 60;

type SignInParams = FormData | Record<string, unknown> | undefined;

function param(params: SignInParams, key: string): string | null {
  if (params instanceof FormData) return params.get(key)?.toString() ?? null;
  const value = params?.[key];
  return value === undefined || value === null ? null : String(value);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ConvexAuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAuthActions() {
  return useMemo(
    () => ({
      signIn: async (provider: string, params?: SignInParams) => {
        if (provider === "anonymous") {
          await delay(SEND_DELAY_MS);
          setSession(CUSTOMER_SESSION);
          return { signingIn: true };
        }

        if (provider === "password") {
          const flow = param(params, "flow") ?? "signIn";
          const password = param(params, "password");
          const code = param(params, "code");
          const email = param(params, "email") ?? "";
          await delay(SEND_DELAY_MS);

          if (flow === "signUp") {
            if (code === null) return { signingIn: false }; // code "sent"
            if (code !== VALID_CODE) throw new Error("Invalid code");
            setSession(CUSTOMER_SESSION);
            return { signingIn: true };
          }

          if (flow === "reset") {
            if (email !== CUSTOMER_SESSION.email) {
              throw new Error("InvalidAccountId");
            }
            return { signingIn: false }; // code "sent"
          }

          if (flow === "reset-verification") {
            if (code !== VALID_CODE) throw new Error("Invalid code");
            setSession(CUSTOMER_SESSION);
            return { signingIn: true };
          }

          if (password !== TEST_PASSWORD) throw new Error("InvalidSecret");
          setSession(CUSTOMER_SESSION);
          return { signingIn: true };
        }

        if (provider !== "email-otp") {
          throw new Error(`Unsupported sign-in provider in tests: ${provider}`);
        }

        const code = param(params, "code");
        await delay(SEND_DELAY_MS);

        if (code === null) return { signingIn: false }; // code "sent"
        if (code !== VALID_CODE) throw new Error("Invalid code");
        setSession(CUSTOMER_SESSION);
        return { signingIn: true };
      },
      signOut: async () => {
        setSession(null);
      },
    }),
    [],
  );
}
