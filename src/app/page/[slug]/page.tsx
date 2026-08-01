import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { getPageBySlug } from "@/lib/pages";

export default async function CustomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const page = await getPageBySlug(supabase, slug);
  if (!page) notFound();

  const canView = !page.archived || (user && (await isAdmin(supabase, user.id)));
  if (!canView) notFound();

  return (
    <>
      <div className="page-header">
        <h1>{page.label}</h1>
        {page.archived && <div className="tagline">Archived - only visible to admins</div>}
      </div>

      <div className="panel">
        <div className="panel-body">
          <p style={{ whiteSpace: "pre-wrap" }}>{page.content || "This page doesn't have any content yet."}</p>
        </div>
      </div>
    </>
  );
}
