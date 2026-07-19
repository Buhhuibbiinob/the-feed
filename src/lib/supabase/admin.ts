import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client for privileged actions (e.g. deleting a user account)
// that the anon/RLS-bound client can never be allowed to do. Server-only —
// never import this from a client component.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — add it to .env.local (Supabase Project Settings > API) to enable admin actions."
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
