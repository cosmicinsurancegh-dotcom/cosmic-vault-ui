"use node";

import { createClient } from "@supabase/supabase-js";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

/**
 * Server-side Supabase access.
 *
 * Runs in the Convex Node runtime so the service role key never reaches the
 * browser. The key is read from the deployment environment - the same place
 * `VLY_INTEGRATION_KEY` comes from - so it is added through the project's Keys
 * tab rather than committed anywhere.
 *
 * If the service role key is absent the module stays inert: nothing throws and
 * the admin console reports exactly which variables are missing.
 */

const url = (
  process.env.SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  ""
).trim();
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

const serviceConfigured = Boolean(url && serviceRoleKey);

/** The shared service-role client, or `null` when the server keys are missing. */
function getServiceClient() {
  if (!serviceConfigured) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Reports how the Supabase integration is wired: which keys the server can see,
 * whether the project answers, and which storage buckets exist. Used by the
 * admin console so configuration problems are visible rather than silent.
 */
export const status = action({
  args: {},
  handler: async (ctx) => {
    await ctx.runQuery(internal.adminGate.staffGate, {});

    const projectRef = url ? url.replace(/^https?:\/\//, "").split(".")[0] : null;
    const base = {
      urlPresent: Boolean(url),
      serviceKeyPresent: Boolean(serviceRoleKey),
      projectRef,
    };

    if (!serviceConfigured) {
      return {
        ...base,
        configured: false,
        reachable: false,
        buckets: [] as string[],
        error:
          "Add SUPABASE_SERVICE_ROLE_KEY (and VITE_SUPABASE_URL) in the Keys tab to enable server-side Supabase calls.",
      };
    }

    const client = getServiceClient()!;
    try {
      const { data, error } = await client.storage.listBuckets();
      if (error) throw new Error(error.message);
      return {
        ...base,
        configured: true,
        reachable: true,
        buckets: (data ?? []).map((bucket) => bucket.name),
        error: null as string | null,
      };
    } catch (error) {
      return {
        ...base,
        configured: true,
        reachable: false,
        buckets: [] as string[],
        error: error instanceof Error ? error.message : "Supabase request failed.",
      };
    }
  },
});

/**
 * Creates a short-lived signed URL for a private object. Staff only; useful for
 * serving Supabase-hosted files inside the console without making a bucket public.
 */
export const signedUrl = action({
  args: {
    bucket: v.string(),
    path: v.string(),
    expiresIn: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.adminGate.staffGate, {});
    const client = getServiceClient();
    if (!client) {
      throw new Error(
        "Supabase is not configured on this deployment. Add SUPABASE_SERVICE_ROLE_KEY in the Keys tab.",
      );
    }
    const { data, error } = await client.storage
      .from(args.bucket)
      .createSignedUrl(args.path, args.expiresIn ?? 300);
    if (error) throw new Error(error.message);
    return { url: data.signedUrl, expiresIn: args.expiresIn ?? 300 };
  },
});
