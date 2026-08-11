import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";

export { BUILTIN_PAGES, MORE_PAGES } from "@/lib/builtinPages";

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
