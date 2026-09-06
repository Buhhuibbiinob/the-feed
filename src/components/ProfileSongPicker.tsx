"use client";

import { useActionState, useState } from "react";
import { setProfileSong, clearProfileSong, type ProfileFormState } from "@/app/actions/profile";
import { MediaSearchField } from "@/components/MediaSearchField";

const initialState: ProfileFormState = {};

export type ProfileSongDraft = {
  youtubeId: string | null;
  title: string | null;
  artist: string | null;
  thumbnailUrl: string | null;
  autoplay: boolean;
};

type PickedSong = {
  youtubeId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
};

export function ProfileSongPicker({ current, ownerId }: { current: ProfileSongDraft; ownerId: string }) {
  const [open, setOpen] = useState(false);
  // The song as it will be saved: Apple's words and picture, plus the
  // YouTube id that actually plays it. The two come from different places
  // now - the catalogue is searched for free, and the video is looked up
  // once, on the result that was picked.
  const [picked, setPicked] = useState<PickedSong | null>(
    current.youtubeId
      ? {
          youtubeId: current.youtubeId,
          title: current.title ?? "",
          artist: current.artist ?? "",
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
        <input type="hidden" name="owner_id" value={ownerId} />
        {picked ? (
          <div className="track-selected">
            {picked.thumbnailUrl && <img src={picked.thumbnailUrl} alt="" />}
            <div>
              <b>{picked.title}</b>
              <div className="sub">{picked.artist}</div>
            </div>
            <span className="clear" onClick={() => setPicked(null)}>
              Clear
            </span>
          </div>
        ) : (
          <MediaSearchField
            placeholder="Search for a song"
            // The one caller that genuinely needs a video: this is the
            // song that plays on the profile.
            needsVideo
            onPick={(track, video) => {
              if (!video) return;
              setPicked({
                youtubeId: video.id,
                title: track.title,
                artist: track.artist,
                thumbnailUrl: track.thumbnailUrl,
              });
            }}
          />
        )}

        <input type="hidden" name="youtube_id" value={picked?.youtubeId ?? ""} />
        <input type="hidden" name="title" value={picked?.title ?? ""} />
        <input type="hidden" name="artist" value={picked?.artist ?? ""} />
        <input type="hidden" name="thumbnail_url" value={picked?.thumbnailUrl ?? ""} />

        <label className="checkbox-row">
          <input type="checkbox" name="autoplay" defaultChecked={current.autoplay} />
          Start playing when someone opens my profile
        </label>
        <div className="field-hint">
          Starts muted, then turns itself up the moment the visitor taps anything, since browsers will
          not let a page make noise before that, on any of them. Loops until they leave.
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
          <input type="hidden" name="owner_id" value={ownerId} />
          <button type="submit" className="comment-action danger">
            Remove profile song
          </button>
        </form>
      )}
    </div>
  );
}
