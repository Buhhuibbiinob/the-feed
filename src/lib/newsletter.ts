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
