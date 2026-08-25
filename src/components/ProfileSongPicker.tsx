"use client";

import { useActionState, useState } from "react";
import { setProfileSong, clearProfileSong, type ProfileFormState } from "@/app/actions/profile";
import { MediaSearchField } from "@/components/MediaSearchField";
import type { YoutubeVideo } from "@/lib/youtube";

const initialState: ProfileFormState = {};

export type ProfileSongDraft = {
  youtubeId: string | null;
  title: string | null;
  artist: string | null;
  thumbnailUrl: string | null;
  autoplay: boolean;
};

export function ProfileSongPicker({ current }: { current: ProfileSongDraft }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<YoutubeVideo | null>(
    current.youtubeId
      ? {
          id: current.youtubeId,
          title: current.title ?? "",
          channelTitle: current.artist ?? "",
          thumbnailUrl: current.thumbnailUrl,
        }
      : null
  );
  const [state, formAction, pending] = useActionState(setProfileSong, initialState);

  // Closed by comparing against the previous action result during render
  // rather than from an effect: an effect here would commit the open panel
  // first and close it on a second pass.
  const [lastOk, setLastOk] = useState(state.ok);
  if (lastOk !== state.ok) {
    setLastOk(state.ok);
    if (state.ok) setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" className="comment-action" onClick={() => setOpen(true)}>
        {current.youtubeId ? "Change profile song" : "Set a profile song"}
      </button>
    );
  }

  return (
    <div className="avatar-picker">
      {state.error && <div className="form-error">{state.error}</div>}

      <form action={formAction} className="comment-form">
        {picked ? (
          <div className="track-selected">
            {picked.thumbnailUrl && <img src={picked.thumbnailUrl} alt="" />}
            <div>
              <b>{picked.title}</b>
              <div className="sub">{picked.channelTitle}</div>
            </div>
            <span className="clear" onClick={() => setPicked(null)}>
              Clear
            </span>
          </div>
        ) : (
          <MediaSearchField placeholder="Search for your song…" onPick={setPicked} />
        )}

        <input type="hidden" name="youtube_id" value={picked?.id ?? ""} />
        <input type="hidden" name="title" value={picked?.title ?? ""} />
        <input type="hidden" name="artist" value={picked?.channelTitle ?? ""} />
        <input type="hidden" name="thumbnail_url" value={picked?.thumbnailUrl ?? ""} />

        <label className="checkbox-row">
          <input type="checkbox" name="autoplay" defaultChecked={current.autoplay} />
          Start playing when someone opens my profile
        </label>
        <div className="field-hint">
          Off by default. Some browsers block autoplay with sound regardless, so visitors may still
          have to press play.
        </div>

        <div className="form-actions">
          <button className="btn" type="submit" disabled={pending || !picked}>
            {pending ? "Saving…" : "Save song"}
          </button>
          <button type="button" className="comment-action" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>

      {current.youtubeId && (
        <form action={clearProfileSong}>
          <button type="submit" className="comment-action danger">
            Remove profile song
          </button>
        </form>
      )}
    </div>
  );
}
