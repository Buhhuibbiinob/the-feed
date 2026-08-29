import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Who is allowed to edit a given profile.
 *
 * You can always edit your own. An admin can additionally edit a BOT's
 * profile - the site's own accounts - so the people running the place
 * can decorate them properly instead of being stuck with the four
 * fields the bot admin panel exposes.
 *
 * The bot check is the whole security boundary here and it is deliberately
 * narrow: is_bot must be true on the target row, read from the database
 * at the time of the write, never taken from the request. An admin
 * cannot edit a real member's page through this, which is a different
 * thing entirely from administering the site's own accounts - and the
 * kind of power that gets added "just for now" and then quietly stays.
 *
 * Writes against somebody else's rows have to go through the
 * service-role client, because every RLS policy on this schema is
 * written as auth.uid() = owner and an admin is not that. That is why
 * this returns the client to use rather than a boolean: getting the
 * answer right and then writing with the wrong client fails silently
 * under RLS, which looks exactly like the save not happening.
 */
export type EditAuth =
  | { ok: true; userId: string; client: Awaited<ReturnType<typeof createClient>>; asBot: boolean }
  | { ok: false; error: string };

export async function authorizeProfileEdit(targetId: string): Promise<EditAuth> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  if (targetId === user.id) {
    return { ok: true, userId: user.id, client: supabase, asBot: false };
  }

  const [{ data: me }, { data: target }] = await Promise.all([
    supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle<{ is_admin: boolean }>(),
    supabase.from("profiles").select("is_bot").eq("id", targetId).maybeSingle<{ is_bot: boolean }>(),
  ]);

  if (!me?.is_admin) return { ok: false, error: "That isn't your page." };
  if (!target?.is_bot) {
    // Said plainly rather than as a generic refusal: an admin trying
    // this on a real member should learn that the line exists, not that
    // something went wrong.
    return { ok: false, error: "Admins can only edit bot accounts, not other members' pages." };
  }

  return {
    ok: true,
    userId: targetId,
    client: createAdminClient() as unknown as Awaited<ReturnType<typeof createClient>>,
    asBot: true,
  };
}

/** Whether a viewer may edit this profile, for deciding what to render. */
export function canEditProfile(
  viewerId: string | null,
  viewerIsAdmin: boolean,
  profileId: string,
  profileIsBot: boolean
): boolean {
  if (!viewerId) return false;
  if (viewerId === profileId) return true;
  return viewerIsAdmin && profileIsBot;
}
