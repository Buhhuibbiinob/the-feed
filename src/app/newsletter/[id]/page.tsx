import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { getIssueById, NEWSLETTER_SECTIONS } from "@/lib/newsletter";

export default async function NewsletterIssuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const issue = await getIssueById(supabase, id);
  if (!issue) notFound();

  const canView = issue.status === "published" || (user && (await isAdmin(supabase, user.id)));
  if (!canView) notFound();

  const sections = NEWSLETTER_SECTIONS.filter((s) => issue[s.key]);

  return (
    <>
      <div className="page-header">
        <h1>{issue.title}</h1>
        <div className="tagline">
          {issue.issue_date}
          {issue.status === "draft" && " - draft preview"}
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="panel">
          <div className="panel-body">
            <p className="empty-state">This issue doesn&apos;t have any sections filled in yet.</p>
          </div>
        </div>
      ) : (
        sections.map((section) => (
          <div className="panel" key={section.key}>
            <div className="panel-head">{section.label}</div>
            <div className="panel-body">
              <p style={{ whiteSpace: "pre-wrap" }}>{issue[section.key]}</p>
            </div>
          </div>
        ))
      )}
    </>
  );
}
