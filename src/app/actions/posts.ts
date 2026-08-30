"use server";

import { revalidatePath } from "next/cache";
import { logEvent } from "@/lib/events";
import { friendlyDbError, isMissingSchema } from "@/lib/dbError";
import { withoutOptionalFields } from "@/lib/postQuery";
import { createClient } from "@/lib/supabase/server";
import { MEDIA_TYPES, type MediaType } from "@/lib/media";
import { isGenreFor } from "@/lib/genres";
import { findOrCreateClub } from "@/lib/clubs";
import { findOrCreateWork } from "@/lib/works";
import { chooseNextStep, type NextStep } from "@/lib/afterPost";
import { checkReviewSafety } from "@/lib/contentSafety";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export type PostFormState = {
  error?: string;
  ok?: boolean;
  /** Set on success, so the form can show what happened instead of blanking. */
  posted?: {
    postId: string;
    /** True only for somebody's very first review. */
    first: boolean;
    next: NextStep;
  };
};

export async function createPost(
  _prevState: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to post." };
  }

  const mediaType = String(formData.get("media_type") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const ratingRaw = String(formData.get("rating") ?? "");
  const rating = ratingRaw ? Number(ratingRaw) : null;
  const artist = String(formData.get("artist") ?? "").trim();
  const coverUrl = String(formData.get("cover_url") ?? "").trim();
  const spotifyTrackId = String(formData.get("spotify_track_id") ?? "").trim();
  const youtubeVideoId = String(formData.get("youtube_video_id") ?? "").trim();
  const respondsTo = String(formData.get("responds_to") ?? "").trim() || null;
  // Validated as a pair with the category, never on its own: "documentary"
  // is a genre of film and of photography but not of music, and a post
  // claiming a genre its category doesn't have is a row no filter will
  // ever match - invisible, and so never reported.
  const rawGenre = formData.get("genre");

  if (!MEDIA_TYPES.includes(mediaType as (typeof MEDIA_TYPES)[number])) {
    return { error: "Choose a valid category." };
  }
  if (!title) {
    return { error: "What are you logging? Give it a title." };
  }
  if (rating !== null && (rating < 1 || rating > 5)) {
    return { error: "Rating must be between 1 and 5." };
  }
  // Writing is optional; saying something is not. A post has to carry
  // either a rating or some words, or it is a title and nothing else -
  // which tells a reader you watched something and not one thing more.
  if (!body && rating === null) {
    return { error: "Give it a rating, or write something. Either is enough." };
  }
  // Only checked when there is text to check. An empty body is not a
  // safety question, and running it through the checker meant a
  // rating-only post could be rejected for the content of nothing.
  if (body) {
    const bodySafety = checkReviewSafety(body);
    if (!bodySafety.allowed) {
      return { error: bodySafety.reason };
    }
  }

  // Every category has clubs now, photography included - the constraint
  // that made a photo post's club insert fail silently has been widened.
  // Music groups by artist; the other two group by the thing itself.
  const clubName = mediaType === "music" ? artist : title;
  const club = clubName
    ? await findOrCreateClub(supabase, mediaType as MediaType, clubName)
    : { id: null, founded: false };
  const clubId = club.id;

  // The thing being reviewed, as opposed to the club around it. A club is
  // a place people join; a work is the object itself, so two reviews of
  // the same film can be counted, averaged and put on one page.
  //
  // Best-effort: if the works table isn't there yet the review still
  // posts, and the backfill picks it up later.
  const workId = await findOrCreateWork(
    supabase,
    mediaType as MediaType,
    title,
    artist || null,
    coverUrl || null
  ).catch(() => null);

  // The post being answered is looked up rather than trusted: a client
  // could post any uuid, and a duet pointing at something that is not a
  // review would render an "answering" line with nothing behind it.
  let answering: { id: string; user_id: string } | null = null;
  if (respondsTo) {
    const { data } = await supabase
      .from("posts")
      .select("id, user_id")
      .eq("id", respondsTo)
      .maybeSingle<{ id: string; user_id: string }>();
    answering = data ?? null;
  }

  const row = {
    user_id: user.id,
    media_type: mediaType,
    title,
    body,
    rating,
    artist: artist || null,
    cover_url: coverUrl || null,
    spotify_track_id: spotifyTrackId || null,
    youtube_video_id: youtubeVideoId || null,
    club_id: clubId,
    work_id: workId,
    genre: isGenreFor(mediaType as MediaType, rawGenre) ? rawGenre : null,
    responds_to_post_id: answering?.id ?? null,
  };

  // The id comes back because the review is linked to from the
  // confirmation - "your review is live" with nowhere to go is not a
  // confirmation of anything.
  //
  // And if the database is a migration behind, the review still goes up
  // without the column it is missing. An insert naming a column that does
  // not exist fails outright, which here means nobody can post at all -
  // losing somebody's review because a field they didn't fill in has no
  // column yet is not a trade worth making.
  let { data: created, error } = await supabase
    .from("posts")
    .insert(row)
    .select("id")
    .single<{ id: string }>();

  if (error && isMissingSchema(error.message)) {
    console.error(`[posts] insert is ahead of the schema: ${error.message}`);
    ({ data: created, error } = await supabase
      .from("posts")
      .insert(withoutOptionalFields(row))
      .select("id")
      .single<{ id: string }>());
  }

  if (error) {
    return { error: friendlyDbError(error.message) };
  }

  // No notification is written here: alerts on this site are DERIVED by
  // querying, not stored, so a duet is picked up by getNotifications
  // reading posts that point at yours. Inserting one would have been a
  // second source of truth for the same event.

  // Reviewing something off the list is what takes it off the list.
  // Scoped to this member, so a posted uuid can only ever tick off one of
  // their own rows; a wrong one is a no-op.
  const queueItemId = String(formData.get("queue_item_id") ?? "").trim();
  if (queueItemId) {
    await supabase
      .from("queue_items")
      .update({ done_at: new Date().toISOString() })
      .eq("id", queueItemId)
      .eq("user_id", user.id);
    revalidatePath("/queue");
  }

  await logEvent(supabase, user.id, "review_posted", answering ? "duet" : "feed");
  if (answering) revalidatePath(`/post/${answering.id}`);
  revalidatePath("/");
  revalidatePath("/clubs");

  return { ok: true, posted: await describePosted(supabase, user.id, created?.id ?? null, club, clubName) };
}

/**
 * The facts the confirmation needs: where the review went, whether it was
 * their first, and the one thing worth doing next.
 *
 * Best-effort on purpose. This runs after the review is safely saved, so
 * anything that fails here costs a nicer confirmation and nothing else -
 * losing the post because the follow-up query fell over would be a
 * grotesque trade.
 */
async function describePosted(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  postId: string | null,
  club: { id: string | null; founded: boolean },
  clubName: string
): Promise<PostFormState["posted"]> {
  if (!postId) return undefined;

  const [{ data: profile }, { count }] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, avatar_url, banner_url")
      .eq("id", userId)
      .maybeSingle<{ username: string; avatar_url: string | null; banner_url: string | null }>(),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  if (!profile) return undefined;

  const reviewCount = count ?? 1;
  return {
    postId,
    first: reviewCount === 1,
    next: chooseNextStep({
      username: profile.username,
      hasAvatar: !!profile.avatar_url,
      hasBanner: !!profile.banner_url,
      reviewCount,
      club: club.id && clubName ? { id: club.id, name: clubName } : null,
      foundedClub: club.founded,
    }),
  };
}

// Pulls the 11-char video id out of any common YouTube URL shape
// (watch?v=, youtu.be/, /embed/, /shorts/); returns null if it isn't one.
function parseYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1, 12) || null;
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return v.slice(0, 11);
      const m = u.pathname.match(/\/(embed|shorts)\/([\w-]{11})/);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}

// Lets a club member post directly into that club (a music video, a review,
// etc.) rather than only through the main feed. The post is pinned to this
// club via club_id and inherits the club's media_type.
export async function createClubPost(
  _prevState: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const clubId = String(formData.get("club_id") ?? "");
  if (!clubId) return { error: "Missing club." };

  const { data: club } = await supabase
    .from("clubs")
    .select("media_type")
    .eq("id", clubId)
    .maybeSingle<{ media_type: MediaType }>();
  if (!club) return { error: "Club not found." };

  const { data: membership } = await supabase
    .from("club_members")
    .select("user_id")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Join the club to post in it." };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const ratingRaw = String(formData.get("rating") ?? "");
  const rating = ratingRaw ? Number(ratingRaw) : null;
  if (rating !== null && (rating < 1 || rating > 5)) {
    return { error: "Rating must be between 1 and 5." };
  }
  if (!body && rating === null) {
    return { error: "Give it a rating, or write something. Either is enough." };
  }

  const youtubeUrl = String(formData.get("youtube_url") ?? "").trim();
  let youtubeVideoId: string | null = null;
  if (youtubeUrl) {
    youtubeVideoId = parseYoutubeId(youtubeUrl);
    if (!youtubeVideoId) return { error: "That doesn't look like a YouTube link." };
  }

  const { error } = await supabase.from("posts").insert({
    user_id: user.id,
    media_type: club.media_type,
    title,
    body,
    rating,
    youtube_video_id: youtubeVideoId,
    club_id: clubId,
  });
  if (error) return { error: error.message };

  await logEvent(supabase, user.id, "review_posted", "club");
  revalidatePath(`/clubs/${clubId}`);
  return { ok: true };
}

export async function updatePost(
  _prevState: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const postId = String(formData.get("post_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const ratingRaw = String(formData.get("rating") ?? "");
  const rating = ratingRaw ? Number(ratingRaw) : null;

  if (!postId || !title) {
    return { error: "Title is required." };
  }
  // The same rule as posting. Without it a rating-only post could be
  // opened for editing and then refused on save, with nothing wrong
  // with it.
  if (!body && rating === null) {
    return { error: "Give it a rating, or write something. Either is enough." };
  }
  if (rating !== null && (rating < 1 || rating > 5)) {
    return { error: "Rating must be between 1 and 5." };
  }
  const bodySafety = checkReviewSafety(body);
  if (!bodySafety.allowed) {
    return { error: bodySafety.reason };
  }

  // The genre comes from the edit form too, which is how the reviews
  // posted before this field existed ever get one: their authors are the
  // only people who know, and editing is the only place they're asked.
  // Validated against the post's OWN category, read from the row rather
  // than posted, so the form cannot assert a category it doesn't own.
  const { data: existing } = await supabase
    .from("posts")
    .select("media_type")
    .eq("id", postId)
    .maybeSingle<{ media_type: MediaType }>();
  const rawGenre = formData.get("genre");
  const genre = existing && isGenreFor(existing.media_type, rawGenre) ? rawGenre : null;

  // Admins can edit anyone's post - title, body, rating and genre - which
  // is what makes a bot's wording fixable without deleting and
  // regenerating it. Same RLS reason as deletePost: the update policy is
  // `using (auth.uid() = user_id)`, so the admin path needs the
  // service-role client or Postgres quietly matches no rows.
  const fields = { title, body, rating, genre };
  const admin = await isAdmin(supabase, user.id);
  const save = (values: Record<string, unknown>) =>
    admin
      ? createAdminClient().from("posts").update(values).eq("id", postId)
      : supabase.from("posts").update(values).eq("id", postId).eq("user_id", user.id);

  let { error } = await save(fields);
  // Same reason as posting: an edit that fails because one column has no
  // migration yet loses the whole edit, including the words.
  if (error && isMissingSchema(error.message)) {
    console.error(`[posts] update is ahead of the schema: ${error.message}`);
    ({ error } = await save(withoutOptionalFields(fields)));
  }

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath(`/post/${postId}`);
  return { ok: true };
}

export async function deletePost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const postId = String(formData.get("post_id") ?? "");
  if (!postId) return;

  // Admins can remove anyone's post; everyone else only their own.
  //
  // The admin path has to go through the service-role client. Dropping the
  // user_id filter from the query is not enough on its own, because the RLS
  // policy on posts is `using (auth.uid() = user_id)` - Postgres filters the
  // row out underneath us and the delete silently affects zero rows. That
  // looked exactly like a broken button: confirm, then nothing.
  if (await isAdmin(supabase, user.id)) {
    await createAdminClient().from("posts").delete().eq("id", postId);
  } else {
    await supabase.from("posts").delete().eq("id", postId).eq("user_id", user.id);
  }

  revalidatePath("/");
  revalidatePath("/leaderboard");
}
