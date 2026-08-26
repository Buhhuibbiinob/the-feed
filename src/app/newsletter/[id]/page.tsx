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
      <div className="panel">
        <div className="newsletter-masthead">
          <h1 className="newsletter-masthead-title">FEEDBACK</h1>
          <div className="newsletter-masthead-sub">
            The Weekly Wrap-Up &middot; {issue.issue_date}
            {issue.status === "draft" && " - draft preview"}
          </div>
        </div>
        <hr className="newsletter-rule" />
        <div className="newsletter-headline">{issue.title}</div>
        {issue.cover_image_url && (
          <div style={{ padding: "18px 20px 0" }}>
            <img
              src={issue.cover_image_url}
              alt=""
              style={{ width: "100%", borderRadius: 4, border: "1px solid #d8d8d8", display: "block" }}
            />
          </div>
        )}

        {sections.length === 0 ? (
          <div className="empty-state" style={{ padding: 16 }}>
            This issue doesn&apos;t have any sections filled in yet.
          </div>
        ) : (
          <div style={{ paddingBottom: 20 }}>
            {sections.map((section) => (
              <div className="newsletter-section" key={section.key}>
                <div className="newsletter-section-title">{section.label}</div>
                <p className="newsletter-section-body">{issue[section.key]}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
