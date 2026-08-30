import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { guardBuiltinPage } from "@/lib/pages";
import { QueueAddForm } from "@/components/QueueAddForm";
import { markQueueDone, markQueueUndone, removeFromQueue } from "@/app/actions/queue";
import { isMissingSchema } from "@/lib/dbError";
import { MEDIA_LABELS } from "@/lib/media";
import { QUEUE_DONE_LABEL, reviewHref, toQueueItem, type QueueItem, type QueueRow } from "@/lib/queue";

export const metadata = { title: "Up Next - Feedback" };

const COLUMNS = "id, media_type, title, subtitle, image_url, from_post_id, done_at, created_at";

function QueueCard({ item, done }: { item: QueueItem; done: boolean }) {
  return (
    <li className={done ? "queue-item done" : "queue-item"}>
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" className="queue-thumb" />
      ) : (
        <span className="queue-thumb blank" aria-hidden="true" />
      )}
      <div className="queue-body">
        <b>{item.title}</b>
        <span className="sub">
          {item.subtitle ? `${item.subtitle} · ` : ""}
          {MEDIA_LABELS[item.mediaType]}
          {item.fromPostId && (
            <>
              {" · "}
              <Link href={`/post/${item.fromPostId}`}>from a review</Link>
            </>
          )}
        </span>
      </div>
      <div className="queue-actions">
        {done ? (
          <form action={markQueueUndone} className="inline-form">
            <input type="hidden" name="id" value={item.id} />
            <button type="submit">Back on the list</button>
          </form>
        ) : (
          <>
            {/* The point of the whole page: the list is a stack of
                reviews waiting to be written, so writing one is one
                click and arrives with the fields already filled in. */}
            <Link href={reviewHref(item)} className="btn">
              Review it
            </Link>
            <form action={markQueueDone} className="inline-form">
              <input type="hidden" name="id" value={item.id} />
              <button type="submit">{QUEUE_DONE_LABEL[item.mediaType]}</button>
            </form>
          </>
        )}
        <form action={removeFromQueue} className="inline-form">
          <input type="hidden" name="id" value={item.id} />
          <button type="submit" className="danger">
            Remove
          </button>
        </form>
      </div>
    </li>
  );
}

export default async function QueuePage() {
  const supabase = await createClient();
  await guardBuiltinPage(supabase, "queue");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="panel">
        <div className="panel-head">Up Next</div>
        <div className="panel-body">
          <p>
            <Link href="/sign-in">Sign in</Link> to keep a list of what you mean to watch and listen
            to. It&apos;s yours alone - nobody else can see it.
          </p>
        </div>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("queue_items")
    .select(COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<QueueRow[]>();

  // The table ships in a migration somebody has to run by hand, so say
  // which thing is missing rather than rendering an empty list that looks
  // like the feature is broken.
  if (error && isMissingSchema(error.message)) {
    return (
      <div className="panel">
        <div className="panel-head">Up Next</div>
        <div className="panel-body">
          <p>
            This page needs a table that isn&apos;t in the database yet. Whoever runs the site needs
            to apply <code>supabase/migrations/006-queue.sql</code>.
          </p>
        </div>
      </div>
    );
  }

  const items = (data ?? []).map(toQueueItem);
  const pending = items.filter((item) => !item.doneAt);
  const done = items.filter((item) => item.doneAt);

  return (
    <>
      <div className="panel">
        <div className="panel-head">Up Next</div>
        <div className="panel-body">
          {pending.length === 0 ? (
            <p className="field-hint" style={{ marginTop: 0 }}>
              Nothing queued. This is the list of things you mean to get to - add them here, or hit
              &quot;Up next&quot; on any review that talks you into something. Only you can see it.
            </p>
          ) : (
            <ul className="queue-list">
              {pending.map((item) => (
                <QueueCard key={item.id} item={item} done={false} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Add something</div>
        <div className="panel-body">
          <QueueAddForm />
        </div>
      </div>

      {done.length > 0 && (
        <div className="panel">
          <div className="panel-head">Done</div>
          <div className="panel-body">
            <ul className="queue-list">
              {done.map((item) => (
                <QueueCard key={item.id} item={item} done />
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
