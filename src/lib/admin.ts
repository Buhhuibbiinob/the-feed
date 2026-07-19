import type { SupabaseClient } from "@supabase/supabase-js";

export async function isAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  return !!data?.is_admin;
}
