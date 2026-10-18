import {
  Callout,
  EmptyState,
  LoadingState,
  PageHeader,
  Panel,
  StatusPill,
  TableShell,
  Td,
  Th,
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
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { formatDate, formatMoney } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import { Archive, Loader2, PackagePlus, PackageSearch, Pencil, Plus, Rocket } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Product = Doc<"products">;

type FormState = {
  productId?: string;
  code: string;
  name: string;
  categoryKey: string;
  description: string;
  targetCustomer: string;
  countries: string[];
  currency: string;
  basePremium: string;
  termMonths: string;
  excess: string;
  coverageLimit: string;
  exclusions: string;
  benefits: string;
  wordingVersion: string;
  wording: string;
  disclosures: string;
  renewalNoticeDays: string;
  cancellationNoticeDays: string;
  effectiveFrom: string;
  ratingFactors: string;
  questions: string;
  requiredDocuments: string;
};

const EMPTY: FormState = {
  code: "",
  name: "",
  categoryKey: "motor",
  description: "",
  targetCustomer: "",
  countries: ["GB"],
  currency: "GBP",
  basePremium: "",
  termMonths: "12",
  excess: "0",
  coverageLimit: "",
  exclusions: "",
  benefits: "",
  wordingVersion: "1.0",
  wording: "",
  disclosures: "",
  renewalNoticeDays: "30",
  cancellationNoticeDays: "14",
  effectiveFrom: new Date().toISOString().slice(0, 10),
  ratingFactors: JSON.stringify(
    [
      {
        key: "risk_band",
        label: "Risk band",
        options: [{ value: "standard", label: "Standard", multiplier: 1 }],
      },
    ],
    null,
    2,
  ),
  questions: JSON.stringify(
    [
      { key: "risk_band", label: "Risk band", type: "select", required: true, options: ["standard"] },
      { key: "details", label: "Additional details", type: "textarea", required: false },
    ],
    null,
    2,
  ),
  requiredDocuments: JSON.stringify(
    [{ key: "id_document", label: "Photo identification", required: true }],
    null,
    2,
  ),
};

function toForm(product: Product, asNewVersion = false): FormState {
  return {
    productId: asNewVersion ? undefined : product._id,
    code: product.code,
    name: product.name,
    categoryKey: product.categoryKey,
    description: product.description,
    targetCustomer: product.targetCustomer,
    countries: product.countries,
    currency: product.currency,
    basePremium: (product.basePremium / 100).toString(),
    termMonths: String(product.termMonths),
    excess: (product.excess / 100).toString(),
    coverageLimit: (product.coverageLimit / 100).toString(),
    exclusions: product.exclusions.join("\n"),
    benefits: product.benefits.join("\n"),
    wordingVersion: product.wordingVersion,
    wording: product.wording,
    disclosures: product.disclosures,
    renewalNoticeDays: String(product.renewalNoticeDays),
    cancellationNoticeDays: String(product.cancellationNoticeDays),
    effectiveFrom: new Date(product.effectiveFrom).toISOString().slice(0, 10),
    ratingFactors: JSON.stringify(product.ratingFactors, null, 2),
    questions: JSON.stringify(product.questions, null, 2),
    requiredDocuments: JSON.stringify(product.requiredDocuments, null, 2),
  };
}

export default function AdminProductsPage() {
  const products = useQuery(api.products.listStaff);
  const reference = useQuery(api.setup.referenceData);
  const saveDraft = useMutation(api.products.saveDraft);
  const publish = useMutation(api.products.publish);
  const archive = useMutation(api.products.archive);
  const seed = useMutation(api.setup.seedStarterCatalogue);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [pending, setPending] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null);
  const [archiveReason, setArchiveReason] = useState("");

  if (products === undefined || reference === undefined) {
    return <LoadingState label="Loading products" />;
  }

  const startNew = () => {
    setForm({ ...EMPTY, effectiveFrom: new Date().toISOString().slice(0, 10) });
    setOpen(true);
  };

  const submit = async () => {
    setPending(true);
    try {
      const parsed = {
        ratingFactors: JSON.parse(form.ratingFactors),
        questions: JSON.parse(form.questions),
        requiredDocuments: JSON.parse(form.requiredDocuments),
      };
      if (!Array.isArray(parsed.ratingFactors) || !Array.isArray(parsed.questions)) {
        throw new Error("Rating factors and questions must be JSON arrays.");
      }
      const result = await saveDraft({
        productId: form.productId ? (form.productId as never) : undefined,
        code: form.code,
        name: form.name,
        categoryKey: form.categoryKey,
        description: form.description,
        targetCustomer: form.targetCustomer,
        countries: form.countries,
        currency: form.currency,
        basePremium: Math.round(Number(form.basePremium) * 100),
        termMonths: Number(form.termMonths),
        excess: Math.round(Number(form.excess || 0) * 100),
        coverageLimit: Math.round(Number(form.coverageLimit) * 100),
        exclusions: form.exclusions.split("\n").map((row) => row.trim()).filter(Boolean),
        benefits: form.benefits.split("\n").map((row) => row.trim()).filter(Boolean),
        wordingVersion: form.wordingVersion,
        wording: form.wording,
        disclosures: form.disclosures,
        renewalNoticeDays: Number(form.renewalNoticeDays),
        cancellationNoticeDays: Number(form.cancellationNoticeDays),
        effectiveFrom: new Date(`${form.effectiveFrom}T00:00:00Z`).getTime(),
        ratingFactors: parsed.ratingFactors,
        questions: parsed.questions,
        requiredDocuments: parsed.requiredDocuments,
      });
      toast.success("Draft saved.", { description: "Publish it when the configuration is complete." });
      setForm((current) => ({ ...current, productId: result.productId }));
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof SyntaxError
          ? "One of the JSON sections is invalid."
          : error instanceof Error
            ? error.message
            : "Could not save the product.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Product management"
        title="Configure what the company sells."
        description="Drafts are versioned. Publishing archives the previous version; historical quotations and policies keep their original terms."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-10 rounded-full bg-transparent"
              onClick={async () => {
                try {
                  const result = await seed();
                  toast.success(
                    result.created ? `${result.created} starter products created.` : "Starter products already exist.",
                  );
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not seed the catalogue.");
                }
              }}
            >
              <PackagePlus className="size-4" /> Starter catalogue
            </Button>
            <Button className="h-10 rounded-full px-5" onClick={startNew}>
              <Plus className="size-4" /> New product
            </Button>
          </div>
        }
      />

      <Callout tone="info" title="Pricing is versioned and deliberate">
        Premiums are produced by the rating factors configured here. A published version cannot be
        edited in place — create a new draft to change terms, then publish when approved.
      </Callout>

      {products.length === 0 ? (
        <Panel>
          <EmptyState
            icon={PackageSearch}
            title="No products configured"
            description="Create your first product, or load the starter catalogue and adjust it."
          />
        </Panel>
      ) : (
        <Panel>
          <TableShell>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th>Version</Th>
                <Th>Base premium</Th>
                <Th>Countries</Th>
                <Th>Updated</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product._id} className="transition-colors hover:bg-primary/[0.02]">
                  <Td>
                    <p className="text-xs font-medium text-ink">{product.name}</p>
                    <p className="text-[0.62rem] text-muted-foreground">{product.code}</p>
                  </Td>
                  <Td className="capitalize">{product.categoryKey}</Td>
                  <Td>v{product.version}</Td>
                  <Td>{formatMoney(product.basePremium, product.currency)}</Td>
                  <Td>{product.countries.length}</Td>
                  <Td>{formatDate(product.updatedAt)}</Td>
                  <Td><StatusPill status={product.status} /></Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-full px-2.5"
                        onClick={() => {
                          setForm(toForm(product, product.status !== "draft"));
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                        {product.status === "draft" ? "Edit" : "New version"}
                      </Button>
                      {product.status === "draft" && (
                        <Button
                          size="sm"
                          className="h-8 rounded-full px-2.5"
                          onClick={async () => {
                            try {
                              await publish({ productId: product._id });
                              toast.success("Product published.");
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : "Could not publish.");
                            }
                          }}
                        >
                          <Rocket className="size-3.5" /> Publish
                        </Button>
                      )}
                      {product.status === "published" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 rounded-full px-2.5 text-muted-foreground"
                          onClick={() => setArchiveTarget(product)}
                        >
                          <Archive className="size-3.5" /> Archive
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Panel>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[1.5rem] border-line bg-background p-0 sm:max-w-[820px]">
          <div className="border-b border-line px-5 py-5 sm:px-7">
            <DialogHeader>
              <DialogTitle className="tracking-[-0.02em]">
                {form.productId ? "Edit draft product" : "New product draft"}
              </DialogTitle>
              <DialogDescription>
                All fields are validated on the server. A draft cannot be sold until it is published.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-4 px-5 py-5 sm:px-7">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-name">Name</Label>
                <Input id="p-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="h-9 rounded-lg bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-code">Product reference</Label>
                <Input id="p-code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} className="h-9 rounded-lg bg-card" placeholder="MOT-COMP-01" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-category">Category</Label>
                <select
                  id="p-category"
                  value={form.categoryKey}
                  onChange={(event) => setForm({ ...form, categoryKey: event.target.value })}
                  className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
                >
                  {reference.categories.map((category) => (
                    <option key={category.key} value={category.key}>{category.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-currency">Currency</Label>
                <select
                  id="p-currency"
                  value={form.currency}
                  onChange={(event) => setForm({ ...form, currency: event.target.value })}
                  className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
                >
                  {reference.currencies.filter((currency) => currency.active).map((currency) => (
                    <option key={currency.code} value={currency.code}>{currency.code}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="p-description">Description</Label>
                <Textarea id="p-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="rounded-lg bg-card text-xs" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="p-target">Target customer</Label>
                <Input id="p-target" value={form.targetCustomer} onChange={(event) => setForm({ ...form, targetCustomer: event.target.value })} className="h-9 rounded-lg bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-base">Base premium (annual, {form.currency})</Label>
                <Input id="p-base" inputMode="decimal" value={form.basePremium} onChange={(event) => setForm({ ...form, basePremium: event.target.value })} className="h-9 rounded-lg bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-coverage">Coverage limit ({form.currency})</Label>
                <Input id="p-coverage" inputMode="decimal" value={form.coverageLimit} onChange={(event) => setForm({ ...form, coverageLimit: event.target.value })} className="h-9 rounded-lg bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-excess">Excess ({form.currency})</Label>
                <Input id="p-excess" inputMode="decimal" value={form.excess} onChange={(event) => setForm({ ...form, excess: event.target.value })} className="h-9 rounded-lg bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-term">Term (months)</Label>
                <Input id="p-term" inputMode="numeric" value={form.termMonths} onChange={(event) => setForm({ ...form, termMonths: event.target.value })} className="h-9 rounded-lg bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-renewal">Renewal notice (days)</Label>
                <Input id="p-renewal" inputMode="numeric" value={form.renewalNoticeDays} onChange={(event) => setForm({ ...form, renewalNoticeDays: event.target.value })} className="h-9 rounded-lg bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-cancel">Cancellation notice (days)</Label>
                <Input id="p-cancel" inputMode="numeric" value={form.cancellationNoticeDays} onChange={(event) => setForm({ ...form, cancellationNoticeDays: event.target.value })} className="h-9 rounded-lg bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-effective">Effective from</Label>
                <Input id="p-effective" type="date" value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} className="h-9 rounded-lg bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-wording-version">Wording version</Label>
                <Input id="p-wording-version" value={form.wordingVersion} onChange={(event) => setForm({ ...form, wordingVersion: event.target.value })} className="h-9 rounded-lg bg-card" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Supported countries</Label>
              <div className="flex flex-wrap gap-2">
                {reference.countries.map((country) => {
                  const checked = form.countries.includes(country.code);
                  return (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          countries: checked
                            ? form.countries.filter((code) => code !== country.code)
                            : [...form.countries, country.code],
                        })
                      }
                      className={
                        checked
                          ? "rounded-full bg-primary px-3 py-1.5 text-[0.62rem] font-medium text-primary-foreground"
                          : "rounded-full border border-line px-3 py-1.5 text-[0.62rem] font-medium text-muted-foreground"
                      }
                    >
                      {country.code}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-benefits">Benefits (one per line)</Label>
                <Textarea id="p-benefits" value={form.benefits} onChange={(event) => setForm({ ...form, benefits: event.target.value })} className="min-h-[90px] rounded-lg bg-card text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-exclusions">Exclusions (one per line)</Label>
                <Textarea id="p-exclusions" value={form.exclusions} onChange={(event) => setForm({ ...form, exclusions: event.target.value })} className="min-h-[90px] rounded-lg bg-card text-xs" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-wording">Policy wording</Label>
              <Textarea id="p-wording" value={form.wording} onChange={(event) => setForm({ ...form, wording: event.target.value })} className="min-h-[100px] rounded-lg bg-card text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-disclosures">Disclosures</Label>
              <Textarea id="p-disclosures" value={form.disclosures} onChange={(event) => setForm({ ...form, disclosures: event.target.value })} className="min-h-[70px] rounded-lg bg-card text-xs" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-factors">Rating factors (JSON)</Label>
              <Textarea id="p-factors" value={form.ratingFactors} onChange={(event) => setForm({ ...form, ratingFactors: event.target.value })} className="min-h-[140px] rounded-lg bg-card font-mono text-[0.65rem]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-questions">Application questions (JSON)</Label>
              <Textarea id="p-questions" value={form.questions} onChange={(event) => setForm({ ...form, questions: event.target.value })} className="min-h-[140px] rounded-lg bg-card font-mono text-[0.65rem]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-docs">Required documents (JSON)</Label>
              <Textarea id="p-docs" value={form.requiredDocuments} onChange={(event) => setForm({ ...form, requiredDocuments: event.target.value })} className="min-h-[90px] rounded-lg bg-card font-mono text-[0.65rem]" />
            </div>

            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="rounded-full" disabled={pending} onClick={submit}>
                {pending && <Loader2 className="size-4 animate-spin" />} Save draft
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <DialogContent className="rounded-[1.5rem] border-line bg-background sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Archive {archiveTarget?.name}?</DialogTitle>
            <DialogDescription>
              It disappears from the customer catalogue. Existing quotations and policies retain their
              terms. Record a reason for the audit trail.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} className="rounded-xl bg-card" placeholder="Reason for archiving" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setArchiveTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              className="rounded-full"
              disabled={archiveReason.trim().length < 3}
              onClick={async () => {
                try {
                  await archive({ productId: archiveTarget!._id, reason: archiveReason });
                  toast.success("Product archived.");
                  setArchiveTarget(null);
                  setArchiveReason("");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not archive the product.");
                }
              }}
            >
              Archive product
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
