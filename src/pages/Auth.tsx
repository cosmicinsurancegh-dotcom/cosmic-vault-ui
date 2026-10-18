import { Brand } from "@/components/site/Brand";
import { Media } from "@/components/site/Media";
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
import { IMAGES } from "@/lib/imagery";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  FolderLock,
  Loader2,
  Mail,
  ShieldCheck,
  UserX,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { cn } from "@/lib/utils";

interface AuthProps {
  redirectAfterAuth?: string;
  defaultMode?: "signin" | "signup";
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

function Auth({ redirectAfterAuth, defaultMode }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [mode, setMode] = useState<"signin" | "signup">(() => {
    const requested = searchParams.get("mode");
    if (requested === "signup" || requested === "signin") return requested;
    return defaultMode ?? "signin";
  });
  const isSignup = mode === "signup";
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("The verification code you entered is incorrect.");
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (error) {
      console.error("Guest login error:", error);
      setError(
        `Failed to sign in as guest: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[0.92fr_1.08fr]">
      {/* Narrative panel */}
      <aside className="starfield relative hidden flex-col overflow-hidden bg-[#071227] p-10 text-bone lg:flex xl:p-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 top-1/4 size-[26rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.28),transparent_66%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-20 size-[24rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(228,217,196,0.14),transparent_68%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-[-18%] top-16 size-[26rem] rounded-full border border-white/[0.07]"
        >
          <span className="absolute inset-12 rounded-full border border-white/[0.05]" />
          <span className="absolute -left-1 top-1/2 size-2 rounded-full bg-electric-soft" />
        </div>

        <Brand href="/" className="relative text-bone" />

        <div className="group relative mt-8 min-h-[12rem] flex-1 overflow-hidden rounded-[1.5rem] border border-white/10">
          <Media
            image={IMAGES.auth}
            overlay="cosmic"
            parallax={18}
            eager
            className="absolute inset-0"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
            <p className="text-[0.58rem] font-semibold uppercase tracking-[0.24em] text-bone/75">
              Insurance for the long horizon
            </p>
            <span className="grid size-7 shrink-0 place-items-center rounded-full border border-white/25 bg-white/10 text-bone backdrop-blur transition-transform duration-500 group-hover:rotate-45">
              <ArrowRight className="size-3.5" />
            </span>
          </div>
        </div>

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
              <span className="grid size-9 place-items-center rounded-full border border-white/15 text-electric-soft">
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
              Quotes, decisions and documents stay on the same record — so
              nothing depends on remembering a phone call.
            </p>
          </div>
        </div>

        <div className="relative mt-10 flex items-center justify-between border-t border-white/10 pt-5 text-[0.62rem] uppercase tracking-[0.16em] text-bone/35">
          <span>Email code sign-in, no password</span>
          <span>Demonstration platform</span>
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
              <span className="grid size-7 place-items-center rounded-full border border-line transition-colors group-hover:border-ink/30">
                <ArrowLeft className="size-3.5" />
              </span>
              Back to home
            </button>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[410px]">
            <AnimatePresence mode="wait" initial={false}>
              {step === "signIn" ? (
                <motion.div
                  key="email"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <div className="relative inline-flex items-center rounded-full border border-line bg-card p-1">
                    {[
                      { label: "Sign in", value: "signin" as const },
                      { label: "Create account", value: "signup" as const },
                    ].map((option) => {
                      const active = mode === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setMode(option.value)}
                          aria-pressed={active}
                          className={cn(
                            "relative rounded-full px-4 py-2 text-xs font-medium transition-colors duration-300",
                            active
                              ? "text-primary-foreground"
                              : "text-ink/55 hover:text-ink",
                          )}
                        >
                          {active && (
                            <motion.span
                              layoutId="auth-mode-pill"
                              className="absolute inset-0 rounded-full bg-primary"
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
                    {isSignup
                      ? "One email, one six-digit code, and your cover starts coming together. No password to remember and no forms in triplicate."
                      : "Use your email and we'll send a six-digit code. No password to remember, no account to remember either."}
                  </p>

                  <form onSubmit={handleEmailSubmit} className="mt-8 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="auth-email">Email address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="auth-email"
                          name="email"
                          type="email"
                          placeholder="you@example.com"
                          className="h-12 rounded-xl bg-card pl-10"
                          disabled={isLoading}
                          required
                        />
                      </div>
                    </div>

                    {error && (
                      <p className="rounded-lg bg-destructive/8 px-3 py-2 text-xs text-destructive">
                        {error}
                      </p>
                    )}

                    <Button
                      type="submit"
                      className="h-12 w-full rounded-full"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Sending code
                        </>
                      ) : (
                        <>
                          {isSignup ? "Create my account" : "Continue with email"}
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </Button>
                  </form>

                  <div className="my-6 flex items-center gap-3">
                    <span className="h-px flex-1 bg-line" />
                    <span className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
                      or
                    </span>
                    <span className="h-px flex-1 bg-line" />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full rounded-full bg-card"
                    onClick={handleGuestLogin}
                    disabled={isLoading}
                  >
                    <UserX className="size-4" />
                    Continue as guest
                  </Button>

                  <p className="mt-5 flex items-start gap-2 text-[0.7rem] leading-5 text-muted-foreground">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-electric" />
                    Guest sessions are temporary: they let you explore the vault,
                    but nothing done as a guest is permanently saved. Sign in with
                    your email whenever you want your quotes and applications to
                    stay on a record.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setStep("signIn");
                      setError(null);
                      setOtp("");
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-ink"
                  >
                    <ArrowLeft className="size-3.5" />
                    Use a different email
                  </button>
                  <h1 className="mt-5 text-[2.2rem] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
                    Check your <span className="text-electric">inbox.</span>
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    We sent a six-digit code to{" "}
                    <span className="font-medium text-ink">{step.email}</span>.
                    It should land within a minute.
                    {isSignup &&
                      " Your vault opens as soon as you're verified."}
                  </p>

                  <form onSubmit={handleOtpSubmit} className="mt-8">
                    <input type="hidden" name="email" value={step.email} />
                    <input type="hidden" name="code" value={otp} />

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
                            const form = (e.target as HTMLElement).closest("form");
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
                      <p className="mt-3 rounded-lg bg-destructive/8 px-3 py-2 text-xs text-destructive">
                        {error}
                      </p>
                    )}

                    <Button
                      type="submit"
                      className="mt-6 h-12 w-full rounded-full"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Verifying
                        </>
                      ) : (
                        <>
                          Verify &amp; enter the vault
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </Button>
                  </form>

                  <p className="mt-5 text-xs text-muted-foreground">
                    Didn&apos;t receive it? Check spam, or{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setStep("signIn");
                        setOtp("");
                        setError(null);
                      }}
                      className="font-medium text-electric underline-offset-4 hover:underline"
                    >
                      try another email
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
            Sign-in is protected by a one-time code sent to your email.
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
