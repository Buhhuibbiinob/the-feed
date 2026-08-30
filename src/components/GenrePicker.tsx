"use client";

import { useState } from "react";
import { GENRES, genreLabel } from "@/lib/genres";
import type { MediaType } from "@/lib/media";

/**
 * Genre as a row of chips, not a dropdown.
 *
 * A select is one tap to open, one to scroll, one to choose, and it looks
 * like paperwork. Chips are one tap, and the options are readable without
 * doing anything at all - which matters for a field that is optional and
 * therefore has to earn every single answer it gets.
 *
 * Tapping the chosen one again clears it, so "I picked the wrong one" and
 * "I would rather not say" have the same, obvious gesture.
 */
export function GenrePicker({
  mediaType,
  value,
  onChange,
}: {
  mediaType: MediaType;
  value: string | null;
  onChange: (genre: string | null) => void;
}) {
  return (
    <div className="field">
      <label>Genre (optional)</label>
      <div className="genre-chips">
        {GENRES[mediaType].map((slug) => (
          <button
            key={slug}
            type="button"
            className={value === slug ? "genre-chip active" : "genre-chip"}
            aria-pressed={value === slug}
            onClick={() => onChange(value === slug ? null : slug)}
          >
            {genreLabel(slug)}
          </button>
        ))}
      </div>
      <input type="hidden" name="genre" value={value ?? ""} />
    </div>
  );
}

/**
 * The same picker, holding its own state.
 *
 * For the edit form, which is a plain uncontrolled form - it has no state
 * of its own to hang this on, and giving it some would mean rewriting it
 * around a field it did not previously have.
 */
export function StandaloneGenrePicker({
  mediaType,
  initial,
}: {
  mediaType: MediaType;
  initial: string | null;
}) {
  const [genre, setGenre] = useState<string | null>(initial);
  return <GenrePicker mediaType={mediaType} value={genre} onChange={setGenre} />;
}
