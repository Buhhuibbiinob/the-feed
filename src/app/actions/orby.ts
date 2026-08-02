"use server";

import { createClient } from "@/lib/supabase/server";
import { askGemini } from "@/lib/gemini";
import { getTrendingTracks } from "@/lib/lastfm";

const SYSTEM_PROMPT_BASE = `You are Orby, a friendly recommendation assistant on Feedback, a music/movie/TV review community site. You ONLY discuss and recommend music, movies, TV shows, underground/indie artists, and short films - nothing else. If asked about anything off-topic, politely redirect back to recommendations in one short sentence and don't answer the off-topic part.

Keep replies conversational but brief (2-4 sentences max, like a chat message, not an essay). For music, prefer picking from the REAL trending tracks and underground artists listed below when they fit what the user asked for - don't invent fake artist names or song titles for those. For movies, TV shows, and short films, there's no live candidate list provided - use your own knowledge to recommend real, well-known titles that fit the request. Never fabricate plot details, release dates, or facts you're not confident about - if you're not sure of a detail, don't state it.`;

// Genie-in-a-bottle rules: 3 wishes (messages) per user, per day.
const DAILY_LIMIT = 3;

export async function askOrby(message: string): Promise<string> {
  const trimmed = message.trim();
  if (!trimmed) return "Ask me for a recommendation - music, a movie, a show, or an underground artist!";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Sign in to chat with Orby!";

  const today = new Date().toISOString().slice(0, 10);
  const { data: profile } = await supabase
    .from("profiles")
    .select("orby_use_count, orby_use_date")
    .eq("id", user.id)
    .single();

  const usedToday = profile?.orby_use_date === today ? (profile.orby_use_count ?? 0) : 0;
  if (usedToday >= DAILY_LIMIT) {
    return `You've used all ${DAILY_LIMIT} of your wishes for today - come back tomorrow for ${DAILY_LIMIT} more!`;
  }

  await supabase
    .from("profiles")
    .update({ orby_use_count: usedToday + 1, orby_use_date: today })
    .eq("id", user.id);

  const [tracks, undergroundRes] = await Promise.all([
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
    tracks.length ? `Trending Music:\n${tracks.map((t) => `- "${t.name}" by ${t.artist}`).join("\n")}` : "",
    underground.length
      ? `Underground creators posted directly on Feedback (real indie artists/filmmakers - prioritize these when the user asks for "underground," "indie," or "unsigned" recs):\n${underground
          .map((u) => `- ${u.artist_name} (${u.platform === "youtube" ? "short film/video" : "music"})${u.description ? `: ${u.description.slice(0, 100)}` : ""}`)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const systemPrompt = candidateText ? `${SYSTEM_PROMPT_BASE}\n\n${candidateText}` : SYSTEM_PROMPT_BASE;
  const reply = await askGemini(systemPrompt, trimmed);
  if (reply) return reply;

  // Fallback for when GEMINI_API_KEY isn't configured yet, or the call
  // fails. Without Gemini there's no real movie/TV data source anymore
  // (TMDB was removed), so screen requests fall back to underground
  // filmmaker posts only rather than guessing at something irrelevant.
  const lower = trimmed.toLowerCase();
  const wantsMusic = /\b(song|track|album|music|artist|band)\b/.test(lower);
  const wantsScreen = /\b(movie|film|tv|show|series|episode|watch)\b/.test(lower);

  const screenPool = underground.filter((u) => u.platform === "youtube").map((u) => `${u.artist_name} (underground filmmaker on Feedback)`);
  const musicPool = [
    ...tracks.map((t) => `"${t.name}" by ${t.artist}`),
    ...underground.filter((u) => u.platform !== "youtube").map((u) => `${u.artist_name} (underground artist on Feedback)`),
  ];

  const pool = wantsScreen && !wantsMusic ? screenPool : wantsMusic && !wantsScreen ? musicPool : [...screenPool, ...musicPool];
  if (pool.length === 0) {
    return "I couldn't find anything to recommend right now - try again in a bit!";
  }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return `Orby recommends: **${pick}**.`;
}
