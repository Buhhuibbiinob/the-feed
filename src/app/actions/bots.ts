"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { getSiteFlags } from "@/lib/siteFlags";
import { askGeminiText, askGeminiJson } from "@/lib/gemini";
import { currentPrompt } from "@/lib/weeklyPrompt";
import { getTrendingTracks, getTrackFromAnyEra, getDeepCut, getSceneTrack } from "@/lib/lastfm";
import { discoverMovies, discoverTv } from "@/lib/tmdb";
import { searchVideos } from "@/lib/youtube";
import {
  generatePersona,
  generateUsername,
  registerFor,
  registerById,
  BANNED_TICS,
  PREMADE_BOTS,
} from "@/lib/botVoices";

export type BotState = { error?: string; ok?: boolean; summary?: string };

export type BotProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  status_media_type: "music" | "movie_tv" | "photography" | null;
  last_seen_at: string | null;
  status_title: string | null;
  status_artist: string | null;
  bot_persona: string | null;
  bot_active: boolean;
};

const BOT_PROFILE_COLUMNS =
  "id, username, avatar_url, banner_url, bio, status_media_type, status_title, status_artist, bot_persona, bot_active, last_seen_at";

// Bots get @bots.invalid addresses: .invalid is RFC2606-reserved so it can
// never receive mail, which keeps them out of every newsletter and
// transactional send automatically (see isSendableEmail).
const BOT_EMAIL_DOMAIN = "bots.invalid";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, admin: false };
  return { supabase, user, admin: await isAdmin(supabase, user.id) };
}

export async function listBots(): Promise<BotProfile[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select(BOT_PROFILE_COLUMNS)
    .eq("is_bot", true)
    .order("username");
  return (data as BotProfile[] | null) ?? [];
}

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Creates one bot account. A bot needs an auth.users row because profiles.id
 * references it and the profile itself is made by the on_auth_user_created
 * trigger, so this is always two steps - and the auth user is rolled back if
 * the second one fails, rather than leaving an account nothing can manage.
 */
async function createOneBot(
  adminClient: AdminClient,
  username: string,
  persona: string
): Promise<{ error?: string }> {
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: `${username.toLowerCase()}@${BOT_EMAIL_DOMAIN}`,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { username },
  });
  if (createError || !created.user) {
    return { error: createError?.message ?? "Couldn't create the bot account." };
  }

  const { error: updateError } = await adminClient
    .from("profiles")
    .update({ is_bot: true, bot_persona: persona, bot_active: true })
    .eq("id", created.user.id);
  if (updateError) {
    await adminClient.auth.admin.deleteUser(created.user.id).catch(() => {});
    return { error: `Created the account but couldn't flag it as a bot: ${updateError.message}` };
  }
  return {};
}

export async function adminCreateBot(_prev: BotState, formData: FormData): Promise<BotState> {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) return { error: "Admins only." };

  const username = String(formData.get("username") ?? "").trim();
  const persona = String(formData.get("persona") ?? "").trim();
  if (!username) return { error: "Give the bot a username." };
  if (!/^[a-zA-Z0-9._]{3,20}$/.test(username)) {
    return { error: "Username must be 3-20 characters, letters/numbers/period/underscore only." };
  }
  if (!persona) return { error: "Give the bot a persona - it's what shapes everything it writes." };

  const adminClient = createAdminClient();

  const { data: taken } = await adminClient.from("profiles").select("id").ilike("username", username).maybeSingle();
  if (taken) return { error: "That username is already taken." };

  const { error } = await createOneBot(adminClient, username, persona);
  if (error) return { error };

  revalidatePath("/admin");
  return { ok: true, summary: `Created @${username}.` };
}

/**
 * Creates the fixed premade cast in one go. Skips any handle already taken
 * rather than failing the whole run, so this is safe to press twice and can
 * be used to top up after deleting a few.
 */
export async function adminCreatePremadeBots(_prev: BotState, _formData: FormData): Promise<BotState> {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) return { error: "Admins only." };

  const adminClient = createAdminClient();
  const { data: existing } = await adminClient.from("profiles").select("username");
  const taken = new Set((existing ?? []).map((r) => String(r.username).toLowerCase()));

  const created: string[] = [];
  const skipped: string[] = [];
  const failures: string[] = [];

  for (const bot of PREMADE_BOTS) {
    if (taken.has(bot.username.toLowerCase())) {
      skipped.push(bot.username);
      continue;
    }
    const { error } = await createOneBot(adminClient, bot.username, bot.persona);
    if (error) failures.push(`@${bot.username}: ${error}`);
    else {
      created.push(bot.username);
      taken.add(bot.username.toLowerCase());
    }
  }

  revalidatePath("/admin");
  revalidatePath("/");

  if (created.length === 0) {
    if (failures.length) return { error: `Couldn't create any. ${failures[0]}` };
    return { ok: true, summary: "All premade bots already exist." };
  }
  const parts = [`Created ${created.length}: ${created.map((u) => `@${u}`).join(", ")}.`];
  if (skipped.length) parts.push(`${skipped.length} already existed.`);
  if (failures.length) parts.push(`${failures.length} failed.`);
  return { ok: true, summary: parts.join(" ") };
}

const MAX_BULK_BOTS = 25;

/**
 * Creates several bots at once, each with its own generated handle, taste
 * and writing voice. Usernames are checked against every existing profile,
 * not just other bots, so a bulk run can't collide with a real member.
 */
export async function adminCreateBotsBulk(_prev: BotState, formData: FormData): Promise<BotState> {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) return { error: "Admins only." };

  const count = Number(formData.get("count") ?? 0);
  if (!Number.isInteger(count) || count < 1 || count > MAX_BULK_BOTS) {
    return { error: `Pick a number between 1 and ${MAX_BULK_BOTS}.` };
  }

  const adminClient = createAdminClient();
  const { data: existing } = await adminClient.from("profiles").select("username");
  const taken = new Set((existing ?? []).map((r) => String(r.username).toLowerCase()));

  const created: string[] = [];
  const failures: string[] = [];

  for (let i = 0; i < count; i++) {
    const username = generateUsername(taken);
    if (!username) {
      failures.push("ran out of unused usernames");
      break;
    }
    // Reserve it locally straight away so the next iteration can't pick it
    // again even though the database doesn't know about it yet.
    taken.add(username.toLowerCase());

    const { error } = await createOneBot(adminClient, username, generatePersona());
    if (error) failures.push(`@${username}: ${error}`);
    else created.push(username);
  }

  revalidatePath("/admin");

  if (created.length === 0) {
    return { error: `Couldn't create any bots. ${failures[0] ?? ""}`.trim() };
  }
  const summary = `Created ${created.length} bot${created.length === 1 ? "" : "s"}: ${created
    .map((u) => `@${u}`)
    .join(", ")}.`;
  return {
    ok: true,
    summary: failures.length ? `${summary} ${failures.length} failed.` : summary,
  };
}

/**
 * Renames one bot. Checked against every profile rather than just other
 * bots, so a rename can't collide with a real member's handle, and the
 * comparison is case-insensitive because usernames are displayed as typed
 * but shouldn't be claimable twice in different cases.
 */
export async function adminRenameBot(_prev: BotState, formData: FormData): Promise<BotState> {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) return { error: "Admins only." };

  const id = String(formData.get("bot_id") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  if (!id) return { error: "Missing bot." };
  if (!/^[a-zA-Z0-9._]{3,20}$/.test(username)) {
    return { error: "Username must be 3-20 characters, letters/numbers/period/underscore only." };
  }

  const adminClient = createAdminClient();
  const { data: taken } = await adminClient
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (taken && taken.id !== id) return { error: "That username is already taken." };

  const { error } = await adminClient
    .from("profiles")
    .update({ username })
    .eq("id", id)
    .eq("is_bot", true);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true, summary: `Renamed to @${username}.` };
}

/** Avatar, banner, bio and "currently listening" for one bot - the same
 * things a real member can set on their own profile. */
export async function adminUpdateBotProfile(formData: FormData) {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) return;

  const id = String(formData.get("bot_id") ?? "");
  if (!id) return;

  const text = (key: string) => {
    const value = String(formData.get(key) ?? "").trim();
    return value || null;
  };
  const statusMediaType = text("status_media_type");
  const statusTitle = text("status_title");

  await createAdminClient()
    .from("profiles")
    .update({
      avatar_url: text("avatar_url"),
      banner_url: text("banner_url"),
      bio: text("bio"),
      // A status needs both a kind and a title to render, so clear the whole
      // thing unless both arrived.
      status_media_type: statusTitle ? statusMediaType : null,
      status_title: statusTitle,
      status_artist: statusTitle ? text("status_artist") : null,
      status_updated_at: statusTitle ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("is_bot", true);

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function adminUpdateBot(formData: FormData) {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) return;

  const id = String(formData.get("bot_id") ?? "");
  const persona = String(formData.get("persona") ?? "").trim();
  const active = formData.get("active") === "true";
  if (!id) return;

  await createAdminClient()
    .from("profiles")
    .update({ bot_persona: persona || null, bot_active: active })
    .eq("id", id)
    .eq("is_bot", true);

  revalidatePath("/admin");
}

export async function adminDeleteBot(formData: FormData) {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) return;

  const id = String(formData.get("bot_id") ?? "");
  if (!id) return;

  const adminClient = createAdminClient();
  // Guard: only ever delete rows actually flagged as bots, so a stray id
  // can't take out a real member's account.
  const { data: target } = await adminClient
    .from("profiles")
    .select("id")
    .eq("id", id)
    .eq("is_bot", true)
    .maybeSingle();
  if (!target) return;

  // Deleting the auth user cascades to the profile, and posts/chat cascade
  // from there.
  await adminClient.auth.admin.deleteUser(id);
  revalidatePath("/admin");
}

// The voice line in each persona is doing the heavy lifting here. These
// prompts mostly exist to stop the model's defaults - even length, tidy
// punctuation, a summarising last sentence - from sanding that voice off.
// The failure mode here is not bad writing, it's TIDY writing. Left alone a
// model produces balanced sentences, correct apostrophes, one observation per
// clause and a closing verdict - which is exactly what nobody types into a
// phone. These rules attack that shape directly.

/** Strips punctuation nobody types on a phone. The prompt forbids all of
 *  this, but these posts go straight to the public feed, so a slip can't be
 *  left to chance. Em/en dashes and semicolons become sentence breaks;
 *  hyphens survive only inside words like "lo-fi". */
// Removes the tics the prompt bans. Asking a model not to say a word gets
// you fewer of them, not none, and these were common enough to be the
// thing that made every account sound the same.
function stripBannedTics(text: string): string {
  let out = text;
  for (const tic of BANNED_TICS) {
    // Whole word only, so "properly" and "fright" survive.
    out = out.replace(new RegExp(`\\b${tic}\\b`, "gi"), "");
  }
  return out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

function stripBotPunctuation(text: string): string {
  return text
    .replace(/\s*[\u2014\u2013]\s*/g, ". ")
    .replace(/\s+-\s+/g, ". ")
    .replace(/\s*;\s*/g, ". ")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\.\s*\./g, ".")
    .trim();
}

// Universal rules only. Anything describing HOW someone types now lives in
// a per-bot register (see REGISTERS in botVoices), because holding it here
// meant every account typed identically no matter what its persona said.
// The only emoji a bot may use: the site's own drawn ones. Anything else
// renders as whatever the reader's phone draws, which is exactly the
// mismatch the drawn set exists to remove - and a bot is the last account
// that should be the one breaking it.
//
// A short, plain subset on purpose. The full set includes a mind-blown
// face and seven coloured hearts, and a bot reaching for those is the
// tell, not the ban.
const BOT_EMOJI = ["\u{1F602}", "\u{1F622}", "\u{1F60D}", "\u{2764}", "\u{1F3A7}", "\u{1F62E}"];
const BOT_EMOJI_ALLOWED = BOT_EMOJI.join(" ");

/**
 * Strips every emoji that is not on the list above.
 *
 * The prompt asks; this enforces. A model told "only these six" will
 * still occasionally produce a seventh, and one sparkle emoji in a bot's
 * post is the thing a member notices.
 */
function stripForeignEmoji(text: string): string {
  const allowed = new Set(BOT_EMOJI);
  return text.replace(/\p{Extended_Pictographic}\uFE0F?/gu, (match) =>
    allowed.has(match.replace(/\uFE0F/g, "")) ? match : ""
  ).replace(/[ \t]{2,}/g, " ").trim();
}

const MATCHUP_PROMPT = `You are a member of Feedback starting a two-option matchup for people to vote on. Pick two REAL things of the same kind that people genuinely argue about - two albums, two films, two shows. They must be real and well known enough that others have an opinion. Never pick a thing against itself.

The question is short and casual, the way you would ask a friend. Not "which is superior".

Reply with ONLY JSON: {"question": "short question", "a": "first thing", "a_sub": "artist or director", "b": "second thing", "b_sub": "artist or director"}`;

const WEEKLY_PROMPT = `You are a member of Feedback answering this week's question. Pick ONE real thing you would actually name, and add one short line about why - or no line at all, which is also fine. Never explain at length.

Reply with ONLY JSON: {"title": "the pick", "subtitle": "artist or director, or empty", "note": "one short line, or empty"}`;

const HUMAN_RULES = `Universal rules:
- Never use a dash of any kind. No em dashes, no en dashes, no hyphens joining clauses. Start a new sentence instead.
- Never use a semicolon. Nobody types one into a phone.
- No hashtags.
- Emojis: almost never. Most posts should have none at all. If one genuinely fits, use exactly one, and only from this list: ${BOT_EMOJI_ALLOWED}. Never two. Never at the start.
- Never use the words "proper" or "fr". They are overused here and they stand out.
- Vary your opener. Do not begin the way a post like this usually begins.

What NOT to do, because it reads as machine-written instantly:
- Do not analyse production, mix, vocals, drums, cinematography, pacing or performances. Nobody posting casually says "the low end is warm" or "the third act drags".
- Do not name the title and artist back like a header.
- Do not end on a verdict or a summary line. Just stop.
- Do not be even-handed. Have one reaction and only that one.
- Do not explain why you feel it. The feeling is the whole post.`;

/** Removes every bot account and everything they posted, in one go.
 *  Only ever targets rows flagged is_bot, so real members are untouchable
 *  by this even if the flag were somehow wrong about who is a bot. */
export async function adminDeleteAllBots(_prev: BotState, _formData: FormData): Promise<BotState> {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) return { error: "Admins only." };

  const adminClient = createAdminClient();
  const { data: targets } = await adminClient.from("profiles").select("id").eq("is_bot", true);

  const ids = (targets ?? []).map((r) => String(r.id));
  if (ids.length === 0) return { error: "There are no bots to remove." };

  let removed = 0;
  for (const id of ids) {
    // Deleting the auth user cascades to the profile, and posts, chat and
    // likes cascade from there.
    const { error } = await adminClient.auth.admin.deleteUser(id);
    if (error) console.error(`[bots] delete failed for ${id}: ${error.message}`);
    else removed++;
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/chat");
  revalidatePath("/leaderboard");

  const failed = ids.length - removed;
  return {
    ok: true,
    summary: `Removed ${removed} bot${removed === 1 ? "" : "s"} and everything they posted.${
      failed ? ` ${failed} could not be removed.` : ""
    }`,
  };
}

/**
 * How long this particular post is.
 *
 * Every bot review was "1-3 lines", and a feed where every post is the
 * same length is a tell on its own - it does not matter how good any
 * single one is. Real people write two words on a Tuesday and five
 * paragraphs when something got to them.
 *
 * Long is the rarest, not the default. A long post that is still hollow
 * is more obviously generated than a short one, because there is more
 * surface for the seams to show - which is why the long mode is told to
 * ramble and contradict itself rather than to say more about the thing.
 */
const LENGTHS = [
  { weight: 3, rules: `ONE line. A fragment is fine. Under twelve words.` },
  { weight: 4, rules: `Two or three short lines. Stop before you have said everything.` },
  { weight: 2, rules: `A proper paragraph, four to six lines.` },
  {
    weight: 1,
    rules: `Long - three short paragraphs. You got carried away. Go off on ONE tangent that is
only half about the thing itself: where you were, who put you onto it, something it reminded
you of. Contradict yourself once and do not tidy it up. Do NOT use the extra room to describe
the work in more detail - that is the thing that reads as written by a machine.`,
  },
];

function pickLength(): string {
  const total = LENGTHS.reduce((n, l) => n + l.weight, 0);
  let roll = Math.random() * total;
  for (const l of LENGTHS) {
    roll -= l.weight;
    if (roll <= 0) return l.rules;
  }
  return LENGTHS[0].rules;
}

const REVIEW_PROMPT = `You are a member of Feedback posting about something you just heard or watched. This is a text to a friend, not a review. React to the vibe and how it hit you, nothing technical. Do not invent facts about it. ${HUMAN_RULES}

Reply with ONLY the post text, no title, no quotes.`;

// CHAT_PROMPT deleted along with the chat step. Leaving an unused prompt
// around is how the behaviour comes back six months later because someone
// finds it and wires it up again.

type ReviewSubject = {
  mediaType: "music" | "movie_tv";
  kind: "song" | "film" | "show";
  title: string;
  artist: string | null;
  overview: string;
  imageUrl: string | null;
  videoQuery: string;
};

const randomOf = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/**
 * Something real to review. Half the time a charting track, otherwise a film
 * or show that's actually out. Every field comes from the source API rather
 * than the model, so a bot can't review a release that doesn't exist - and
 * each carries the search that finds its video, since a music review wants
 * the official video and a film wants the trailer.
 *
 * Falls back to music if TMDB is unreachable or unconfigured, so losing the
 * movie source degrades to how this worked before rather than posting
 * nothing.
 */
/**
 * Artists the community has actually reviewed, newest first. Discovery
 * starts from real taste on the site rather than a list I picked, so the
 * pool drifts toward whatever this place is into.
 */
async function communitySeedArtists(adminClient: AdminClient): Promise<string[]> {
  const { data } = await adminClient
    .from("posts")
    .select("artist")
    .eq("media_type", "music")
    .not("artist", "is", null)
    .order("created_at", { ascending: false })
    .limit(120);

  const seen = new Set<string>();
  for (const row of data ?? []) {
    const name = String(row.artist ?? "").trim();
    if (name) seen.add(name);
  }
  return [...seen];
}

/**
 * What a bot reviews, weighted toward finds rather than charts.
 *
 * Most of the time a deep cut - one step out from an artist this community
 * already posts, past that artist's most-played few, and with anything over
 * the listener ceiling dropped. Then scene tags. Only the last sliver comes
 * from the decades or the live chart, so the feed isn't wall-to-wall
 * obscurities but isn't led by them either.
 */
async function pickTrack(adminClient: AdminClient) {
  const roll = Math.random();

  if (roll < 0.6) {
    const seeds = await communitySeedArtists(adminClient).catch(() => []);
    const cut = await getDeepCut(seeds).catch(() => null);
    if (cut) return cut;
  }
  if (roll < 0.85) {
    const scene = await getSceneTrack().catch(() => null);
    if (scene) return scene;
  }
  const era = await getTrackFromAnyEra().catch(() => null);
  if (era) return era;

  const chart = await getTrendingTracks(30).catch(() => []);
  return chart.length ? chart[Math.floor(Math.random() * chart.length)] : null;
}

async function pickReviewSubject(adminClient: AdminClient): Promise<ReviewSubject | null> {
  const wantsScreen = Math.random() < 0.5;

  if (wantsScreen) {
    const isTv = Math.random() < 0.5;
    const results = await (isTv ? discoverTv(undefined, 20) : discoverMovies(undefined, 20)).catch(
      () => []
    );
    if (results.length > 0) {
      const pick = randomOf(results);
      return {
        mediaType: "movie_tv",
        kind: isTv ? "show" : "film",
        title: pick.title,
        artist: null,
        overview: pick.overview,
        imageUrl: pick.imageUrl,
        videoQuery: `${pick.title} official trailer`,
      };
    }
  }

  const track = await pickTrack(adminClient);
  if (!track) return null;
  return {
    mediaType: "music",
    kind: "song",
    title: track.name,
    artist: track.artist,
    overview: "",
    imageUrl: track.imageUrl ?? null,
    videoQuery: `${track.name} ${track.artist} official video`,
  };
}

/**
 * Runs one round of bot activity: a review, a chat message, and a like.
 *
 * Split out from the admin action so a scheduler can run the same round
 * without holding an admin session - see /api/bots/run. The flag check
 * lives in here rather than at each caller so switching bots off in the
 * admin screen switches off every path at once.
 */
export async function runBotRound(requestedId = ""): Promise<BotState> {
  const supabase = await createClient();

  const flags = await getSiteFlags(supabase);
  if (!flags.bots_enabled) {
    return { error: "Bots are switched off. Turn them on in Homepage Sections first." };
  }

  const bots = (await listBots()).filter((b) => b.bot_active);
  if (bots.length === 0) return { error: "No active bots yet - create one below." };

  // A specific bot when one was asked for, otherwise any active bot.
  const requested = requestedId ? bots.find((b) => b.id === requestedId) : null;
  if (requestedId && !requested) {
    return { error: "That bot is paused or no longer exists." };
  }

  const adminClient = createAdminClient();
  const bot = requested ?? bots[Math.floor(Math.random() * bots.length)];
  const persona = bot.bot_persona ?? "a friendly fan of music, film and TV";
  // A premade bot's register is chosen deliberately; anything else falls
  // back to a stable one derived from the name.
  const voice =
    registerById(PREMADE_BOTS.find((b) => b.username === bot.username)?.register ?? "") ??
    registerFor(bot.username);
  const done: string[] = [];
  const skipped: string[] = [];

  // 1. Review something real - a charting track, or a film/show that's
  //    actually out - so bots can never invent a release. Which of the two
  //    is a coin flip, so the feed doesn't fill up with only music.
  const subject = await pickReviewSubject(adminClient);
  if (!subject) {
    skipped.push("couldn't find anything to review - Last.fm may be unreachable");
  } else {
    const { data: already } = await adminClient
      .from("posts")
      .select("id")
      .eq("user_id", bot.id)
      .eq("title", subject.title)
      .maybeSingle();

    if (already) {
      skipped.push(`@${bot.username} has already reviewed "${subject.title}"`);
    } else {
      const written = await askGeminiText(
        `${REVIEW_PROMPT}\n\nYour voice: ${persona}\n\nHow you type: ${voice.rules}\n\nLength for THIS post: ${pickLength()}`,
        subject.mediaType === "music"
          ? `Write your review of the song "${subject.title}" by ${subject.artist}.`
          : `Write your review of the ${subject.kind} "${subject.title}". What it is, so you don't ` +
            `contradict it: ${subject.overview || "no synopsis available, so keep it to how it made you feel"}`
      );
      const body = written.ok ? written.text : null;
      if (!written.ok) skipped.push(`couldn't write the review: ${written.error}`);
      if (body) {
        // Attach the video the way a member would paste a link, so the review
        // has something to play and Feed TV has a lineup - its clips come
        // from posts carrying a youtube_video_id.
        const [video] = await searchVideos(subject.videoQuery, 1);

        // Decade tag charts rarely carry art, so fall back to the video's
        // thumbnail rather than posting a review with an empty cover.
        const cover =
          subject.imageUrl ??
          (video ? `https://img.youtube.com/vi/${video.id}/hqdefault.jpg` : null);

        const { error } = await adminClient.from("posts").insert({
          user_id: bot.id,
          media_type: subject.mediaType,
          title: subject.title,
          artist: subject.artist,
          body: stripForeignEmoji(stripBannedTics(stripBotPunctuation(body))),
          rating: 3 + Math.floor(Math.random() * 3), // 3-5, never a fake pan
          cover_url: cover,
          youtube_video_id: video?.id ?? null,
        });
        if (error) console.error(`[bots] review insert failed: ${error.message}`);
        else done.push(`reviewed "${subject.title}"`);
      }
    }
  }

  // 2. Chat: deliberately nothing.
  //
  //    Bots no longer post in the live chat at all. A feed post is a thing
  //    you scroll past; a chat message is addressed to whoever is in the
  //    room, and answering one gets you nothing back. That is the moment
  //    somebody works out which accounts are not people, and it poisons
  //    every other thing a bot does. The room is for members.

  // 3. Like a recent post from a real member (never another bot's, which
  //    would just be bots inflating each other).
  const { data: candidates } = await adminClient
    .from("posts")
    .select("id, user_id, profiles!posts_user_id_fkey(is_bot)")
    .order("created_at", { ascending: false })
    .limit(30);

  // Supabase types an embedded relation as an array, so normalise before
  // reading is_bot.
  type LikeCandidate = {
    id: string;
    user_id: string;
    profiles: { is_bot: boolean } | { is_bot: boolean }[] | null;
  };
  const isBotAuthor = (p: LikeCandidate) =>
    Array.isArray(p.profiles) ? p.profiles[0]?.is_bot : p.profiles?.is_bot;

  const likeable = ((candidates ?? []) as unknown as LikeCandidate[]).filter(
    (p) => p.profiles && !isBotAuthor(p) && p.user_id !== bot.id
  );

  if (likeable.length > 0) {
    const target = likeable[Math.floor(Math.random() * likeable.length)];
    const { error } = await adminClient
      .from("likes")
      .upsert({ post_id: target.id, user_id: bot.id }, { onConflict: "post_id,user_id" });
    if (!error) done.push("liked a post");

    // 4. And sometimes a reaction rather than a like. A reaction says
    //    which yes it was, and a member seeing one on their review gets
    //    something a like does not give them. Only sometimes, because a
    //    bot that reacts to everything is a bot.
    if (Math.random() < 0.45) {
      const other = likeable[Math.floor(Math.random() * likeable.length)];
      const emoji = BOT_EMOJI[Math.floor(Math.random() * BOT_EMOJI.length)];
      const { error: reactionError } = await adminClient
        .from("post_reactions")
        .upsert(
          { post_id: other.id, user_id: bot.id, emoji },
          { onConflict: "post_id,user_id" }
        );
      if (!reactionError) done.push("reacted to a post");
    }
  }

  // 5. Answer this week's question, if this bot has not already. One
  //    answer each per week is the same rule members get, and the page is
  //    the emptiest thing on the site when nobody has answered yet.
  if (Math.random() < 0.4) {
    const { prompt, week } = currentPrompt();
    const { data: existing } = await adminClient
      .from("weekly_answers")
      .select("user_id")
      .eq("user_id", bot.id)
      .eq("week_start", week)
      .maybeSingle();

    if (!existing) {
      const answer = await askGeminiJson<{ title?: string; subtitle?: string; note?: string }>(
        `${WEEKLY_PROMPT}\n\nYour voice: ${persona}\n\nHow you type: ${voice.rules}`,
        `The question is: "${prompt.question}". Answer it with one real ${prompt.placeholder.toLowerCase()}.`
      );
      if (answer.ok && answer.data && answer.data.title) {
        const fields = answer.data;
        const { error } = await adminClient.from("weekly_answers").insert({
          user_id: bot.id,
          week_start: week,
          prompt_id: prompt.id,
          title: String(fields.title).slice(0, 160),
          subtitle: fields.subtitle ? String(fields.subtitle).slice(0, 160) : null,
          note: fields.note
            ? stripForeignEmoji(stripBannedTics(stripBotPunctuation(String(fields.note)))).slice(0, 280)
            : null,
        });
        if (!error) done.push("answered this week's question");
      } else if (!answer.ok) {
        skipped.push(`couldn't answer the weekly question: ${answer.error}`);
      }
    }
  }

  // 6. Start a matchup, rarely. Two options and a question is the
  //    cheapest thing on the site for a member to join in with, and an
  //    empty /polls is the deadest page there is - but a page of bot
  //    matchups is worse than an empty one, so this is the lowest odds
  //    of anything in this round.
  if (Math.random() < 0.18) {
    const made = await askGeminiJson<{
      question?: string;
      a?: string;
      a_sub?: string;
      b?: string;
      b_sub?: string;
    }>(
      `${MATCHUP_PROMPT}\n\nYour voice: ${persona}`,
      "Start one matchup about something you actually care about."
    );
    if (!made.ok) {
      skipped.push(`couldn't write a matchup: ${made.error}`);
    } else {
    const fields = made.data ?? {};
    const a = String(fields.a ?? "").trim();
    const b = String(fields.b ?? "").trim();
    // Same rule the human form enforces: two of the same thing is not a
    // choice. A model asked for two options will occasionally give one.
    if (a && b && a.toLowerCase() !== b.toLowerCase()) {
      const { error } = await adminClient.from("polls").insert({
        created_by: bot.id,
        media_type: subject?.mediaType ?? "music",
        question: fields.question
          ? stripForeignEmoji(stripBotPunctuation(String(fields.question))).slice(0, 120)
          : null,
        option_a: a.slice(0, 90),
        option_b: b.slice(0, 90),
        subtitle_a: fields.a_sub ? String(fields.a_sub).slice(0, 90) : null,
        subtitle_b: fields.b_sub ? String(fields.b_sub).slice(0, 90) : null,
      });
      if (!error) done.push("started a matchup");
    }
    }
  }

  // 7. Vote on somebody else's matchup. Voting costs nothing and is the
  //    thing that makes a poll worth opening, so this is far likelier
  //    than starting one.
  if (Math.random() < 0.6) {
    const { data: openPolls } = await adminClient
      .from("polls")
      .select("id, created_by")
      .neq("created_by", bot.id)
      .order("created_at", { ascending: false })
      .limit(20);
    const choices = openPolls ?? [];
    if (choices.length > 0) {
      const poll = choices[Math.floor(Math.random() * choices.length)];
      const { error } = await adminClient.from("poll_votes").upsert(
        {
          poll_id: poll.id,
          user_id: bot.id,
          choice: Math.random() < 0.5 ? "a" : "b",
        },
        { onConflict: "poll_id,user_id" }
      );
      if (!error) done.push("voted on a matchup");
    }
  }

  revalidatePath("/");
  revalidatePath("/weekly");
  revalidatePath("/polls");
  revalidatePath("/leaderboard");

  if (done.length === 0) {
    return {
      error: skipped.length
        ? `@${bot.username} did nothing this round. ${skipped.join(". ")}.`
        : `@${bot.username} couldn't do anything this round.`,
    };
  }
  // Report what was skipped even on a partial success, so "it only liked
  // something" comes with the reason attached instead of looking broken.
  return {
    ok: true,
    summary: skipped.length
      ? `@${bot.username} ${done.join(", ")}. Skipped: ${skipped.join(". ")}.`
      : `@${bot.username} ${done.join(", ")}.`,
  };
}

/**
 * The admin screen's button. Nothing but an auth gate in front of
 * runBotRound - the work itself is identical however it's triggered.
 */
export async function adminRunBotActivity(_prev: BotState, _formData: FormData): Promise<BotState> {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) return { error: "Admins only." };

  return runBotRound(String(_formData?.get("bot_id") ?? ""));
}
