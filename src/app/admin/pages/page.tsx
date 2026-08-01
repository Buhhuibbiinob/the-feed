import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { BUILTIN_PAGES, getArchivedBuiltinSlugs, getAllPagesForAdmin } from "@/lib/pages";
import { setBuiltinPageArchived, setCustomPageArchived, deleteCustomPage } from "@/app/actions/pages";
import { CreatePageForm } from "@/components/CreatePageForm";

export const metadata = { title: "Pages - Feedback" };

export default async function AdminPagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(supabase, user.id))) {
    notFound();
  }

  const [archivedSlugs, customPages] = await Promise.all([
    getArchivedBuiltinSlugs(supabase),
    getAllPagesForAdmin(supabase),
  ]);

  return (
    <>
      <div className="page-header">
        <h1>Pages</h1>
        <div className="tagline">
          Archive a built-in page to hide it from navigation, or add a custom page of your own.
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Built-in Pages</div>
        <div className="panel-body flush">
          {BUILTIN_PAGES.map((p) => {
            const archived = archivedSlugs.has(p.slug);
            return (
              <div className="site-links-link" key={p.slug}>
                <span>{p.label}</span>
                <form action={setBuiltinPageArchived}>
                  <input type="hidden" name="slug" value={p.slug} />
                  <input type="hidden" name="archived" value={archived ? "false" : "true"} />
                  <button type="submit" className={archived ? "btn" : "btn btn-ghost"}>
                    {archived ? "Unarchive" : "Archive"}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Custom Pages</div>
        <div className="panel-body flush">
          {customPages.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              No custom pages yet - add one below.
            </div>
          ) : (
            customPages.map((p) => (
              <div className="site-links-link" key={p.id}>
                <Link href={`/admin/pages/${p.id}`}>
                  {p.label} <span className="dm-inbox-time">{p.path}</span>
                </Link>
                <div className="form-actions" style={{ margin: 0 }}>
                  <form action={setCustomPageArchived}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="archived" value={p.archived ? "false" : "true"} />
                    <button type="submit" className={p.archived ? "btn" : "btn btn-ghost"}>
                      {p.archived ? "Unarchive" : "Archive"}
                    </button>
                  </form>
                  <form action={deleteCustomPage}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className="comment-action danger">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Add a Page</div>
        <div className="panel-body">
          <CreatePageForm />
        </div>
      </div>
    </>
  );
}
