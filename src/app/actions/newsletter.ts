"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { NEWSLETTER_SECTIONS, getIssueById, renderIssueHtml, type NewsletterSectionKey } from "@/lib/newsletter";
import { sendBulkEmail } from "@/lib/email";
import { getUpcomingMoviesAndTv } from "@/lib/tmdb";
import { askGeminiJson } from "@/lib/gemini";

// Every registered account's email, not just the public "get notified"
// waitlist - paginated since the admin API caps each page.
async function getAllAccountEmails(): Promise<string[]> {
  const admin = createAdminClient();
  const emails: string[] = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) break;
    for (const u of data.users) {
      if (u.email) emails.push(u.email);
    }
    if (data.users.length < perPage) break;
    page++;
  }
  return emails;
}

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

function newsletterSystemPrompt(weekAgo: string, today: string, horizon: string): string {
  return `You write the weekly newsletter for Feedback, a music/movie/TV review community site. Today is ${today}.

THIS ISSUE COVERS ONE WEEK ONLY. Every item you mention must fall in one of these two windows:
- Things that HAPPENED: between ${weekAgo} and ${today}.
- Things that are COMING UP: between ${today} and ${horizon}.
Anything outside those dates does not belong in this issue, no matter how interesting or how highly it ranks in search results. Do not mention older releases, past news, retrospectives, or anniversaries. If you are not certain a thing falls inside the window, leave it out.

You will be given real data already scoped to that window - upcoming releases from TMDB, underground creator posts, and top-rated reviews. Use it as your primary source, and never invent artists, titles, release dates, or facts. If a section has no real data to draw from and you can't find real info inside the date window for it either, write exactly "Nothing new to report this week." for that section instead of padding it with something older or made up.

You have Google Search available - use it to pull in real, verifiable info from inside the date window above, especially where the provided data is thin. Prefer searches that name the current month and year. When you use something you found via search, end that section with a new line reading exactly "Source: <the real URL>" - only include a Source line when you actually have a real URL from search, never a made-up one.

For data that came from the provided site/TMDB data instead of search, mention the source inline - e.g. "(via TMDB)" for movie/TV data, or "posted by @username" for site content.

Keep each section to 2-4 short sentences, friendly and punchy, not corporate. Do not use em dashes - use a comma or period instead. Do not use emojis. Respond with JSON matching this exact shape: { "title": string, "upcoming_releases": string, "underground_releases": string, "upcoming_artists": string, "upcoming_actors": string, "upcoming_short_films": string, "short_film_releases": string, "artist_of_week": string, "filmmaker_of_week": string }`;
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

  // Everything in an issue is scoped to the week it covers: site activity
  // from the last 7 days, and releases landing within the next 14 (a strict
  // 7-day forward window leaves "Upcoming Releases" empty most weeks, since
  // TMDB dates cluster on Fridays).
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const weekAgoIso = weekAgo.toISOString();
  const todayStr = now.toISOString().slice(0, 10);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);
  const horizonStr = horizon.toISOString().slice(0, 10);

  const [upcomingAll, artistPostsRes, topPostsRes] = await Promise.all([
    getUpcomingMoviesAndTv(30).catch(() => []),
    supabase
      .from("artist_posts")
      .select("artist_name, platform, description, created_at")
      .eq("status", "active")
      .gte("created_at", weekAgoIso)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("posts")
      .select("title, artist, media_type, rating, cover_url, created_at, profiles(username)")
      .gte("created_at", weekAgoIso)
      .not("rating", "is", null)
      .order("rating", { ascending: false })
      .limit(10),
  ]);

  // TMDB's "upcoming" list runs months out - keep only what actually lands
  // in this issue's window.
  const upcoming = upcomingAll
    .filter((u) => u.date && u.date >= todayStr && u.date <= horizonStr)
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

  const dataDump = [
    `Issue window: activity from ${weekAgoStr} to ${todayStr}; upcoming through ${horizonStr}.`,
    upcoming.length
      ? `Releasing between ${todayStr} and ${horizonStr} (via TMDB):\n${upcoming.map((u) => `- ${u.title} (${u.mediaType}, ${u.date ?? "date TBA"})`).join("\n")}`
      : `Releases between ${todayStr} and ${horizonStr} (via TMDB): none.`,
    artistPosts.length
      ? `Underground creator posts on Feedback since ${weekAgoStr}:\n${artistPosts
          .map((a) => `- ${a.artist_name} (${a.platform === "youtube" ? "short film" : "music"})${a.description ? `: ${a.description.slice(0, 150)}` : ""}`)
          .join("\n")}`
      : `Underground creator posts since ${weekAgoStr}: none.`,
    topPosts.length
      ? `Top-rated reviews on Feedback since ${weekAgoStr}:\n${topPosts
          .map((p) => `- "${p.title}"${p.artist ? ` by ${p.artist}` : ""} (${p.media_type}, ${p.rating}★, reviewed by @${usernameOf(p) ?? "unknown"})`)
          .join("\n")}`
      : `Top-rated reviews since ${weekAgoStr}: none yet.`,
  ].join("\n\n");

  const systemPrompt = newsletterSystemPrompt(weekAgoStr, todayStr, horizonStr);

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

  const { data: subscriberRows } = await supabase.from("waitlist_signups").select("email");
  const waitlistEmails = (subscriberRows ?? []).map((r) => r.email as string);

  const { data: newsletterRows } = await supabase
    .from("newsletter_subscribers")
    .select("email")
    .is("unsubscribed_at", null);
  const newsletterEmails = (newsletterRows ?? []).map((r) => r.email as string);

  const accountEmails = await getAllAccountEmails();
  const emails = [
    ...new Set([...waitlistEmails, ...newsletterEmails, ...accountEmails].map((e) => e.toLowerCase())),
  ];

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mythefeed.com";
  const html = renderIssueHtml(issue, siteUrl);
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
