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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useUpload } from "@/hooks/use-upload";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { formatDate, formatDateTime, formatMoney, statusLabel } from "@/lib/format";
import { normalizeRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { ArrowUpRight, Check, ClipboardList, FileText, Loader2, Send, Upload } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type Application = Doc<"applications"> & { customerName?: string };

export default function ApplicationsPage() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const applications = useQuery(api.applications.mine);
  const [selectedId, setSelectedId] = useState<Id<"applications"> | null>(null);

  if (applications === undefined) return <LoadingState label="Loading applications" />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Applications"
        title="Underwriting, with a person on the other end."
        description={
          role === "broker"
            ? "Applications for customers assigned to your brokerage. Underwriting decisions remain with authorised staff."
            : "Track every application from draft to a policy decision. Submitted answers are preserved as originally filed."
        }
        actions={
          <Button asChild className="h-10 rounded-full px-5">
            <Link to="/dashboard/catalogue">Start from a quotation <ArrowUpRight className="size-4" /></Link>
          </Button>
        }
      />

      {applications.length === 0 ? (
        <Panel>
          <EmptyState
            icon={ClipboardList}
            title="No applications yet"
            description="A quotation becomes an application when you're ready to apply. Upload the product's required documents, then submit for review."
            action={
              <Button asChild size="sm" className="rounded-full">
                <Link to="/dashboard/catalogue">Browse products</Link>
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-3">
          {applications.map((application) => (
            <Panel key={application._id} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{application.reference}</p>
                    <StatusPill status={application.status} />
                    {application.decision && (
                      <span className="text-[0.62rem] text-muted-foreground">
                        Decision: {statusLabel(application.decision)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {application.productName} · v{application.productVersion} ·{" "}
                    {role === "broker" && application.customerName
                      ? `${application.customerName} · `
                      : ""}
                    {application.submittedAt
                      ? `submitted ${formatDate(application.submittedAt)}`
                      : `draft created ${formatDate(application.createdAt)}`}
                  </p>
                  {application.status === "additional_info_required" && (
                    <p className="mt-1.5 text-[0.68rem] font-medium text-amber-700 dark:text-amber-400">
                      Information requested - open to respond.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink">
                      {formatMoney(application.premium, application.currency)}
                    </p>
                    <p className="text-[0.6rem] text-muted-foreground">annual premium</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-full bg-transparent px-4"
                    onClick={() => setSelectedId(application._id)}
                  >
                    {application.status === "draft" ? "Continue" : "Open"}
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {selectedId && (
        <ApplicationDialog
          applicationId={selectedId}
          open={Boolean(selectedId)}
          onOpenChange={(open) => !open && setSelectedId(null)}
        />
      )}
    </div>
  );
}

function ApplicationDialog({
  applicationId,
  open,
  onOpenChange,
}: {
  applicationId: Id<"applications">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const detail = useQuery(api.applications.get, { applicationId });
  const submit = useMutation(api.applications.submit);
  const respond = useMutation(api.applications.respond);
  const addDocument = useMutation(api.applications.addDocument);
  const payPremium = useMutation(api.payments.initiatePremium);
  const upload = useUpload();

  const [terms, setTerms] = useState(false);
  const [response, setResponse] = useState("");
  const [pending, setPending] = useState(false);
  const [otherName, setOtherName] = useState("");
  const [otherFile, setOtherFile] = useState<File | null>(null);
  const [requiredFile, setRequiredFile] = useState<Record<string, File | null>>({});

  if (detail === undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[1.5rem] border-line bg-background sm:max-w-[760px]">
          <LoadingState label="Loading application" />
        </DialogContent>
      </Dialog>
    );
  }

  const { application, product, customer, policy, transactions, events } = detail;
  const editable = application.status === "draft";
  const canAddDocs = editable || application.status === "additional_info_required";
  const provided = new Set(application.documents.map((doc) => doc.key));
  const requiredDocs = product?.requiredDocuments ?? [];
  const pendingPayment = transactions.find(
    (tx) => tx.type === "premium" && tx.status === "pending",
  );
  const paid = transactions.some((tx) => tx.type === "premium" && tx.status === "succeeded");

  const uploadRequired = async (key: string, label: string, file: File) => {
    setPending(true);
    try {
      const uploaded = await upload(file);
      await addDocument({
        applicationId: application._id,
        document: {
          name: uploaded.name,
          key,
          storageId: uploaded.storageId,
        },
      });
      toast.success(`${label} uploaded.`);
      setRequiredFile((current) => ({ ...current, [key]: null }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setPending(false);
    }
  };

  const uploadOther = async () => {
    if (!otherFile) {
      toast.error("Choose a file first.");
      return;
    }
    setPending(true);
    try {
      const uploaded = await upload(otherFile);
      await addDocument({
        applicationId: application._id,
        document: {
          name: otherName.trim() || uploaded.name,
          key: "other",
          storageId: uploaded.storageId,
        },
      });
      toast.success("Document uploaded.");
      setOtherFile(null);
      setOtherName("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setPending(false);
    }
  };

  const startPayment = async () => {
    setPending(true);
    try {
      const result = await payPremium({ applicationId: application._id });
      toast.success("Payment instructions created.", { description: result.reference });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the payment.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[1.5rem] border-line bg-background p-0 sm:max-w-[780px]">
        <div className="border-b border-line px-5 py-5 sm:px-7">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-lg tracking-[-0.02em]">
              {application.reference} <StatusPill status={application.status} />
            </DialogTitle>
            <DialogDescription>
              {application.productName} · version {application.productVersion} ·{" "}
              {formatMoney(application.premium, application.currency)} per year
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 px-5 py-5 sm:px-7">
          {application.status === "additional_info_required" && (
            <Callout tone="warning" title="Action needed">
              {application.infoRequest}
              <div className="mt-3 space-y-2">
                <Textarea
                  value={response}
                  onChange={(event) => setResponse(event.target.value)}
                  placeholder="Add the requested information…"
                  className="rounded-xl bg-card"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={pending || response.trim().length < 2}
                    onClick={async () => {
                      setPending(true);
                      try {
                        await respond({ applicationId: application._id, message: response });
                        setResponse("");
                        toast.success("Response sent to the underwriting team.");
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

          {application.decision && (
            <Callout tone={application.decision === "approved" ? "success" : "danger"} title={`Decision: ${statusLabel(application.decision)}`}>
              {application.decisionReason}
              <p className="mt-1 text-[0.65rem]">
                Recorded {formatDateTime(application.decidedAt)} by authorised staff.
              </p>
            </Callout>
          )}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Application details
            </h3>
            <div className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Detail label="Policyholder">{customer?.fullName ?? "-"}</Detail>
              <Detail label="Country">{application.country}</Detail>
              <Detail label="Submitted">
                {application.submittedAt ? formatDateTime(application.submittedAt) : "Not submitted"}
              </Detail>
              <Detail label="Assigned reviewer">
                {application.assignedTo ? "Assigned" : "Awaiting assignment"}
              </Detail>
            </div>
            <dl className="mt-4 divide-y divide-line rounded-xl border border-line">
              {product?.questions.map((question) => (
                <div key={question.key} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:justify-between sm:gap-4">
                  <dt className="text-[0.68rem] text-muted-foreground">{question.label}</dt>
                  <dd className="text-xs text-ink sm:text-right">
                    {String(
                      (application.answers as Record<string, string | number>)?.[question.key] ?? "-",
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Documents
              </h3>
              <span className="text-[0.62rem] text-muted-foreground">
                {application.documents.length} attached
              </span>
            </div>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {application.documents.length === 0 ? (
                <li className="px-4 py-3 text-xs text-muted-foreground">No documents attached yet.</li>
              ) : (
                application.documents.map((doc) => (
                  <li key={`${doc.key}-${doc.addedAt}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="flex min-w-0 items-center gap-2 text-xs text-ink">
                      <FileText className="size-3.5 shrink-0 text-primary" />
                      <span className="truncate">{doc.name}</span>
                    </span>
                    <span className="shrink-0 text-[0.6rem] uppercase tracking-[0.1em] text-muted-foreground">
                      {requiredDocs.find((item) => item.key === doc.key)?.label ?? doc.key}
                    </span>
                  </li>
                ))
              )}
            </ul>

            {canAddDocs && (
              <div className="mt-3 space-y-3">
                {requiredDocs.map((required) => {
                  const done = provided.has(required.key);
                  return (
                    <div key={required.key} className="flex flex-col gap-2 rounded-xl border border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-medium text-ink">
                          {required.label}{" "}
                          <span className={cn("text-[0.6rem]", required.required ? "text-destructive" : "text-muted-foreground")}>
                            {required.required ? "required" : "optional"}
                          </span>
                        </p>
                        <p className="text-[0.62rem] text-muted-foreground">
                          {done ? "Uploaded" : "PDF, image, DOCX, or text · max 10 MB"}
                        </p>
                      </div>
                      {done ? (
                        <span className="inline-flex items-center gap-1 text-[0.65rem] font-medium text-emerald-700 dark:text-emerald-400">
                          <Check className="size-3.5" /> Received
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept=".pdf,image/png,image/jpeg,image/webp,.docx,.txt"
                            className="h-9 max-w-[220px] text-[0.65rem]"
                            onChange={(event) =>
                              setRequiredFile((current) => ({
                                ...current,
                                [required.key]: event.target.files?.[0] ?? null,
                              }))
                            }
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 rounded-full px-3"
                            disabled={pending || !requiredFile[required.key]}
                            onClick={() =>
                              uploadRequired(required.key, required.label, requiredFile[required.key]!)
                            }
                          >
                            <Upload className="size-3.5" /> Upload
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="rounded-xl border border-dashed border-line px-4 py-3">
                  <p className="text-xs font-medium text-ink">Add another document</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Input
                      placeholder="Document name"
                      value={otherName}
                      onChange={(event) => setOtherName(event.target.value)}
                      className="h-9 rounded-lg bg-card text-xs"
                    />
                    <Input
                      type="file"
                      accept=".pdf,image/png,image/jpeg,image/webp,.docx,.txt"
                      onChange={(event) => setOtherFile(event.target.files?.[0] ?? null)}
                      className="h-9 max-w-[220px] text-[0.65rem]"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 shrink-0 rounded-full px-3"
                      disabled={pending || !otherFile}
                      onClick={uploadOther}
                    >
                      <Upload className="size-3.5" /> Upload
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {application.status === "draft" && (
            <section className="rounded-xl border border-line bg-ice/40 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Submit for underwriting
              </h3>
              <p className="mt-1.5 text-[0.7rem] leading-5 text-muted-foreground">
                Required documents: {requiredDocs.filter((doc) => doc.required).map((doc) => doc.label).join(", ") || "none"}.
                Once submitted, the application can only be changed through an information request.
              </p>
              <label className="mt-3 flex items-start gap-2 text-[0.7rem] leading-5 text-ink">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(event) => setTerms(event.target.checked)}
                  className="mt-0.5 accent-[var(--primary)]"
                />
                I accept the policy terms, exclusions, and disclosures for this product version, and
                confirm the answers are true and complete.
              </label>
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  className="rounded-full"
                  disabled={pending || !terms}
                  onClick={async () => {
                    setPending(true);
                    try {
                      await submit({ applicationId: application._id, termsAccepted: true });
                      toast.success("Application submitted for manual underwriting.");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not submit.");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                  Submit application
                </Button>
              </div>
            </section>
          )}

          {application.status === "approved" && !policy && (
            <section className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Premium payment
              </h3>
              <p className="mt-1.5 text-[0.7rem] leading-5 text-muted-foreground">
                The policy is issued after payment is confirmed by the finance team. This is a
                recorded bank transfer in the current payment configuration.
              </p>
              {paid ? (
                <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  Payment confirmed. The policy will be issued by an authorised administrator.
                </p>
              ) : pendingPayment ? (
                <p className="mt-2 text-xs text-ink">
                  Awaiting confirmation for{" "}
                  <span className="font-semibold">{pendingPayment.reference}</span> -{" "}
                  {formatMoney(pendingPayment.amount, pendingPayment.currency)}.
                </p>
              ) : (
                <Button
                  size="sm"
                  className="mt-3 rounded-full"
                  disabled={pending}
                  onClick={startPayment}
                >
                  {pending && <Loader2 className="size-3.5 animate-spin" />}
                  Create payment instructions
                </Button>
              )}
            </section>
          )}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              History
            </h3>
            <div className="mt-2">
              <Timeline
                items={events.map((event) => ({
                  body: event.message,
                  at: event.createdAt,
                  internal: event.internal,
                  title: event.toStatus ? statusLabel(event.toStatus) : undefined,
                }))}
              />
            </div>
          </section>

          {policy && (
            <Callout tone="success" title={`Policy ${policy.policyNumber} issued`}>
              The policy is active and documents are in your library.{" "}
              <Link to="/dashboard/policies" className="font-medium text-primary underline-offset-2 hover:underline">
                View policy
              </Link>
            </Callout>
          )}

          <div className="flex justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
