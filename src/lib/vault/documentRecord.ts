import { formatDate, formatMoneyValue } from "@/lib/format";
import type { Mineral } from "@/lib/vault/types";
import { formatWeight } from "@/lib/vault/types";

/**
 * The facts a certificate or assay report prints.
 *
 * Everything beyond the record itself is optional: a live mineral carries its
 * reference, object, quantity, value and dates, while dimensions, purity or a
 * certificate number exist only on records that were appraised or certified at
 * intake. A document prints what the record holds and leaves the rest out,
 * rather than filling the gap with a guess.
 */
export type VaultDocumentRecord = {
  /** The vault record the document is bound to (`minerals.reference`). */
  reference: string;
  /** Only records certified at intake carry their own certificate number. */
  certificateNumber?: string;
  name: string;
  category: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerReference?: string;
  /** Formatted quantity, e.g. `1 kg`. */
  quantity: string;
  dimensions?: string;
  purity?: string;
  grade?: string;
  /** Formatted appraisal, e.g. `£48,500`. */
  value: string;
  storageLocation?: string;
  depositedAt?: string;
  appraisedAt?: string;
  insured: boolean;
  isDemo?: boolean;
};

/** Builds the document record for a demonstration mineral. */
export function vaultDocumentRecordFromMineral(
  mineral: Mineral,
): VaultDocumentRecord {
  return {
    reference: mineral.vaultId,
    certificateNumber: mineral.certificateNumber,
    name: mineral.name,
    category: mineral.category,
    ownerName: mineral.ownerName,
    ownerEmail: mineral.ownerEmail,
    ownerReference: mineral.ownerReference,
    quantity: formatWeight(mineral.weight, mineral.unit),
    dimensions: mineral.dimensions,
    purity: mineral.purity,
    grade: mineral.grade,
    value: formatMoneyValue(mineral.estimatedValue, mineral.currency),
    storageLocation: mineral.storageLocation,
    depositedAt: formatDate(mineral.depositDate),
    appraisedAt: formatDate(mineral.valuationUpdatedAt),
    insured: mineral.insurancePolicy?.status === "active",
    isDemo: mineral.isDemo,
  };
}
