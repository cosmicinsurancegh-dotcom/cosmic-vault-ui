import {
  Callout,
  Detail,
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
import { api } from "@/convex/_generated/api";
import { formatDate } from "@/lib/format";
import { normalizeRole } from "@/lib/permissions";
import { useMutation, useQuery } from "convex/react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function ProfilePage() {
  const me = useQuery(api.customers.me);
  const reference = useQuery(api.setup.referenceData);
  const brokerProfile = useQuery(api.brokers.myProfile);
  const update = useMutation(api.customers.updateProfile);
  const updateBroker = useMutation(api.brokers.updateSelf);
  const createTicket = useMutation(api.tickets.create);

  const role = normalizeRole(me?.user?.role);
  const profile = me?.profile;

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    dateOfBirth: "",
    country: "GB",
    city: "",
    addressLine: "",
    postalCode: "",
    currency: "GBP",
    locale: "en-GB",
    timezone: "Europe/London",
    preferredLanguage: "en",
    marketingOptIn: false,
  });
  const [brokerForm, setBrokerForm] = useState({ contactName: "", phone: "" });
  const [request, setRequest] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      fullName: profile.fullName,
      phone: profile.phone ?? "",
      dateOfBirth: profile.dateOfBirth ?? "",
      country: profile.country,
      city: profile.city ?? "",
      addressLine: profile.addressLine ?? "",
      postalCode: profile.postalCode ?? "",
      currency: profile.currency,
      locale: profile.locale,
      timezone: profile.timezone,
      preferredLanguage: profile.preferredLanguage,
      marketingOptIn: profile.marketingOptIn,
    });
  }, [profile]);

  useEffect(() => {
    if (!brokerProfile?.profile) return;
    setBrokerForm({
      contactName: brokerProfile.profile.contactName,
      phone: brokerProfile.profile.phone ?? "",
    });
  }, [brokerProfile]);

  if (me === undefined || reference === undefined) {
    return <LoadingState label="Loading profile" />;
  }

  if (role === "broker") {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Broker profile"
          title="Your brokerage contact details."
          description="Company, agreement, countries, and commission are managed by the insurer. You can keep the contact details current."
        />
        <Panel>
          <PanelHeader title="Brokerage" description="Read-only commercial terms." />
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            <Detail label="Organisation">{brokerProfile?.profile?.orgName ?? "Not set up yet"}</Detail>
            <Detail label="Broker reference">{brokerProfile?.profile?.reference ?? "-"}</Detail>
            <Detail label="Status">
              {brokerProfile?.profile ? <StatusPill status={brokerProfile.profile.status} /> : "-"}
            </Detail>
            <Detail label="Agreement reference">{brokerProfile?.profile?.agreementRef ?? "-"}</Detail>
            <Detail label="Countries">
              {brokerProfile?.profile?.countries.join(", ") || "-"}
            </Detail>
            <Detail label="Commission">
              {brokerProfile?.commissionEnabled
                ? `${brokerProfile.profile?.commissionRate ?? 0}%`
                : "Disabled"}
            </Detail>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Contact details" />
          <div className="space-y-3 px-5 py-5 sm:max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="broker-contact">Contact name</Label>
              <Input
                id="broker-contact"
                value={brokerForm.contactName}
                onChange={(event) => setBrokerForm({ ...brokerForm, contactName: event.target.value })}
                className="h-10 rounded-xl bg-card"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="broker-phone">Phone</Label>
              <Input
                id="broker-phone"
                value={brokerForm.phone}
                onChange={(event) => setBrokerForm({ ...brokerForm, phone: event.target.value })}
                className="h-10 rounded-xl bg-card"
              />
            </div>
            <Button
              className="rounded-full"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                try {
                  await updateBroker(brokerForm);
                  toast.success("Contact details updated.");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not update details.");
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Save details
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Profile & account"
        title="The details behind your cover."
        description="Identity changes may require verification. Sensitive changes are recorded in the audit trail."
      />

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Panel>
          <PanelHeader
            title="Personal details"
            description={`Customer reference ${profile?.reference ?? "-"}`}
            action={profile ? <StatusPill status={profile.verificationStatus} /> : undefined}
          />
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="profile-name">Full name</Label>
              <Input
                id="profile-name"
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                className="h-10 rounded-xl bg-card"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" value={me.user?.email ?? ""} readOnly className="h-10 rounded-xl bg-muted" />
              <p className="text-[0.62rem] text-muted-foreground">
                Email is tied to sign-in. Contact support to change it securely.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-phone">Phone</Label>
              <Input
                id="profile-phone"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                className="h-10 rounded-xl bg-card"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-dob">Date of birth</Label>
              <Input
                id="profile-dob"
                type="date"
                value={form.dateOfBirth}
                onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })}
                className="h-10 rounded-xl bg-card"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-country">Country</Label>
              <select
                id="profile-country"
                value={form.country}
                onChange={(event) => setForm({ ...form, country: event.target.value })}
                className="h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink"
              >
                {reference.countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="profile-address">Address</Label>
              <Input
                id="profile-address"
                value={form.addressLine}
                onChange={(event) => setForm({ ...form, addressLine: event.target.value })}
                className="h-10 rounded-xl bg-card"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-city">City</Label>
              <Input
                id="profile-city"
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
                className="h-10 rounded-xl bg-card"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-postal">Postal code</Label>
              <Input
                id="profile-postal"
                value={form.postalCode}
                onChange={(event) => setForm({ ...form, postalCode: event.target.value })}
                className="h-10 rounded-xl bg-card"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-currency">Preferred currency</Label>
              <select
                id="profile-currency"
                value={form.currency}
                onChange={(event) => setForm({ ...form, currency: event.target.value })}
                className="h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink"
              >
                {reference.currencies
                  .filter((currency) => currency.active)
                  .map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-language">Language</Label>
              <select
                id="profile-language"
                value={form.preferredLanguage}
                onChange={(event) => setForm({ ...form, preferredLanguage: event.target.value })}
                className="h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink"
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="es">Español</option>
                <option value="nl">Nederlands</option>
                <option value="ar">العربية</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-timezone">Time zone</Label>
              <Input
                id="profile-timezone"
                value={form.timezone}
                onChange={(event) => setForm({ ...form, timezone: event.target.value })}
                className="h-10 rounded-xl bg-card"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-locale">Locale</Label>
              <Input
                id="profile-locale"
                value={form.locale}
                onChange={(event) => setForm({ ...form, locale: event.target.value })}
                className="h-10 rounded-xl bg-card"
              />
            </div>
            <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground sm:col-span-2">
              <input
                type="checkbox"
                checked={form.marketingOptIn}
                onChange={(event) => setForm({ ...form, marketingOptIn: event.target.checked })}
                className="mt-0.5 accent-[var(--primary)]"
              />
              Send me occasional product updates. Service and security messages are always sent.
            </label>
            <div className="sm:col-span-2">
              <Button
                className="rounded-full"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  try {
                    await update(form);
                    toast.success("Profile updated.");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not update the profile.");
                  } finally {
                    setPending(false);
                  }
                }}
              >
                {pending && <Loader2 className="size-4 animate-spin" />} Save changes
              </Button>
            </div>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Account security" />
            <div className="space-y-3 px-5 py-4">
              <Detail label="Sign-in method">Email one-time code (passwordless)</Detail>
              <Detail label="Email verified">
                {me.user?.emailVerificationTime
                  ? formatDate(me.user.emailVerificationTime)
                  : "Verified when you signed in with a code"}
              </Detail>
              <Detail label="Role">Customer</Detail>
              <Callout tone="info">
                Multifactor authentication beyond the email code is not configured by this
                authentication provider. Do not share your one-time code with anyone.
              </Callout>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Data & account requests"
              description="Access, correction, or closure requests open a support case."
            />
            <div className="space-y-3 px-5 py-4">
              <Textarea
                value={request}
                onChange={(event) => setRequest(event.target.value)}
                placeholder="Tell us what you need - for example, a copy of your data or an account closure request."
                className="min-h-[90px] rounded-xl bg-card"
              />
              <Button
                variant="outline"
                className="rounded-full bg-transparent"
                disabled={pending || request.trim().length < 10}
                onClick={async () => {
                  setPending(true);
                  try {
                    const result = await createTicket({
                      category: "account",
                      subject: "Account data request",
                      message: request,
                    });
                    setRequest("");
                    toast.success("Request submitted.", { description: result.reference });
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not submit the request.");
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <ShieldCheck className="size-4" /> Submit request
              </Button>
              <p className="text-[0.62rem] leading-5 text-muted-foreground">
                Account closure is reviewed manually. Policies and financial records are retained for
                the applicable legal period.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
