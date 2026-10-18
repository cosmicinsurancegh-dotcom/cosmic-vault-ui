import {
  Callout,
  Detail,
  EmptyState,
  LoadingState,
  PageHeader,
  Panel,
  StatusPill,
  Timeline,
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
import { useDocumentDownload } from "@/hooks/use-document-download";
import { useUpload } from "@/hooks/use-upload";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { formatDate, formatDateTime, formatMoney, statusLabel, toMinor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Check,
  Download,
  FileText,
  LifeBuoy,
  Loader2,
  Send,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type Claim = Doc<"claims">;
const STATUSES = [
  "all",
  "submitted",
  "under_review",
  "additional_info_required",
  "under_assessment",
  "payment_pending",
  "approved",
  "partially_approved",
  "declined",
  "paid",
  "closed",
];

export default function ClaimsPage() {
  const [status, setStatus] = useState("all");
  const claims = useQuery(api.claims.mine);
  const [selectedId, setSelectedId] = useState<Id<"claims"> | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);

  if (claims === undefined) return <LoadingState label="Loading claims" />;
  const filtered = status === "all" ? claims : claims.filter((claim) => claim.status === status);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Claims"
        title="Tell us what happened."
        description="A submitted claim is not an admission of cover. An authorised handler reviews the evidence, records a decision, and settlement is tracked separately."
        actions={
          <div className="flex items-center gap-2">
            <select
              aria-label="Filter claims"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-9 rounded-[4px] border border-line bg-card px-3 text-xs text-ink"
            >
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? "All statuses" : statusLabel(value)}
                </option>
              ))}
            </select>
            <Button className="h-9 rounded-[4px] px-4" onClick={() => setSubmitOpen(true)}>
              <LifeBuoy className="size-3.5" /> New claim
            </Button>
          </div>
        }
      />

      {filtered.length === 0 ? (
        <Panel>
          <EmptyState
            icon={LifeBuoy}
            title={claims.length === 0 ? "No claims submitted" : "No claims in this state"}
            description="You can claim against an active policy. Have the incident date, location, amount, and supporting evidence ready."
            action={
              <Button size="sm" className="rounded-[4px]" onClick={() => setSubmitOpen(true)}>
                Submit a claim
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-3">
          {filtered.map((claim) => (
            <Panel key={claim._id} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{claim.reference}</p>
                    <StatusPill status={claim.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {claim.productName} · incident {formatDate(claim.incidentDate)} · reported{" "}
                    {formatDate(claim.reportedAt)}
                  </p>
                  {claim.status === "additional_info_required" && (
                    <p className="mt-1 text-[0.68rem] font-medium text-amber-700 dark:text-amber-400">
                      Evidence requested - open to respond.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink">
                      {formatMoney(claim.amountClaimed, claim.currency)}
                    </p>
                    <p className="text-[0.6rem] text-muted-foreground">claimed</p>
                    {claim.approvedAmount !== undefined && (
                      <p className="mt-1 text-[0.65rem] font-medium text-emerald-700 dark:text-emerald-400">
                        {formatMoney(claim.approvedAmount, claim.currency)} approved
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-[4px] bg-transparent px-4"
                    onClick={() => setSelectedId(claim._id)}
                  >
                    Open
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <SubmitClaimDialog open={submitOpen} onOpenChange={setSubmitOpen} />

      {selectedId && (
        <ClaimDialog
          claimId={selectedId}
          open={Boolean(selectedId)}
          onOpenChange={(open) => !open && setSelectedId(null)}
        />
      )}
    </div>
  );
}

function SubmitClaimDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const policies = useQuery(api.policies.mine, { status: "active" });
  const submit = useMutation(api.claims.submit);
  const upload = useUpload();
  const [policyId, setPolicyId] = useState("");
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState("supporting_evidence");
  const [pending, setPending] = useState(false);

  const selectedPolicy = (policies ?? []).find((policy) => policy._id === policyId);

  const reset = () => {
    setPolicyId("");
    setLocation("");
    setDescription("");
    setAmount("");
    setFile(null);
    setFileKey("supporting_evidence");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background p-0 sm:max-w-[640px]">
        <div className="border-b border-line px-5 py-5 sm:px-7">
          <DialogHeader>
            <DialogTitle className="tracking-[-0.02em]">Submit a claim</DialogTitle>
            <DialogDescription>
              Only active policies can be claimed against. The incident must fall within the policy term.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-4 px-5 py-5 sm:px-7">
          {(policies ?? []).length === 0 ? (
            <Callout tone="warning" title="No active policies">
              A claim needs an active policy.{" "}
              <Link to="/dashboard/policies" className="font-medium text-primary">View policies</Link>
            </Callout>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="claim-policy">Policy</Label>
                <select
                  id="claim-policy"
                  value={policyId}
                  onChange={(event) => setPolicyId(event.target.value)}
                  className="h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink"
                >
                  <option value="">Choose a policy…</option>
                  {(policies ?? []).map((policy) => (
                    <option key={policy._id} value={policy._id}>
                      {policy.productName} · {policy.policyNumber}
                    </option>
                  ))}
                </select>
                {selectedPolicy && (
                  <p className="text-[0.65rem] text-muted-foreground">
                    Term {formatDate(selectedPolicy.startDate)} – {formatDate(selectedPolicy.endDate)} ·
                    coverage {formatMoney(selectedPolicy.coverageLimit, selectedPolicy.currency)} ·
                    excess {formatMoney(selectedPolicy.excess, selectedPolicy.currency)}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="incident-date">Incident date</Label>
                  <Input
                    id="incident-date"
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={incidentDate}
                    onChange={(event) => setIncidentDate(event.target.value)}
                    className="h-10 rounded-xl bg-card"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="claim-amount">
                    Amount claimed {selectedPolicy ? `(${selectedPolicy.currency})` : ""}
                  </Label>
                  <Input
                    id="claim-amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                    className="h-10 rounded-xl bg-card"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="incident-location">Incident location</Label>
                <Input
                  id="incident-location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="City, country, or address"
                  className="h-10 rounded-xl bg-card"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="incident-description">What happened?</Label>
                <Textarea
                  id="incident-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-[110px] rounded-xl bg-card"
                  placeholder="Describe the incident and any immediate actions taken."
                />
              </div>

              <div className="space-y-2 rounded-xl border border-dashed border-line px-4 py-3">
                <p className="text-xs font-medium text-ink">Supporting evidence</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    aria-label="Evidence type"
                    value={fileKey}
                    onChange={(event) => setFileKey(event.target.value)}
                    className="h-9 rounded-lg border border-line bg-card px-2 text-xs text-ink"
                  >
                    <option value="supporting_evidence">Supporting evidence</option>
                    <option value="invoice">Invoice / receipt</option>
                    <option value="photo">Photo</option>
                    <option value="police_report">Police report</option>
                    <option value="medical_report">Medical report</option>
                    <option value="other">Other</option>
                  </select>
                  <Input
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp,.docx,.txt"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    className="h-9 text-[0.65rem]"
                  />
                </div>
                <p className="text-[0.62rem] text-muted-foreground">
                  At least one file is required. PDF, image, DOCX, or text · max 10 MB.
                </p>
              </div>

              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <Button variant="outline" className="rounded-[4px]" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  className="rounded-[4px]"
                  disabled={pending}
                  onClick={async () => {
                    setPending(true);
                    try {
                      if (!policyId) throw new Error("Choose a policy.");
                      if (!file) throw new Error("Attach at least one piece of evidence.");
                      const uploaded = await upload(file);
                      const result = await submit({
                        policyId: policyId as never,
                        incidentDate: new Date(`${incidentDate}T12:00:00`).getTime(),
                        location,
                        description,
                        amountClaimed: toMinor(amount, "Claim amount"),
                        documents: [
                          {
                            name: uploaded.name,
                            key: fileKey,
                            storageId: uploaded.storageId,
                          },
                        ],
                      });
                      toast.success("Claim submitted.", { description: result.reference });
                      reset();
                      onOpenChange(false);
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not submit the claim.");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Submit claim
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ClaimDialog({
  claimId,
  open,
  onOpenChange,
}: {
  claimId: Id<"claims">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const detail = useQuery(api.claims.get, { claimId });
  const documents = useQuery(api.documents.mine, {});
  const respond = useMutation(api.claims.respond);
  const addDocument = useMutation(api.claims.addDocument);
  const dispute = useMutation(api.claims.dispute);
  const upload = useUpload();
  const download = useDocumentDownload();
  const [response, setResponse] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [complaint, setComplaint] = useState("");
  const [pending, setPending] = useState(false);

  if (detail === undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background sm:max-w-[760px]">
          <LoadingState label="Loading claim" />
        </DialogContent>
      </Dialog>
    );
  }

  const { claim, policy, events } = detail;
  const evidence = (documents ?? []).filter((document) => document.claimId === claim._id);
  const final = ["declined", "paid", "closed"].includes(claim.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[4px] border-line bg-background p-0 sm:max-w-[780px]">
        <div className="border-b border-line px-5 py-5 sm:px-7">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-lg tracking-[-0.02em]">
              {claim.reference} <StatusPill status={claim.status} />
            </DialogTitle>
            <DialogDescription>
              {claim.productName} · {policy?.policyNumber ?? "Policy"} ·{" "}
              {formatMoney(claim.amountClaimed, claim.currency)} claimed
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 px-5 py-5 sm:px-7">
          {claim.status === "additional_info_required" && (
            <Callout tone="warning" title="Evidence needed">
              {claim.infoRequest}
              <div className="mt-3 space-y-2">
                <Textarea
                  value={response}
                  onChange={(event) => setResponse(event.target.value)}
                  placeholder="Describe what you are providing, then upload any new evidence…"
                  className="rounded-xl bg-card"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="rounded-[4px]"
                    disabled={pending || response.trim().length < 2}
                    onClick={async () => {
                      setPending(true);
                      try {
                        await respond({ claimId, message: response });
                        setResponse("");
                        toast.success("Response sent to the claims team.");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Could not send the response.");
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    <Send className="size-3.5" /> Send response
                  </Button>
                </div>
              </div>
            </Callout>
          )}

          {claim.decision && (
            <Callout tone={claim.decision === "declined" ? "danger" : "success"} title={`Decision: ${statusLabel(claim.decision)}`}>
              {claim.decisionReason}
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <p>
                  Decision amount:{" "}
                  <span className="font-semibold">
                    {formatMoney(claim.approvedAmount ?? 0, claim.currency)}
                  </span>
                </p>
                <p>
                  Settlement:{" "}
                  <span className="font-semibold">
                    {claim.status === "paid"
                      ? `paid ${formatDate(claim.paidAt)} · ref ${claim.settlementRef}`
                      : "not yet paid"}
                  </span>
                </p>
              </div>
              <p className="mt-1 text-[0.65rem]">
                The decision and the settlement are separate states. An approved claim can remain
                unpaid while finance processes the settlement.
              </p>
            </Callout>
          )}

          <section className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Detail label="Incident date">{formatDate(claim.incidentDate)}</Detail>
            <Detail label="Reported">{formatDateTime(claim.reportedAt)}</Detail>
            <Detail label="Location">{claim.location}</Detail>
            <Detail label="Policy excess">{formatMoney(policy?.excess ?? 0, claim.currency)}</Detail>
            <Detail label="Description" className="sm:col-span-2">
              {claim.description}
            </Detail>
            {claim.customerResponse && (
              <Detail label="Your response" className="sm:col-span-2">
                {claim.customerResponse}
              </Detail>
            )}
            {claim.closureReason && (
              <Detail label="Closure" className="sm:col-span-2">
                {claim.closureReason}
              </Detail>
            )}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Evidence
            </h3>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {evidence.length === 0 ? (
                <li className="px-4 py-3 text-xs text-muted-foreground">No evidence available.</li>
              ) : (
                evidence.map((document) => (
                  <li key={document._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="flex min-w-0 items-center gap-2 text-xs text-ink">
                      <FileText className="size-3.5 shrink-0 text-primary" />
                      <span className="truncate">{document.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await download(document._id);
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Could not open the file.");
                        }
                      }}
                      className="inline-flex shrink-0 items-center gap-1 text-[0.65rem] font-medium text-primary"
                    >
                      <Download className="size-3.5" /> Open
                    </button>
                  </li>
                ))
              )}
            </ul>

            {!final && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp,.docx,.txt"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="h-9 max-w-[260px] text-[0.65rem]"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-[4px] px-3"
                  disabled={pending || !file}
                  onClick={async () => {
                    if (!file) return;
                    setPending(true);
                    try {
                      const uploaded = await upload(file);
                      await addDocument({
                        claimId,
                        document: {
                          name: uploaded.name,
                          key: "supporting_evidence",
                          storageId: uploaded.storageId,
                        },
                      });
                      toast.success("Evidence uploaded.");
                      setFile(null);
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Upload failed.");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  <Upload className="size-3.5" /> Add evidence
                </Button>
              </div>
            )}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              History
            </h3>
            <div className="mt-2">
              <Timeline
                items={events.map((event) => ({
                  body: event.message,
                  at: event.createdAt,
                  title: event.toStatus ? statusLabel(event.toStatus) : undefined,
                }))}
              />
            </div>
          </section>

          {claim.decision && (
            <section className="rounded-xl border border-line bg-ice/30 p-4">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <AlertTriangle className="size-3.5" /> Complaint / dispute
              </h3>
              {claim.disputeMessage ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  A complaint has been raised: “{claim.disputeMessage}”. Support will respond on the
                  linked ticket.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-[0.68rem] leading-5 text-muted-foreground">
                    If you disagree with the decision, raise a formal complaint. This does not change
                    the recorded decision; it opens a separate support case.
                  </p>
                  <Textarea
                    value={complaint}
                    onChange={(event) => setComplaint(event.target.value)}
                    className="mt-2 rounded-xl bg-card"
                    placeholder="Explain why you are disputing the decision…"
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-[4px] bg-transparent"
                      disabled={pending || complaint.trim().length < 10}
                      onClick={async () => {
                        setPending(true);
                        try {
                          const result = await dispute({ claimId, message: complaint });
                          setComplaint("");
                          toast.success("Complaint raised.", {
                            description: `Ticket ${result.ticketReference}`,
                          });
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Could not raise the complaint.");
                        } finally {
                          setPending(false);
                        }
                      }}
                    >
                      Raise complaint
                    </Button>
                  </div>
                </>
              )}
            </section>
          )}

          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[0.62rem] text-muted-foreground">
              <ShieldCheck className="size-3.5" /> Decisions are made only by authorised staff.
            </p>
            <Button variant="outline" className="rounded-[4px]" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
