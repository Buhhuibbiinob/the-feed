"use client";

import { useState } from "react";
import { addPostToCollection } from "@/app/actions/collections";

type Collection = { id: string; name: string };

export function AddToCollectionButton({
  postId,
  asLink = false,
}: {
  postId: string;
  /** Render as a plain underlined text link for the old-blog action row. */
  asLink?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (collections === null) {
      setLoading(true);
      try {
        const res = await fetch("/api/collections/mine");
        const data = await res.json();
        setCollections(data.collections ?? []);
      } finally {
        setLoading(false);
      }
    }
  }

  function save(collectionId: string) {
    const formData = new FormData();
    formData.set("collection_id", collectionId);
    formData.set("post_id", postId);
    addPostToCollection(formData);
    setSavedId(collectionId);
  }

  return (
    <div className="add-to-collection">
      {asLink ? (
        <button type="button" onClick={toggleOpen}>
          Save
        </button>
      ) : (
        <button
          type="button"
          className="circle-icon-btn green small"
          onClick={toggleOpen}
          aria-label="Save to collection"
          title="Save to collection"
        >
          <svg viewBox="0 0 24 24">
            <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
          </svg>
        </button>
      )}
      {open && (
        <div className="track-results">
          {loading ? (
            <div className="track-result">Loading…</div>
          ) : !collections || collections.length === 0 ? (
            <div className="track-result">
              No collections yet - create one on the Collections page.
            </div>
          ) : (
            collections.map((c) => (
              <div className="track-result" key={c.id} onClick={() => save(c.id)}>
                {c.name}
                {savedId === c.id && <span> ✓</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
