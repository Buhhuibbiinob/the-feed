"use client";

import { useState } from "react";
import { COMMON_GENRES, genreLabel, searchGenres } from "@/lib/genres";
import type { MediaType } from "@/lib/media";

/**
 * Genre, as a short row you can search past.
 *
 * It used to be every genre at once as chips. Fifteen was already a wall
 * to scan rather than a set to choose from, and it was too FEW to be
 * useful: anybody who cared enough to want "shoegaze" or "amapiano"
 * found the field had been written for somebody else, and picked nothing.
 * So the list is now several times longer and you never see all of it -
 * eight common answers, and a search box for the rest.
 *
 * Search is the only part that had to be right. Nobody types "hip-hop";
 * they type "rap". A picker that answers "no matches" to "rap" has told
 * a lie about what it contains, so the aliases in genres.ts matter more
 * than the list does.
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
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  // Once something is picked, the wall goes away entirely. The answer is
  // the only thing still worth showing, and leaving forty other options
  // on screen implies the choice is still open when it is made.
  if (value) {
    return (
      <div className="field">
        <label>Genre</label>
        <div className="genre-chosen">
          <button
            type="button"
            className="genre-chip active"
            onClick={() => {
              onChange(null);
              setQuery("");
              setSearching(false);
            }}
            aria-label={`${genreLabel(value)}, tap to change`}
          >
            {genreLabel(value)}
            <span className="genre-clear" aria-hidden="true">×</span>
          </button>
        </div>
        <input type="hidden" name="genre" value={value} />
      </div>
    );
  }

  const results = searching || query ? searchGenres(mediaType, query) : COMMON_GENRES[mediaType];

  return (
    <div className="field">
      {/* Not "(optional)". It IS optional, and saying so as the label is
          an instruction to skip it: which is what people did, leaving
          the one field that makes genre filters and recommendations
          possible empty on most reviews. Saying what it is for asks for
          the same second of effort with a reason attached. */}
      <label htmlFor="genre-search">Genre, so people can find this later</label>

      <div className="genre-chips">
        {results.map((slug) => (
          <button
            key={slug}
            type="button"
            className="genre-chip"
            onClick={() => onChange(slug)}
          >
            {genreLabel(slug)}
          </button>
        ))}
        {results.length === 0 && (
          <span className="genre-none">Nothing matching “{query.trim()}”.</span>
        )}
      </div>

      <input
        id="genre-search"
        type="text"
        className="genre-search"
        placeholder="Search genres. Try “rap”, “shoegaze”, “true crime”"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSearching(true);
        }}
        // These pickers sit inside a form that saves something else, so
        // Enter here means "I have finished typing", not "submit".
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        autoComplete="off"
      />

      <input type="hidden" name="genre" value="" />
    </div>
  );
}

/**
 * The same picker, holding its own state.
 *
 * For the edit form, which is a plain uncontrolled form - it has no
 * state of its own to hang this on.
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
