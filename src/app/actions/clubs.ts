"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function joinClub(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const clubId = String(formData.get("club_id") ?? "");
  if (!clubId) return;

  await supabase.from("club_members").insert({ club_id: clubId, user_id: user.id });
  revalidatePath(`/clubs/${clubId}`);
  revalidatePath("/clubs");
}

export async function leaveClub(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const clubId = String(formData.get("club_id") ?? "");
  if (!clubId) return;

  await supabase.from("club_members").delete().eq("club_id", clubId).eq("user_id", user.id);
  revalidatePath(`/clubs/${clubId}`);
  revalidatePath("/clubs");
}
