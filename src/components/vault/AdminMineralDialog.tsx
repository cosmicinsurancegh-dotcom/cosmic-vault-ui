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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime, formatMoneyValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MINERAL_PLANS, premiumLabel, quotePlan } from "@/lib/vault/plans";
import {
  addInternalNote,
  assignPolicy,
  defaultPolicyFor,
  removePolicy,
  startShipment,
  updateMineral,
} from "@/lib/vault/store";
import {
  describeShipmentEmailOutcome,
  useShipmentStatusPublisher,
} from "@/lib/vault/useShipmentEmail";
import type {
  Mineral,
  MineralCategory,
  MineralInput,
  MineralType,
  ShippingStatus,
  VaultActor,
  WeightUnit,
} from "@/lib/vault/types";
import {
  MINERAL_CATEGORIES,
  MINERAL_TYPES,
  SHIPPING_STATUSES,
  SHIPPING_STATUS_META,
  WEIGHT_UNITS,
  formatAddress,
  formatWeight,
} from "@/lib/vault/types";
import {
  Check,
  ClipboardCopy,
  Gem,
  Loader2,
  Mail,
  MessageSquareLock,
  PackagePlus,
  ShieldCheck,
  Truck,
} from "lucide-react";
import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { MineralVisual } from "./MineralVisual";
import { ShipmentEmailPreview } from "./ShipmentEmailPreview";
import { ShipmentRouteRail } from "@/components/dashboard/ShipmentRouteRail";
import { vaultRoute } from "./vaultRoute";
import { InsuranceBadge, ShippingStatusBadge } from "./StatusBadges";

const CARRIERS = [
  "Malca-Amit",
  "Brink's Global Services",
  "Loomis International",
  "G4S Secure Solutions",
];

const CURRENCIES = ["GBP", "USD", "EUR", "CHF"];
type AdminTab = "details" | "insurance" | "shipping" | "notes";

function isoDate(ms?: number) {
  const date = new Date(ms ?? Date.now());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/* The default collection window used when an operator opens a new consignment.
   Kept out of the component body so the form's initial state does not read the
   clock during every render. */
function defaultShipmentEta() {
  return isoDate(Date.now() + 3 * 24 * 60 * 60 * 1000);
}

function dateFromInput(value: string, fallback = Date.now()) {
  if (!value) return fallback;
  const timestamp = new Date(`${value}T12:00:00`).getTime();
  return Number.isNaN(timestamp) ? fallback : timestamp;
}

function FormField({
  label,
  children,
  className,
  hint,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  hint?: string;
}) {
  const id = useId();
  /* Every form control sits under a visible label. Wiring the label to the
     control with a generated id keeps the whole dialog usable by keyboard and
     screen reader, including the shipping form with a dozen fields. */
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string }>, { id })
    : children;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-[0.62rem]">
        {label}
      </Label>
      {control}
      {hint && <p className="text-[0.55rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const inputClass = "h-9 rounded-[4px] bg-card text-xs";
const selectClass =
  "h-9 w-full rounded-[4px] border border-line bg-card px-2.5 text-xs text-ink";

function DetailsTab({
  mineral,
  actor,
}: {
  mineral: Mineral;
  actor: VaultActor;
}) {
  const [form, setForm] = useState<MineralInput>({
    name: mineral.name,
    type: mineral.type,
    category: mineral.category,
    description: mineral.description,
    weight: mineral.weight,
    unit: mineral.unit,
    dimensions: mineral.dimensions,
    purity: mineral.purity,
    grade: mineral.grade,
    estimatedValue: mineral.estimatedValue,
    currency: mineral.currency,
    photos: mineral.photos,
    notes: mineral.notes,
    storageLocation: mineral.storageLocation,
    certificateUrl: mineral.certificateUrl,
    assayReportUrl: mineral.assayReportUrl,
  });
  const [photoText, setPhotoText] = useState(mineral.photos.join("\n"));
  const [pending, setPending] = useState(false);

  const update = <K extends keyof MineralInput>(key: K, value: MineralInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Mineral name" className="sm:col-span-2">
          <Input
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField label="Type">
          <select
            value={form.type}
            onChange={(event) => update("type", event.target.value as MineralType)}
            className={selectClass}
          >
            {MINERAL_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Category">
          <select
            value={form.category}
            onChange={(event) =>
              update("category", event.target.value as MineralCategory)
            }
            className={selectClass}
          >
            {MINERAL_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Weight">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.weight}
            onChange={(event) => update("weight", Number(event.target.value))}
            className={inputClass}
          />
        </FormField>
        <FormField label="Unit">
          <select
            value={form.unit}
            onChange={(event) => update("unit", event.target.value as WeightUnit)}
            className={selectClass}
          >
            {WEIGHT_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Dimensions">
          <Input
            value={form.dimensions}
            onChange={(event) => update("dimensions", event.target.value)}
            placeholder="e.g. 115 × 52 × 9 mm"
            className={inputClass}
          />
        </FormField>
        <FormField label="Purity">
          <Input
            value={form.purity}
            onChange={(event) => update("purity", event.target.value)}
            placeholder="e.g. 999.9"
            className={inputClass}
          />
        </FormField>
        <FormField label="Grade / karat">
          <Input
            value={form.grade}
            onChange={(event) => update("grade", event.target.value)}
            placeholder="e.g. VVS1 · Excellent cut"
            className={inputClass}
          />
        </FormField>
        <FormField label="Storage location">
          <Input
            value={form.storageLocation}
            onChange={(event) => update("storageLocation", event.target.value)}
            placeholder="e.g. Vault A · Drawer 12"
            className={inputClass}
          />
        </FormField>
        <FormField label="Appraised value">
          <Input
            type="number"
            step="1"
            min="0"
            value={form.estimatedValue}
            onChange={(event) =>
              update("estimatedValue", Number(event.target.value))
            }
            className={inputClass}
          />
        </FormField>
        <FormField label="Currency">
          <select
            value={form.currency}
            onChange={(event) => update("currency", event.target.value)}
            className={selectClass}
          >
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label="Photo URLs"
          className="sm:col-span-2"
          hint="One image URL per line. The first image is used on the card."
        >
          <Textarea
            value={photoText}
            onChange={(event) => {
              setPhotoText(event.target.value);
              update(
                "photos",
                event.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean),
              );
            }}
            className="min-h-[78px] rounded-xl bg-card font-mono text-[0.62rem]"
          />
        </FormField>
        <FormField label="Description" className="sm:col-span-2">
          <Textarea
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            className="min-h-[80px] rounded-xl bg-card text-xs"
          />
        </FormField>
        <FormField label="Client-visible notes" className="sm:col-span-2">
          <Textarea
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            className="min-h-[70px] rounded-xl bg-card text-xs"
          />
        </FormField>
        <FormField label="Certificate URL">
          <Input
            value={form.certificateUrl ?? ""}
            onChange={(event) => update("certificateUrl", event.target.value)}
            placeholder="Optional document link"
            className={inputClass}
          />
        </FormField>
        <FormField label="Assay report URL">
          <Input
            value={form.assayReportUrl ?? ""}
            onChange={(event) => update("assayReportUrl", event.target.value)}
            placeholder="Optional report link"
            className={inputClass}
          />
        </FormField>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-[0.58rem] text-muted-foreground">
          Editing updates the client record immediately and records an internal audit
          entry.
        </p>
        <Button
          size="sm"
          className="h-9 rounded-[4px] px-4"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              updateMineral(actor, mineral.id, form);
              toast.success("Mineral record updated.");
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Could not update the record.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          Save mineral record
        </Button>
      </div>
    </div>
  );
}

function InsuranceTab({
  mineral,
  actor,
}: {
  mineral: Mineral;
  actor: VaultActor;
}) {
  const policy = mineral.insurancePolicy;
  const [planId, setPlanId] = useState(policy?.planId ?? MINERAL_PLANS[0].id);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const selectedPlan =
    MINERAL_PLANS.find((plan) => plan.id === planId) ?? MINERAL_PLANS[0];
  const quote = quotePlan(selectedPlan, mineral.estimatedValue);

  return (
    <div className="space-y-5">
      {policy ? (
        <div className="rounded-[4px] border border-line bg-ice/25 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[0.54rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Current policy
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">{policy.name}</p>
              <p className="mt-0.5 text-[0.62rem] text-muted-foreground">
                {policy.policyNumber} · {policy.planType}
              </p>
            </div>
            <InsuranceBadge mineral={mineral} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line/70 pt-3 sm:grid-cols-4">
            {[
              ["Coverage", formatMoneyValue(policy.coverageAmount, policy.currency)],
              [
                "Premium",
                `${formatMoneyValue(policy.premium, policy.currency)} ${premiumLabel(policy)}`,
              ],
              ["Deductible", formatMoneyValue(policy.deductible, policy.currency)],
              ["Term", `${formatDate(policy.startDate)} – ${formatDate(policy.endDate)}`],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 text-[0.68rem] font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-col gap-2 border-t border-line/70 pt-3 sm:flex-row">
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason for removing cover (optional)"
              className="h-8 flex-1 rounded-[4px] bg-card text-[0.65rem]"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 rounded-[4px] bg-transparent text-[0.62rem]"
              onClick={() => {
                try {
                  removePolicy(actor, mineral.id, reason);
                  toast.success("Policy removed from the mineral.");
                  setReason("");
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Could not remove the policy.",
                  );
                }
              }}
            >
              Remove cover
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-[4px] border border-amber-500/30 bg-amber-500/[0.06] p-4">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-xs font-semibold text-ink">This mineral is uninsured.</p>
            <p className="mt-1 text-[0.65rem] leading-5 text-muted-foreground">
              Choose a recommended plan and bind it to this record. The client will see
              the policy immediately.
            </p>
          </div>
        </div>
      )}

      <div>
        <p className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {policy ? "Replace with a recommended plan" : "Recommended plans"}
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {MINERAL_PLANS.map((plan) => {
            const planQuote = quotePlan(plan, mineral.estimatedValue);
            const selected = plan.id === planId;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setPlanId(plan.id)}
                className={cn(
                  "rounded-[4px] border p-3 text-left transition-colors",
                  selected
                    ? "border-primary/45 bg-primary/[0.04]"
                    : "border-line bg-card hover:border-primary/25",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[0.68rem] font-semibold text-ink">{plan.name}</p>
                  <span
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded-full border",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-line text-transparent",
                    )}
                  >
                    <Check className="size-2.5" strokeWidth={3} />
                  </span>
                </div>
                <p className="mt-1.5 text-[0.58rem] text-muted-foreground">
                  {formatMoneyValue(planQuote.coverageAmount, mineral.currency)} cover
                </p>
                <p className="mt-0.5 text-[0.62rem] font-semibold text-ink">
                  {formatMoneyValue(planQuote.premium, mineral.currency)}
                  <span className="text-[0.52rem] font-normal text-muted-foreground">
                    {" "}
                    / yr
                  </span>
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[4px] border border-line bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-ink">{selectedPlan.name}</p>
            <p className="mt-1 max-w-md text-[0.64rem] leading-5 text-muted-foreground">
              {selectedPlan.blurb}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
              Agreed cover
            </p>
            <p className="mt-0.5 text-[0.78rem] font-semibold text-ink">
              {formatMoneyValue(quote.coverageAmount, mineral.currency)}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-3">
          <p className="text-[0.58rem] text-muted-foreground">
            Deductible {formatMoneyValue(quote.deductible, mineral.currency)} · 12 month
            term · starts today
          </p>
          <Button
            size="sm"
            className="h-8 rounded-[4px] px-3 text-[0.62rem]"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                assignPolicy(
                  actor,
                  mineral.id,
                  defaultPolicyFor(mineral, selectedPlan.id),
                );
                toast.success(
                  policy ? "Policy replaced." : "Policy bound to the mineral.",
                );
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Could not bind the policy.",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            {policy ? "Replace policy" : "Bind policy"}
          </Button>
        </div>
      </div>

      <div className="rounded-[4px] border border-line bg-ice/20 p-4">
        <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Policy history
        </p>
        {policy ? (
          <ul className="mt-2 space-y-2.5">
            {[...policy.statusHistory].reverse().map((event, index) => (
              <li key={`${event.at}-${index}`} className="text-[0.64rem] leading-5">
                <span className="text-muted-foreground">
                  {formatDateTime(event.at)} · {event.actor}
                </span>
                <p className="text-ink">{event.note}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[0.64rem] text-muted-foreground">
            No policy changes yet.
          </p>
        )}
      </div>
    </div>
  );
}

function ShippingTab({
  mineral,
  actor,
}: {
  mineral: Mineral;
  actor: VaultActor;
}) {
  const shipment = mineral.shipping;
  const [form, setForm] = useState(() => ({
    trackingNumber: "",
    carrier: CARRIERS[0],
    service: "Secure road · signed delivery",
    name: mineral.ownerName,
    line1: "",
    city: "",
    postcode: "",
    country: "United Kingdom",
    estimatedDelivery: defaultShipmentEta(),
    initialStatus: "pending" as "pending" | "in_progress",
    note: "",
  }));
  const [status, setStatus] = useState<ShippingStatus>(
    shipment?.currentStatus ?? "pending",
  );
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const publishStatus = useShipmentStatusPublisher(actor);

  if (shipment) {
    const route = vaultRoute(shipment);
    return (
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[4px] border border-line bg-card p-3.5">
            <p className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
              Tracking
            </p>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(shipment.trackingNumber);
                toast.success("Tracking number copied.");
              }}
              className="mt-1 flex w-full items-center justify-between gap-1 text-left text-[0.68rem] font-semibold text-ink hover:text-primary"
            >
              <span className="truncate">{shipment.trackingNumber}</span>
              <ClipboardCopy className="size-3 text-muted-foreground" />
            </button>
          </div>
          <div className="rounded-[4px] border border-line bg-card p-3.5">
            <p className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
              Carrier
            </p>
            <p className="mt-1 truncate text-[0.68rem] font-semibold text-ink">
              {shipment.carrier}
            </p>
            <p className="mt-0.5 text-[0.55rem] text-muted-foreground">
              {shipment.service}
            </p>
          </div>
          <div className="rounded-[4px] border border-line bg-card p-3.5">
            <p className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
              ETA
            </p>
            <p className="mt-1 text-[0.68rem] font-semibold text-ink">
              {formatDate(shipment.estimatedDelivery)}
            </p>
          </div>
          <div className="rounded-[4px] border border-line bg-card p-3.5">
            <p className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
              Status
            </p>
            <div className="mt-1">
              <ShippingStatusBadge status={shipment.currentStatus} long />
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[4px] border border-line bg-card p-4">
            <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Live journey
            </p>
            <ShipmentRouteRail
              shipment={route.shipment}
              events={route.events}
              className="mt-4"
            />
          </div>
          <div className="space-y-3">
            <div className="rounded-[4px] border border-line bg-ice/20 p-4">
              <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Route
              </p>
              <p className="mt-2 text-[0.62rem] font-semibold text-ink">Origin</p>
              <p className="text-[0.6rem] leading-5 text-muted-foreground">
                {formatAddress(shipment.origin)}
              </p>
              <p className="mt-3 text-[0.62rem] font-semibold text-ink">Destination</p>
              <p className="text-[0.6rem] leading-5 text-muted-foreground">
                {formatAddress(shipment.destination)}
              </p>
            </div>

            <div className="rounded-[4px] border border-line bg-card p-4">
              <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Update tracking status
              </p>
              <div className="mt-2 space-y-2">
                <select
                  aria-label="New tracking status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as ShippingStatus)
                  }
                  className={selectClass}
                >
                  {SHIPPING_STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {SHIPPING_STATUS_META[item].longLabel}
                    </option>
                  ))}
                </select>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Short update shown to the member under the new step"
                  className="min-h-[64px] rounded-xl bg-card text-[0.68rem]"
                />
                <Button
                  size="sm"
                  className="h-8 w-full rounded-[4px] text-[0.62rem]"
                  disabled={pending || status === shipment.currentStatus}
                  onClick={async () => {
                    setPending(true);
                    const message = `Tracking updated to ${
                      SHIPPING_STATUS_META[status].label
                    }.`;
                    try {
                      const outcome = await publishStatus(mineral, status, note);
                      const description = describeShipmentEmailOutcome(outcome);
                      if (outcome.kind === "sent" || outcome.kind === "demo") {
                        toast.success(message, { description });
                      } else {
                        toast.warning(message, { description });
                      }
                      setNote("");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Could not update tracking.",
                      );
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  {pending && <Loader2 className="size-3.5 animate-spin" />}
                  Publish status update
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-full rounded-[4px] bg-transparent text-[0.6rem]"
                  onClick={() => setEmailOpen(true)}
                >
                  <Mail className="size-3" />
                  Preview the member email
                </Button>
              </div>
              <p className="mt-2 text-[0.55rem] leading-4 text-muted-foreground">
                The member sees this update immediately, and the email carries the
                same timeline, timestamp and note.
              </p>
            </div>
          </div>
        </div>
        <ShipmentEmailPreview
          mineral={mineral}
          status={shipment.currentStatus}
          note={
            shipment.statusHistory[shipment.statusHistory.length - 1]?.note ?? ""
          }
          open={emailOpen}
          onOpenChange={setEmailOpen}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-[4px] border border-line bg-ice/20 p-4">
        <PackagePlus className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <p className="text-xs font-semibold text-ink">Initiate a shipment</p>
          <p className="mt-1 text-[0.65rem] leading-5 text-muted-foreground">
            The consignment starts in Pending or In Progress. Every later status change
            is timestamped and shown to the member.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Carrier">
          <select
            value={form.carrier}
            onChange={(event) =>
              setForm((current) => ({ ...current, carrier: event.target.value }))
            }
            className={selectClass}
          >
            {CARRIERS.map((carrier) => (
              <option key={carrier} value={carrier}>
                {carrier}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Service">
          <Input
            value={form.service}
            onChange={(event) =>
              setForm((current) => ({ ...current, service: event.target.value }))
            }
            className={inputClass}
          />
        </FormField>
        <FormField label="Tracking number">
          <Input
            value={form.trackingNumber}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                trackingNumber: event.target.value,
              }))
            }
            placeholder="e.g. CVX-8842-1190-GB"
            className={inputClass}
          />
        </FormField>
        <FormField label="Estimated delivery">
          <Input
            type="date"
            value={form.estimatedDelivery}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                estimatedDelivery: event.target.value,
              }))
            }
            className={inputClass}
          />
        </FormField>
        <FormField label="Recipient name">
          <Input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            className={inputClass}
          />
        </FormField>
        <FormField label="Country">
          <Input
            value={form.country}
            onChange={(event) =>
              setForm((current) => ({ ...current, country: event.target.value }))
            }
            className={inputClass}
          />
        </FormField>
        <FormField label="Address line" className="sm:col-span-2">
          <Input
            value={form.line1}
            onChange={(event) =>
              setForm((current) => ({ ...current, line1: event.target.value }))
            }
            placeholder="Street and number"
            className={inputClass}
          />
        </FormField>
        <FormField label="City">
          <Input
            value={form.city}
            onChange={(event) =>
              setForm((current) => ({ ...current, city: event.target.value }))
            }
            className={inputClass}
          />
        </FormField>
        <FormField label="Postcode">
          <Input
            value={form.postcode}
            onChange={(event) =>
              setForm((current) => ({ ...current, postcode: event.target.value }))
            }
            className={inputClass}
          />
        </FormField>
        <FormField label="Initial status">
          <select
            value={form.initialStatus}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                initialStatus: event.target.value as "pending" | "in_progress",
              }))
            }
            className={selectClass}
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
          </select>
        </FormField>
        <FormField label="First update note" className="sm:col-span-2">
          <Textarea
            value={form.note}
            onChange={(event) =>
              setForm((current) => ({ ...current, note: event.target.value }))
            }
            placeholder="What is happening at the packing bench?"
            className="min-h-[64px] rounded-xl bg-card text-xs"
          />
        </FormField>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-[0.58rem] text-muted-foreground">
          Origin is always the Cosmic Vault Depository, London.
        </p>
        <Button
          size="sm"
          className="h-9 rounded-[4px] px-4"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              startShipment(actor, mineral.id, {
                trackingNumber: form.trackingNumber,
                carrier: form.carrier,
                service: form.service,
                destination: {
                  name: form.name,
                  line1: form.line1,
                  city: form.city,
                  postcode: form.postcode,
                  country: form.country,
                },
                estimatedDelivery: dateFromInput(form.estimatedDelivery),
                initialStatus: form.initialStatus,
                note: form.note,
              });
              toast.success("Shipment initiated and published to the member.");
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not start the shipment.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          <Truck className="size-3.5" />
          Start shipment
        </Button>
      </div>
    </div>
  );
}

function NotesTab({
  mineral,
  actor,
}: {
  mineral: Mineral;
  actor: VaultActor;
}) {
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-[4px] border border-amber-500/30 bg-amber-500/[0.05] p-4">
        <MessageSquareLock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="text-xs font-semibold text-ink">Internal notes</p>
          <p className="mt-1 text-[0.65rem] leading-5 text-muted-foreground">
            These notes are never returned to the member. Use them for operational
            context, carrier instructions and underwriting observations.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-[0.62rem]">Add a note</Label>
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="What should the next person on this record know?"
          className="min-h-[90px] rounded-xl bg-card text-xs"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            className="h-8 rounded-[4px] px-3 text-[0.62rem]"
            disabled={pending || body.trim().length < 3}
            onClick={async () => {
              setPending(true);
              try {
                addInternalNote(actor, mineral.id, body);
                toast.success("Internal note added.");
                setBody("");
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Could not add the note.",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Save internal note
          </Button>
        </div>
      </div>

      <div>
        <p className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Note history
        </p>
        {mineral.internalNotes.length === 0 ? (
          <p className="mt-2 rounded-[4px] border border-dashed border-line px-4 py-6 text-center text-[0.65rem] text-muted-foreground">
            No internal notes on this record.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {mineral.internalNotes.map((note) => (
              <li key={note.id} className="rounded-[4px] border border-line bg-card p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[0.66rem] font-semibold text-ink">{note.author}</p>
                  <p className="text-[0.55rem] text-muted-foreground">
                    {formatDateTime(note.createdAt)}
                  </p>
                </div>
                <p className="mt-1 text-[0.65rem] leading-5 text-muted-foreground">
                  {note.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function AdminMineralDialog({
  mineral,
  actor,
  open,
  onOpenChange,
  initialTab = "details",
}: {
  mineral: Mineral;
  actor: VaultActor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: AdminTab;
}) {
  const [tab, setTab] = useState<AdminTab>(initialTab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94dvh] overflow-y-auto rounded-[4px] border-line bg-background p-0 sm:max-w-[980px]">
        <div className="border-b border-line p-4 pr-12 sm:p-5 sm:pr-14">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <MineralVisual
                mineral={mineral}
                className="aspect-square size-16 shrink-0 rounded-[4px]"
                overlay={false}
              />
              <div className="min-w-0">
                <DialogHeader className="text-left">
                  <p className="text-[0.52rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Record control · {mineral.vaultId}
                  </p>
                  <DialogTitle className="mt-1 truncate text-[1.15rem] font-semibold tracking-[-0.03em] text-ink">
                    {mineral.name}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-[0.62rem] text-muted-foreground">
                    {mineral.ownerName} · {mineral.ownerEmail} · {mineral.ownerReference}
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <InsuranceBadge mineral={mineral} />
                  {mineral.shipping && (
                    <ShippingStatusBadge status={mineral.shipping.currentStatus} />
                  )}
                  <span className="rounded-[4px] border border-line bg-ice/50 px-2 py-0.5 text-[0.58rem] font-semibold text-muted-foreground">
                    {formatWeight(mineral.weight, mineral.unit)}
                  </span>
                  <span className="rounded-[4px] border border-line bg-ice/50 px-2 py-0.5 text-[0.58rem] font-semibold text-muted-foreground">
                    {mineral.storageLocation}
                  </span>
                </div>
              </div>
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <p className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
                Appraised
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-ink">
                {formatMoneyValue(mineral.estimatedValue, mineral.currency)}
              </p>
              <p className="mt-0.5 text-[0.55rem] text-muted-foreground">
                Updated {formatDate(mineral.valuationUpdatedAt)}
              </p>
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as AdminTab)}>
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-line bg-transparent p-0 px-4 sm:px-5">
            {[
              { value: "details", label: "Mineral", icon: Gem },
              { value: "insurance", label: "Insurance", icon: ShieldCheck },
              { value: "shipping", label: "Shipping", icon: Truck },
              {
                value: "notes",
                label: `Notes${mineral.internalNotes.length ? ` (${mineral.internalNotes.length})` : ""}`,
                icon: MessageSquareLock,
              },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="relative shrink-0 rounded-none border-b-2 border-transparent px-3 py-3 text-[0.65rem] font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-ink data-[state=active]:shadow-none"
              >
                <Icon className="size-3.5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="px-4 py-5 sm:px-5">
            <TabsContent value="details" className="mt-0">
              <DetailsTab mineral={mineral} actor={actor} />
            </TabsContent>
            <TabsContent value="insurance" className="mt-0">
              <InsuranceTab mineral={mineral} actor={actor} />
            </TabsContent>
            <TabsContent value="shipping" className="mt-0">
              {/* A new consignment changes the tab from its start form to its
                  live controls. Remounting on that transition keeps the status
                  picker in step without a setState-in-effect loop. */}
              <ShippingTab
                key={mineral.shipping?.currentStatus ?? "no-shipment"}
                mineral={mineral}
                actor={actor}
              />
            </TabsContent>
            <TabsContent value="notes" className="mt-0">
              <NotesTab mineral={mineral} actor={actor} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
