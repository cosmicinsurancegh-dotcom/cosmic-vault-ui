import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase browser client.
 *
 * Identity in this product stays with Convex Auth, so the Supabase client is
 * created without a session store: it is used for Postgres reads/writes and
 * Storage calls that are protected by row-level security policies, never to
 * hold a second login session.
 *
 * Keys are read from the Vite env (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
 * Only the anon key may live in the browser; the service role key is used
 * exclusively by the Convex action in `src/convex/supabase.ts`.
 */

const url = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "").trim();
const anonKey = (
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ""
).trim();

export const supabaseUrl = url;
export const supabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** The shared client, or `null` when the Supabase keys are not configured yet. */
export function getSupabase(): SupabaseClient | null {
  if (!client && supabaseConfigured) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/** Public URL for an object in a public Supabase Storage bucket. */
export function supabaseStorageUrl(bucket: string, path: string) {
  if (!supabaseConfigured) return null;
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${path.replace(/^\//, "")}`;
}

/**
 * Cheap round-trip that proves the browser-side keys reach the project.
 * `/auth/v1/health` is the public health endpoint, so this works with the
 * anon key and does not need a table, bucket or policy to exist.
 */
export async function checkSupabaseHealth(): Promise<{
  ok: boolean;
  status?: number;
  error?: string;
}> {
  if (!supabaseConfigured) {
    return { ok: false, error: "Supabase browser keys are not set." };
  }
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      headers: { apikey: anonKey },
    });
    return response.ok
      ? { ok: true, status: response.status }
      : { ok: false, status: response.status, error: `HTTP ${response.status}` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Request failed.",
    };
  }
}
