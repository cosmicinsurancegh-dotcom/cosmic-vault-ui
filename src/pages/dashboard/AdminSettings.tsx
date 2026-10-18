import {
  Callout,
  EmptyState,
  LoadingState,
  PageHeader,
  Panel,
  PanelHeader,
  StatusPill,
} from "@/components/dashboard/PlatformUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDateTime } from "@/lib/format";
import {
  PERMISSION_LABELS,
  STAFF_PERMISSIONS,
  can,
} from "@/lib/permissions";
import { checkSupabaseHealth, supabaseConfigured, supabaseUrl } from "@/lib/supabase";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Database,
  Loader2,
  MailWarning,
  PackagePlus,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const allowed = can(user?.role, user?.permissions, STAFF_PERMISSIONS.SETTINGS_MANAGE);
  const canStaff = can(user?.role, user?.permissions, STAFF_PERMISSIONS.STAFF_MANAGE);
  const settings = useQuery(api.settings.get, allowed ? {} : "skip");
  const reference = useQuery(api.setup.referenceData, allowed ? {} : "skip");
  const staff = useQuery(api.staff.list, canStaff ? {} : "skip");
  const issues = useQuery(api.notifications.deliveryIssues, allowed ? {} : "skip");
  const update = useMutation(api.settings.update);
  const resetTemplates = useMutation(api.settings.resetTemplates);
  const promote = useMutation(api.staff.promote);
  const setPermissions = useMutation(api.staff.setPermissions);
  const revoke = useMutation(api.staff.revoke);
  const setStaffStatus = useMutation(api.staff.setStatus);
  const retryEmail = useMutation(api.notifications.retryEmail);
  const seed = useMutation(api.setup.seedStarterCatalogue);

  const [form, setForm] = useState({
    companyName: "",
    supportEmail: "",
    defaultCurrency: "GBP",
    commissionEnabled: false,
    renewalNoticeDays: "30",
    claimSlaDays: "10",
    bankAccountName: "",
    bankIban: "",
    bankSortCode: "",
    bankSwift: "",
    allowedCurrencies: [] as string[],
  });
  const [templates, setTemplates] = useState<
    { key: string; subject: string; body: string }[]
  >([]);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState<"admin" | "super_admin">("admin");
  const [staffReason, setStaffReason] = useState("");
  const [permissionTarget, setPermissionTarget] = useState<Id<"users"> | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      companyName: settings.companyName,
      supportEmail: settings.supportEmail,
      defaultCurrency: settings.defaultCurrency,
      commissionEnabled: settings.commissionEnabled,
      renewalNoticeDays: String(settings.renewalNoticeDays),
      claimSlaDays: String(settings.claimSlaDays),
      bankAccountName: settings.bankAccountName ?? "",
      bankIban: settings.bankIban ?? "",
      bankSortCode: settings.bankSortCode ?? "",
      bankSwift: settings.bankSwift ?? "",
      allowedCurrencies: settings.allowedCurrencies,
    });
    setTemplates(settings.emailTemplates);
  }, [settings]);

  if (!allowed) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="System settings" title="Restricted settings." />
        <Callout tone="warning" title="Permission required">
          System settings require the settings.manage permission, normally held by a super admin.
        </Callout>
      </div>
    );
  }

  if (settings === undefined || reference === undefined) {
    return <LoadingState label="Loading settings" />;
  }

  const save = async () => {
    setPending(true);
    try {
      await update({
        companyName: form.companyName,
        supportEmail: form.supportEmail,
        defaultCurrency: form.defaultCurrency,
        commissionEnabled: form.commissionEnabled,
        renewalNoticeDays: Number(form.renewalNoticeDays),
        claimSlaDays: Number(form.claimSlaDays),
        bankAccountName: form.bankAccountName || undefined,
        bankIban: form.bankIban || undefined,
        bankSortCode: form.bankSortCode || undefined,
        bankSwift: form.bankSwift || undefined,
        allowedCurrencies: form.allowedCurrencies,
        emailTemplates: templates,
      });
      toast.success("Settings saved and audited.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System administration"
        title="Company, channels, access."
        description="Changes here are audited. Roles and permissions take effect immediately on the server."
        actions={
          <Button
            className="h-10 rounded-full px-5"
            disabled={pending}
            onClick={save}
          >
            {pending && <Loader2 className="size-4 animate-spin" />} Save settings
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Panel>
          <PanelHeader title="Company & defaults" />
          <div className="grid gap-3 px-5 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="s-company">Company name</Label>
              <Input id="s-company" value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} className="h-9 rounded-lg bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-email">Support email</Label>
              <Input id="s-email" type="email" value={form.supportEmail} onChange={(event) => setForm({ ...form, supportEmail: event.target.value })} className="h-9 rounded-lg bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-currency">Default currency</Label>
              <select
                id="s-currency"
                value={form.defaultCurrency}
                onChange={(event) => setForm({ ...form, defaultCurrency: event.target.value })}
                className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs text-ink"
              >
                {reference.currencies.filter((currency) => currency.active).map((currency) => (
                  <option key={currency.code} value={currency.code}>{currency.code}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-renewal">Renewal notice (days)</Label>
              <Input id="s-renewal" inputMode="numeric" value={form.renewalNoticeDays} onChange={(event) => setForm({ ...form, renewalNoticeDays: event.target.value })} className="h-9 rounded-lg bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-sla">Claim SLA (days)</Label>
              <Input id="s-sla" inputMode="numeric" value={form.claimSlaDays} onChange={(event) => setForm({ ...form, claimSlaDays: event.target.value })} className="h-9 rounded-lg bg-card" />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
              <input type="checkbox" checked={form.commissionEnabled} onChange={(event) => setForm({ ...form, commissionEnabled: event.target.checked })} className="accent-[var(--primary)]" />
              Broker commission features enabled company-wide
            </label>

            <div className="space-y-1.5 sm:col-span-2">
              <p className="text-xs font-semibold text-ink">Bank transfer instructions (shown to customers)</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="s-bank-name">Account name</Label>
              <Input id="s-bank-name" value={form.bankAccountName} onChange={(event) => setForm({ ...form, bankAccountName: event.target.value })} className="h-9 rounded-lg bg-card" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="s-iban">IBAN</Label>
              <Input id="s-iban" value={form.bankIban} onChange={(event) => setForm({ ...form, bankIban: event.target.value })} className="h-9 rounded-lg bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-sort">Sort code</Label>
              <Input id="s-sort" value={form.bankSortCode} onChange={(event) => setForm({ ...form, bankSortCode: event.target.value })} className="h-9 rounded-lg bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-swift">SWIFT / BIC</Label>
              <Input id="s-swift" value={form.bankSwift} onChange={(event) => setForm({ ...form, bankSwift: event.target.value })} className="h-9 rounded-lg bg-card" />
            </div>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Supported currencies" description="Only configured currencies can be used by products." />
            <div className="flex flex-wrap gap-2 px-5 py-4">
              {reference.currencies.map((currency) => {
                const checked = form.allowedCurrencies.includes(currency.code);
                return (
                  <button
                    key={currency.code}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        allowedCurrencies: checked
                          ? form.allowedCurrencies.filter((code) => code !== currency.code)
                          : [...form.allowedCurrencies, currency.code],
                      })
                    }
                    className={
                      checked
                        ? "rounded-full bg-primary px-3 py-1.5 text-[0.62rem] font-medium text-primary-foreground"
                        : "rounded-full border border-line px-3 py-1.5 text-[0.62rem] font-medium text-muted-foreground"
                    }
                  >
                    {currency.code}
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Starter catalogue" description="Publishes six real product records you can edit." />
            <div className="px-5 py-4">
              <Button
                variant="outline"
                className="rounded-full bg-transparent"
                onClick={async () => {
                  try {
                    const result = await seed();
                    toast.success(result.created ? `${result.created} products created.` : "Already seeded.");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not seed the catalogue.");
                  }
                }}
              >
                <PackagePlus className="size-4" /> Load starter catalogue
              </Button>
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <PanelHeader
          title="Email templates"
          description="Used for queued notification emails. Placeholders: {{name}}, {{title}}, {{body}}, {{reference}}, {{company}}."
          action={
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-full"
              onClick={async () => {
                await resetTemplates();
                toast.success("Templates reset to defaults.");
              }}
            >
              Reset defaults
            </Button>
          }
        />
        <div className="max-h-[420px] space-y-3 overflow-y-auto px-5 py-4">
          {templates.map((template, index) => (
            <details key={template.key} className="rounded-xl border border-line">
              <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-ink">
                {template.key}
              </summary>
              <div className="space-y-2 border-t border-line px-4 py-3">
                <Label className="text-[0.62rem]">Subject</Label>
                <Input
                  value={template.subject}
                  onChange={(event) =>
                    setTemplates((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, subject: event.target.value } : item,
                      ),
                    )
                  }
                  className="h-9 rounded-lg bg-card text-xs"
                />
                <Label className="text-[0.62rem]">Body</Label>
                <Textarea
                  value={template.body}
                  onChange={(event) =>
                    setTemplates((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, body: event.target.value } : item,
                      ),
                    )
                  }
                  className="min-h-[90px] rounded-lg bg-card text-xs"
                />
              </div>
            </details>
          ))}
          <Button
            size="sm"
            variant="outline"
            className="rounded-full bg-transparent"
            onClick={() =>
              setTemplates((current) => [
                ...current,
                { key: "custom.event", subject: "Update from {{company}}", body: "{{title}}\n\n{{body}}" },
              ])
            }
          >
            Add template
          </Button>
        </div>
      </Panel>

      {canStaff && (
        <Panel>
          <PanelHeader
            title="Staff & roles"
            description="Only a super admin can grant access or change permissions. The last super admin cannot be revoked."
          />
          <div className="border-b border-line px-5 py-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={staffEmail}
                onChange={(event) => setStaffEmail(event.target.value)}
                placeholder="Existing account email"
                className="h-9 flex-1 rounded-lg bg-card text-xs"
              />
              <select
                aria-label="Staff role"
                value={staffRole}
                onChange={(event) => setStaffRole(event.target.value as "admin" | "super_admin")}
                className="h-9 rounded-lg border border-line bg-card px-2 text-xs text-ink"
              >
                <option value="admin">Administrator</option>
                <option value="super_admin">Super admin</option>
              </select>
              <Button
                size="sm"
                className="h-9 rounded-full px-3"
                disabled={pending || !staffEmail}
                onClick={async () => {
                  setPending(true);
                  try {
                    await promote({ email: staffEmail, role: staffRole });
                    toast.success("Staff access granted.");
                    setStaffEmail("");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not grant access.");
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <UserPlus className="size-3.5" /> Grant
              </Button>
            </div>
            <Input
              value={staffReason}
              onChange={(event) => setStaffReason(event.target.value)}
              placeholder="Reason (required to revoke or suspend)"
              className="mt-2 h-9 rounded-lg bg-card text-xs"
            />
          </div>
          {staff === undefined ? (
            <LoadingState label="Loading staff" />
          ) : staff.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No staff accounts" />
          ) : (
            <ul className="divide-y divide-line">
              {staff.map((member) => (
                <li key={member._id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-ink">
                        {member.name ?? member.email} · <span className="capitalize">{(member.role ?? "admin").replace("_", " ")}</span>
                      </p>
                      <p className="text-[0.62rem] text-muted-foreground">
                        {member.email} · {member.permissions.length || "all"} permissions
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill status={member.status} />
                      {member.role === "admin" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-full bg-transparent px-2.5"
                          onClick={() => {
                            setPermissionTarget(member._id);
                            setPermissionDraft(member.permissions);
                          }}
                        >
                          Permissions
                        </Button>
                      )}
                      {member._id !== user?._id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-full bg-transparent px-2.5"
                          disabled={pending || staffReason.trim().length < 3}
                          onClick={async () => {
                            setPending(true);
                            try {
                              await revoke({ userId: member._id, reason: staffReason });
                              toast.success("Staff access revoked.");
                              setStaffReason("");
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : "Could not revoke access.");
                            } finally {
                              setPending(false);
                            }
                          }}
                        >
                          Revoke
                        </Button>
                      )}
                      {member._id !== user?._id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 rounded-full px-2.5 text-destructive"
                          disabled={pending || staffReason.trim().length < 3}
                          onClick={async () => {
                            setPending(true);
                            try {
                              await setStaffStatus({
                                userId: member._id,
                                status: member.status === "suspended" ? "active" : "suspended",
                                reason: staffReason,
                              });
                              toast.success(member.status === "suspended" ? "Staff reinstated." : "Staff suspended.");
                              setStaffReason("");
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : "Could not change staff status.");
                            } finally {
                              setPending(false);
                            }
                          }}
                        >
                          {member.status === "suspended" ? "Reinstate" : "Suspend"}
                        </Button>
                      )}
                    </div>
                  </div>
                  {permissionTarget === member._id && (
                    <div className="mt-3 rounded-xl border border-line p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                          <label key={key} className="flex items-start gap-2 text-[0.65rem] leading-4 text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={permissionDraft.includes(key)}
                              onChange={(event) =>
                                setPermissionDraft((current) =>
                                  event.target.checked
                                    ? [...current, key]
                                    : current.filter((item) => item !== key),
                                )
                              }
                              className="mt-0.5 accent-[var(--primary)]"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                      <div className="mt-2 flex justify-end gap-2">
                        <Button size="sm" variant="ghost" className="h-8 rounded-full" onClick={() => setPermissionTarget(null)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 rounded-full"
                          disabled={pending}
                          onClick={async () => {
                            setPending(true);
                            try {
                              await setPermissions({ userId: member._id, permissions: permissionDraft });
                              toast.success("Permissions updated.");
                              setPermissionTarget(null);
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : "Could not update permissions.");
                            } finally {
                              setPending(false);
                            }
                          }}
                        >
                          Save permissions
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <SupabasePanel />

      <Panel>
        <PanelHeader
          title="Email delivery issues"
          description="Failed or skipped deliveries are retained. Retry safely without duplicating in-app notifications."
        />
        {issues === undefined ? (
          <LoadingState label="Loading delivery records" />
        ) : issues.failed.length === 0 && issues.skipped.length === 0 ? (
          <EmptyState icon={MailWarning} title="No delivery issues" description="Queued emails are delivered through the configured integration gateway." />
        ) : (
          <ul className="max-h-[320px] divide-y divide-line overflow-y-auto">
            {[...issues.failed, ...issues.skipped].map((item) => (
              <li key={item._id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-ink">{item.title}</p>
                  <p className="text-[0.62rem] text-muted-foreground">
                    {item.emailStatus} · attempts {item.emailAttempts} · {formatDateTime(item.createdAt)}
                    {item.emailError ? ` · ${item.emailError}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full bg-transparent px-3"
                  onClick={async () => {
                    try {
                      await retryEmail({ notificationId: item._id });
                      toast.success("Delivery queued again.");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not retry delivery.");
                    }
                  }}
                >
                  Retry
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/**
 * Supabase wiring at a glance: which keys each runtime can see and whether the
 * project answers. Keys are added in the project Keys tab, never in code.
 */
function SupabasePanel() {
  const checkServer = useAction(api.supabase.status);
  const [browser, setBrowser] = useState<{ ok: boolean; detail: string } | null>(null);
  const [server, setServer] = useState<{
    ok: boolean;
    detail: string;
    buckets: string[];
  } | null>(null);
  const [pending, setPending] = useState<"browser" | "server" | null>(null);

  const runBrowserCheck = async () => {
    setPending("browser");
    try {
      const result = await checkSupabaseHealth();
      setBrowser(
        result.ok
          ? { ok: true, detail: "Auth endpoint answered with the anon key." }
          : { ok: false, detail: result.error ?? "Unreachable." },
      );
    } finally {
      setPending(null);
    }
  };

  const runServerCheck = async () => {
    setPending("server");
    try {
      const result = await checkServer({});
      setServer({
        ok: result.configured && result.reachable,
        detail: result.error
          ? result.error
          : `Service role key reached ${result.projectRef ?? "the project"}.`,
        buckets: result.buckets,
      });
    } catch (error) {
      setServer({
        ok: false,
        detail: error instanceof Error ? error.message : "Could not check Supabase.",
        buckets: [],
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Supabase"
        description="Postgres, Storage and Realtime as a second data plane alongside Convex. Convex Auth stays the app's identity provider."
      />

      <div className="grid gap-4 px-5 py-5 lg:grid-cols-2">
        <div className="rounded-xl border border-line p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-xs font-semibold text-ink">
              <Database className="size-3.5 text-primary" />
              Browser keys
            </p>
            <StatusPill status={supabaseConfigured ? "active" : "pending"} />
          </div>
          <p className="mt-2 text-[0.68rem] leading-5 text-muted-foreground">
            {supabaseConfigured
              ? `Client ready for ${supabaseUrl.replace(/^https?:\/\//, "")}. Only the anon key is exposed to the browser.`
              : "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Keys tab to enable browser-side Supabase calls."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-full bg-transparent px-3"
              disabled={!supabaseConfigured || pending !== null}
              onClick={runBrowserCheck}
            >
              {pending === "browser" && <Loader2 className="size-3.5 animate-spin" />}
              Test browser keys
            </Button>
            {browser && (
              <span
                className={
                  browser.ok
                    ? "text-[0.68rem] text-muted-foreground"
                    : "text-[0.68rem] text-destructive"
                }
              >
                {browser.detail}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-line p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-xs font-semibold text-ink">
              <ShieldCheck className="size-3.5 text-primary" />
              Server keys
            </p>
            <StatusPill status={server?.ok ? "active" : "pending"} />
          </div>
          <p className="mt-2 text-[0.68rem] leading-5 text-muted-foreground">
            {server?.ok
              ? `Reachable. ${server.buckets.length} storage bucket${server.buckets.length === 1 ? "" : "s"}${
                  server.buckets.length ? `: ${server.buckets.join(", ")}` : ""
                }.`
              : server?.detail ??
                "Add SUPABASE_SERVICE_ROLE_KEY in the Keys tab for server-side storage and admin calls. It is used only inside Convex actions."}
          </p>
          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-full bg-transparent px-3"
              disabled={pending !== null}
              onClick={runServerCheck}
            >
              {pending === "server" && <Loader2 className="size-3.5 animate-spin" />}
              Check server connection
            </Button>
          </div>
        </div>
      </div>

      {(!supabaseConfigured || server?.ok === false) && (
        <div className="px-5 pb-5">
          <Callout tone="warning" title="Keys required">
            Add <code className="font-mono text-[0.68rem]">VITE_SUPABASE_URL</code>,{" "}
            <code className="font-mono text-[0.68rem]">VITE_SUPABASE_ANON_KEY</code> and{" "}
            <code className="font-mono text-[0.68rem]">SUPABASE_SERVICE_ROLE_KEY</code> in the
            project Keys tab (Supabase dashboard → Project Settings → API). Everything
            else - data access and storage calls - is wired already.
          </Callout>
        </div>
      )}
    </Panel>
  );
}
