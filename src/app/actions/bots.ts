"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { getSiteFlags } from "@/lib/siteFlags";
import { askGemini } from "@/lib/gemini";
import { getTrendingTracks } from "@/lib/lastfm";

export type BotState = { error?: string; ok?: boolean; summary?: string };

export type BotProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  bot_persona: string | null;
  bot_active: boolean;
};

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
    .select("id, username, avatar_url, bot_persona, bot_active")
    .eq("is_bot", true)
    .order("username");
  return (data as BotProfile[] | null) ?? [];
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

  // A bot still needs an auth.users row, because profiles.id references it
  // and the profile is created by the on_auth_user_created trigger.
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

  revalidatePath("/admin");
  return { ok: true, summary: `Created @${username}.` };
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

const REVIEW_PROMPT = `You are a member of Feedback, a music/movie/TV review community. Write a short review in the voice described. 2-4 sentences, casual and specific, like a real person posting. Do not use em dashes. Do not use emojis. Do not invent facts about the track beyond how it sounds and how you feel about it. Reply with ONLY the review text, no title, no quotes.`;

const CHAT_PROMPT = `You are a member of Feedback, a music/movie/TV review community, writing one short live-chat message in the voice described. One sentence, casual, like a real chat message. Do not use em dashes or emojis. Reply with ONLY the message.`;

/**
 * Runs one round of bot activity: a review, a chat message, and a like.
 * Admin-triggered rather than scheduled, so activity only appears when
 * someone asks for it.
 */
export async function adminRunBotActivity(_prev: BotState, _formData: FormData): Promise<BotState> {
  const { supabase, user, admin } = await requireAdmin();
  if (!user || !admin) return { error: "Admins only." };

  const flags = await getSiteFlags(supabase);
  if (!flags.bots_enabled) {
    return { error: "Bots are switched off. Turn them on in Homepage Sections first." };
  }

  const bots = (await listBots()).filter((b) => b.bot_active);
  if (bots.length === 0) return { error: "No active bots yet - create one below." };

  const adminClient = createAdminClient();
  const bot = bots[Math.floor(Math.random() * bots.length)];
  const persona = bot.bot_persona ?? "a friendly music fan";
  const done: string[] = [];

  // 1. Review a real trending track, so bots never invent releases.
  const tracks = await getTrendingTracks(30).catch(() => []);
  if (tracks.length > 0) {
    const track = tracks[Math.floor(Math.random() * tracks.length)];
    const { data: already } = await adminClient
      .from("posts")
      .select("id")
      .eq("user_id", bot.id)
      .eq("title", track.name)
      .maybeSingle();

    if (!already) {
      const body = await askGemini(
        `${REVIEW_PROMPT}\n\nYour voice: ${persona}`,
        `Write your review of the song "${track.name}" by ${track.artist}.`
      );
      if (body) {
        const { error } = await adminClient.from("posts").insert({
          user_id: bot.id,
          media_type: "music",
          title: track.name,
          artist: track.artist,
          body: body.trim(),
          rating: 3 + Math.floor(Math.random() * 3), // 3-5, never a fake pan
          cover_url: track.imageUrl ?? null,
        });
        if (error) console.error(`[bots] review insert failed: ${error.message}`);
        else done.push(`reviewed "${track.name}"`);
      }
    }
  }

  // 2. One live-chat message.
  const chat = await askGemini(
    `${CHAT_PROMPT}\n\nYour voice: ${persona}`,
    "Say something about what you're listening to or watching lately."
  );
  if (chat) {
    const { error } = await adminClient
      .from("chat_messages")
      .insert({ user_id: bot.id, body: chat.trim() });
    if (error) console.error(`[bots] chat insert failed: ${error.message}`);
    else done.push("posted in chat");
  }

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
  }

  revalidatePath("/");
  revalidatePath("/chat");
  revalidatePath("/leaderboard");

  if (done.length === 0) {
    return { error: `@${bot.username} couldn't do anything this round - Gemini may be rate limited.` };
  }
  return { ok: true, summary: `@${bot.username} ${done.join(", ")}.` };
}
