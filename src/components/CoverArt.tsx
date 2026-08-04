import { coverGradient } from "@/lib/cover";

// Album/poster art floating above its own mirrored reflection, the way
// iTunes 7's Cover Flow sat artwork on a glass shelf.
//
// The reflection has to live on a wrapper rather than on .release-cover
// itself: that element sets overflow:hidden (to clip the art to its
// rounded corners) and already spends its ::before on the top gloss, so a
// mirrored ::after there would be clipped away. The wrapper carries the
// same background so .sk-reflect::after can inherit it.
export function CoverArt({
  imageUrl,
  seed,
  reflect = true,
}: {
  imageUrl?: string | null;
  seed: string;
  reflect?: boolean;
}) {
  const backgroundImage = imageUrl ? `url(${imageUrl})` : coverGradient(seed);
  const style = imageUrl
    ? { backgroundImage, backgroundSize: "cover", backgroundPosition: "center" }
    : { backgroundImage };

  return (
    <div className={reflect ? "sk-reflect" : undefined} style={reflect ? style : undefined}>
      <div className="release-cover" style={style} />
    </div>
  );
}
