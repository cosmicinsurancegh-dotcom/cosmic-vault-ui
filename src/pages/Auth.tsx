import AcidSquares from "@/components/reactbits/AcidSquares";
import { Brand } from "@/components/site/Brand";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";

import { useAuth } from "@/hooks/use-auth";
import { signInFailureMessage, withSignInTimeout } from "@/lib/signInTimeout";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  FolderLock,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { cn } from "@/lib/utils";

interface AuthProps {
  redirectAfterAuth?: string;
}

type AuthMethod = "code" | "password";

/**
 * A code can be on its way for three different reasons: signing in without a
 * password, confirming a brand-new password account, or resetting an existing
 * password. The intent decides which params the next `signIn` call needs.
 */
interface VerificationState {
  intent: "email-code" | "password-signup" | "password-reset";
  email: string;
  password?: string;
}

function readableAuthError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const meaningful = raw
    .split("\n")
    .map((line) => line.trim())
    .find(
      (line) =>
        line.length > 0 &&
        !line.startsWith("at ") &&
        !/^\[Request ID:/i.test(line) &&
        !/^Server Error$/i.test(line),
    );
  return (meaningful ?? raw.split("\n")[0] ?? "")
    .replace(/^Uncaught (Error|ConvexError):\s*/i, "")
    .replace(/^\[CONVEX[^\]]*\]\s*/i, "")
    .trim();
}

function passwordErrorMessage(error: unknown, isSignup: boolean): string {
  const message = readableAuthError(error);
  if (/8 characters/i.test(message)) {
    return "Use at least 8 characters for your password.";
  }
  if (/already exists/i.test(message)) {
    return "That email already has a password. Sign in with it, or reset it with the link below the password field.";
  }
  if (
    /invalid credentials|invalid password|invalidaccountid|invalidsecret|invalid account/i.test(
      message,
    )
  ) {
    return isSignup
      ? "We couldn't create that password. Sign in with your existing one, or reset it below."
      : "That email and password don't match. If you haven't set a password yet, sign in with an email code, then add one from your profile.";
  }
  if (/toomanyfailedattempts|too many/i.test(message)) {
    return "Too many attempts. Wait a moment, or sign in with an email code.";
  }
  return message || "We couldn't complete that. Please try again.";
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [mode, setMode] = useState<"signin" | "signup">(() => {
    const requested = searchParams.get("mode");
    if (requested === "signup" || requested === "signin") return requested;
    return "signin";
  });
  const isSignup = mode === "signup";
  const [method, setMethod] = useState<AuthMethod>(() =>
    searchParams.get("method") === "password" ? "password" : "code",
  );
  const [step, setStep] = useState<VerificationState | null>(null);
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const resetToEntry = () => {
    setStep(null);
    setOtp("");
    setError(null);
    setPassword("");
    setConfirmPassword("");
    setNewPassword("");
  };

  /**
   * The tab and the method are both part of the address, so `/auth?mode=signup`
   * and `/auth?method=password` (and the `/signup` alias) keep showing the state
   * the visitor chose across a reload, a bookmark or a shared link. Every other
   * param, `returnTo` included, is carried through untouched.
   */
  const rememberInUrl = (key: "mode" | "method", value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    setSearchParams(params, { replace: true });
  };

  const selectMethod = (next: AuthMethod) => {
    setMethod(next);
    rememberInUrl("method", next);
    resetToEntry();
  };

  const selectMode = (next: "signin" | "signup") => {
    setMode(next);
    rememberInUrl("mode", next);
    resetToEntry();
  };

  const handleCodeSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const address = email.trim();
    setIsLoading(true);
    setError(null);
    try {
      await withSignInTimeout(signIn("email-otp", { email: address }));
      setOtp("");
      setStep({ intent: "email-code", email: address });
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        signInFailureMessage(
          error,
          readableAuthError(error) ||
            "Failed to send verification code. Please try again.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    // Password accounts are keyed by the lower-cased address, so normalize
    // here too; otherwise a capitalised address would fail code verification.
    const address = email.trim().toLowerCase();
    setIsLoading(true);
    setError(null);

    if (isSignup) {
      if (password.length < 8) {
        setError("Use at least 8 characters for your password.");
        setIsLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError("Those passwords don't match.");
        setIsLoading(false);
        return;
      }
    }

    try {
      const result = await withSignInTimeout(
        signIn("password", {
          email: address,
          password,
          flow: isSignup ? "signUp" : "signIn",
        }),
      );
      if (isSignup && !result.signingIn) {
        // A new password account is inert until its email address is confirmed.
        setOtp("");
        setStep({ intent: "password-signup", email: address, password });
        return;
      }
      navigate(redirect);
    } catch (error) {
      console.error("Password sign-in error:", error);
      setError(
        signInFailureMessage(error, passwordErrorMessage(error, isSignup)),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const address = email.trim().toLowerCase();
    if (!address) {
      setError("Enter your email address first, then choose Forgot password?");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await withSignInTimeout(
        signIn("password", { email: address, flow: "reset" }),
      );
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setStep({ intent: "password-reset", email: address });
    } catch (error) {
      console.error("Password reset error:", error);
      setError(
        signInFailureMessage(
          error,
          "No password is set for that email yet. Sign in with an email code instead, then add a password from your profile.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!step) return;
    setIsLoading(true);
    setError(null);
    try {
      if (step.intent === "email-code") {
        await withSignInTimeout(signIn("email-otp", { email: step.email }));
      } else if (step.intent === "password-signup") {
        await withSignInTimeout(
          signIn("password", {
            email: step.email,
            password: step.password ?? "",
            flow: "signUp",
          }),
        );
      } else {
        await withSignInTimeout(
          signIn("password", { email: step.email, flow: "reset" }),
        );
      }
      setOtp("");
    } catch (error) {
      console.error("Resend code error:", error);
      setError(
        signInFailureMessage(
          error,
          "We couldn't send a new code. Please try again.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!step) return;
    setIsLoading(true);
    setError(null);
    try {
      if (step.intent === "email-code") {
        await withSignInTimeout(
          signIn("email-otp", { email: step.email, code: otp }),
        );
      } else if (step.intent === "password-signup") {
        await withSignInTimeout(
          signIn("password", {
            email: step.email,
            password: step.password ?? "",
            code: otp,
            flow: "signUp",
          }),
        );
      } else {
        if (newPassword.length < 8) {
          setError("Use at least 8 characters for your new password.");
          setIsLoading(false);
          return;
        }
        if (newPassword !== confirmPassword) {
          setError("Those passwords don't match.");
          setIsLoading(false);
          return;
        }
        await withSignInTimeout(
          signIn("password", {
            email: step.email,
            code: otp,
            newPassword,
            flow: "reset-verification",
          }),
        );
      }
      navigate(redirect);
    } catch (error) {
      console.error(
        step.intent === "email-code"
          ? "OTP verification error:"
          : "Password verification error:",
        error,
      );
      setError(
        signInFailureMessage(
          error,
          step.intent === "email-code"
            ? "The verification code you entered is incorrect."
            : "That code wasn't accepted. Check it and try again.",
        ),
      );
      setOtp("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[0.92fr_1.08fr]">
      {/* Narrative panel */}
      <aside className="relative hidden flex-col overflow-hidden bg-[#071227] p-10 text-bone lg:flex xl:p-14">
        <div aria-hidden="true" className="absolute inset-0">
          <AcidSquares
            color="#071227"
            accentColor="#4c7dff"
            secondaryColor="#e4d9c4"
            tileSize={1.15}
            gap={0.14}
            roundness={0.28}
            rotation={35}
            waves={1}
            pulse={1}
            lighting="split"
            tilt={0.66}
            grain={0.1}
            fade={0.22}
            opacity={0.95}
            intro
            mouseInteraction
          />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(7,18,39,0.94)_0%,rgba(7,18,39,0.55)_38%,rgba(7,18,39,0.12)_66%,rgba(7,18,39,0.55)_100%)]"
        />

        <Brand href="/" className="relative text-bone" />

        <div className="relative mt-auto pt-8">
          <p className="flex items-center gap-3 text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-bone/45">
            <span className="h-px w-7 bg-bone/30" />
            Member access
          </p>
          <p className="mt-5 max-w-md text-balance text-[clamp(2.2rem,3.3vw,3.1rem)] font-semibold leading-[1.02] tracking-[-0.045em]">
            A quieter kind of{" "}
            <span className="text-electric-soft">insurance.</span>
          </p>
          <p className="mt-5 max-w-sm text-sm leading-6 text-bone/55">
            Your quotes, documents, and a concierge who answers the phone. One
            calm place for everything you&apos;re protecting.
          </p>

          <div className="mt-10 max-w-md rounded-2xl border border-white/12 bg-white/[0.035] p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-[4px] border border-white/15 text-electric-soft">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <p className="text-xs font-medium text-bone">
                  One vault, one record
                </p>
                <p className="text-[0.62rem] text-bone/40">
                  Policies, claims, documents
                </p>
              </div>
              <FolderLock className="ml-auto size-4 text-electric-soft" />
            </div>
            <p className="mt-3 font-display text-lg italic leading-snug text-bone/80">
              Quotes, decisions and documents stay on the same record - so
              nothing depends on remembering a phone call.
            </p>
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:py-8">
        <div className="flex items-center justify-between">
          <Brand href="/" compact className="text-ink lg:hidden" />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle className="size-9" />
            <button
              type="button"
              onClick={() => navigate("/")}
              className="group inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-ink"
            >
              <span className="grid size-9 place-items-center rounded-[4px] border border-line transition-colors group-hover:border-ink/30">
                <ArrowLeft className="size-3.5" />
              </span>
              Back to home
            </button>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[410px]">
            <AnimatePresence mode="wait" initial={false}>
              {step === null ? (
                <motion.div
                  key="email"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <div className="relative inline-flex items-center rounded-[4px] border border-line bg-card p-1">
                    {[
                      { label: "Sign in", value: "signin" as const },
                      { label: "Create account", value: "signup" as const },
                    ].map((option) => {
                      const active = mode === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => selectMode(option.value)}
                          aria-pressed={active}
                          className={cn(
                            "relative rounded-[4px] px-4 py-2 text-xs font-medium transition-colors duration-300",
                            active
                              ? "text-primary-foreground"
                              : "text-ink/55 hover:text-ink",
                          )}
                        >
                          {active && (
                            <motion.span
                              layoutId="auth-mode-pill"
                              className="absolute inset-0 rounded-[4px] bg-primary"
                              transition={{
                                type: "spring",
                                stiffness: 380,
                                damping: 32,
                              }}
                            />
                          )}
                          <span className="relative">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-6 text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-electric">
                    {isSignup ? "Get started" : "Welcome back"}
                  </p>
                  <h1 className="mt-3 text-[2.35rem] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
                    {isSignup ? "Create your" : "Enter the"}{" "}
                    <span className="text-electric">vault.</span>
                  </h1>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                    {method === "password"
                      ? isSignup
                        ? "Choose a password for your vault. We'll confirm it's you with a six-digit code before it goes live."
                        : "Sign in with the password you set for your account. Forgotten it? Reset it below, or switch to an email code."
                      : isSignup
                        ? "One email, one six-digit code, and your cover starts coming together. No password to remember and no forms in triplicate."
                        : "Use your email and we'll send a six-digit code. No password to remember, no account to remember either."}
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-1 rounded-[4px] border border-line bg-card p-1">
                    {[
                      {
                        value: "code" as const,
                        label: "Email code",
                        icon: Mail,
                      },
                      {
                        value: "password" as const,
                        label: "Password",
                        icon: KeyRound,
                      },
                    ].map((option) => {
                      const active = method === option.value;
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => selectMethod(option.value)}
                          aria-pressed={active}
                          className={cn(
                            "relative inline-flex items-center justify-center gap-2 rounded-[4px] px-3 py-2 text-xs font-medium transition-colors duration-300",
                            active ? "text-ink" : "text-ink/50 hover:text-ink",
                          )}
                        >
                          {active && (
                            <motion.span
                              layoutId="auth-method-pill"
                              className="absolute inset-0 rounded-[4px] bg-muted"
                              transition={{
                                type: "spring",
                                stiffness: 380,
                                damping: 32,
                              }}
                            />
                          )}
                          <Icon className="relative size-3.5" />
                          <span className="relative">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <form
                    onSubmit={
                      method === "code"
                        ? handleCodeSubmit
                        : handlePasswordSubmit
                    }
                    className="mt-5 space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="auth-email">Email address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="auth-email"
                          name="email"
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="you@example.com"
                          className="h-12 rounded-xl bg-card pl-10"
                          disabled={isLoading}
                          autoComplete="email"
                          required
                        />
                      </div>
                    </div>

                    {method === "password" && (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-baseline justify-between gap-3">
                            <Label htmlFor="auth-password">Password</Label>
                            {!isSignup && (
                              <button
                                type="button"
                                onClick={handleForgotPassword}
                                disabled={isLoading}
                                className="text-[0.7rem] font-medium text-electric underline-offset-4 transition-colors hover:underline disabled:opacity-60"
                              >
                                Forgot password?
                              </button>
                            )}
                          </div>
                          <div className="relative">
                            <KeyRound className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="auth-password"
                              name="password"
                              type="password"
                              value={password}
                              onChange={(event) =>
                                setPassword(event.target.value)
                              }
                              placeholder={
                                isSignup
                                  ? "At least 8 characters"
                                  : "Your password"
                              }
                              className="h-12 rounded-xl bg-card pl-10"
                              disabled={isLoading}
                              autoComplete={
                                isSignup ? "new-password" : "current-password"
                              }
                              minLength={8}
                              required
                            />
                          </div>
                        </div>

                        {isSignup ? (
                          <div className="space-y-2">
                            <Label htmlFor="auth-confirm-password">
                              Confirm password
                            </Label>
                            <div className="relative">
                              <KeyRound className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                id="auth-confirm-password"
                                name="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(event) =>
                                  setConfirmPassword(event.target.value)
                                }
                                placeholder="Repeat your password"
                                className="h-12 rounded-xl bg-card pl-10"
                                disabled={isLoading}
                                autoComplete="new-password"
                                minLength={8}
                                required
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="text-[0.7rem] leading-5 text-muted-foreground">
                            Set up an account with an email code?{" "}
                            <button
                              type="button"
                              onClick={() => selectMethod("code")}
                              className="font-medium text-electric underline-offset-4 hover:underline"
                            >
                              Sign in with an email code
                            </button>{" "}
                            and add a password from your profile.
                          </p>
                        )}
                      </>
                    )}

                    {error && (
                      <p
                        role="alert"
                        className="rounded-lg bg-destructive/8 px-3 py-2 text-xs leading-5 text-destructive"
                      >
                        {error}
                      </p>
                    )}

                    <Button
                      type="submit"
                      className="h-12 w-full rounded-[4px]"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          {method === "code"
                            ? "Sending code"
                            : isSignup
                              ? "Creating account"
                              : "Signing in"}
                        </>
                      ) : (
                        <>
                          {method === "code"
                            ? isSignup
                              ? "Create my account"
                              : "Continue with email"
                            : isSignup
                              ? "Create my account"
                              : "Sign in with password"}
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </Button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key={step.intent}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <button
                    type="button"
                    onClick={resetToEntry}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-ink"
                  >
                    <ArrowLeft className="size-3.5" />
                    Use a different email
                  </button>
                  <h1 className="mt-5 text-[2.2rem] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
                    {step.intent === "password-reset" ? (
                      <>
                        Set a new{" "}
                        <span className="text-electric">password.</span>
                      </>
                    ) : (
                      <>
                        Check your <span className="text-electric">inbox.</span>
                      </>
                    )}
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    We sent a six-digit code to{" "}
                    <span className="font-medium text-ink">{step.email}</span>.
                    {step.intent === "password-reset"
                      ? " Enter it below with your new password."
                      : step.intent === "password-signup"
                        ? " Confirm it to switch on password sign-in for your account."
                        : " It should land within a minute."}
                    {step.intent === "email-code" &&
                      isSignup &&
                      " Your vault opens as soon as you're verified."}
                  </p>

                  <form onSubmit={handleVerifySubmit} className="mt-8">
                    {step.intent === "password-reset" && (
                      <div className="mb-6 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="auth-new-password">
                            New password
                          </Label>
                          <Input
                            id="auth-new-password"
                            type="password"
                            value={newPassword}
                            onChange={(event) =>
                              setNewPassword(event.target.value)
                            }
                            placeholder="At least 8 characters"
                            className="h-12 rounded-xl bg-card"
                            disabled={isLoading}
                            autoComplete="new-password"
                            minLength={8}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="auth-confirm-new-password">
                            Confirm new password
                          </Label>
                          <Input
                            id="auth-confirm-new-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(event) =>
                              setConfirmPassword(event.target.value)
                            }
                            placeholder="Repeat your new password"
                            className="h-12 rounded-xl bg-card"
                            disabled={isLoading}
                            autoComplete="new-password"
                            minLength={8}
                            required
                          />
                        </div>
                        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Verification code
                        </p>
                      </div>
                    )}

                    <div className="flex justify-center sm:justify-start">
                      <InputOTP
                        value={otp}
                        onChange={setOtp}
                        maxLength={6}
                        disabled={isLoading}
                        containerClassName="gap-2"
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            otp.length === 6 &&
                            !isLoading
                          ) {
                            const form = (e.target as HTMLElement).closest(
                              "form",
                            );
                            if (form) form.requestSubmit();
                          }
                        }}
                      >
                        <InputOTPGroup className="gap-2">
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot
                              key={index}
                              index={index}
                              className="h-12 w-11 rounded-xl border bg-card text-base first:rounded-l-xl last:rounded-r-xl"
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>

                    {error && (
                      <p
                        role="alert"
                        className="mt-3 rounded-lg bg-destructive/8 px-3 py-2 text-xs leading-5 text-destructive"
                      >
                        {error}
                      </p>
                    )}

                    <Button
                      type="submit"
                      className="mt-6 h-12 w-full rounded-[4px]"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Verifying
                        </>
                      ) : (
                        <>
                          {step.intent === "password-reset"
                            ? "Save password & sign in"
                            : "Verify & enter the vault"}
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </Button>
                  </form>

                  <p className="mt-5 text-xs text-muted-foreground">
                    Didn&apos;t receive it? Check spam, or{" "}
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={isLoading}
                      className="font-medium text-electric underline-offset-4 hover:underline disabled:opacity-60"
                    >
                      resend the code
                    </button>
                    .
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-[0.68rem] text-muted-foreground">
            Sign in with a one-time email code or a password you set.
          </p>
          <p className="text-[0.62rem] text-muted-foreground/70">
            By continuing you agree to our{" "}
            <a
              href="/legal/terms"
              className="underline underline-offset-2 transition-colors hover:text-ink"
            >
              Terms
            </a>{" "}
            and{" "}
            <a
              href="/legal/privacy"
              className="underline underline-offset-2 transition-colors hover:text-ink"
            >
              Privacy Notice
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
