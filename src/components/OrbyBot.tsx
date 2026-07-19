"use client";

import { useRef, useState } from "react";
import type { MediaType } from "@/lib/media";
import type { SpotifyTrack } from "@/lib/spotify";
import type { YoutubeVideo } from "@/lib/youtube";

export type OrbyCandidate = {
  id: string;
  title: string;
  artist: string | null;
  mediaType: MediaType;
  username: string;
  rating: number | null;
};

type OrbyPick = {
  title: string;
  artist: string | null;
  mediaType: MediaType;
  source: "feed" | "spotify" | "youtube";
  username?: string;
  rating?: number | null;
};

type OrbyMessage = { from: "user" | "orby"; text: string };

const GREETING: OrbyMessage = {
  from: "orby",
  text: "Hi, I'm Orby! Ask me for a recommendation — music, a movie, or a show — and I'll find one for you. I only do recommendations, so that's the only thing I'll answer!",
};

const OFF_TOPIC_REPLY =
  "I'm just here to give recommendations — ask me for a song, movie, or show and I'll find one!";

const MUSIC_SEEDS = [
  "today's top hits",
  "indie rock",
  "hip hop essentials",
  "chill lofi beats",
  "90s throwbacks",
  "pop hits",
  "r&b classics",
  "electronic dance",
  "acoustic covers",
  "kpop hits",
];

const MOVIE_TV_SEEDS = [
  "official movie trailer",
  "new tv series trailer",
  "sci-fi movie trailer",
  "comedy movie trailer",
  "must watch series",
  "award winning film trailer",
  "animated movie trailer",
  "thriller trailer",
];

const RECOMMEND_INTENT =
  /\b(recommend|recommendation|suggest|suggestion|any good|give me|find me|show me|pick (me|out)|what should i|got any|something to (watch|listen)|surprise me)\b/i;
const MEDIA_WORDS = /\b(song|track|album|music|artist|band|movie|film|tv|show|series|episode)\b/i;

function isRecommendationRequest(message: string): boolean {
  return RECOMMEND_INTENT.test(message) || MEDIA_WORDS.test(message);
}

function detectMediaType(message: string): MediaType | null {
  const m = message.toLowerCase();
  if (/\b(song|album|track|music|artist|band)\b/.test(m)) return "music";
  if (/\b(movie|film|tv|show|series|episode)\b/.test(m)) return "movie_tv";
  return null;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function fetchOutsidePick(mediaType: MediaType): Promise<OrbyPick | null> {
  try {
    if (mediaType === "music") {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(pick(MUSIC_SEEDS))}`);
      if (!res.ok) return null;
      const data = await res.json();
      const tracks: SpotifyTrack[] = data.tracks ?? [];
      if (tracks.length === 0) return null;
      const track = pick(tracks);
      return { title: track.name, artist: track.artist, mediaType: "music", source: "spotify" };
    }
    const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(pick(MOVIE_TV_SEEDS))}`);
    if (!res.ok) return null;
    const data = await res.json();
    const videos: YoutubeVideo[] = data.videos ?? [];
    if (videos.length === 0) return null;
    const video = pick(videos);
    return { title: video.title, artist: video.channelTitle, mediaType: "movie_tv", source: "youtube" };
  } catch {
    return null;
  }
}

function formatRec(pick: OrbyPick): string {
  const kind = pick.mediaType === "music" ? "🎧" : "🎬";
  const byline = pick.artist ? ` — ${pick.artist}` : "";
  if (pick.source === "feed") {
    const ratingClause = pick.rating ? `, rated ${pick.rating}★` : "";
    return `${kind} Orby recommends: **${pick.title}**${byline} (posted by ${pick.username}${ratingClause}).`;
  }
  const sourceLabel = pick.source === "spotify" ? "Spotify" : "YouTube";
  return `${kind} Orby found this on ${sourceLabel}: **${pick.title}**${byline}.`;
}

export function OrbyBot({ candidates }: { candidates: OrbyCandidate[] }) {
  const [messages, setMessages] = useState<OrbyMessage[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const usedIds = useRef(new Set<string>());

  function pickFeedCandidate(mediaType: MediaType): OrbyPick | null {
    let pool = candidates.filter((c) => c.mediaType === mediaType);
    if (pool.length === 0) pool = candidates;
    if (pool.length === 0) return null;

    let unused = pool.filter((c) => !usedIds.current.has(c.id));
    if (unused.length === 0) {
      usedIds.current.clear();
      unused = pool;
    }

    const chosen = pick(unused);
    usedIds.current.add(chosen.id);
    return {
      title: chosen.title,
      artist: chosen.artist,
      mediaType: chosen.mediaType,
      source: "feed",
      username: chosen.username,
      rating: chosen.rating,
    };
  }

  async function getReply(message: string): Promise<string> {
    if (!isRecommendationRequest(message)) {
      return OFF_TOPIC_REPLY;
    }

    const mediaType = detectMediaType(message) ?? (Math.random() < 0.5 ? "music" : "movie_tv");

    const tryOutsideFirst = Math.random() < 0.5;
    if (tryOutsideFirst) {
      const outside = await fetchOutsidePick(mediaType);
      if (outside) return formatRec(outside);
      const feed = pickFeedCandidate(mediaType);
      if (feed) return formatRec(feed);
    } else {
      const feed = pickFeedCandidate(mediaType);
      if (feed) return formatRec(feed);
      const outside = await fetchOutsidePick(mediaType);
      if (outside) return formatRec(outside);
    }

    return "I couldn't find anything to recommend right now — try again in a bit!";
  }

  async function send() {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft("");
    setMessages((prev) => [...prev, { from: "user", text }]);
    setPending(true);
    const reply = await getReply(text);
    setPending(false);
    setMessages((prev) => [...prev, { from: "orby", text: reply }]);
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="orb" style={{ width: 18, height: 18, marginRight: 8, verticalAlign: "middle" }} />
        Orby
      </div>
      <div className="chat-body">
        {messages.map((m, i) => (
          <div className="chat-row" key={i}>
            <b>{m.from === "orby" ? "Orby" : "You"}:</b> {m.text}
          </div>
        ))}
        {pending && (
          <div className="chat-row">
            <b>Orby:</b> Thinking…
          </div>
        )}
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          type="text"
          placeholder="Ask Orby for a recommendation…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={pending}
        />
        <button className="btn" type="submit" disabled={pending}>
          Ask
        </button>
      </form>
    </div>
  );
}
