import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { EditPageForm } from "@/components/EditPageForm";
import type { SitePage } from "@/lib/pages";

export const metadata = { title: "Edit Page - Feedback" };

export default async function AdminEditPagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(supabase, user.id))) {
    notFound();
  }

  const { data } = await supabase
    .from("site_pages")
    .select("id, slug, label, kind, path, content, archived, created_at, updated_at")
    .eq("id", id)
    .eq("kind", "custom")
    .maybeSingle();

  const page = data as SitePage | null;
  if (!page) notFound();

  return (
    <>
      <div className="page-header">
        <h1>{page.label}</h1>
        <div className="tagline">{page.path}</div>
      </div>

      <div className="panel">
        <div className="panel-body">
          <EditPageForm page={page} />
        </div>
      </div>
    </>
  );
}
