import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { getIssueById } from "@/lib/newsletter";
import { NewsletterEditForm } from "@/components/NewsletterEditForm";
import { publishNewsletterIssue, unpublishNewsletterIssue, deleteNewsletterIssue } from "@/app/actions/newsletter";

export const metadata = { title: "Edit Issue - Feedback" };

export default async function AdminNewsletterEditPage({
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

  const issue = await getIssueById(supabase, id);
  if (!issue) notFound();

  return (
    <>
      <div className="page-header">
        <h1>{issue.title}</h1>
        <div className="tagline">
          {issue.status === "published" ? "Published" : "Draft"} - {issue.issue_date}
        </div>
      </div>

      <div className="panel">
        <div className="panel-body">
          <NewsletterEditForm issue={issue} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Publish</div>
        <div className="panel-body">
          <p>
            Subscribers signed up through the sign-up page and the public newsletter page. Sending the
            actual email still needs an email provider wired up - publishing here makes the issue visible
            on the public <Link href="/newsletter">/newsletter</Link> archive.
          </p>
          <div className="form-actions">
            {issue.status === "published" ? (
              <form action={unpublishNewsletterIssue}>
                <input type="hidden" name="id" value={issue.id} />
                <button className="btn btn-ghost" type="submit">
                  Unpublish
                </button>
              </form>
            ) : (
              <form action={publishNewsletterIssue}>
                <input type="hidden" name="id" value={issue.id} />
                <button className="btn" type="submit">
                  Publish
                </button>
              </form>
            )}
            <form action={deleteNewsletterIssue}>
              <input type="hidden" name="id" value={issue.id} />
              <button className="comment-action danger" type="submit">
                Delete Issue
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
