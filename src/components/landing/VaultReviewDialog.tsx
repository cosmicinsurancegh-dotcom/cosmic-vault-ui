import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { COVERAGE_ICONS, COVERAGE_OPTIONS, type CoverageKey } from "@/lib/vault";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  Hash,
  Loader2,
  ShieldCheck,
  Vault,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type VaultReviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCoverage?: CoverageKey;
};

/**
 * The marketing site's only request form. It records a vault review against the
 * same `quotes` table the platform already uses, so a request survives sign-in
 * and lands in the member's vault with a reference attached.
 */
export function VaultReviewDialog({
  open,
  onOpenChange,
  defaultCoverage = "home",
}: VaultReviewDialogProps) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const requestQuote = useMutation(api.quotes.requestQuote);

  const [coverage, setCoverage] = useState<CoverageKey>(defaultCoverage);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [declaredValue, setDeclaredValue] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const selected = COVERAGE_OPTIONS.find((option) => option.key === coverage);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    try {
      const details = [
        `Custody class: ${selected?.label ?? "Not specified"}.`,
        declaredValue.trim()
          ? `Declared value: ${declaredValue.trim()}.`
          : "Declared value: to be appraised.",
        message.trim() ? `Notes: ${message.trim()}` : "",
      ]
        .filter(Boolean)
        .join(" ");

      const result = await requestQuote({
        name,
        email,
        coverage,
        plan: selected?.label,
        message: details,
      });
      setReference(result.reference);
      toast.success("Your vault review is in.", {
        description: `Reference ${result.reference}. A vault specialist will reply by email.`,
      });
    } catch (error) {
      toast.error("We couldn't send that just yet.", {
        description:
          error instanceof Error ? error.message : "Please try again in a moment.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto rounded-[4px] border-line bg-background p-0 sm:max-w-[620px]">
        <AnimatePresence mode="wait" initial={false}>
          {reference ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="px-6 py-9 text-center sm:px-10 sm:py-12"
            >
              <div className="relative mx-auto grid size-16 place-items-center rounded-[4px] bg-primary text-primary-foreground">
                <span className="absolute inset-0 -z-10 animate-ping rounded-[4px] bg-primary/20" />
                <Check className="size-7" strokeWidth={2.4} />
              </div>
              <p className="mt-6 text-[0.66rem] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                Review requested
              </p>
              <DialogTitle className="mt-3 text-3xl font-semibold leading-[1.1] tracking-[-0.035em] text-ink sm:text-4xl">
                Your request is
                <span className="text-electric"> on the record.</span>
              </DialogTitle>
              <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
                A vault specialist will read what you have sent, confirm the
                custody class and come back with an appraisal and an indicative
                premium. Nothing is charged at this stage.
              </p>
              <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-[4px] border border-dashed border-line bg-card px-5 py-2.5 text-sm font-semibold tracking-[0.14em] text-ink">
                <Hash className="size-3.5 text-electric" />
                {reference}
              </div>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  className="h-11 w-full rounded-[4px] px-6 sm:w-auto"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(isAuthenticated ? "/dashboard" : "/auth?returnTo=%2Fdashboard");
                  }}
                >
                  {isAuthenticated ? "Open my vault" : "Create your vault"}
                  <ArrowUpRight className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  className="h-11 w-full rounded-[4px] px-6 text-muted-foreground sm:w-auto"
                  onClick={() => onOpenChange(false)}
                >
                  Done
                </Button>
              </div>
              <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5" />
                Your details stay in the vault.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader className="gap-2 border-b border-line/80 px-6 py-6 pr-12 text-left sm:px-8 sm:pr-14">
                <p className="flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-electric">
                  <Vault className="size-3.5" />
                  Vault review
                </p>
                <DialogTitle className="text-2xl font-semibold tracking-[-0.03em] text-ink sm:text-[1.75rem]">
                  Tell us what you’re storing.
                </DialogTitle>
                <DialogDescription className="text-sm leading-6">
                  We confirm the class, appraise the object, then quote custody
                  and cover together. No obligation, and no price is fixed by
                  this form.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6 sm:px-8">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Custody class
                  </Label>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {COVERAGE_OPTIONS.map((option) => {
                      const Icon = COVERAGE_ICONS[option.key];
                      const active = coverage === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setCoverage(option.key)}
                          aria-pressed={active}
                          className={cn(
                            "flex cursor-pointer items-center gap-2.5 rounded-[4px] border px-3 py-2.5 text-left text-[0.78rem] font-medium transition-all duration-300",
                            active
                              ? "border-electric bg-electric/[0.07] text-ink"
                              : "border-line bg-card text-muted-foreground hover:border-ink/25 hover:text-ink",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-7 shrink-0 place-items-center rounded-[4px] transition-colors",
                              active
                                ? "bg-primary text-primary-foreground"
                                : "bg-ink/[0.05] text-ink/60",
                            )}
                          >
                            <Icon className="size-3.5" />
                          </span>
                          {option.short}
                        </button>
                      );
                    })}
                  </div>
                  {selected && (
                    <p className="mt-2.5 text-[0.72rem] leading-5 text-muted-foreground">
                      {selected.blurb}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="review-name">Full name</Label>
                    <Input
                      id="review-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Ada Lovelace"
                      className="h-11 rounded-[4px] bg-card"
                      required
                      minLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="review-email">Email</Label>
                    <Input
                      id="review-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="ada@example.com"
                      className="h-11 rounded-[4px] bg-card"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="review-value">Declared value (optional)</Label>
                  <Input
                    id="review-value"
                    value={declaredValue}
                    onChange={(event) => setDeclaredValue(event.target.value)}
                    placeholder="e.g. £250,000 or 3 × 1 kg bars"
                    className="h-11 rounded-[4px] bg-card"
                  />
                  <p className="text-[0.68rem] leading-5 text-muted-foreground">
                    If an appraisal already exists, send the reference instead —
                    case, seals and assay cards stay with the object.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="review-message">
                    Anything else we should know? (optional)
                  </Label>
                  <Textarea
                    id="review-message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Sizes, stone counts, current storage, transit needs, timing…"
                    className="min-h-[84px] resize-none rounded-[4px] bg-card"
                  />
                </div>

                <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-electric" />
                    Reviewed by a person, never resold.
                  </p>
                  <Button
                    type="submit"
                    disabled={pending}
                    className="h-11 w-full rounded-[4px] px-6 sm:w-auto"
                  >
                    {pending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Sending request
                      </>
                    ) : (
                      <>
                        Request my review
                        <ArrowUpRight className="size-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
