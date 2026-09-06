import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { guardBuiltinPage } from "@/lib/pages";
import { QueueAddForm } from "@/components/QueueAddForm";
import { markQueueDone, markQueueUndone, removeFromQueue } from "@/app/actions/queue";
import { isMissingSchema } from "@/lib/dbError";
import { formatForKey, type MediaFormat } from "@/lib/physicalMedia";
import { QUEUE_DONE_LABEL, reviewHref, toQueueItem, type QueueItem, type QueueRow } from "@/lib/queue";

export const metadata = { title: "Your shelf - Feedback" };

const COLUMNS = "id, media_type, title, subtitle, image_url, from_post_id, done_at, created_at";

/**
 * Your shelf.
 *
 * This was a list called Up Next, and everywhere you could pick something
 * up was somewhere else: the Crate had its own pile, the Shelves had
 * theirs, and what you kept from either went into a list of rows with
 * thumbnails on it. Three places, one of which looked nothing like the
 * other two.
 *
 * They are one thing now. You dig through the crate or walk along the
 * shelves, and whatever you take ends up standing on your own shelf,
 * which is made of the same wood as the ones you took it from. The list
 * is gone. Nothing is lost by that: everything the rows said is still
 * here, on the card under each record.
 */

/** What a queued thing would sit on a shelf as. */
function shelfFormat(item: QueueItem): MediaFormat | "case" {
  // A film is a tall case with a spine, whatever year it is from. A
  // photograph has no object either, so it gets the same glass a
  // download gets. Music is the only one with a real answer, and with no
  // year on a queue row the answer comes from the title.
  if (item.mediaType === "movie_tv") return "case";
  if (item.mediaType === "photography") return "download";
  return formatForKey(`${item.title} ${item.subtitle ?? ""}`);
}

function ShelfThing({ item, done }: { item: QueueItem; done: boolean }) {
  return (
    <article className={done ? "woodslot played" : "woodslot"}>
      <div className={`wooditem fmt-${shelfFormat(item)}`}>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" loading="lazy" />
        ) : (
          <div className="wood-blank" aria-hidden="true" />
        )}
        {/* Taking it off the shelf lives on the record itself. Under it,
            beside the other two, it was a third link in a column that
            only ever had room for two, and the three ran together across
            the whole shelf. */}
        <form action={removeFromQueue} className="inline-form">
          <input type="hidden" name="id" value={item.id} />
          <button type="submit" className="wood-remove" aria-label={`Take ${item.title} off the shelf`}>
            <span aria-hidden="true">&times;</span>
          </button>
        </form>
      </div>
      <div className="woodlabel">
        <b title={item.title}>{item.title}</b>
        <span title={item.subtitle ?? ""}>
          {item.subtitle ||
            (item.fromPostId ? "someone talked you into it" : " ")}
        </span>
      </div>
      <div className="woodactions">
        {done ? (
          <form action={markQueueUndone} className="inline-form">
            <input type="hidden" name="id" value={item.id} />
            <button type="submit">Put it back</button>
          </form>
        ) : (
          <>
            {/* Still the point of the page: the shelf is a stack of
                reviews waiting to be written, and starting one is a
                single press with the fields already filled in. */}
            <Link href={reviewHref(item)} className="wood-link">
              Review
            </Link>
            <form action={markQueueDone} className="inline-form">
              <input type="hidden" name="id" value={item.id} />
              <button type="submit">{QUEUE_DONE_LABEL[item.mediaType]}</button>
            </form>
          </>
        )}
      </div>
    </article>
  );
}

/** The two places a record comes from, said as doors rather than links. */
function Doors() {
  return (
    <div className="shelf-doors">
      <Link href="/crate" className="shelf-door">
        <b>Dig through a crate</b>
        <span>One sleeve at a time, in an order nobody chose</span>
      </Link>
      <Link href="/shelves" className="shelf-door">
        <b>Walk along the shelves</b>
        <span>Pick a decade, a scene or a place and see what is on it</span>
      </Link>
    </div>
  );
}

export default async function ShelfPage() {
  const supabase = await createClient();
  await guardBuiltinPage(supabase, "queue");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="panel">
        <div className="panel-head">Your shelf</div>
        <div className="panel-body">
          <p>
            <Link href="/sign-in">Sign in</Link> to keep a shelf of what you mean to get to. It is
            yours alone, and nobody else can see what is on it.
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
  // which thing is missing rather than rendering an empty shelf that
  // looks like the feature is broken.
  if (error && isMissingSchema(error.message)) {
    return (
      <div className="panel">
        <div className="panel-head">Your shelf</div>
        <div className="panel-body">
          <p>
            This page needs a table that is not in the database yet. Whoever runs the site needs to
            apply <code>supabase/migrations/006-queue.sql</code>.
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
        <div className="panel-head">Your shelf</div>
        <div className="panel-body">
          {pending.length === 0 ? (
            <>
              <p className="shelf-intro" style={{ marginTop: 0 }}>
                Nothing on it yet. Anything you take out of a crate or off a shelf ends up standing
                here, and so does anything you press Up Next on. Only you can see it.
              </p>
              <Doors />
            </>
          ) : (
            <>
              <div className="woodwall">
                <div className="woodgrid">
                  {pending.map((item) => (
                    <ShelfThing key={item.id} item={item} done={false} />
                  ))}
                </div>
              </div>
              <Doors />
            </>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Put something on it</div>
        <div className="panel-body">
          <QueueAddForm />
        </div>
      </div>

      {done.length > 0 && (
        <div className="panel">
          <div className="panel-head">Been through these</div>
          <div className="panel-body">
            <div className="woodwall played-wall">
              <div className="woodgrid">
                {done.map((item) => (
                  <ShelfThing key={item.id} item={item} done />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
