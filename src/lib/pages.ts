import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";

// Secondary pages an admin can archive (hide from nav, block direct visits
// for non-admins). The homepage isn't included - archiving the whole feed
// doesn't make sense and page.tsx is too central to gate this way.
export const BUILTIN_PAGES: { slug: string; label: string; path: string }[] = [
  { slug: "chat", label: "Chat", path: "/chat" },
  { slug: "leaderboard", label: "Leaderboard", path: "/leaderboard" },
  { slug: "new-releases", label: "New Releases", path: "/new-releases" },
  { slug: "recs", label: "Recs", path: "/recs" },
  { slug: "clubs", label: "Clubs", path: "/clubs" },
  { slug: "artists", label: "Creators", path: "/artists" },
  { slug: "collections", label: "Collections", path: "/collections" },
  { slug: "wrapped", label: "Wrapped", path: "/wrapped" },
  { slug: "newsletter", label: "Newsletter", path: "/newsletter" },
];

export type SitePage = {
  id: string;
  slug: string;
  label: string;
  kind: "builtin" | "custom";
  path: string;
  content: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

const PAGE_COLUMNS = "id, slug, label, kind, path, content, archived, created_at, updated_at";

/** Call at the top of a built-in secondary page's server component to hide it (404) from
 * non-admins once an admin has archived it. No-op if the page was never archived. */
export async function guardBuiltinPage(supabase: SupabaseClient, slug: string): Promise<void> {
  const { data } = await supabase
    .from("site_pages")
    .select("archived")
    .eq("slug", slug)
    .eq("kind", "builtin")
    .maybeSingle();

  if (!data?.archived) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && (await isAdmin(supabase, user.id))) return;
  notFound();
}

export async function getArchivedBuiltinSlugs(supabase: SupabaseClient): Promise<Set<string>> {
  const { data } = await supabase
    .from("site_pages")
    .select("slug")
    .eq("kind", "builtin")
    .eq("archived", true);
  return new Set((data ?? []).map((r) => r.slug as string));
}

export async function getActiveCustomPages(supabase: SupabaseClient): Promise<SitePage[]> {
  const { data } = await supabase
    .from("site_pages")
    .select(PAGE_COLUMNS)
    .eq("kind", "custom")
    .eq("archived", false)
    .order("created_at", { ascending: true })
    .returns<SitePage[]>();
  return data ?? [];
}

export async function getAllPagesForAdmin(supabase: SupabaseClient): Promise<SitePage[]> {
  const { data } = await supabase
    .from("site_pages")
    .select(PAGE_COLUMNS)
    .eq("kind", "custom")
    .order("created_at", { ascending: false })
    .returns<SitePage[]>();
  return data ?? [];
}

export async function getPageBySlug(supabase: SupabaseClient, slug: string): Promise<SitePage | null> {
  const { data } = await supabase
    .from("site_pages")
    .select(PAGE_COLUMNS)
    .eq("slug", slug)
    .eq("kind", "custom")
    .maybeSingle();
  return (data as SitePage | null) ?? null;
}
