import Link from "next/link";
import type { Print } from "@/lib/photoShelf";

/**
 * A shelf of photographs.
 *
 * Not sleeves. A photograph on a shelf is a framed print standing on the
 * board, and drawing one as a record sleeve would be the same mistake
 * the racks made twice: reaching for the object we already had rather
 * than the one the thing actually is.
 *
 * So: a mount, a frame, and the print inside it, standing on the same
 * wood everything else stands on. The frame is what makes a picture read
 * as an object rather than as an image dropped on a page, and the mount
 * is what makes the frame read as a frame.
 *
 * Landscape, portrait and square all sit on the board at the same
 * height, because they are all standing on it.
 */
export function PhotoShelf({ prints, emptyNote }: { prints: Print[]; emptyNote: string }) {
  if (prints.length === 0) return <p className="shelf-empty">{emptyNote}</p>;

  return (
    <div className="woodwall">
      <div className="woodgrid prints">
        {prints.map((print) => (
          <article className="woodslot" key={print.id}>
            <Link href={`/post/${print.id}`} className="wooditem framed">
              <span className="frame-mount">
                <img src={print.imageUrl} alt={print.title} loading="lazy" decoding="async" />
              </span>
            </Link>
            <div className="woodlabel">
              <b title={print.title}>{print.title}</b>
              {print.authorUsername ? (
                <Link href={`/profile/${print.authorUsername}`} className="print-by">
                  {print.by}
                </Link>
              ) : (
                <span title={print.by}>{print.by}</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
