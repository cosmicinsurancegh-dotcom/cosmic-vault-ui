import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatMoneyValue } from "@/lib/format";
import { MINERAL_PLANS, quotePlan, type MineralPlan } from "@/lib/vault/plans";
import { fileClaim, requestInsurance } from "@/lib/vault/store";
import type { Mineral, VaultActor } from "@/lib/vault/types";
import { cn } from "@/lib/utils";
import {
  BadgeCheck,
  Check,
  ChevronRight,
  FileWarning,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export function PlanMiniCard({
  plan,
  mineral,
  selected,
  onSelect,
  compact = false,
}: {
  plan: MineralPlan;
  mineral: Mineral;
  selected?: boolean;
  onSelect?: () => void;
  compact?: boolean;
}) {
  const quote = quotePlan(plan, mineral.estimatedValue);
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.72rem] font-semibold text-ink">{plan.name}</p>
          <p className="mt-0.5 text-[0.55rem] uppercase tracking-[0.12em] text-muted-foreground">
            {plan.planType}
          </p>
        </div>
        <span
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-line bg-card text-transparent",
          )}
        >
          <Check className="size-3" strokeWidth={2.5} />
        </span>
      </div>
      {!compact && (
        <p className="mt-2 text-[0.68rem] leading-5 text-muted-foreground">
          {plan.blurb}
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line/70 pt-2.5">
        <div>
          <p className="text-[0.5rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Cover
          </p>
          <p className="mt-0.5 text-[0.68rem] font-semibold text-ink">
            {formatMoneyValue(quote.coverageAmount, mineral.currency)}
          </p>
        </div>
        <div>
          <p className="text-[0.5rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Premium / yr
          </p>
          <p className="mt-0.5 text-[0.68rem] font-semibold text-ink">
            {formatMoneyValue(quote.premium, mineral.currency)}
          </p>
        </div>
      </div>
    </>
  );

  if (!onSelect) {
    return (
      <div className="rounded-[4px] border border-line bg-card p-3.5">{content}</div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-[4px] border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        selected
          ? "border-primary/45 bg-primary/[0.04]"
          : "border-line bg-card hover:border-primary/25",
      )}
    >
      {content}
    </button>
  );
}

export function InsuranceRequestDialog({
  mineral,
  actor,
  open,
  onOpenChange,
  initialPlanId,
}: {
  mineral: Mineral;
  actor: VaultActor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPlanId?: string;
}) {
  const [planId, setPlanId] = useState(initialPlanId ?? MINERAL_PLANS[0].id);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const plan = MINERAL_PLANS.find((item) => item.id === planId) ?? MINERAL_PLANS[0];
  const quote = useMemo(
    () => quotePlan(plan, mineral.estimatedValue),
    [mineral.estimatedValue, plan],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="text-lg tracking-[-0.03em]">
            Add insurance to {mineral.name}
          </DialogTitle>
          <DialogDescription>
            Choose a recommended policy. Vault operations review every request and
            confirm the final terms before cover begins.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1 grid gap-2 sm:grid-cols-3">
          {MINERAL_PLANS.map((item) => (
            <PlanMiniCard
              key={item.id}
              plan={item}
              mineral={mineral}
              selected={item.id === planId}
              onSelect={() => setPlanId(item.id)}
              compact
            />
          ))}
        </div>

        <div className="rounded-[4px] border border-line bg-ice/30 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">{plan.name}</p>
              <p className="mt-1 max-w-md text-[0.68rem] leading-5 text-muted-foreground">
                {plan.blurb}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Estimated premium
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums text-ink">
                {formatMoneyValue(quote.premium, mineral.currency)}
                <span className="ml-1 text-[0.6rem] font-medium text-muted-foreground">
                  / yr
                </span>
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line/70 pt-3 sm:grid-cols-3">
            <div>
              <p className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
                Agreed cover
              </p>
              <p className="mt-0.5 text-xs font-semibold text-ink">
                {formatMoneyValue(quote.coverageAmount, mineral.currency)}
              </p>
            </div>
            <div>
              <p className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
                Deductible
              </p>
              <p className="mt-0.5 text-xs font-semibold text-ink">
                {formatMoneyValue(quote.deductible, mineral.currency)}
              </p>
            </div>
            <div>
              <p className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
                Term
              </p>
              <p className="mt-0.5 text-xs font-semibold text-ink">12 months</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="insurance-note">Anything we should know?</Label>
          <Textarea
            id="insurance-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional. For example, a planned shipment, a recent appraisal, or a question about cover."
            className="min-h-[88px] rounded-xl bg-card text-xs"
          />
        </div>

        <p className="flex items-start gap-2 text-[0.65rem] leading-5 text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
          Submitting a request does not bind cover. The mineral stays uninsured until
          an underwriter confirms the policy, and you will see the active policy on
          this record.
        </p>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="rounded-[4px] bg-transparent"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="rounded-[4px]"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                requestInsurance(actor, mineral.id, { planId, note });
                toast.success("Insurance request sent to underwriting.");
                onOpenChange(false);
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Could not send the request.",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <BadgeCheck className="size-3.5" />}
            Request this policy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const CLAIM_REASONS = [
  "Damage in storage",
  "Transit loss or damage",
  "Theft or attempted theft",
  "Valuation dispute",
  "Other",
] as const;

export function ClaimDialog({
  mineral,
  actor,
  open,
  onOpenChange,
}: {
  mineral: Mineral;
  actor: VaultActor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState<string>(CLAIM_REASONS[0]);
  const [reference, setReference] = useState("");
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const policy = mineral.insurancePolicy;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="text-lg tracking-[-0.03em]">
            File a claim
          </DialogTitle>
          <DialogDescription>
            {policy
              ? `${policy.name} · ${policy.policyNumber}. A claims handler will review the report before any decision is made.`
              : "This mineral is not insured. Add cover before filing a claim."}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-[4px] border border-line bg-ice/30 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Insured mineral
              </p>
              <p className="mt-1 text-xs font-semibold text-ink">{mineral.name}</p>
              <p className="mt-0.5 text-[0.62rem] text-muted-foreground">
                {mineral.vaultId} · {mineral.storageLocation}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Coverage
              </p>
              <p className="mt-1 text-xs font-semibold text-ink">
                {policy
                  ? formatMoneyValue(policy.coverageAmount, policy.currency)
                  : "Not insured"}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>What happened?</Label>
          <div className="flex flex-wrap gap-1.5">
            {CLAIM_REASONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setReason(option)}
                className={cn(
                  "rounded-[4px] border px-3 py-1.5 text-[0.65rem] font-medium transition-colors",
                  reason === option
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-line bg-card text-muted-foreground hover:border-primary/30 hover:text-ink",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="claim-reference">
            Related reference <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="claim-reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Tracking number, appraisal reference or service ticket"
            className="h-9 rounded-[4px] bg-card text-xs"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="claim-details">Tell us what happened</Label>
          <Textarea
            id="claim-details"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Include dates, what you observed, and any steps already taken. You can add documents after the report is acknowledged."
            className="min-h-[112px] rounded-xl bg-card text-xs"
          />
          <p className="text-[0.6rem] text-muted-foreground">
            {details.trim().length}/10 characters minimum
          </p>
        </div>

        {!policy && (
          <p className="flex items-start gap-2 rounded-[4px] border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-[0.65rem] leading-5 text-muted-foreground">
            <FileWarning className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            Claims can only be filed against an active policy. Add insurance first, then
            return to this record.
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="rounded-[4px] bg-transparent"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="rounded-[4px]"
            disabled={pending || !policy || details.trim().length < 10}
            onClick={async () => {
              setPending(true);
              try {
                fileClaim(actor, mineral.id, {
                  reason:
                    reason +
                    (reference.trim() ? ` · Reference ${reference.trim()}` : ""),
                  details,
                });
                toast.success("Claim submitted. A claims handler will review it.");
                setDetails("");
                setReference("");
                onOpenChange(false);
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Could not submit the claim.",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronRight className="size-3.5" />}
            Submit claim report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
