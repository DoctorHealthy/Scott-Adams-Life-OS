import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client for trusted server paths that act across users (the
// reminder cron, Telegram link completion). Bypasses RLS. Server-only; the
// secret key never reaches the browser.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SECRET_KEY is not set on the server.");
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
