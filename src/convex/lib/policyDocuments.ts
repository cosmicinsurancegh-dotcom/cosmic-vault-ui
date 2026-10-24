import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * The three documents every issued policy carries: a schedule, a certificate
 * and the wording version it was sold on. Both issuance paths - the public
 * application flow and the staff console - render them here, so a policy's
 * paperwork does not depend on which screen issued it.
 */

export type PolicyDocumentDraft = {
  name: string;
  body: string;
};

function money(amount: number, currency: string) {
  return `${(amount / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
  })} ${currency}`;
}

function isoDate(at: number) {
  return new Date(at).toISOString().slice(0, 10);
}

export function buildPolicyDocuments(args: {
  policyNumber: string;
  applicationReference: string;
  customerName: string;
  product: Doc<"products">;
  country: string;
  currency: string;
  premium: number;
  startDate: number;
  endDate: number;
}): PolicyDocumentDraft[] {
  const { policyNumber, product, currency, customerName } = args;

  const schedule = [
    `POLICY SCHEDULE - ${policyNumber}`,
    "",
    `Product: ${product.name} (version ${product.version})`,
    `Policyholder: ${customerName}`,
    `Insured country: ${args.country}`,
    `Term: ${isoDate(args.startDate)} to ${isoDate(args.endDate)}`,
    `Premium: ${money(args.premium, currency)}`,
    `Coverage limit: ${money(product.coverageLimit, currency)}`,
    `Excess: ${money(product.excess, currency)}`,
    "",
    "Benefits:",
    ...product.benefits.map((benefit) => `• ${benefit}`),
    "",
    "Exclusions:",
    ...product.exclusions.map((exclusion) => `• ${exclusion}`),
    "",
    `Wording version: ${product.wordingVersion}`,
    "",
    "This schedule must be read with the policy wording.",
  ].join("\n");

  const certificate = [
    `CERTIFICATE OF INSURANCE - ${policyNumber}`,
    "",
    `This certifies that ${customerName} is insured under ${product.name} from ${isoDate(args.startDate)} to ${isoDate(args.endDate)}.`,
    `Policy number: ${policyNumber}`,
    `Application: ${args.applicationReference}`,
    `Premium: ${money(args.premium, currency)}`,
    "",
    "Cover is subject to the policy wording, schedule, exclusions, and excess.",
  ].join("\n");

  return [
    { name: `${policyNumber} - policy schedule`, body: schedule },
    { name: `${policyNumber} - certificate`, body: certificate },
    {
      name: `${policyNumber} - policy wording v${product.wordingVersion}`,
      body: `${product.wording}\n\n${product.disclosures}`,
    },
  ];
}

export async function writePolicyDocuments(
  ctx: MutationCtx,
  args: {
    ownerUserId: Id<"users">;
    policyId: Id<"policies">;
    issuedBy: Id<"users">;
    at: number;
    version: number;
    documents: PolicyDocumentDraft[];
  },
) {
  for (const document of args.documents) {
    await ctx.db.insert("documents", {
      ownerUserId: args.ownerUserId,
      name: document.name,
      category: "policy",
      policyId: args.policyId,
      body: document.body,
      contentType: "text/plain",
      version: args.version,
      issuedBy: args.issuedBy,
      issuedAt: args.at,
      createdAt: args.at,
    });
  }
}
