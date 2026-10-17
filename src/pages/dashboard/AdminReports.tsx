import {
  Callout,
  LoadingState,
  PageHeader,
  Panel,
  TableShell,
  Td,
  Th,
} from "@/components/dashboard/PlatformUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { downloadCsv } from "@/lib/format";
import { STAFF_PERMISSIONS, can } from "@/lib/permissions";
import { useQuery } from "convex/react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

const REPORTS = [
  { value: "customers", label: "Customer registrations" },
  { value: "policies", label: "Policies issued" },
  { value: "applications", label: "Application outcomes" },
  { value: "claims", label: "Claims by status and product" },
  { value: "premiums", label: "Premium collections" },
  { value: "outstanding", label: "Outstanding premiums" },
  { value: "refunds", label: "Refunds" },
  { value: "renewals", label: "Renewals and lapses" },
  { value: "broker_activity", label: "Broker activity & commission" },
  { value: "staff_workload", label: "Staff workloads" },
];

export default function AdminReportsPage() {
  const { user } = useAuth();
  const allowed = can(user?.role, user?.permissions, STAFF_PERMISSIONS.REPORTS_VIEW);
  const [report, setReport] = useState("policies");
  const [from, setFrom] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [productId, setProductId] = useState("");
  const [country, setCountry] = useState("all");
  const reference = useQuery(api.setup.referenceData, allowed ? {} : "skip");
  const catalogue = useQuery(api.products.catalogue, allowed ? {} : "skip");
  const args = useMemo(
    () => ({
      report,
      from: new Date(`${from}T00:00:00Z`).getTime(),
      to: new Date(`${to}T23:59:59Z`).getTime(),
      productId: productId ? (productId as never) : undefined,
      country: country === "all" ? undefined : country,
    }),
    [report, from, to, productId, country],
  );
  const result = useQuery(api.reports.generate, allowed ? args : "skip");

  if (!allowed) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Reports" title="Restricted reporting." />
        <Callout tone="warning" title="Permission required">
          Your account does not include report access. Ask a super admin to grant the
          <span className="font-medium"> reports.view </span> permission.
        </Callout>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports & analytics"
        title="Numbers that trace back to records."
        description="Every report is built from live records. Amounts are grouped by currency and never combined across currencies."
      />

      <Panel>
        <div className="grid gap-3 border-b border-line px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="report-type" className="text-[0.65rem]">Report</Label>
            <select
              id="report-type"
              value={report}
              onChange={(event) => setReport(event.target.value)}
              className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
            >
              {REPORTS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="report-from" className="text-[0.65rem]">From</Label>
              <Input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-9 rounded-lg bg-card text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-to" className="text-[0.65rem]">To</Label>
              <Input id="report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-9 rounded-lg bg-card text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="report-product" className="text-[0.65rem]">Product</Label>
              <select
                id="report-product"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
              >
                <option value="">All products</option>
                {(catalogue?.products ?? []).map((product) => (
                  <option key={product._id} value={product._id}>{product.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-country" className="text-[0.65rem]">Country</Label>
              <select
                id="report-country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
              >
                <option value="all">All countries</option>
                {(reference?.countries ?? []).map((item) => (
                  <option key={item.code} value={item.code}>{item.code}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <p className="text-[0.68rem] text-muted-foreground">
            {result ? `${result.rows.length} rows · generated ${new Date(result.generatedAt).toLocaleString()}` : "Running…"}
          </p>
          <Button
            variant="outline"
            className="h-9 rounded-full bg-transparent"
            disabled={!result || result.rows.length === 0}
            onClick={() => {
              if (!result) return;
              downloadCsv(
                `${result.report}-${from}-to-${to}.csv`,
                result.columns,
                result.rows,
              );
            }}
          >
            <Download className="size-4" /> Export CSV
          </Button>
        </div>

        {result === undefined ? (
          <LoadingState label="Building report" />
        ) : result.rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <FileSpreadsheet className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium text-ink">No rows in this period</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Widen the date range or remove a filter. Reports only include real records.
            </p>
          </div>
        ) : (
          <TableShell>
            <thead>
              <tr>
                {result.columns.map((column) => (
                  <Th key={column.key}>{column.label}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, index) => (
                <tr key={index} className="transition-colors hover:bg-primary/[0.02]">
                  {result.columns.map((column) => (
                    <Td key={column.key}>{String(row[column.key] ?? "—")}</Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>

      {result && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Panel className="p-5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Totals</h3>
            <dl className="mt-3 space-y-2">
              {Object.entries(result.totals).map(([key, value]) => (
                <div key={key} className="flex items-start justify-between gap-3 text-xs">
                  <dt className="capitalize text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</dt>
                  <dd className="text-right font-medium text-ink">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel className="p-5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Accounting basis</h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{result.basis}</p>
            <p className="mt-2 text-[0.65rem] leading-5 text-muted-foreground">
              Reporting currency: {result.currency}. Monetary totals are shown per currency and are
              never summed across currencies.
            </p>
          </Panel>
        </div>
      )}
    </div>
  );
}
