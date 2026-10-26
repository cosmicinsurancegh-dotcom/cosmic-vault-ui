import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../src/convex/schema";
import { api, internal } from "../src/convex/_generated/api";
import {
  GATEWAY_FROM_ADDRESS,
  emailSender,
  senderAddress,
} from "../src/convex/lib/sender";

/**
 * Who outbound email is sent from. The address is set in Settings so an admin
 * can change it without a deployment; the delivery actions read it at send time
 * and stamp it under the company name. A deployment that has not set one keeps
 * using EMAIL_FROM_ADDRESS.
 */

const modules = {
  "../src/convex/_generated/api.js": () =>
    import("../src/convex/_generated/api.js"),
  "../src/convex/settings.ts": () => import("../src/convex/settings"),
  "../src/convex/notifications.ts": () => import("../src/convex/notifications"),
  "../src/convex/email.ts": () => import("../src/convex/email"),
};

const test = () => convexTest(schema, modules);
type Test = ReturnType<typeof test>;

/** Everything `settings.update` needs to succeed apart from the from address. */
const SETTINGS_ARGS = {
  companyName: "Cosmic Vault Insurance",
  supportEmail: "help@cosmicvault.test",
  defaultCurrency: "GBP",
  commissionEnabled: false,
  renewalNoticeDays: 30,
  claimSlaDays: 10,
  allowedCurrencies: ["GBP"],
  emailTemplates: [],
};

async function seedSettingsAdmin(t: Test) {
  const admin = await t.run(
    async (ctx) =>
      await ctx.db.insert("users", {
        name: "Sam Super",
        email: "super@cosmicvault.test",
        role: "super_admin",
        status: "active",
      }),
  );
  await t.run(
    async (ctx) =>
      await ctx.db.insert("currencies", {
        code: "GBP",
        name: "Pound sterling",
        symbol: "£",
        minorUnits: 2,
        active: true,
      }),
  );
  return admin;
}

describe("email sender header", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("names the configured company and its address", () => {
    expect(
      emailSender({
        emailFromAddress: "mail@cosmicvault.co",
        companyName: "Cosmic Vault Insurance",
      }),
    ).toBe("Cosmic Vault Insurance <mail@cosmicvault.co>");
  });

  it("keeps the brand name when no company is configured", () => {
    vi.stubEnv("EMAIL_FROM_ADDRESS", "");
    expect(emailSender({ emailFromAddress: "mail@cosmicvault.co" })).toBe(
      "Cosmic Vault Insurance <mail@cosmicvault.co>",
    );
  });

  it("falls back to the deployment address, then the gateway's sender", () => {
    vi.stubEnv("EMAIL_FROM_ADDRESS", "deploy@cosmicvault.co");
    expect(senderAddress()).toBe("deploy@cosmicvault.co");
    expect(emailSender({ companyName: "Cosmic Vault" })).toBe(
      "Cosmic Vault <deploy@cosmicvault.co>",
    );

    vi.stubEnv("EMAIL_FROM_ADDRESS", "");
    expect(senderAddress()).toBe(GATEWAY_FROM_ADDRESS);
  });

  /**
   * A message with no sender falls back to the gateway client's own default,
   * `noreply@project.freebuff.dev` - a domain with no SPF or DKIM record, which
   * a receiving provider cannot authenticate and therefore drops while the
   * app still records the send as successful. The header must never be left
   * to that default.
   */
  it("always stamps an address the receiving side can authenticate", () => {
    vi.stubEnv("EMAIL_FROM_ADDRESS", "");
    expect(emailSender()).toBe(
      "Cosmic Vault Insurance <noreply@freebuff.com>",
    );
    expect(GATEWAY_FROM_ADDRESS).not.toContain("project.freebuff.dev");
  });

  it("prefers the address set in Settings over the deployment's", () => {
    vi.stubEnv("EMAIL_FROM_ADDRESS", "deploy@cosmicvault.co");
    expect(senderAddress("settings@cosmicvault.co")).toBe(
      "settings@cosmicvault.co",
    );
  });
});

describe("settings email sender", () => {
  it("saves the address an admin sets and hands it to delivery", async () => {
    const t = test();
    const admin = await seedSettingsAdmin(t);

    // Saved the way the settings form sends it: typed, possibly untidy.
    await t.withIdentity({ subject: admin }).mutation(api.settings.update, {
      ...SETTINGS_ARGS,
      emailFromAddress: "  Mail@CosmicVault.co ",
    });

    // This is what both delivery actions read before they send.
    const sender = await t.query(internal.settings.emailSender, {});
    expect(sender).toEqual({
      emailFromAddress: "mail@cosmicvault.co",
      companyName: "Cosmic Vault Insurance",
    });
    expect(emailSender(sender)).toBe(
      "Cosmic Vault Insurance <mail@cosmicvault.co>",
    );
  });

  it("rejects an address that is not an email", async () => {
    const t = test();
    const admin = await seedSettingsAdmin(t);

    await expect(
      t.withIdentity({ subject: admin }).mutation(api.settings.update, {
        ...SETTINGS_ARGS,
        emailFromAddress: "not-an-address",
      }),
    ).rejects.toThrow(/valid email from address/i);
  });

  it("treats a blank address as the deployment's", async () => {
    const t = test();
    const admin = await seedSettingsAdmin(t);

    await t.withIdentity({ subject: admin }).mutation(api.settings.update, {
      ...SETTINGS_ARGS,
      emailFromAddress: "   ",
    });

    const sender = await t.query(internal.settings.emailSender, {});
    expect(sender.emailFromAddress).toBeUndefined();
  });
});

/**
 * The header that actually leaves the deployment. `email.deliver` hands the
 * message to the gateway, so the only place the fix can be seen is the request
 * body it posts: a configured deployment keeps its own address, and one that
 * has configured nothing must still send under the company name from an
 * address the receiving side can authenticate.
 */
describe("delivery request sender", () => {
  const originalKey = process.env.VLY_INTEGRATION_KEY;
  const originalFrom = process.env.EMAIL_FROM_ADDRESS;

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.VLY_INTEGRATION_KEY = originalKey;
    process.env.EMAIL_FROM_ADDRESS = originalFrom;
  });

  /** Runs the real delivery action and returns the `from` it posted. */
  async function deliveredFrom(t: Test) {
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Casey Client",
        email: "client@cosmicvault.test",
        role: "customer",
        status: "active",
      }),
    );
    const notificationId = await t.run((ctx) =>
      ctx.db.insert("notifications", {
        userId,
        type: "shipment.status_changed",
        title: "Gold bullion is in transit",
        body: "SHP-1 · London → Zurich",
        dedupeKey: `shipment.status:test:${userId}`,
        emailStatus: "queued",
        emailAttempts: 0,
        createdAt: Date.now(),
      }),
    );

    process.env.VLY_INTEGRATION_KEY = "test-key";
    const posted: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", async (_url: unknown, init: unknown) => {
      posted.push(JSON.parse((init as { body: string }).body));
      return new Response(JSON.stringify({ id: "msg-1", status: "sent" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    await t.action(internal.email.deliver, {
      notificationId,
      to: "client@cosmicvault.test",
      subject: "Shipment in transit",
      text: "Hello Casey, your shipment is on its way.",
    });

    return posted[0]?.from;
  }

  it("never lets the client pick the sender when nothing is configured", async () => {
    vi.stubEnv("EMAIL_FROM_ADDRESS", "");
    expect(await deliveredFrom(test())).toBe(
      "Cosmic Vault Insurance <noreply@freebuff.com>",
    );
  });

  it("sends from the address the admin set in Settings", async () => {
    const t = test();
    const admin = await seedSettingsAdmin(t);
    await t.withIdentity({ subject: admin }).mutation(api.settings.update, {
      ...SETTINGS_ARGS,
      emailFromAddress: "mail@cosmicvault.co",
    });

    vi.stubEnv("EMAIL_FROM_ADDRESS", "");
    expect(await deliveredFrom(t)).toBe(
      "Cosmic Vault Insurance <mail@cosmicvault.co>",
    );
  });
});

/**
 * The test message staff send themselves from Settings. It exists because a
 * stored "sent" row cannot show whether mail reaches an inbox: the console asks
 * the gateway, mails the signed-in staff member with the saved sender, and shows
 * what came back.
 */
describe("settings test email", () => {
  const originalKey = process.env.VLY_INTEGRATION_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    if (originalKey === undefined) delete process.env.VLY_INTEGRATION_KEY;
    else process.env.VLY_INTEGRATION_KEY = originalKey;
  });

  /** The audit entries written for test sends, newest last. */
  async function testSends(t: Test) {
    return await t.run((ctx) =>
      ctx.db
        .query("auditLogs")
        .withIndex("by_action", (q) => q.eq("action", "settings.email_test"))
        .collect(),
    );
  }

  /** Records what the gateway was asked to send, and answers with `body`. */
  function gatewayAnswers(body: Record<string, unknown>) {
    const posted: Array<Record<string, unknown>> = [];
    process.env.VLY_INTEGRATION_KEY = "test-key";
    vi.stubGlobal("fetch", async (_url: unknown, init: unknown) => {
      posted.push(JSON.parse((init as { body: string }).body));
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    return posted;
  }

  it("mails the signed-in staff member with the saved sender", async () => {
    const t = test();
    const admin = await seedSettingsAdmin(t);
    await t.withIdentity({ subject: admin }).mutation(api.settings.update, {
      ...SETTINGS_ARGS,
      emailFromAddress: "mail@cosmicvault.co",
    });
    const posted = gatewayAnswers({ id: "msg-1", status: "sent" });

    const result = await t
      .withIdentity({ subject: admin })
      .action(api.email.sendTest, {});

    expect(result).toEqual({
      status: "sent",
      error: null,
      to: "super@cosmicvault.test",
      from: "Cosmic Vault Insurance <mail@cosmicvault.co>",
    });
    // The recipient is the caller's own address, taken from the session.
    expect(posted[0]).toMatchObject({
      to: ["super@cosmicvault.test"],
      from: "Cosmic Vault Insurance <mail@cosmicvault.co>",
    });

    // The trail records who checked delivery, from which address, and that the
    // provider took it - not just that some test ran.
    const audit = await testSends(t);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorId: admin,
      actorRole: "super_admin",
      entityType: "settings",
      entityId: "email",
      after: {
        to: "super@cosmicvault.test",
        from: "Cosmic Vault Insurance <mail@cosmicvault.co>",
        status: "sent",
      },
    });
    expect(audit[0]?.reason).toBeUndefined();
  });

  it("reports a message the gateway calls failed", async () => {
    const t = test();
    const admin = await seedSettingsAdmin(t);
    gatewayAnswers({
      status: "failed",
      error: "Sender domain is not verified for this project.",
    });

    const result = await t
      .withIdentity({ subject: admin })
      .action(api.email.sendTest, {});

    expect(result).toMatchObject({
      status: "failed",
      error: "Sender domain is not verified for this project.",
      to: "super@cosmicvault.test",
    });

    const audit = await testSends(t);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorId: admin,
      after: { status: "failed" },
      reason: "Sender domain is not verified for this project.",
    });
  });

  it("audits an attempt no provider was available for", async () => {
    const t = test();
    const admin = await seedSettingsAdmin(t);
    // No key on the deployment: the send is skipped, and that is still an
    // attempt somebody made and should be able to see later.
    vi.stubEnv("VLY_INTEGRATION_KEY", "");

    const result = await t
      .withIdentity({ subject: admin })
      .action(api.email.sendTest, {});

    expect(result).toMatchObject({ status: "skipped" });
    const audit = await testSends(t);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorId: admin,
      after: { status: "skipped", to: "super@cosmicvault.test" },
      reason: "Email provider not configured (VLY_INTEGRATION_KEY missing).",
    });
  });

  it("lists the last checks with who made them and what came back", async () => {
    const t = test();
    const admin = await seedSettingsAdmin(t);
    gatewayAnswers({ status: "sent" });
    await t.withIdentity({ subject: admin }).action(api.email.sendTest, {});

    vi.unstubAllGlobals();
    gatewayAnswers({
      status: "failed",
      error: "Sender domain is not verified for this project.",
    });
    await t.withIdentity({ subject: admin }).action(api.email.sendTest, {});

    const checks = await t
      .withIdentity({ subject: admin })
      .query(api.settings.testEmailChecks, {});

    expect(checks).toHaveLength(2);
    // Newest first, so the panel reads as a log.
    expect(checks[0]).toMatchObject({
      actorName: "Sam Super",
      status: "failed",
      error: "Sender domain is not verified for this project.",
      to: "super@cosmicvault.test",
    });
    expect(checks[1]).toMatchObject({ actorName: "Sam Super", status: "sent" });
    expect(checks[1]?.error).toBeNull();

    const latest = await t
      .withIdentity({ subject: admin })
      .query(api.settings.testEmailChecks, { limit: 1 });
    expect(latest).toHaveLength(1);
    expect(latest[0]?._id).toBe(checks[0]?._id);
  });

  it("keeps the checks away from accounts without settings access", async () => {
    const t = test();
    await seedSettingsAdmin(t);
    const customer = await t.run(
      async (ctx) =>
        await ctx.db.insert("users", {
          name: "Casey Client",
          email: "client@cosmicvault.test",
          role: "customer",
          status: "active",
        }),
    );

    await expect(
      t
        .withIdentity({ subject: customer })
        .query(api.settings.testEmailChecks, {}),
    ).rejects.toThrow(/restricted to staff|permission/i);
  });

  it("cannot be used by accounts that cannot manage settings", async () => {
    const t = test();
    const customer = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Casey Client",
        email: "client@cosmicvault.test",
        role: "customer",
        status: "active",
      }),
    );
    const posted = gatewayAnswers({ status: "sent" });

    await expect(
      t.withIdentity({ subject: customer }).action(api.email.sendTest, {}),
    ).rejects.toThrow(/restricted to staff|permission/i);
    expect(posted).toHaveLength(0);
  });
});
