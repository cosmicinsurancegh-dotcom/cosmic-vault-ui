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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import {
  COVERAGE_ICONS,
  COVERAGE_OPTIONS,
  PLANS,
  planByName,
  type CoverageKey,
} from "@/lib/vault";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type QuoteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCoverage?: CoverageKey;
  defaultPlan?: string;
};

export function QuoteDialog({
  open,
  onOpenChange,
  defaultCoverage = "health",
  defaultPlan,
}: QuoteDialogProps) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const requestQuote = useMutation(api.quotes.requestQuote);

  // The parent gives the dialog a fresh key each time it opens, so these
  // initial values are the source of truth for a new request.
  const [coverage, setCoverage] = useState<CoverageKey>(defaultCoverage);
  const [plan, setPlan] = useState(defaultPlan ?? "recommend");
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    try {
      const chosenPlan = plan === "recommend" ? undefined : plan;
      const result = await requestQuote({
        name,
        email,
        coverage,
        plan: chosenPlan,
        message: message || undefined,
        monthlyEstimate: planByName(chosenPlan)?.monthly,
      });
      setReference(result.reference);
      toast.success("Your quote request is in.", {
        description: `Reference ${result.reference}. A human advisor will be in touch within one business day.`,
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
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto rounded-[1.6rem] border-line bg-background p-0 sm:max-w-[600px]">
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
              <div className="relative mx-auto grid size-16 place-items-center rounded-full bg-primary text-primary-foreground">
                <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/20" />
                <Check className="size-7" strokeWidth={2.4} />
              </div>
              <p className="mt-6 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                Request received
              </p>
              <h3 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-ink sm:text-4xl">
                Your universe is in
                <span className="text-electric"> safe hands.</span>
              </h3>
              <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
                A named advisor will reach out within one business day with a
                tailored quote. Keep this reference for your records.
              </p>
              <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-dashed border-line bg-card px-5 py-2.5 text-sm font-semibold tracking-[0.14em] text-ink">
                <Sparkles className="size-3.5 text-electric" />
                {reference}
              </div>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                {isAuthenticated ? (
                  <Button
                    className="h-11 w-full rounded-full px-6 sm:w-auto"
                    onClick={() => {
                      onOpenChange(false);
                      navigate("/dashboard");
                    }}
                  >
                    Open my vault
                    <ArrowUpRight className="size-4" />
                  </Button>
                ) : (
                  <Button
                    className="h-11 w-full rounded-full px-6 sm:w-auto"
                    onClick={() => {
                      onOpenChange(false);
                      navigate("/auth?returnTo=%2Fdashboard");
                    }}
                  >
                    Create your vault
                    <ArrowUpRight className="size-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="h-11 w-full rounded-full px-6 text-muted-foreground sm:w-auto"
                  onClick={() => onOpenChange(false)}
                >
                  Done
                </Button>
              </div>
              <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5" />
                No obligation. No jargon. No spam.
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
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.30em] text-electric">
                  Talk to a human
                </p>
                <DialogTitle className="text-2xl font-semibold tracking-[-0.03em] text-ink sm:text-[1.75rem]">
                  Let&apos;s find your <span>perfect cover.</span>
                </DialogTitle>
                <DialogDescription className="text-sm leading-6">
                  Tell us a little about what you want to protect. An advisor
                  will shape a plan around it — usually within a day.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6 sm:px-8">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    What should we protect?
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
                          className={cn(
                            "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-all duration-300",
                            active
                              ? "border-electric bg-electric/[0.07] text-ink"
                              : "border-line bg-card text-muted-foreground hover:border-ink/25 hover:text-ink",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-7 shrink-0 place-items-center rounded-full transition-colors",
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
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="quote-name">Full name</Label>
                    <Input
                      id="quote-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Ada Lovelace"
                      className="h-11 rounded-xl bg-card"
                      required
                      minLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quote-email">Email</Label>
                    <Input
                      id="quote-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="ada@example.com"
                      className="h-11 rounded-xl bg-card"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quote-plan">Preferred plan (optional)</Label>
                  <Select value={plan} onValueChange={setPlan}>
                    <SelectTrigger
                      id="quote-plan"
                      className="h-11 w-full rounded-xl bg-card"
                    >
                      <SelectValue placeholder="Help me choose" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="recommend">
                        Help me choose — recommend a plan
                      </SelectItem>
                      {PLANS.map((option) => (
                        <SelectItem key={option.id} value={option.name}>
                          {option.name} — from £{option.monthly}/mo
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quote-message">
                    Anything we should know? (optional)
                  </Label>
                  <Textarea
                    id="quote-message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="A family of four, a listed cottage, and a very old camper van…"
                    className="min-h-[86px] resize-none rounded-xl bg-card"
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-electric" />
                    Your details stay in the vault.
                  </p>
                  <Button
                    type="submit"
                    disabled={pending}
                    className="h-11 w-full rounded-full px-6 sm:w-auto"
                  >
                    {pending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Sending request
                      </>
                    ) : (
                      <>
                        Request my quote
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
