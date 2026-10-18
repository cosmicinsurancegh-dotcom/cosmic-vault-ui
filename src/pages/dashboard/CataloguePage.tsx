import {
  Callout,
  EmptyState,
  LoadingState,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/dashboard/PlatformUI";
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
import { Media } from "@/components/site/Media";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { formatMoney } from "@/lib/format";
import { coverImage } from "@/lib/imagery";
import { normalizeRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { ArrowUpRight, Calculator, Check, Loader2, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type Product = Doc<"products">;
type AnswerValue = string | number;

export default function CataloguePage() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const profile = useQuery(api.customers.me);
  const reference = useQuery(api.setup.referenceData);
  const [country, setCountry] = useState<string>("");
  const [category, setCategory] = useState("all");
  const catalogue = useQuery(api.products.catalogue, {
    country: country || undefined,
    category,
  });
  const brokerCustomers = useQuery(
    api.brokers.myCustomers,
    role === "broker" ? {} : "skip",
  );

  const [selected, setSelected] = useState<Product | null>(null);
  const [quoteProduct, setQuoteProduct] = useState<Product | null>(null);

  const activeCountry = country || profile?.profile?.country || "GB";

  if (catalogue === undefined || reference === undefined) {
    return <LoadingState label="Loading the catalogue" />;
  }

  const countries = reference.countries;
  const categories = reference.categories.filter((item) => item.active);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Product catalogue"
        title="Cover built for a life, not a spreadsheet."
        description="Premiums are calculated from the configured product rules - never a fixed demo price. Every application is then reviewed by an underwriter."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Country"
              value={activeCountry}
              onChange={(event) => setCountry(event.target.value)}
              className="h-9 rounded-[4px] border border-line bg-card px-3 text-xs text-ink"
            >
              {countries.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-9 rounded-[4px] border border-line bg-card px-3 text-xs text-ink"
            >
              <option value="all">All categories</option>
              {categories.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {catalogue.products.length === 0 ? (
        <Panel>
          <EmptyState
            icon={ShieldCheck}
            title="No products available in this market yet"
            description="Products must be configured and published by an authorised administrator. Try another country or speak to support."
            action={
              <Button asChild variant="outline" size="sm" className="rounded-[4px]">
                <Link to="/dashboard/support">Ask support</Link>
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {catalogue.products.map((product) => (
            <article
              key={product._id}
              className="group flex flex-col overflow-hidden rounded-[1.3rem] border border-line bg-card p-5 transition-[transform,border-color,box-shadow] duration-500 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_24px_48px_-40px_rgba(8,18,39,0.5)]"
            >
              <div className="relative -mx-5 -mt-5 mb-4 overflow-hidden">
                <Media
                  image={coverImage(product.categoryKey)}
                  overlay="soft"
                  className="aspect-[16/7] w-full"
                />
                <span className="absolute left-4 top-4 rounded-[4px] border border-white/20 bg-white/12 px-2.5 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-bone backdrop-blur-md">
                  {categories.find((item) => item.key === product.categoryKey)?.name ?? product.categoryKey}
                </span>
                <span className="absolute right-4 top-4 text-[0.6rem] uppercase tracking-[0.14em] text-bone/75">
                  v{product.version}
                </span>
              </div>
              <h2 className="text-base font-semibold tracking-[-0.02em] text-ink">{product.name}</h2>
              <p className="mt-2 flex-1 text-xs leading-5 text-muted-foreground">{product.description}</p>
              <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-[0.7rem]">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Coverage limit</dt>
                  <dd className="font-medium text-ink">{formatMoney(product.coverageLimit, product.currency)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Excess</dt>
                  <dd className="font-medium text-ink">{formatMoney(product.excess, product.currency)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Indicative from</dt>
                  <dd className="font-semibold text-ink">
                    {formatMoney(product.basePremium, product.currency)} / yr
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" className="h-9 flex-1 rounded-[4px] bg-transparent" onClick={() => setSelected(product)}>
                  Details
                </Button>
                <Button size="sm" className="h-9 flex-1 rounded-[4px]" onClick={() => setQuoteProduct(product)}>
                  Get a quote
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Product details */}
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[1.5rem] border-line bg-background p-0 sm:max-w-[700px]">
          {selected && (
            <>
              <div className="border-b border-line px-6 py-5">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">
                    {selected.name}
                  </DialogTitle>
                  <DialogDescription>
                    Product {selected.code} · version {selected.version} · wording v
                    {selected.wordingVersion}
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.68rem] text-muted-foreground">
                  <span>{selected.targetCustomer}</span>
                </div>
              </div>
              <div className="space-y-5 px-6 py-5">
                <p className="text-sm leading-6 text-ink">{selected.description}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Coverage limit", formatMoney(selected.coverageLimit, selected.currency)],
                    ["Excess", formatMoney(selected.excess, selected.currency)],
                    ["Term", `${selected.termMonths} months`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-line px-3 py-3">
                      <p className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {label}
                      </p>
                      <p className="mt-1 text-sm font-medium text-ink">{value}</p>
                    </div>
                  ))}
                </div>
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Included
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {selected.benefits.map((benefit) => (
                      <li key={benefit} className="flex gap-2 text-xs leading-5 text-ink">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" /> {benefit}
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Exclusions
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {selected.exclusions.map((exclusion) => (
                      <li key={exclusion} className="text-xs leading-5 text-muted-foreground">
                        • {exclusion}
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Available in
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-ink">
                    {selected.countries
                      .map((code) => countries.find((country) => country.code === code)?.name ?? code)
                      .join(" · ")}
                  </p>
                </section>
                <Callout tone="info" title="Manual underwriting">
                  A quotation is indicative. Cover only begins once an underwriter approves the
                  application, the premium is confirmed, and a policy is issued.
                </Callout>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" className="rounded-[4px]" onClick={() => setSelected(null)}>
                    Close
                  </Button>
                  <Button
                    className="rounded-[4px]"
                    onClick={() => {
                      setQuoteProduct(selected);
                      setSelected(null);
                    }}
                  >
                    Get a quotation <ArrowUpRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {quoteProduct && (
        <QuoteDialog
          product={quoteProduct}
          open={Boolean(quoteProduct)}
          onOpenChange={(open) => !open && setQuoteProduct(null)}
          countries={countries}
          defaultCountry={activeCountry}
          broker={role === "broker"}
          brokerCustomers={(brokerCustomers ?? []).map((row) => ({
            userId: row.assignment.customerUserId,
            name: row.profile?.fullName ?? "Customer",
            country: row.profile?.country ?? "GB",
          }))}
        />
      )}
    </div>
  );
}

function QuoteDialog({
  product,
  open,
  onOpenChange,
  countries,
  defaultCountry,
  broker,
  brokerCustomers,
}: {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  countries: { code: string; name: string }[];
  defaultCountry: string;
  broker: boolean;
  brokerCustomers: { userId: string; name: string; country: string }[];
}) {
  const createQuotation = useMutation(api.quotations.create);
  const preview = useMutation(api.products.quote);
  const [country, setCountry] = useState(
    product.countries.includes(defaultCountry) ? defaultCountry : product.countries[0],
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customerUserId, setCustomerUserId] = useState(brokerCustomers[0]?.userId ?? "");
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<{
    premium: number;
    currency: string;
    factors: { label: string; selected: string; multiplier: number }[];
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const factorLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const factor of product.ratingFactors) {
      for (const option of factor.options) map.set(`${factor.key}:${option.value}`, option.label);
    }
    return map;
  }, [product.ratingFactors]);

  const setAnswer = (key: string, value: string) => {
    setAnswers((current) => ({ ...current, [key]: value }));
    setResult(null);
  };

  const payload = () => {
    const converted: Record<string, AnswerValue> = {};
    for (const question of product.questions) {
      const raw = answers[question.key];
      if (raw === undefined || raw === "") continue;
      converted[question.key] =
        question.type === "number" ? Number(raw) : raw;
    }
    return converted;
  };

  const calculate = async () => {
    setPending(true);
    try {
      const response = await preview({
        productId: product._id,
        country,
        answers: payload(),
      });
      setResult({
        premium: response.breakdown.premium,
        currency: response.breakdown.currency,
        factors: response.breakdown.factors,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not calculate a premium.");
    } finally {
      setPending(false);
    }
  };

  const save = async () => {
    setPending(true);
    try {
      if (broker && !customerUserId) throw new Error("Choose a customer.");
      if (broker && !consent) throw new Error("Record the customer's consent first.");
      const response = await createQuotation({
        productId: product._id,
        country,
        answers: payload(),
        customerUserId: broker ? (customerUserId as never) : undefined,
        consentConfirmed: broker ? consent : undefined,
      });
      setSaved(response.reference);
      toast.success("Quotation saved.", { description: response.reference });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the quotation.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[1.5rem] border-line bg-background p-0 sm:max-w-[680px]">
        <div className="border-b border-line px-5 py-5 sm:px-7">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">
              {product.name}
            </DialogTitle>
            <DialogDescription>
              Indicative pricing from the published product rules. Nothing is approved at this stage.
            </DialogDescription>
          </DialogHeader>
        </div>

        {saved ? (
          <div className="px-5 py-8 text-center sm:px-8">
            <span className="mx-auto grid size-14 place-items-center rounded-[4px] bg-primary text-primary-foreground">
              <Check className="size-6" />
            </span>
            <h3 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-ink">
              Quotation saved.
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Reference <span className="font-semibold text-ink">{saved}</span>. Continue to an
              application whenever you're ready, then upload the required documents.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Button asChild className="rounded-[4px]">
                <Link to="/dashboard/quotes">Open quotations</Link>
              </Button>
              <Button variant="outline" className="rounded-[4px]" onClick={() => onOpenChange(false)}>
                Keep browsing
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 px-5 py-5 sm:px-7">
            {broker && (
              <div className="space-y-3 rounded-xl border border-line bg-ice/40 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="quote-customer">Customer</Label>
                  {brokerCustomers.length === 0 ? (
                    <p className="text-xs text-destructive">
                      No customers are assigned to you yet. Ask an administrator to assign one.
                    </p>
                  ) : (
                    <select
                      id="quote-customer"
                      value={customerUserId}
                      onChange={(event) => setCustomerUserId(event.target.value)}
                      className="h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink"
                    >
                      {brokerCustomers.map((customer) => (
                        <option key={customer.userId} value={customer.userId}>
                          {customer.name} · {customer.country}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    className="mt-0.5 accent-[var(--primary)]"
                  />
                  The customer has asked me to prepare this quotation and I have recorded their
                  consent.
                </label>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="quote-country">Country of cover</Label>
              <select
                id="quote-country"
                value={country}
                onChange={(event) => {
                  setCountry(event.target.value);
                  setResult(null);
                }}
                className="h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink"
              >
                {product.countries.map((code) => (
                  <option key={code} value={code}>
                    {countries.find((item) => item.code === code)?.name ?? code}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {product.questions.map((question) => (
                <div
                  key={question.key}
                  className={cn("space-y-1.5", question.type === "textarea" && "sm:col-span-2")}
                >
                  <Label htmlFor={`q-${question.key}`}>
                    {question.label}
                    {question.required && <span className="text-destructive"> *</span>}
                  </Label>
                  {question.type === "select" ? (
                    <select
                      id={`q-${question.key}`}
                      value={answers[question.key] ?? ""}
                      onChange={(event) => setAnswer(question.key, event.target.value)}
                      className="h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink"
                      required={question.required}
                    >
                      <option value="">Select…</option>
                      {(question.options ?? []).map((option) => (
                        <option key={option} value={option}>
                          {factorLabels.get(`${question.key}:${option}`) ?? option}
                        </option>
                      ))}
                    </select>
                  ) : question.type === "textarea" ? (
                    <Textarea
                      id={`q-${question.key}`}
                      value={answers[question.key] ?? ""}
                      onChange={(event) => setAnswer(question.key, event.target.value)}
                      className="min-h-[84px] rounded-xl bg-card"
                      required={question.required}
                    />
                  ) : (
                    <Input
                      id={`q-${question.key}`}
                      type={question.type === "number" ? "number" : question.type === "date" ? "date" : "text"}
                      value={answers[question.key] ?? ""}
                      onChange={(event) => setAnswer(question.key, event.target.value)}
                      className="h-10 rounded-xl bg-card"
                      required={question.required}
                    />
                  )}
                  {question.help && (
                    <p className="text-[0.65rem] leading-4 text-muted-foreground">{question.help}</p>
                  )}
                </div>
              ))}
            </div>

            {result && (
              <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Indicative annual premium
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-ink">
                      {formatMoney(result.premium, result.currency)}
                    </p>
                  </div>
                  <StatusPill status="quoted" />
                </div>
                <ul className="mt-3 space-y-1">
                  {result.factors.map((factor) => (
                    <li key={factor.label} className="flex justify-between gap-2 text-[0.68rem] text-muted-foreground">
                      <span>{factor.label}: {factor.selected}</span>
                      <span className="tabular-nums">×{factor.multiplier}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[0.62rem] leading-4 text-muted-foreground">
                  Assumes a {product.termMonths}-month term. Final terms are set by an underwriter.
                </p>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
              <Button variant="outline" className="rounded-[4px]" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="outline" className="rounded-[4px]" onClick={calculate} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
                Calculate premium
              </Button>
              <Button className="rounded-[4px]" onClick={save} disabled={pending || !result}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Save quotation
              </Button>
            </div>
            {!result && (
              <p className="text-right text-[0.65rem] text-muted-foreground">
                Calculate the premium first, then save the quotation.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
