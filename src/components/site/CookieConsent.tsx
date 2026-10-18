import { Switch } from "@/components/ui/switch";
import {
  CONSENT_CATEGORIES,
  CONSENT_PROMPT_EVENT,
  readConsent,
  rememberTheme,
  writeConsent,
} from "@/lib/consent";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ChevronDown, Cookie } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { useTheme } from "next-themes";

/** How long the page is left alone before the question is asked. */
const PROMPT_DELAY_MS = 1800;

/* The card is deliberately theme-independent: it stays white with dark text in
   both light and dark mode, so the palette is pinned to the light-theme values
   (ink #0a1224, muted #5e6572, line #d4d9e1, electric #2b61eb) rather than the
   themed tokens, which invert under `.dark`. */

const primaryButton =
  "group inline-flex h-10 items-center justify-between gap-2 rounded-[4px] bg-[#2b61eb] pl-4 pr-1.5 text-[0.82rem] font-medium text-white transition-colors hover:bg-[#2454d0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2b61eb]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

const secondaryButton =
  "inline-flex h-10 items-center justify-center rounded-[4px] border border-[#d4d9e1] px-4 text-[0.82rem] font-medium text-[#33405c] transition-colors hover:border-[#a9b4c7] hover:bg-[#f4f8ff] hover:text-[#0a1224] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2b61eb]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

const categoryRow =
  "flex items-start justify-between gap-3 rounded-[0.9rem] border px-3.5 py-3";

export function CookieConsent() {
  const reduceMotion = useReducedMotion();
  const { resolvedTheme } = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const [preferences, setPreferences] = useState(
    () => readConsent()?.preferences ?? true,
  );

  useEffect(() => {
    const stored = readConsent();

    /* A considered pause rather than a banner on the first frame: the page
       settles, the reader starts, and only then does the question arrive. It
       only asks when there is no current answer on file. */
    const timer = stored
      ? null
      : window.setTimeout(() => setOpen(true), PROMPT_DELAY_MS);

    /* The footer can reopen preferences at any time, including after a choice
       has been saved, so this listener is always attached. */
    const onPrompt = () => {
      if (timer !== null) window.clearTimeout(timer);
      setManaging(true);
      setOpen(true);
      /* Opened deliberately from the footer, so move focus into the panel. */
      window.requestAnimationFrame(() => panelRef.current?.focus());
    };

    window.addEventListener(CONSENT_PROMPT_EVENT, onPrompt);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener(CONSENT_PROMPT_EVENT, onPrompt);
    };
  }, []);

  /* Escape dismisses without recording anything. With no answer on file the
     banner simply returns next visit, so nobody is opted in by accident. */
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setManaging(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const save = (allowPreferences: boolean) => {
    writeConsent(allowPreferences);
    if (allowPreferences) {
      rememberTheme(resolvedTheme === "dark" ? "dark" : "light");
    }
    setPreferences(allowPreferences);
    setOpen(false);
    setManaging(false);
    toast("Cookie preferences saved", {
      description: allowPreferences
        ? "Interface preferences are remembered. Nothing tracks you across sites."
        : "Only essential session storage is in use, and your theme will not be remembered next visit.",
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby="cookie-consent-title"
          aria-describedby="cookie-consent-description"
          tabIndex={-1}
          initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 260, damping: 28, mass: 0.8 }
          }
          className="fixed inset-x-3 bottom-3 z-[70] max-h-[calc(100svh-1.5rem)] w-auto max-w-[27.5rem] overflow-y-auto overscroll-contain rounded-[1.35rem] border border-[#d4d9e1] bg-white p-5 text-[#0a1224] shadow-[0_34px_90px_-38px_rgba(8,18,39,0.45)] outline-none focus-visible:ring-2 focus-visible:ring-[#2b61eb]/40 sm:inset-x-auto sm:bottom-5 sm:left-5 sm:w-[27.5rem] sm:p-6"
        >
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#2b61eb]/45 to-transparent"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-[radial-gradient(circle,rgba(43,97,235,0.12),transparent_68%)]"
          />

          <div className="relative flex items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-[4px] border border-[#d4d9e1] bg-[#e2f3ff] text-[#2b61eb]">
              <Cookie className="size-[1.15rem]" strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <p className="text-[0.56rem] font-semibold uppercase tracking-[0.26em] text-[#5e6572]">
                Cookies · Your choice
              </p>
              <h2
                id="cookie-consent-title"
                className="mt-2 text-[1.16rem] font-semibold leading-tight tracking-[-0.025em] text-[#0a1224]"
              >
                Your call on cookies.
              </h2>
            </div>
          </div>

          <p
            id="cookie-consent-description"
            className="relative mt-4 text-[0.82rem] leading-6 text-[#5e6572]"
          >
            One session cookie keeps you signed in; a little browser storage
            remembers your theme. There is no advertising or cross-site
            tracking here.{" "}
            <Link
              to="/legal/cookies"
              className="font-medium text-[#2b61eb] underline decoration-[#2b61eb]/35 underline-offset-2 transition-colors hover:decoration-[#2b61eb]"
            >
              Cookie policy
            </Link>
          </p>

          <AnimatePresence initial={false}>
            {managing && (
              <motion.div
                key="manage"
                initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-2 border-t border-[#e6eaf1] pt-4">
                  <div className={cn(categoryRow, "border-[#d4d9e1] bg-[#f4f8ff]")}>
                    <div>
                      <p className="text-[0.8rem] font-medium text-[#0a1224]">
                        {CONSENT_CATEGORIES.essential.label}
                      </p>
                      <p className="mt-1 text-[0.69rem] leading-5 text-[#5e6572]">
                        {CONSENT_CATEGORIES.essential.description}
                      </p>
                    </div>
                    <span className="mt-0.5 shrink-0 rounded-full border border-[#d4d9e1] px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.14em] text-[#5e6572]">
                      Always on
                    </span>
                  </div>

                  <div className={cn(categoryRow, "border-[#d4d9e1] bg-[#f4f8ff]")}>
                    <div>
                      <p className="text-[0.8rem] font-medium text-[#0a1224]">
                        {CONSENT_CATEGORIES.preferences.label}
                      </p>
                      <p className="mt-1 text-[0.69rem] leading-5 text-[#5e6572]">
                        {CONSENT_CATEGORIES.preferences.description}
                      </p>
                    </div>
                    <Switch
                      checked={preferences}
                      onCheckedChange={setPreferences}
                      aria-label="Remember interface preferences"
                      className="mt-0.5 shrink-0 data-[state=unchecked]:bg-[#cfd6e4] data-[state=checked]:bg-[#2b61eb] [&_[data-slot=switch-thumb]]:bg-white"
                    />
                  </div>

                  <div className={cn(categoryRow, "border-[#e6eaf1]")}>
                    <div>
                      <p className="text-[0.8rem] font-medium text-[#5e6572]">
                        {CONSENT_CATEGORIES.analytics.label}
                      </p>
                      <p className="mt-1 text-[0.69rem] leading-5 text-[#7a8598]">
                        {CONSENT_CATEGORIES.analytics.description}
                      </p>
                    </div>
                    <span className="mt-0.5 shrink-0 rounded-full border border-[#e6eaf1] px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.14em] text-[#7a8598]">
                      None in use
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative mt-5 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => save(false)}
              className={cn(secondaryButton, "order-2 sm:order-1")}
            >
              Essential only
            </button>
            <button
              type="button"
              onClick={() => save(managing ? preferences : true)}
              className={cn(primaryButton, "order-1 sm:order-2")}
            >
              <span>{managing ? "Save choices" : "Allow preferences"}</span>
              <span className="grid size-7 shrink-0 place-items-center rounded-[4px] bg-white/20 transition-transform duration-500 group-hover:rotate-45">
                <ArrowUpRight className="size-3.5" strokeWidth={2.2} />
              </span>
            </button>
          </div>

          <div className="relative mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setManaging((current) => !current)}
              aria-expanded={managing}
              className="inline-flex items-center gap-1.5 text-[0.72rem] font-medium text-[#5e6572] transition-colors hover:text-[#0a1224] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2b61eb]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {managing ? "Hide details" : "Manage preferences"}
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform duration-300",
                  managing && "rotate-180",
                )}
              />
            </button>
            <p className="text-[0.6rem] text-[#8a93a3]">
              Reviewed every 180 days
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
