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
 * Playlists, embedded.
 *
 * Both services will play a playlist for anybody with the link, no key
 * and no account, which is why this works at all. The iframes are lazy:
 * a wall of twelve players all connecting on load is a slow tab, and
 * most of them are below the fold anyway.
 */
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
          {pending ? "Putting it up…" : "Put it up"}
        </button>
      </div>
    </form>
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
              Nobody&apos;s put a playlist up yet. Paste a link to one you actually listen to.
            </p>
          </div>
        </div>
      ) : (
        <div className="playlist-wall">
          {playlists.map((playlist) => {
            const mine = currentUserId === playlist.userId;
            return (
              <article className="panel playlist-card" key={playlist.id}>
                <div className="panel-body">
                  <div className="playlist-head">
                    <div className="playlist-titles">
                      <b>{playlist.title}</b>
                      <span className="playlist-by">
                        <Link href={`/profile/${playlist.username}`}>{playlist.username}</Link>
                        {" · "}
                        {PROVIDER_LABELS[playlist.provider]}
                      </span>
                    </div>
                    {(mine || viewerIsAdmin) && (
                      <form action={removePlaylist} className="inline-form">
                        <input type="hidden" name="playlist_id" value={playlist.id} />
                        <button type="submit" className="comment-action danger">
                          {mine ? "Take down" : "Remove (admin)"}
                        </button>
                      </form>
                    )}
                  </div>

                  {playlist.note && <p className="playlist-note">{playlist.note}</p>}

                  <div className={`playlist-embed ${playlist.provider}`}>
                    <iframe
                      src={embedUrl(playlist)}
                      title={`${playlist.title} on ${PROVIDER_LABELS[playlist.provider]}`}
                      loading="lazy"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    />
                  </div>

                  <a
                    className="playlist-open"
                    href={openUrl(playlist)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in {PROVIDER_LABELS[playlist.provider]} →
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
