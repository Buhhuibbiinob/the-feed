"use client";

import { useActionState, useEffect, useState } from "react";
import { createPost, type PostFormState } from "@/app/actions/posts";
import type { YoutubeVideo } from "@/lib/youtube";
import { MEDIA_LABELS } from "@/lib/media";

const initialState: PostFormState = {};

export function PostForm() {
  const [state, formAction, pending] = useActionState(createPost, initialState);
  const [formKey, setFormKey] = useState(0);
  const [lastOk, setLastOk] = useState(state.ok);

  const [mediaType, setMediaType] = useState("music");
  const [title, setTitle] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [videoQuery, setVideoQuery] = useState("");
  const [videoResults, setVideoResults] = useState<YoutubeVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<YoutubeVideo | null>(null);
  const [videoSearching, setVideoSearching] = useState(false);

  if (state.ok !== lastOk) {
    setLastOk(state.ok);
    if (state.ok) {
      setFormKey((k) => k + 1);
      setMediaType("music");
      setTitle("");
      setPosterUrl("");
      setVideoQuery("");
      setVideoResults([]);
      setSelectedVideo(null);
    }
  }

  useEffect(() => {
    if (!videoQuery.trim()) {
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(videoQuery)}`);
        const data = await res.json();
        if (!cancelled) setVideoResults(data.videos ?? []);
      } finally {
        if (!cancelled) setVideoSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [videoQuery]);

  function selectVideo(video: YoutubeVideo) {
    setSelectedVideo(video);
    setTitle(video.title);
    setVideoQuery("");
    setVideoResults([]);
  }

  function clearSelectedVideo() {
    setSelectedVideo(null);
  }

  return (
    <div className="panel">
      <div className="panel-head">Post a Review</div>
      <div className="panel-body">
        {state.error && <div className="form-error">{state.error}</div>}
        <form action={formAction} key={formKey}>
          <div className="field">
            <label htmlFor="media_type">Category</label>
            <select
              id="media_type"
              name="media_type"
              value={mediaType}
              onChange={(e) => {
                setMediaType(e.target.value);
                setVideoQuery("");
                setVideoResults([]);
                setSelectedVideo(null);
              }}
              required
            >
              <option value="music">{MEDIA_LABELS.music}</option>
              <option value="movie_tv">{MEDIA_LABELS.movie_tv}</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="video-search">
              {mediaType === "music" ? "Find a track on YouTube" : "Find it on YouTube"}
            </label>
            {selectedVideo ? (
              <div className="track-selected">
                {selectedVideo.thumbnailUrl && <img src={selectedVideo.thumbnailUrl} alt="" />}
                <div>
                  <b>{selectedVideo.title}</b>
                  <div className="sub">{selectedVideo.channelTitle}</div>
                </div>
                <span className="clear" onClick={clearSelectedVideo}>
                  Clear
                </span>
              </div>
            ) : (
              <div className="track-search">
                <input
                  id="video-search"
                  type="text"
                  placeholder={
                    mediaType === "music" ? "Search song or artist…" : "Search movie or show title…"
                  }
                  value={videoQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setVideoQuery(value);
                    if (!value.trim()) {
                      setVideoResults([]);
                      setVideoSearching(false);
                    } else {
                      setVideoSearching(true);
                    }
                  }}
                  autoComplete="off"
                />
                {videoQuery.trim() && (
                  <div className="track-results">
                    {videoSearching ? (
                      <div className="track-result">Searching…</div>
                    ) : videoResults.length === 0 ? (
                      <div className="track-result">No matches.</div>
                    ) : (
                      videoResults.map((video) => (
                        <div className="track-result" key={video.id} onClick={() => selectVideo(video)}>
                          {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" />}
                          <div>
                            <b>{video.title}</b>
                            <div className="sub">{video.channelTitle}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {!selectedVideo && (
            <div className="field">
              <label htmlFor="poster-url">Or paste a cover image URL</label>
              <input
                id="poster-url"
                type="url"
                placeholder="https://…"
                value={posterUrl}
                onChange={(e) => setPosterUrl(e.target.value)}
              />
              {posterUrl && (
                <div className="track-selected">
                  <img src={posterUrl} alt="" />
                </div>
              )}
            </div>
          )}

          <input
            type="hidden"
            name="artist"
            value={mediaType === "music" ? selectedVideo?.channelTitle ?? "" : ""}
          />
          <input type="hidden" name="cover_url" value={selectedVideo?.thumbnailUrl ?? posterUrl} />
          <input type="hidden" name="youtube_video_id" value={selectedVideo?.id ?? ""} />

          <div className="field">
            <label htmlFor="title">Title</label>
            <input
              id="title"
              name="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="rating">Rating</label>
            <select id="rating" name="rating" defaultValue="">
              <option value="">No rating</option>
              <option value="1">★☆☆☆☆</option>
              <option value="2">★★☆☆☆</option>
              <option value="3">★★★☆☆</option>
              <option value="4">★★★★☆</option>
              <option value="5">★★★★★</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="body">Your review</label>
            <textarea id="body" name="body" required />
            <div className="field-hint">Tip: wrap text in ||double pipes|| to mark it as a spoiler.</div>
          </div>
          <div className="form-actions">
            <button className="btn" type="submit" disabled={pending}>
              {pending ? "Posting…" : "Post"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
