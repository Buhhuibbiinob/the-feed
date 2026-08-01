import { coverGradient } from "@/lib/cover";

export type ShelfItem = {
  id: string;
  title: string;
  subtitle: string;
  poster?: boolean;
  imageUrl?: string;
};

export function Shelf({
  title,
  items,
  emptyMessage = "Nothing here yet - be the first to post one.",
  tone,
}: {
  title: string;
  items: ShelfItem[];
  emptyMessage?: string;
  tone?: "blue" | "purple" | "green" | "pink" | "orange" | "yellow";
}) {
  return (
    <div className={`panel${tone ? ` tone-${tone}` : ""}`}>
      <div className="panel-head tabbed">
        <span className="panel-head-tab">
          <span className="tab-the">the</span>
          <span className="tab-main">{title}</span>
        </span>
      </div>
      <div className="shelf-body">
        <div className="sk-shelf-grid">
          {items.length === 0 ? (
            <div className="empty-state">{emptyMessage}</div>
          ) : (
            items.map((item) => {
              const image = item.imageUrl ? `url(${item.imageUrl})` : coverGradient(item.id);
              const imageStyle = item.imageUrl
                ? { backgroundImage: image, backgroundSize: "cover", backgroundPosition: "center" }
                : { backgroundImage: image };
              return (
                <div className="sk-shelf-item" key={item.id}>
                  <div className="sk-stack">
                    <div className={`sk-card${item.poster ? " poster" : ""}`} style={imageStyle} />
                  </div>
                  <div className="sk-shelf-name">{item.title}</div>
                  <div className="sk-shelf-artist">{item.subtitle}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
