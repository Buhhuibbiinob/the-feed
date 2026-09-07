"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPlaylistCover } from "@/lib/playlistCover";
import { isAdmin } from "@/lib/admin";
import { friendlyDbError, isMissingSchema } from "@/lib/dbError";
import {
  MAX_PLAYLISTS_PER_PERSON,
  MAX_PLAYLIST_TITLE,
  parsePlaylistUrl,
} from "@/lib/playlists";

export type PlaylistState = { error?: string; ok?: boolean };

export async function addPlaylist(
  _prev: PlaylistState,
  formData: FormData
): Promise<PlaylistState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const parsed = parsePlaylistUrl(formData.get("url"));
  // Named rather than generic: "that isn't a playlist link" leaves
  // somebody who pasted an ALBUM link with no idea what went wrong.
  if (!parsed) {
    return {
      error:
        "That doesn't look like a playlist link. Spotify, Apple Music, YouTube, SoundCloud, Deezer and Tidal all work, but it has to be a playlist. An album, a single track or one video won't.",
    };
  }

  const title = String(formData.get("title") ?? "").trim().slice(0, MAX_PLAYLIST_TITLE);
  if (!title) return { error: "Give it a name." };

  const { count } = await supabase
    .from("playlists")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_PLAYLISTS_PER_PERSON) {
    return { error: `That's ${MAX_PLAYLISTS_PER_PERSON} playlists. Take one down first.` };
  }

  // The artwork, once, here. Not per render: a wall of twelve would
  // otherwise be twelve requests every time anybody opened the tab, and
  // a playlist's cover does not change. Failure is not fatal - a
  // playlist with no picture still goes up, and Cover Flow draws it as a
  // blank sleeve rather than refusing the paste over a thumbnail.
  const coverUrl = await fetchPlaylistCover(parsed).catch(() => null);

  const row = {
    user_id: user.id,
    provider: parsed.provider,
    provider_id: parsed.providerId,
    storefront: parsed.storefront,
    slug: parsed.slug,
    title,
    note: String(formData.get("note") ?? "").trim().slice(0, 200) || null,
  };
  let { error } = await supabase.from("playlists").insert({ ...row, cover_url: coverUrl });
  // A database still on 013 has no cover_url column. Rather than refuse
  // the playlist over a picture, put it up without one - the column
  // arrives with migration 014 and every playlist added after that gets
  // its cover.
  if (error && /cover_url/.test(error.message)) {
    ({ error } = await supabase.from("playlists").insert(row));
  }

  // 23505: they already added it. That is the state they wanted.
  if (error && error.code !== "23505") {
    if (isMissingSchema(error.message)) {
      return { error: "Playlists aren't set up yet: run migration 013." };
    }
    return { error: friendlyDbError(error.message) };
  }

  revalidatePath("/");
  return { ok: true };
}

/**
 * Takes one down.
 *
 * An admin can remove anybody's, the same as a post: a playlist is
 * publicly visible, and moderation has to reach everything that is. The
 * admin path needs the service-role client, because the delete policy is
 * `using (auth.uid() = user_id)` and Postgres would otherwise filter the
 * row out underneath us and report zero rows affected - which looks
 * exactly like a broken button.
 */
export async function removePlaylist(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("playlist_id") ?? "").trim();
  if (!id) return;

  if (await isAdmin(supabase, user.id)) {
    await createAdminClient().from("playlists").delete().eq("id", id);
  } else {
    await supabase.from("playlists").delete().eq("id", id).eq("user_id", user.id);
  }

  revalidatePath("/");
}
