import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPublishedIssues } from "@/lib/newsletter";
import { NewsletterSubscribeForm } from "@/components/NewsletterSubscribeForm";

export const metadata = { title: "Newsletter - Feedback" };

export default async function NewsletterArchivePage() {
  const supabase = await createClient();
  const issues = await getPublishedIssues(supabase);

  return (
    <>
      <div className="page-header">
        <h1>The Feedback Weekly</h1>
        <div className="tagline">
          Upcoming releases, underground artists, up-and-coming actors, short films, and the artist and
          filmmaker of the week - updated every weekend.
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Subscribe</div>
        <div className="panel-body">
          <p className="field-hint" style={{ marginBottom: 10 }}>
            Get the weekly issue by email - no account required.
          </p>
          <NewsletterSubscribeForm />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Past Issues</div>
        <div className="panel-body flush">
          {issues.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              No issues published yet - check back soon.
            </div>
          ) : (
            issues.map((issue) => (
              <Link href={`/newsletter/${issue.id}`} key={issue.id} className="site-links-link">
                <span>{issue.title}</span>
                <span className="dm-inbox-time">{issue.issue_date}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );
}
