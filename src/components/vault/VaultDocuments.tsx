import { BrandMark } from "@/components/site/Brand";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { VaultDocumentRecord } from "@/lib/vault/documentRecord";
import { downloadPdfDocument } from "@/lib/pdf";
import { BadgeCheck, Download, Fingerprint } from "lucide-react";
import { toast } from "sonner";

export type VaultDocumentKind = "certificate" | "assay";

function assayNumber(record: VaultDocumentRecord) {
  const source = record.certificateNumber ?? record.reference;
  return `ASSAY-${source.split("-").slice(-2).join("-")}`;
}

function certificateFields(record: VaultDocumentRecord): [string, string][] {
  const fields: ([string, string] | null)[] = [
    ["Weight", record.quantity],
    record.dimensions ? ["Dimensions", record.dimensions] : null,
    record.purity ? ["Purity", record.purity] : null,
    record.grade ? ["Grade", record.grade] : null,
    record.storageLocation ? ["Storage", record.storageLocation] : null,
    record.depositedAt ? ["Deposited", record.depositedAt] : null,
    ["Appraised value", record.value],
    record.appraisedAt ? ["Appraisal refreshed", record.appraisedAt] : null,
    ["Record status", record.insured ? "Insured" : "Uninsured"],
  ];
  return fields.filter((field): field is [string, string] => field !== null);
}

function assayRows(record: VaultDocumentRecord): [string, string, string][] {
  const purityAndGrade = [record.purity, record.grade].filter(Boolean).join(" · ");
  const rows: ([string, string, string] | null)[] = [
    ["Total weight", "Calibrated balance", record.quantity],
    record.dimensions
      ? ["Dimensions", "Digital calliper", record.dimensions]
      : null,
    purityAndGrade
      ? ["Purity / grade", "XRF and visual", purityAndGrade]
      : null,
    ["Appraised value", "Market comparison", record.value],
    ["Parcel seal", "Serial verification", "Intact · matched to record"],
  ];
  return rows.filter((row): row is [string, string, string] => row !== null);
}

function summaryLines(record: VaultDocumentRecord) {
  return [
    `Record: ${record.reference}`,
    ...(record.certificateNumber
      ? [`Certificate: ${record.certificateNumber}`]
      : []),
    ...(record.ownerName
      ? [
          `Owner: ${record.ownerName}${
            record.ownerReference ? ` (${record.ownerReference})` : ""
          }`,
        ]
      : []),
    ...(record.ownerEmail ? [`Owner email: ${record.ownerEmail}`] : []),
    `Object: ${record.name}`,
    `Category: ${record.category}`,
    `Weight: ${record.quantity}`,
    ...(record.dimensions ? [`Dimensions: ${record.dimensions}`] : []),
    ...(record.purity ? [`Purity: ${record.purity}`] : []),
    ...(record.grade ? [`Grade: ${record.grade}`] : []),
    `Appraised value: ${record.value}`,
    ...(record.storageLocation
      ? [`Vault location: ${record.storageLocation}`]
      : []),
    ...(record.depositedAt ? [`Deposited: ${record.depositedAt}`] : []),
    ...(record.appraisedAt
      ? [`Appraisal refreshed: ${record.appraisedAt}`]
      : []),
    "",
    record.isDemo
      ? "Demonstration document. Not a real certificate or assay."
      : "Record generated from the live vault ledger.",
  ];
}

function DownloadSummary({
  record,
  kind,
}: {
  record: VaultDocumentRecord;
  kind: VaultDocumentKind;
}) {
  return (
    <Button
      variant="outline"
      className="h-9 rounded-[4px] bg-transparent text-xs"
      onClick={() => {
        downloadPdfDocument({
          filename: `${record.reference}-${kind === "certificate" ? "certificate" : "assay"}.pdf`,
          title:
            kind === "certificate"
              ? "Certificate of Authenticity"
              : "Assay & Appraisal Report",
          subtitle: [record.name, record.certificateNumber]
            .filter(Boolean)
            .join(" · "),
          lines: summaryLines(record),
        });
        toast.success("Document summary downloaded as a PDF.");
      }}
    >
      <Download className="size-3.5" />
      Download summary
    </Button>
  );
}

export function VaultDocumentDialog({
  record,
  kind,
  open,
  onOpenChange,
}: {
  record: VaultDocumentRecord;
  kind: VaultDocumentKind | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!kind) return null;
  const isCertificate = kind === "certificate";
  const number = isCertificate ? record.certificateNumber : assayNumber(record);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background p-0 sm:max-w-[760px]">
        <div className="starfield relative overflow-hidden bg-[#071227] px-6 py-6 text-bone sm:px-8">
          <span className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.4),transparent_66%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <BrandMark className="size-8" />
              <div>
                <p className="text-sm font-semibold tracking-[-0.02em]">Cosmic Vault</p>
                <p className="text-[0.55rem] uppercase tracking-[0.22em] text-bone/45">
                  Depository · London
                </p>
              </div>
            </div>
            <span className="rounded-[4px] border border-white/15 bg-white/[0.05] px-2.5 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-bone/65">
              {isCertificate ? "Certificate of authenticity" : "Assay & appraisal"}
            </span>
          </div>
          <div className="relative mt-8">
            <DialogHeader>
              <DialogTitle className="max-w-lg text-[1.4rem] font-semibold leading-tight tracking-[-0.035em] text-bone">
                {isCertificate
                  ? "One object. One permanent record."
                  : "Independent verification of the object in custody."}
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-lg text-xs leading-5 text-bone/55">
                {isCertificate
                  ? "This certificate is bound to the vault record below. The record cannot be transferred without the original certificate and a verified identity."
                  : "The measurements and observations below are recorded against the sealed parcel held in the vault."}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="px-5 py-6 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            {number && (
              <div>
                <p className="text-[0.56rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {isCertificate ? "Certificate" : "Report"} number
                </p>
                <p className="mt-1 text-sm font-semibold tracking-[0.02em] text-ink">
                  {number}
                </p>
              </div>
            )}
            <div className={number ? "text-right" : undefined}>
              <p className="text-[0.56rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Vault record
              </p>
              <p className="mt-1 text-sm font-semibold tracking-[0.02em] text-ink">
                {record.reference}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {record.ownerName && (
              <div>
                <p className="text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Registered owner
                </p>
                <p className="mt-1.5 font-display text-lg italic text-ink">
                  {record.ownerName}
                </p>
                {(record.ownerReference || record.ownerEmail) && (
                  <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                    {[record.ownerReference, record.ownerEmail]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
            )}
            <div>
              <p className="text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Object
              </p>
              <p className="mt-1.5 text-sm font-semibold text-ink">{record.name}</p>
              <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                {record.category}
              </p>
            </div>
          </div>

          {isCertificate ? (
            <>
              <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-line pt-5 sm:grid-cols-3">
                {certificateFields(record).map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="mt-1 truncate text-[0.72rem] font-medium text-ink">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-7 rounded-[4px] border border-line bg-ice/35 px-4 py-3">
                <p className="text-[0.68rem] leading-5 text-muted-foreground">
                  The object described above is held under dual control in the Cosmic
                  Vault depository. This certificate is valid only while the record
                  remains active and the insurance policy shown on the record is in
                  force.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-end justify-between gap-5">
                <div>
                  <div className="h-px w-48 bg-ink/30" />
                  <p className="mt-2 text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
                    Authorised signatory · Iris Chen
                  </p>
                </div>
                <div className="grid size-16 place-items-center rounded-full border border-primary/25 text-primary">
                  <BadgeCheck className="size-6" strokeWidth={1.4} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mt-6 overflow-hidden rounded-[4px] border border-line">
                <table className="w-full border-collapse text-left text-xs">
                  <caption className="sr-only">Assay measurements and verification</caption>
                  <thead>
                    <tr className="bg-muted/50">
                      {["Observation", "Method", "Result"].map((head) => (
                        <th
                          key={head}
                          className="border-b border-line px-3 py-2 text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                        >
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assayRows(record).map(([observation, method, result]) => (
                      <tr key={observation} className="odd:bg-card even:bg-ice/20">
                        <td className="border-b border-line/70 px-3 py-2.5 font-medium text-ink">
                          {observation}
                        </td>
                        <td className="border-b border-line/70 px-3 py-2.5 text-muted-foreground">
                          {method}
                        </td>
                        <td className="border-b border-line/70 px-3 py-2.5 text-ink">
                          {result}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex items-start gap-3 rounded-[4px] border border-line bg-ice/30 px-4 py-3">
                <Fingerprint className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="text-[0.68rem] leading-5 text-muted-foreground">
                  Assayed by the Cosmic Vault gemmology and bullion desk. The sealed
                  parcel was opened only under dual control and re-sealed with a new
                  serial immediately after measurement.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-[0.63rem] text-muted-foreground">
                  <BadgeCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                  Verified against the physical parcel
                </div>
                <p className="font-display text-lg italic text-ink">M. Vale</p>
              </div>
            </>
          )}

          <div className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <p className="text-[0.58rem] text-muted-foreground">
              {record.isDemo
                ? "Demonstration document. Not a real certificate or assay."
                : "Record generated from the live vault ledger."}
            </p>
            <div className="flex gap-2">
              <DownloadSummary record={record} kind={kind} />
              <Button
                className="h-9 rounded-[4px] px-4 text-xs"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
