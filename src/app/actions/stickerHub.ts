"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Removing one sticker from your own hub.
//
// The only write left in the sticker feature. There is deliberately no
// way to add one: the hub holds what people already placed, and the
// point of this pass was to stop stickers being scattered over a page,
// not to reopen the drawer.

export async function removeHubSticker(formData: FormData) {
  const id = String(formData.get("sticker_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Scoped to the caller's own rows. The table's RLS says the same
  // thing, so this is the second lock rather than the only one.
  await supabase.from("profile_stickers").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/profile", "layout");
}
