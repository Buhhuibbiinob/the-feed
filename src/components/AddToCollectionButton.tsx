"use client";

import { useState } from "react";
import { addPostToCollection } from "@/app/actions/collections";

type Collection = { id: string; name: string };

export function AddToCollectionButton({ postId }: { postId: string }) {
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
      <button type="button" className="comment-action" onClick={toggleOpen}>
        Save to collection
      </button>
      {open && (
        <div className="track-results">
          {loading ? (
            <div className="track-result">Loading…</div>
          ) : !collections || collections.length === 0 ? (
            <div className="track-result">
              No collections yet — create one on the Collections page.
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
