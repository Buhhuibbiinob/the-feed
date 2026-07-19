"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  const location = String(formData.get("location") ?? "").trim() || null;

  const eventTimeRaw = String(formData.get("event_time") ?? "");
  const eventTime = eventTimeRaw ? new Date(eventTimeRaw) : null;
  if (!eventTime || Number.isNaN(eventTime.getTime())) {
    return { error: "Pick a valid date and time." };
  }

  const { data: membership } = await supabase
    .from("club_members")
    .select("user_id")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Join the club to create events." };

  const { error } = await supabase.from("club_events").insert({
    club_id: clubId,
    created_by: user.id,
    title,
    description,
    location,
    event_time: eventTime.toISOString(),
  });

  if (error) return { error: error.message };

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
