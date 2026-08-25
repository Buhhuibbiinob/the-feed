"use client";

import { useActionState, useState } from "react";
import {
  addFavorite,
  moveFavorite,
  removeFavorite,
  type ProfileFormState,
} from "@/app/actions/profile";
import { MediaSearchField } from "@/components/MediaSearchField";
import {
  FAVORITE_KINDS,
  FAVORITE_LABELS,
  FAVORITE_SINGULAR,
  MAX_FAVORITES_PER_KIND,
  type Favorite,
  type FavoriteKind,
} from "@/lib/favorites";

const initialState: ProfileFormState = {};

function KindEditor({ kind, items }: { kind: FavoriteKind; items: Favorite[] }) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [state, formAction, pending] = useActionState(addFavorite, initialState);

  // Cleared by comparing against the previous action result during render,
  // so the emptied form is what commits rather than a second pass after the
  // just-added entry has already been painted.
  const [lastOk, setLastOk] = useState(state.ok);
  if (lastOk !== state.ok) {
    setLastOk(state.ok);
    if (state.ok) {
      setTitle("");
      setSubtitle("");
      setImageUrl("");
    }
  }

  const full = items.length >= MAX_FAVORITES_PER_KIND;

  return (
    <div className="favorites-kind">
      <div className="favorites-kind-head">
        {FAVORITE_LABELS[kind]}
        <span className="favorites-count">
          {items.length}/{MAX_FAVORITES_PER_KIND}
        </span>
      </div>

      {state.error && <div className="form-error">{state.error}</div>}

      {items.length > 0 && (
        <ul className="favorites-edit-list">
          {items.map((item, index) => (
            <li key={item.id} className="favorites-edit-row">
              {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="favorite-blank" />}
              <span className="favorites-edit-title">
                <b>{item.title}</b>
                {item.subtitle && <span className="sub">{item.subtitle}</span>}
              </span>
              <span className="layout-move">
                <form action={moveFavorite}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button
                    type="submit"
                    className="comment-action"
                    disabled={index === 0}
                    aria-label={`Move ${item.title} up`}
                  >
                    ↑
                  </button>
                </form>
                <form action={moveFavorite}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    type="submit"
                    className="comment-action"
                    disabled={index === items.length - 1}
                    aria-label={`Move ${item.title} down`}
                  >
                    ↓
                  </button>
                </form>
                <form action={removeFavorite}>
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className="comment-action danger" aria-label={`Remove ${item.title}`}>
                    ✕
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <div className="field-hint">That list is full. Remove one to add another.</div>
      ) : (
        <form action={formAction} className="comment-form">
          <input type="hidden" name="kind" value={kind} />
          <MediaSearchField
            placeholder={`Search for ${FAVORITE_SINGULAR[kind] === "artist" ? "an" : "a"} ${FAVORITE_SINGULAR[kind]}…`}
            onPick={(video) => {
              setTitle(video.title);
              setSubtitle(video.channelTitle);
              setImageUrl(video.thumbnailUrl ?? "");
            }}
          />
          <input
            type="text"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`Name of the ${FAVORITE_SINGULAR[kind]}`}
            maxLength={120}
            required
          />
          <input
            type="text"
            name="subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Note (optional)"
            maxLength={120}
          />
          <input type="hidden" name="image_url" value={imageUrl} />
          <div className="form-actions">
            <button className="btn" type="submit" disabled={pending || !title.trim()}>
              {pending ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// One editor per list. They're separate forms on purpose: adding a movie
// shouldn't make you re-save your artists, and each list has its own
// eight-slot limit to report against.
export function FavoritesEditor({ favorites }: { favorites: Record<FavoriteKind, Favorite[]> }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="comment-action" onClick={() => setOpen(true)}>
        Edit top lists
      </button>
    );
  }

  return (
    <div className="avatar-picker favorites-editor">
      {FAVORITE_KINDS.map((kind) => (
        <KindEditor key={kind} kind={kind} items={favorites[kind]} />
      ))}
      <div className="form-actions">
        <button type="button" className="comment-action" onClick={() => setOpen(false)}>
          Done
        </button>
      </div>
    </div>
  );
}
