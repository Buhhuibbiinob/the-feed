"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { addPlaylist, removePlaylist, type PlaylistState } from "@/app/actions/playlists";
import {
  APPLE_MUSIC_CONNECT_NOTE,
  MAX_PLAYLIST_TITLE,
  PROVIDER_LABELS,
  embedUrl,
  openUrl,
  parsePlaylistUrl,
  type Playlist,
} from "@/lib/playlists";

const initialState: PlaylistState = {};

/**
 * Playlists, as a shelf of tapes.
 *
 * A playlist is a mixtape. Not a metaphor reached for to match the
 * furniture: it is the same object doing the same job, somebody choosing
 * an order and handing it over, which is why the add form already asked
 * "what do you call it" rather than "title".
 *
 * Both services will play a playlist for anybody with the link, no key
 * and no account, which is why this works at all. Only the tape you press
 * loads a player, and that is not decoration either: the old wall
 * rendered every embed at once, and twelve players all connecting on load
 * is a slow tab where eleven of them are below the fold.
 */

/** Pasting a link, and being told whether it is one before you submit. */
function AddPlaylist() {
  const [state, formAction, pending] = useActionState(addPlaylist, initialState);
  const [url, setUrl] = useState("");

  // Recognised as you paste, before you submit. A link that is going to
  // be rejected should say so while the paste is still in your hand.
  const parsed = parsePlaylistUrl(url);
  const [lastOk, setLastOk] = useState(state.ok);
  if (lastOk !== state.ok) {
    setLastOk(state.ok);
    if (state.ok) setUrl("");
  }

  return (
    <form action={formAction} className="playlist-add" key={state.ok ? "clean" : "dirty"}>
      <div className="field">
        <label htmlFor="playlist-url">Paste a playlist link</label>
        <input
          id="playlist-url"
          name="url"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="open.spotify.com/playlist/… or music.apple.com/…/playlist/…"
          autoComplete="off"
        />
        <div className="field-hint">
          {url.trim() && !parsed
            ? "That is not a playlist link. An album or a single track will not work here."
            : parsed
            ? `${PROVIDER_LABELS[parsed.provider]} playlist. Give it a name and it's up.`
            : APPLE_MUSIC_CONNECT_NOTE}
        </div>
      </div>

      <div className="field">
        <label htmlFor="playlist-title">What do you call it?</label>
        <input
          id="playlist-title"
          name="title"
          type="text"
          maxLength={MAX_PLAYLIST_TITLE}
          placeholder="the one for the drive home"
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor="playlist-note">A line about it (optional)</label>
        <input
          id="playlist-note"
          name="note"
          type="text"
          maxLength={200}
          placeholder="two years of this, mostly at night"
          autoComplete="off"
        />
      </div>

      {state.error && <div className="form-error">{state.error}</div>}

      <div className="form-actions">
        <button type="submit" className="btn" disabled={pending || !parsed}>
          {pending ? "Putting it up" : "Put it up"}
        </button>
      </div>
    </form>
  );
}

/**
 * The shelf, and the one tape in the deck.
 *
 * Nothing is playing to begin with, deliberately. A shelf that starts
 * playing at you is a shelf that decided for you, and the whole point of
 * a wall of other people's tapes is that you pick one.
 */
function TapeShelf({
  playlists,
  currentUserId,
  viewerIsAdmin,
}: {
  playlists: Playlist[];
  currentUserId: string | null;
  viewerIsAdmin: boolean;
}) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playing = playlists.find((p) => p.id === playingId) ?? null;

  return (
    <>
      <div className="woodwall tapes">
        <div className="woodgrid">
          {playlists.map((playlist) => (
            <article
              className={playlist.id === playingId ? "woodslot playing" : "woodslot"}
              key={playlist.id}
            >
              <div className="wooditem">
                <button
                  type="button"
                  className="wood-tape-btn"
                  aria-pressed={playlist.id === playingId}
                  onClick={() =>
                    setPlayingId(playlist.id === playingId ? null : playlist.id)
                  }
                >
                  <span className={`wood-tape ${playlist.provider}`}>
                    <span className="wood-tape-label">
                      <span className="wood-tape-title">{playlist.title}</span>
                      <span className="wood-tape-by">{playlist.username}</span>
                    </span>
                    {/* Wound unevenly on purpose. Two spools the same size
                        is a tape nobody has played. */}
                    <span className="wood-tape-spools" aria-hidden="true">
                      <span />
                      <span />
                    </span>
                  </span>
                </button>
              </div>
              {/* The title is written on the tape, so the card under the
                  board says the thing the tape has no room for. Repeating
                  the title here just made every playlist say its own name
                  twice. */}
              <div className="woodlabel">
                <b title={playlist.note ?? playlist.title}>
                  {playlist.note || `${playlist.username}'s tape`}
                </b>
                <span>{PROVIDER_LABELS[playlist.provider]}</span>
              </div>
              <div className="woodactions">
                <Link href={`/profile/${playlist.username}`} className="wood-link">
                  {playlist.username}
                </Link>
                {(currentUserId === playlist.userId || viewerIsAdmin) && (
                  <form action={removePlaylist} className="inline-form">
                    <input type="hidden" name="playlist_id" value={playlist.id} />
                    <button type="submit">
                      {currentUserId === playlist.userId ? "Take down" : "Remove"}
                    </button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      {playing && (
        <div className={`tape-deck ${playing.provider}`}>
          <div className="tape-deck-head">
            <b>{playing.title}</b>
            <a href={openUrl(playing)} target="_blank" rel="noreferrer">
              Open in {PROVIDER_LABELS[playing.provider]}
            </a>
          </div>
          {playing.note && <p className="tape-deck-note">{playing.note}</p>}
          <iframe
            src={embedUrl(playing)}
            title={`${playing.title} on ${PROVIDER_LABELS[playing.provider]}`}
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          />
          <div className="tape-deck-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setPlayingId(null)}>
              Put it back
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function PlaylistWall({
  playlists,
  currentUserId,
  viewerIsAdmin,
  canAdd,
}: {
  playlists: Playlist[];
  currentUserId: string | null;
  viewerIsAdmin: boolean;
  canAdd: boolean;
}) {
  return (
    <>
      {canAdd ? (
        <div className="panel">
          <div className="panel-head">Add a playlist</div>
          <div className="panel-body">
            <AddPlaylist />
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="panel-body">
            <p className="empty-state">
              <Link href="/sign-in">Sign in</Link> to put one of yours up.
            </p>
          </div>
        </div>
      )}

      {playlists.length === 0 ? (
        <div className="panel">
          <div className="panel-body">
            <p className="empty-state">
              Nobody has put a playlist up yet. Paste a link to one you actually listen to.
            </p>
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="panel-head">On the shelf</div>
          <div className="panel-body">
            <TapeShelf
              playlists={playlists}
              currentUserId={currentUserId}
              viewerIsAdmin={viewerIsAdmin}
            />
          </div>
        </div>
      )}
    </>
  );
}
