"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Deleting your own account.
//
// Required by the App Store: an app that lets people create an account has
// to let them delete it from inside the app, not by emailing whoever runs
// it. Guideline 5.1.1(v), and it is an automatic rejection - but it would
// be the right thing to have anyway, since "you can join but you can't
// leave" is not a defensible position for a website either.
//
// It is a real deletion, not a flag. profiles.id references auth.users
// with `on delete cascade`, and forty tables cascade from profiles, so
// removing the auth user takes the reviews, comments, likes, follows,
// messages, stickers, lists and the rest with it.

export type DeleteAccountState = { error?: string };

export async function deleteMyAccount(
  _prev: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle<{ username: string }>();
  if (!profile) return { error: "Couldn't find your account." };

  // Typing the username rather than ticking a box. This is the one action
  // on the site that cannot be undone, and a confirmation you can click
  // through without reading is not a confirmation.
  const typed = String(formData.get("confirm") ?? "").trim();
  if (typed.toLowerCase() !== profile.username.toLowerCase()) {
    return { error: `Type ${profile.username} exactly to confirm.` };
  }

  // The auth user lives outside the schema RLS covers, so this needs the
  // service key. Without it the account would appear to delete - the
  // profile row would go - while the login kept working.
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Account deletion isn't configured. Contact the site owner." };
  }

  // The newsletter list is keyed on the address and only sets user_id to
  // null when a profile goes, so without this a deleted member keeps
  // getting the weekly email with no account and no way to stop it.
  if (user.email) {
    await admin.from("newsletter_subscribers").delete().ilike("email", user.email);
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: error.message };

  // Sign out on this device too, so the browser isn't left holding a
  // session cookie for an account that no longer exists.
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/?deleted=1");
}
