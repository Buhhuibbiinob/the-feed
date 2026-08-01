import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { getAllIssuesForAdmin } from "@/lib/newsletter";
import { createNewsletterIssue } from "@/app/actions/newsletter";

export const metadata = { title: "Newsletter - Feedback" };

export default async function AdminNewsletterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(supabase, user.id))) {
    notFound();
  }

  const issues = await getAllIssuesForAdmin(supabase);

  return (
    <>
      <div className="page-header">
        <h1>Weekly Newsletter</h1>
        <div className="tagline">Draft and publish the weekly issue - upcoming releases, spotlights, and more.</div>
      </div>

      <div className="panel">
        <div className="panel-body">
          <form action={createNewsletterIssue}>
            <button className="btn" type="submit">
              New Issue
            </button>
          </form>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Issues</div>
        <div className="panel-body flush">
          {issues.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              No issues yet - create your first one above.
            </div>
          ) : (
            issues.map((issue) => (
              <Link href={`/admin/newsletter/${issue.id}`} key={issue.id} className="site-links-link">
                <span>
                  {issue.title} - {issue.issue_date}
                </span>
                <span className="dm-inbox-time">{issue.status}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );
}
