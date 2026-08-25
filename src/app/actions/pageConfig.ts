"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadPageConfig, savePageConfig } from "@/lib/pageConfigStore";
import { applyPreset, resolvePageConfig, type SurfaceKind } from "@/lib/pageConfig";
import { normalizeColor } from "@/lib/pageTheme";
import { logEvent } from "@/lib/events";
import { checkBioSafety } from "@/lib/contentSafety";

export type PageConfigState = { error?: string; ok?: boolean };

/**
 * Resolves who the caller is editing, and refuses if it isn't theirs.
 *
 * RLS is the real boundary, but failing here means a wrong owner comes
 * back as a readable message rather than a policy violation the UI has to
 * translate.
 */
async function requireOwnership(surface: SurfaceKind, ownerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." as const };

  if (surface === "profile") {
    if (ownerId !== user.id) return { error: "That isn't your page." as const };
    return { supabase, user };
  }

  const { data: club } = await supabase
    .from("clubs")
    .select("created_by")
    .eq("id", ownerId)
    .maybeSingle();
  if (!club || club.created_by !== user.id) return { error: "That isn't your club." as const };
  return { supabase, user };
}

async function revalidateSurface(
  supabase: Awaited<ReturnType<typeof createClient>>,
  surface: SurfaceKind,
  ownerId: string
) {
  if (surface === "club") {
    revalidatePath(`/clubs/${ownerId}`);
    return;
  }
  const { data } = await supabase.from("profiles").select("username").eq("id", ownerId).maybeSingle();
  if (data?.username) revalidatePath(`/profile/${data.username}`);
}

function readSurface(formData: FormData): { surface: SurfaceKind; ownerId: string } | null {
  const surface = String(formData.get("surface") ?? "");
  const ownerId = String(formData.get("owner_id") ?? "");
  if ((surface !== "profile" && surface !== "club") || !ownerId) return null;
  return { surface, ownerId };
}

/**
 * Saves the whole look and arrangement in one write.
 *
 * The editor posts the entire config as JSON rather than a field per
 * control: a page's appearance is one thing to a member, and applying half
 * of it because two form posts raced is worse than applying none.
 */
export async function savePageAppearance(
  _prev: PageConfigState,
  formData: FormData
): Promise<PageConfigState> {
  const target = readSurface(formData);
  if (!target) return { error: "Unknown page." };

  const owned = await requireOwnership(target.surface, target.ownerId);
  if ("error" in owned) return { error: owned.error };
  const { supabase, user } = owned;

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get("config") ?? "{}"));
  } catch {
    return { error: "Couldn't read those settings." };
  }

  // Re-resolved server-side, so whatever the client posted is filtered
  // through the same validation a stored config gets.
  const config = resolvePageConfig(parsed, target.surface);

  const presetId = String(formData.get("preset") ?? "");
  const finalConfig = presetId ? applyPreset(config, presetId) : config;

  const { error } = await savePageConfig(supabase, target.surface, target.ownerId, finalConfig);
  if (error) return { error };

  await logEvent(supabase, user.id, "profile_edit", `page_${target.surface}_appearance`);
  await revalidateSurface(supabase, target.surface, target.ownerId);
  return { ok: true };
}

/** Saves the current look under a name so it can be switched back to. */
export async function saveThemePreset(
  _prev: PageConfigState,
  formData: FormData
): Promise<PageConfigState> {
  const target = readSurface(formData);
  if (!target) return { error: "Unknown page." };

  const owned = await requireOwnership(target.surface, target.ownerId);
  if ("error" in owned) return { error: owned.error };
  const { supabase, user } = owned;

  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  if (!name) return { error: "Give the preset a name." };

  const current = await loadPageConfig(supabase, target.surface, target.ownerId);
  const withoutSameName = current.presets.filter((p) => p.name.toLowerCase() !== name.toLowerCase());
  if (withoutSameName.length >= 8) {
    return { error: "That's eight saved presets. Delete one first." };
  }

  const next = {
    ...current,
    presets: [
      ...withoutSameName,
      {
        name,
        themeId: current.themeId,
        palette: current.palette,
        fontPairId: current.fontPairId,
        background: current.background,
      },
    ],
  };

  const { error } = await savePageConfig(supabase, target.surface, target.ownerId, next);
  if (error) return { error };

  await logEvent(supabase, user.id, "profile_edit", "theme_preset_save");
  await revalidateSurface(supabase, target.surface, target.ownerId);
  return { ok: true };
}

export async function applyThemePreset(formData: FormData) {
  const target = readSurface(formData);
  if (!target) return;

  const owned = await requireOwnership(target.surface, target.ownerId);
  if ("error" in owned) return;
  const { supabase } = owned;

  const name = String(formData.get("name") ?? "");
  const current = await loadPageConfig(supabase, target.surface, target.ownerId);
  const preset = current.presets.find((p) => p.name === name);
  if (!preset) return;

  // The arrangement is kept: switching looks shouldn't undo the ordering.
  await savePageConfig(supabase, target.surface, target.ownerId, {
    ...current,
    themeId: preset.themeId,
    palette: preset.palette,
    fontPairId: preset.fontPairId,
    background: preset.background,
  });
  await revalidateSurface(supabase, target.surface, target.ownerId);
}

export async function deleteThemePreset(formData: FormData) {
  const target = readSurface(formData);
  if (!target) return;

  const owned = await requireOwnership(target.surface, target.ownerId);
  if ("error" in owned) return;
  const { supabase } = owned;

  const name = String(formData.get("name") ?? "");
  const current = await loadPageConfig(supabase, target.surface, target.ownerId);
  await savePageConfig(supabase, target.surface, target.ownerId, {
    ...current,
    presets: current.presets.filter((p) => p.name !== name),
  });
  await revalidateSurface(supabase, target.surface, target.ownerId);
}

/** The mood ring: emoji, colour, a few words. */
export async function setMood(_prev: PageConfigState, formData: FormData): Promise<PageConfigState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // One grapheme, so the ring stays a ring rather than a sentence.
  const emoji = [...String(formData.get("emoji") ?? "").trim()].slice(0, 2).join("") || null;
  const text = String(formData.get("text") ?? "").trim().slice(0, 60) || null;

  if (text) {
    const safety = checkBioSafety(text);
    if (!safety.allowed) return { error: safety.reason };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      mood_emoji: emoji,
      mood_color: normalizeColor(formData.get("color")),
      mood_text: text,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  await logEvent(supabase, user.id, "profile_edit", "mood");
  const { data } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
  if (data?.username) revalidatePath(`/profile/${data.username}`);
  return { ok: true };
}

/** "What I'd like to review next", plus a free blurb slot. */
export async function setBlurbs(_prev: PageConfigState, formData: FormData): Promise<PageConfigState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const next = String(formData.get("blurb_next") ?? "").trim().slice(0, 300) || null;
  const free = String(formData.get("blurb_free") ?? "").trim().slice(0, 300) || null;

  for (const value of [next, free]) {
    if (!value) continue;
    const safety = checkBioSafety(value);
    if (!safety.allowed) return { error: safety.reason };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ blurb_next: next, blurb_free: free })
    .eq("id", user.id);
  if (error) return { error: error.message };

  await logEvent(supabase, user.id, "profile_edit", "blurbs");
  const { data } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
  if (data?.username) revalidatePath(`/profile/${data.username}`);
  return { ok: true };
}
