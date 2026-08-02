import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { getIssueById, NEWSLETTER_SECTIONS } from "@/lib/newsletter";
import { NewsletterEditForm } from "@/components/NewsletterEditForm";
import { NewsletterSendButton } from "@/components/NewsletterSendButton";
import { NewsletterGenerateButton } from "@/components/NewsletterGenerateButton";
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

  const { count: subscriberCount } = await supabase
    .from("waitlist_signups")
    .select("id", { count: "exact", head: true });

  return (
    <>
      <div className="page-header">
        <h1>{issue.title}</h1>
        <div className="tagline">
          {issue.status === "published" ? "Published" : "Draft"} - {issue.issue_date}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Generate with AI</div>
        <div className="panel-body">
          <p>
            Pulls real data from this week - TMDB upcoming releases, underground creator posts, and
            top-rated reviews on Feedback - and drafts each section below from it. Grounded in that real
            data only (won&apos;t invent titles or facts), with sources cited inline. Fills the draft in
            place - review and edit before publishing or sending. Requires a{" "}
            <code>GEMINI_API_KEY</code> environment variable.
          </p>
          <NewsletterGenerateButton issueId={issue.id} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-body">
          <NewsletterEditForm
            key={[issue.title, ...NEWSLETTER_SECTIONS.map((s) => issue[s.key])].join("|")}
            issue={issue}
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Publish</div>
        <div className="panel-body">
          <p>
            Publishing makes the issue visible on the public <Link href="/newsletter">/newsletter</Link>{" "}
            archive.
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

      <div className="panel">
        <div className="panel-head">Send Email</div>
        <div className="panel-body">
          <p>
            Emails everyone who subscribed through the sign-up page or the public newsletter page.
            Requires a <code>RESEND_API_KEY</code> environment variable - without it, sending will show an
            error explaining what to add.
          </p>
          <NewsletterSendButton issueId={issue.id} subscriberCount={subscriberCount ?? 0} />
        </div>
      </div>
    </>
  );
}
