"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { NEWSLETTER_SECTIONS, getIssueById, renderIssueHtml, type NewsletterSectionKey } from "@/lib/newsletter";
import { sendBulkEmail } from "@/lib/email";
import { getUpcomingMoviesAndTv, getTrendingPeople } from "@/lib/tmdb";
import { getAlbumsReleasedBetween } from "@/lib/appleMusic";
import { getTrendingTracks } from "@/lib/lastfm";
import { searchVideos } from "@/lib/youtube";
import { askGeminiJson } from "@/lib/gemini";
import { getNewsletterRecipients } from "@/lib/newsletterRecipients";
import { siteUrl } from "@/lib/site";

export type NewsletterFormState = { error?: string; ok?: boolean };
export type NewsletterSendState = { error?: string; ok?: boolean; sent?: number };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, admin: false };
  const admin = await isAdmin(supabase, user.id);
  return { supabase, user, admin };
}

export async function createNewsletterIssue() {
  const { supabase, user, admin } = await requireAdmin();
  if (!user || !admin) redirect("/");

  const { data, error } = await supabase
    .from("newsletter_issues")
    .insert({ created_by: user.id })
    .select("id")
    .single();

  revalidatePath("/admin/newsletter");
  if (error || !data) {
    console.error(`[newsletter] createNewsletterIssue failed: ${error?.message ?? "no data returned"}`);
    redirect(`/admin/newsletter?error=${encodeURIComponent(error?.message ?? "Could not create issue - no data returned.")}`);
  }
  redirect(`/admin/newsletter/${data.id}`);
}

type GeneratedDraft = { title: string } & Record<NewsletterSectionKey, string>;

function newsletterSystemPrompt(weekStart: string, weekEnd: string, horizon: string): string {
  return `You write the weekly newsletter for Feedback, a music/movie/TV review community site. This issue covers the week of ${weekStart} (Monday) through ${weekEnd} (Sunday).

THIS ISSUE COVERS THAT ONE WEEK ONLY. Every item you mention must fall in one of these two windows:
- Things that HAPPENED: between ${weekStart} and ${weekEnd}.
- Things that are COMING UP: between ${weekStart} and ${horizon}.
Anything outside those dates does not belong in this issue, no matter how interesting or how highly it ranks in search results. Do not mention older releases, past news, retrospectives, or anniversaries. If you are not certain a thing falls inside the window, leave it out.

You will be given real data already scoped to that window, gathered from several sources: album releases from Apple Music, charting tracks from Last.fm, upcoming movies and TV plus trending people from TMDB, short films published on YouTube, and the site's own underground creator posts and top-rated reviews. Use it as your primary source, and never invent artists, titles, release dates, or facts.

Every section should draw on whichever of those sources fits it, not only on site content:
- Upcoming Releases: TMDB movie/TV releases, plus notable albums due out.
- Underground Artist Releases and Up-and-Coming Artists: site creator posts first, then Last.fm and Apple Music entries a reader may not know yet.
- Up-and-Coming Actors: the TMDB trending people list.
- Upcoming Short Films and Short Film Releases: the YouTube short films, plus site creator posts from filmmakers.
- Artist of the Week and Filmmaker of the Week: pick one real name from the data and say why this week specifically.

Only write exactly "Nothing new to report this week." when a section genuinely has no usable data from ANY source above and search turns up nothing inside the window. Do not use it as a default. If a source list is non-empty, that section has something to write about.

You have Google Search available - use it to pull in real, verifiable info from inside the date window above, especially where the provided data is thin. Prefer searches that name the current month and year. When you use something you found via search, end that section with a new line reading exactly "Source: <the real URL>" - only include a Source line when you actually have a real URL from search, never a made-up one.

For data that came from the provided site/TMDB data instead of search, mention the source inline - e.g. "(via TMDB)" for movie/TV data, or "posted by @username" for site content.

Keep each section to 2-4 short sentences, friendly and punchy, not corporate. Do not use em dashes - use a comma or period instead. Do not use emojis. Respond with JSON matching this exact shape: { "title": string, "upcoming_releases": string, "underground_releases": string, "upcoming_artists": string, "upcoming_actors": string, "upcoming_short_films": string, "short_film_releases": string, "artist_of_week": string, "filmmaker_of_week": string }`;
}

// The week is a real Monday-to-Sunday calendar week in the site's own
// timezone, not a rolling 7 days and not UTC. This matters: late on a
// Sunday evening in the US it is already Monday in UTC, so a UTC-based
// week would silently roll the issue forward and cover the week that has
// barely started instead of the one just finished.
const NEWSLETTER_TZ = process.env.NEWSLETTER_TIMEZONE || "America/Los_Angeles";

function localDateStr(d: Date, tz: string): string {
  return d.toLocaleDateString("en-CA", { timeZone: tz }); // en-CA formats as YYYY-MM-DD
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`); // midday avoids DST edge cases
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Monday = 0 ... Sunday = 6, so subtracting this lands on the week's Monday.
function mondayOffset(dateStr: string, tz: string): number {
  const weekday = new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: tz,
    weekday: "short",
  });
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const index = order.indexOf(weekday);
  return index === -1 ? 0 : index;
}

// The UTC instant of local midnight on a given day, for querying timestamptz.
function localMidnightUtc(dateStr: string, tz: string): Date {
  const utcMidnight = new Date(`${dateStr}T00:00:00Z`);
  const shifted = new Date(utcMidnight.toLocaleString("en-US", { timeZone: tz }));
  const asUtc = new Date(utcMidnight.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(utcMidnight.getTime() + (asUtc.getTime() - shifted.getTime()));
}

// Safety net in case the model doesn't follow the em dash / emoji
// instructions perfectly.
function sanitizeCopy(text: string): string {
  return text
    .replace(/—/g, " - ")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}]/gu, "")
    .trim();
}

export async function generateNewsletterDraft(
  _prevState: NewsletterFormState,
  formData: FormData
): Promise<NewsletterFormState> {
  const { supabase, user, admin } = await requireAdmin();
  if (!user || !admin) return { error: "Admins only." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing issue id." };

  // The Monday-to-Sunday week we're currently in (e.g. generating any time
  // during Jul 27 - Aug 2 produces the Jul 27 - Aug 2 issue). Upcoming
  // releases look 14 days past the week's end: a strict 7-day forward
  // window leaves that section empty most weeks, since TMDB release dates
  // cluster on Fridays.
  const todayLocal = localDateStr(new Date(), NEWSLETTER_TZ);
  const weekStartStr = addDays(todayLocal, -mondayOffset(todayLocal, NEWSLETTER_TZ));
  const weekEndStr = addDays(weekStartStr, 6);
  const horizonStr = addDays(weekEndStr, 14);

  const weekStartIso = localMidnightUtc(weekStartStr, NEWSLETTER_TZ).toISOString();
  // Exclusive upper bound: midnight at the start of the following Monday.
  const weekEndIso = localMidnightUtc(addDays(weekEndStr, 1), NEWSLETTER_TZ).toISOString();

  // Pull from every real source available, not just the site's own posts -
  // sections like Up-and-Coming Actors and Short Film Releases have no
  // site-generated equivalent, so without outside data they can only ever
  // come back as "Nothing new to report". Each source fails independently:
  // one dead API must not blank out the whole issue.
  const [upcomingAll, trendingPeople, newAlbums, trendingTracks, shortFilms, artistPostsRes, topPostsRes] =
    await Promise.all([
    getUpcomingMoviesAndTv(30).catch(() => []),
    getTrendingPeople(10).catch(() => []),
    getAlbumsReleasedBetween(weekStartStr, weekEndStr).catch(() => []),
    getTrendingTracks(15).catch(() => []),
    searchVideos("short film", 8, { publishedAfter: weekStartIso, publishedBefore: weekEndIso, order: "viewCount" }).catch(
      () => []
    ),
    supabase
      .from("artist_posts")
      .select("artist_name, platform, description, created_at")
      .eq("status", "active")
      .gte("created_at", weekStartIso)
      .lt("created_at", weekEndIso)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("posts")
      .select("title, artist, media_type, rating, cover_url, created_at, profiles(username)")
      .gte("created_at", weekStartIso)
      .lt("created_at", weekEndIso)
      .not("rating", "is", null)
      .order("rating", { ascending: false })
      .limit(10),
  ]);

  // TMDB's "upcoming" list runs months out - keep only what actually lands
  // between the start of this week and the horizon.
  const upcoming = upcomingAll
    .filter((u) => u.date && u.date >= weekStartStr && u.date <= horizonStr)
    .slice(0, 15);

  const artistPosts =
    (artistPostsRes.data as { artist_name: string; platform: string; description: string | null }[] | null) ?? [];
  const topPosts =
    (topPostsRes.data as {
      title: string;
      artist: string | null;
      media_type: "music" | "movie_tv";
      rating: number | null;
      cover_url: string | null;
      profiles: { username: string } | { username: string }[] | null;
    }[] | null) ?? [];

  const usernameOf = (p: (typeof topPosts)[number]) =>
    Array.isArray(p.profiles) ? p.profiles[0]?.username : p.profiles?.username;

  const weekLabel = `${weekStartStr} (Monday) to ${weekEndStr} (Sunday)`;
  const dataDump = [
    `Issue week: ${weekLabel}. Upcoming releases run through ${horizonStr}.`,
    upcoming.length
      ? `Releasing between ${weekStartStr} and ${horizonStr} (via TMDB):\n${upcoming.map((u) => `- ${u.title} (${u.mediaType}, ${u.date ?? "date TBA"})`).join("\n")}`
      : `Releases between ${weekStartStr} and ${horizonStr} (via TMDB): none.`,
    newAlbums.length
      ? `Albums released this week (via Apple Music):\n${newAlbums
          .map((a) => `- "${a.name}" by ${a.artistName} (released ${a.releaseDate})${a.url ? ` ${a.url}` : ""}`)
          .join("\n")}`
      : "Albums released this week (via Apple Music): none.",
    trendingTracks.length
      ? `Charting tracks right now (via Last.fm):\n${trendingTracks.map((t) => `- "${t.name}" by ${t.artist}`).join("\n")}`
      : "Charting tracks (via Last.fm): none available.",
    trendingPeople.length
      ? `People trending this week (via TMDB) - use for the actors section:\n${trendingPeople
          .map((p) => `- ${p.name}${p.department ? ` (${p.department})` : ""}${p.knownFor.length ? `, known for ${p.knownFor.slice(0, 3).join(", ")}` : ""}`)
          .join("\n")}`
      : "People trending this week (via TMDB): none available.",
    shortFilms.length
      ? `Short films published on YouTube during ${weekLabel}:\n${shortFilms
          .map((v) => `- "${v.title}" by ${v.channelTitle} https://www.youtube.com/watch?v=${v.id}`)
          .join("\n")}`
      : `Short films published on YouTube during ${weekLabel}: none found.`,
    artistPosts.length
      ? `Underground creator posts on Feedback during ${weekLabel}:\n${artistPosts
          .map((a) => `- ${a.artist_name} (${a.platform === "youtube" ? "short film" : "music"})${a.description ? `: ${a.description.slice(0, 150)}` : ""}`)
          .join("\n")}`
      : `Underground creator posts during ${weekLabel}: none.`,
    topPosts.length
      ? `Top-rated reviews on Feedback during ${weekLabel}:\n${topPosts
          .map((p) => `- "${p.title}"${p.artist ? ` by ${p.artist}` : ""} (${p.media_type}, ${p.rating}★, reviewed by @${usernameOf(p) ?? "unknown"})`)
          .join("\n")}`
      : `Top-rated reviews during ${weekLabel}: none yet.`,
  ].join("\n\n");

  const systemPrompt = newsletterSystemPrompt(weekStartStr, weekEndStr, horizonStr);

  // Google Search grounding has its own free-tier quota, far smaller than
  // the model's own. When only that is exhausted, fall back to an ungrounded
  // draft rather than failing: the TMDB/site data dump below is the primary
  // source anyway, and search was only ever an enhancement on top of it.
  let result = await askGeminiJson<GeneratedDraft>(systemPrompt, dataDump, true);
  let usedGrounding = true;
  if (!result.ok && result.error.includes("429")) {
    console.warn("[newsletter] grounded generation rate limited, retrying without Google Search");
    result = await askGeminiJson<GeneratedDraft>(systemPrompt, dataDump, false);
    usedGrounding = false;
  }
  if (!result.ok) {
    return { error: `Couldn't generate a draft: ${result.error}` };
  }
  if (!usedGrounding) {
    console.warn("[newsletter] draft generated without Google Search grounding");
  }
  const draft = result.data;

  const realImages = [
    ...topPosts.filter((p) => p.cover_url).map((p) => p.cover_url!),
    ...upcoming.filter((u) => u.imageUrl).map((u) => u.imageUrl!),
  ];
  const coverImageUrl = realImages[0] ?? null;
  const imageUrls = [...new Set(realImages.slice(1, 4))];

  const update: Record<string, string | null | string[]> = {
    title: sanitizeCopy(draft.title),
    // Date the issue by the Sunday it covers, so it matches its own window.
    // Still editable by hand on the form afterwards.
    issue_date: weekEndStr,
    cover_image_url: coverImageUrl,
    image_urls: imageUrls,
  };
  const filledSections: string[] = [];
  for (const s of NEWSLETTER_SECTIONS) {
    const value = draft[s.key] ? sanitizeCopy(draft[s.key]) : null;
    update[s.key] = value;
    if (value) filledSections.push(s.key);
  }

  if (filledSections.length === 0) {
    return {
      error:
        "Gemini replied but every section came back empty. Try again - if it keeps happening the model may be returning a different JSON shape than expected.",
    };
  }

  let { error: updateError } = await supabase.from("newsletter_issues").update(update).eq("id", id);

  // image_urls is a newer column - if the database hasn't had schema.sql
  // re-run since it was added, the whole update fails and the draft is
  // silently lost. Save everything else rather than throwing the draft away.
  if (updateError && updateError.message.toLowerCase().includes("image_urls")) {
    console.warn("[newsletter] image_urls column missing, saving draft without it");
    const withoutImages = { ...update };
    delete withoutImages.image_urls;
    ({ error: updateError } = await supabase.from("newsletter_issues").update(withoutImages).eq("id", id));
  }

  if (updateError) {
    console.error(`[newsletter] saving draft failed: ${updateError.message}`);
    return { error: `Gemini wrote the draft but saving it failed: ${updateError.message}` };
  }

  revalidatePath(`/admin/newsletter/${id}`);
  return { ok: true };
}

export async function updateNewsletterIssue(
  _prevState: NewsletterFormState,
  formData: FormData
): Promise<NewsletterFormState> {
  const { user, admin, supabase } = await requireAdmin();
  if (!user || !admin) return { error: "Admins only." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing issue id." };

  const update: Record<string, string | null> = {
    title: String(formData.get("title") ?? "").trim() || "This Week on Feedback",
    issue_date: String(formData.get("issue_date") ?? "") || new Date().toISOString().slice(0, 10),
    cover_image_url: String(formData.get("cover_image_url") ?? "").trim() || null,
  };
  for (const section of NEWSLETTER_SECTIONS) {
    update[section.key] = String(formData.get(section.key) ?? "").trim() || null;
  }

  const { error } = await supabase.from("newsletter_issues").update(update).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/admin/newsletter/${id}`);
  revalidatePath("/newsletter");
  revalidatePath(`/newsletter/${id}`);
  return { ok: true };
}

export async function publishNewsletterIssue(formData: FormData) {
  const { user, admin, supabase } = await requireAdmin();
  if (!user || !admin) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase
    .from("newsletter_issues")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath(`/admin/newsletter/${id}`);
  revalidatePath("/admin/newsletter");
  revalidatePath("/newsletter");
  revalidatePath(`/newsletter/${id}`);
}

export async function unpublishNewsletterIssue(formData: FormData) {
  const { user, admin, supabase } = await requireAdmin();
  if (!user || !admin) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("newsletter_issues").update({ status: "draft" }).eq("id", id);

  revalidatePath(`/admin/newsletter/${id}`);
  revalidatePath("/admin/newsletter");
  revalidatePath("/newsletter");
}

export async function sendNewsletterIssue(
  _prevState: NewsletterSendState,
  formData: FormData
): Promise<NewsletterSendState> {
  const { user, admin, supabase } = await requireAdmin();
  if (!user || !admin) return { error: "Admins only." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing issue id." };

  const issue = await getIssueById(supabase, id);
  if (!issue) return { error: "Issue not found." };

  const emails = await getNewsletterRecipients(supabase);

  const html = renderIssueHtml(issue, siteUrl());
  const result = await sendBulkEmail(issue.title, html, emails);

  if (!result.ok) return { error: result.error };
  return { ok: true, sent: result.sent };
}

export async function deleteNewsletterIssue(formData: FormData) {
  const { user, admin, supabase } = await requireAdmin();
  if (!user || !admin) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("newsletter_issues").delete().eq("id", id);
  revalidatePath("/admin/newsletter");
  redirect("/admin/newsletter");
}
