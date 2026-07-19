"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MAX_EVENT_FLYER_BYTES, megabytes, isImageFile, guessContentType } from "@/lib/uploads";

export type EventFormState = {
  error?: string;
  ok?: boolean;
};

export async function createEvent(
  _prevState: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const clubId = String(formData.get("club_id") ?? "");
  if (!clubId) return { error: "Missing club." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const description = String(formData.get("description") ?? "").trim() || null;

  const eventTimeRaw = String(formData.get("event_time") ?? "");
  const eventTime = eventTimeRaw ? new Date(eventTimeRaw) : null;
  if (!eventTime || Number.isNaN(eventTime.getTime())) {
    return { error: "Pick a valid date and time." };
  }

  const flyerFile = formData.get("flyer_file");
  const flyer = flyerFile instanceof File && flyerFile.size > 0 ? flyerFile : null;
  if (flyer) {
    if (!isImageFile(flyer)) return { error: "Flyer must be an image." };
    if (flyer.size > MAX_EVENT_FLYER_BYTES) {
      return { error: `Flyer must be under ${megabytes(MAX_EVENT_FLYER_BYTES)}MB.` };
    }
  }

  const { data: membership } = await supabase
    .from("club_members")
    .select("user_id")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Join the club to create events." };

  const { data: inserted, error } = await supabase
    .from("club_events")
    .insert({
      club_id: clubId,
      created_by: user.id,
      title,
      description,
      event_time: eventTime.toISOString(),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (flyer && inserted) {
    const ext = flyer.name.split(".").pop() || "jpg";
    const path = `${user.id}/event-flyers/${inserted.id}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, flyer, { upsert: true, contentType: guessContentType(flyer) });
    if (!uploadError) {
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase
        .from("club_events")
        .update({ flyer_url: publicUrl })
        .eq("id", inserted.id);
    }
  }

  revalidatePath(`/clubs/${clubId}`);
  return { ok: true };
}

export async function deleteEvent(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const eventId = String(formData.get("event_id") ?? "");
  const clubId = String(formData.get("club_id") ?? "");
  if (!eventId) return;

  await supabase.from("club_events").delete().eq("id", eventId).eq("created_by", user.id);
  if (clubId) revalidatePath(`/clubs/${clubId}`);
}

export async function setRsvp(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const eventId = String(formData.get("event_id") ?? "");
  const clubId = String(formData.get("club_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!eventId || (status !== "going" && status !== "maybe" && status !== "not_going")) return;

  await supabase
    .from("club_event_rsvps")
    .upsert(
      { event_id: eventId, user_id: user.id, status, responded_at: new Date().toISOString() },
      { onConflict: "event_id,user_id" }
    );

  if (clubId) revalidatePath(`/clubs/${clubId}`);
}

export async function clearRsvp(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const eventId = String(formData.get("event_id") ?? "");
  const clubId = String(formData.get("club_id") ?? "");
  if (!eventId) return;

  await supabase.from("club_event_rsvps").delete().eq("event_id", eventId).eq("user_id", user.id);
  if (clubId) revalidatePath(`/clubs/${clubId}`);
}
