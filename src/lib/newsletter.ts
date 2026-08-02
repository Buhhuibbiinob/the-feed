import type { SupabaseClient } from "@supabase/supabase-js";

export type NewsletterSectionKey =
  | "upcoming_releases"
  | "underground_releases"
  | "upcoming_artists"
  | "upcoming_actors"
  | "upcoming_short_films"
  | "short_film_releases"
  | "artist_of_week"
  | "filmmaker_of_week";

export const NEWSLETTER_SECTIONS: { key: NewsletterSectionKey; label: string; placeholder: string }[] = [
  {
    key: "upcoming_releases",
    label: "Upcoming Releases",
    placeholder: "New albums, movies, and shows dropping soon...",
  },
  {
    key: "underground_releases",
    label: "Underground Artist Releases",
    placeholder: "Independent releases worth knowing about...",
  },
  {
    key: "upcoming_artists",
    label: "Up-and-Coming Artists",
    placeholder: "Artists to watch...",
  },
  {
    key: "upcoming_actors",
    label: "Up-and-Coming Actors",
    placeholder: "Actors to watch...",
  },
  {
    key: "upcoming_short_films",
    label: "Upcoming Short Films",
    placeholder: "Short films in the works...",
  },
  {
    key: "short_film_releases",
    label: "Short Film Releases",
    placeholder: "Short films out now...",
  },
  {
    key: "artist_of_week",
    label: "Artist of the Week",
    placeholder: "This week's spotlight artist...",
  },
  {
    key: "filmmaker_of_week",
    label: "Filmmaker of the Week",
    placeholder: "This week's spotlight filmmaker...",
  },
];

export type NewsletterIssue = {
  id: string;
  issue_date: string;
  status: "draft" | "published";
  title: string;
  created_at: string;
  published_at: string | null;
} & Record<NewsletterSectionKey, string | null>;

const ISSUE_COLUMNS =
  "id, issue_date, status, title, created_at, published_at, " + NEWSLETTER_SECTIONS.map((s) => s.key).join(", ");

export async function getPublishedIssues(supabase: SupabaseClient): Promise<NewsletterIssue[]> {
  const { data } = await supabase
    .from("newsletter_issues")
    .select(ISSUE_COLUMNS)
    .eq("status", "published")
    .order("issue_date", { ascending: false })
    .returns<NewsletterIssue[]>();
  return data ?? [];
}

export async function getAllIssuesForAdmin(supabase: SupabaseClient): Promise<NewsletterIssue[]> {
  const { data } = await supabase
    .from("newsletter_issues")
    .select(ISSUE_COLUMNS)
    .order("issue_date", { ascending: false })
    .returns<NewsletterIssue[]>();
  return data ?? [];
}

export async function getIssueById(supabase: SupabaseClient, id: string): Promise<NewsletterIssue | null> {
  const { data } = await supabase.from("newsletter_issues").select(ISSUE_COLUMNS).eq("id", id).maybeSingle();
  return (data as NewsletterIssue | null) ?? null;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderIssueHtml(issue: NewsletterIssue, siteUrl: string): string {
  const sections = NEWSLETTER_SECTIONS.filter((s) => issue[s.key]);
  const dateline = new Date(issue.issue_date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const body = sections
    .map(
      (s, i) =>
        `<tr><td style="padding:${i === 0 ? "26" : "22"}px 30px 0;">` +
        `<div style="border-top:2px solid #1a1a1a; padding-top:10px;">` +
        `<h2 style="font-family:Georgia,'Times New Roman',serif; font-size:13px; font-weight:bold; text-transform:uppercase; letter-spacing:1.5px; margin:0 0 8px; color:#1a1a1a;">${escapeHtml(s.label)}</h2>` +
        `<p style="font-family:Georgia,'Times New Roman',serif; font-size:15px; line-height:1.6; margin:0; color:#2a2a2a; white-space:pre-wrap;">${escapeHtml(issue[s.key]!)}</p>` +
        `</div></td></tr>`
    )
    .join("");

  return (
    `<div style="background-color:#e8eaf0; padding:30px 12px; font-family:Georgia,'Times New Roman',serif;">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center" style="max-width:600px; width:100%; background-color:#fdfcf8; border:1px solid #8d8d92; border-radius:8px; overflow:hidden; box-shadow:0 6px 20px rgba(0,0,0,0.25);">` +

    // Masthead: brushed-steel chrome bar, matching the site's app-shell top bar
    `<tr><td style="background-color:#5c6773; background-image:linear-gradient(180deg,#8a95a0 0%,#5c6773 50%,#465059 100%); padding:20px 24px; text-align:center;">` +
    `<div style="font-family:Georgia,'Times New Roman',serif; font-size:34px; font-weight:bold; letter-spacing:2px; color:#ffffff; text-shadow:0 1px 2px rgba(0,0,0,0.5);">FEEDBACK</div>` +
    `<div style="font-family:Georgia,'Times New Roman',serif; font-size:11px; font-style:italic; color:#e2e6ea; margin-top:4px;">The Weekly Wrap-Up &middot; ${escapeHtml(dateline)}</div>` +
    `</td></tr>` +

    // Double newspaper rule under the masthead
    `<tr><td style="padding:14px 30px 0;"><div style="border-top:3px double #1a1a1a;"></div></td></tr>` +

    // Headline
    `<tr><td style="padding:16px 30px 0; text-align:center;">` +
    `<h1 style="font-family:Georgia,'Times New Roman',serif; font-size:26px; font-weight:bold; margin:0; color:#1a1a1a; line-height:1.25;">${escapeHtml(issue.title)}</h1>` +
    `</td></tr>` +

    (body || `<tr><td style="padding:22px 30px 0; font-family:Georgia,'Times New Roman',serif; color:#606060;">No sections filled in for this issue.</td></tr>`) +

    // Footer
    `<tr><td style="padding:30px 30px 24px;">` +
    `<div style="border-top:1px solid #c8c8c8; padding-top:14px; text-align:center;">` +
    `<span style="font-family:-apple-system,'Helvetica Neue',Arial,sans-serif; font-size:11px; color:#9a9a9a;">You're receiving this because you have an account or subscribed at <a href="${siteUrl}" style="color:#2f6fce;">Feedback</a>.</span>` +
    `</div></td></tr>` +

    `</table></div>`
  );
}
