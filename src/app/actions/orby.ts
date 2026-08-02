"use server";

import { createClient } from "@/lib/supabase/server";
import { askGemini } from "@/lib/gemini";
import { discoverMovies, discoverTv, MOVIE_GENRE_WORDS, TV_GENRE_WORDS } from "@/lib/tmdb";
import { getTrendingTracks } from "@/lib/lastfm";

function detectGenre(message: string): { movie?: number; tv?: number } {
  const m = message.toLowerCase();
  for (const [word, id] of Object.entries(MOVIE_GENRE_WORDS)) {
    if (m.includes(word)) return { movie: id, tv: TV_GENRE_WORDS[word] };
  }
  return {};
}

const SYSTEM_PROMPT_BASE = `You are Orby, a friendly recommendation assistant on Feedback, a music/movie/TV review community site. You ONLY discuss and recommend music, movies, TV shows, underground/indie artists, and short films - nothing else. If asked about anything off-topic, politely redirect back to recommendations in one short sentence and don't answer the off-topic part.

Keep replies conversational but brief (2-4 sentences max, like a chat message, not an essay). When recommending, pick from the REAL candidates listed below when they fit what the user asked for - don't invent fake titles, artists, or details. If nothing listed fits the request, you may suggest a well-known real title from your own knowledge instead, but never fabricate plot details, release dates, or facts you're not confident about.`;

export async function askOrby(message: string): Promise<string> {
  const trimmed = message.trim();
  if (!trimmed) return "Ask me for a recommendation - music, a movie, a show, or an underground artist!";

  const genre = detectGenre(trimmed);
  const supabase = await createClient();

  const [movies, shows, tracks, undergroundRes] = await Promise.all([
    discoverMovies(genre.movie, 12).catch(() => []),
    discoverTv(genre.tv, 12).catch(() => []),
    getTrendingTracks(20).catch(() => []),
    supabase
      .from("artist_posts")
      .select("artist_name, platform, description")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const underground =
    (undergroundRes.data as { artist_name: string; platform: string; description: string | null }[] | null) ?? [];

  const candidateText = [
    movies.length
      ? `Movies:\n${movies.map((m) => `- ${m.title} (${m.date?.slice(0, 4) ?? "?"})${m.overview ? ` - ${m.overview.slice(0, 120)}` : ""}`).join("\n")}`
      : "",
    shows.length
      ? `TV Shows:\n${shows.map((s) => `- ${s.title} (${s.date?.slice(0, 4) ?? "?"})${s.overview ? ` - ${s.overview.slice(0, 120)}` : ""}`).join("\n")}`
      : "",
    tracks.length ? `Trending Music:\n${tracks.map((t) => `- "${t.name}" by ${t.artist}`).join("\n")}` : "",
    underground.length
      ? `Underground creators posted directly on Feedback (real indie artists/filmmakers - prioritize these when the user asks for "underground," "indie," or "unsigned" recs):\n${underground
          .map((u) => `- ${u.artist_name} (${u.platform === "youtube" ? "short film/video" : "music"})${u.description ? `: ${u.description.slice(0, 100)}` : ""}`)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const systemPrompt = `${SYSTEM_PROMPT_BASE}\n\n${candidateText}`;
  const reply = await askGemini(systemPrompt, trimmed);
  if (reply) return reply;

  // Fallback for when GEMINI_API_KEY isn't configured yet, or the call
  // fails - still recommends from the same real data, just without the
  // conversational reasoning.
  const pool = [
    ...movies.map((m) => `${m.title} (${m.date?.slice(0, 4) ?? "?"})`),
    ...shows.map((s) => `${s.title} (${s.date?.slice(0, 4) ?? "?"})`),
    ...tracks.map((t) => `"${t.name}" by ${t.artist}`),
    ...underground.map((u) => `${u.artist_name} (underground ${u.platform === "youtube" ? "filmmaker" : "artist"} on Feedback)`),
  ];
  if (pool.length === 0) return "I couldn't find anything to recommend right now - try again in a bit!";
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return `Orby recommends: **${pick}**.`;
}
