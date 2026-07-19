"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createCollection(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const description = String(formData.get("description") ?? "").trim() || null;

  await supabase.from("collections").insert({ user_id: user.id, name, description });
  revalidatePath("/collections");
}

export async function deleteCollection(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const collectionId = String(formData.get("collection_id") ?? "");
  if (!collectionId) return;

  await supabase.from("collections").delete().eq("id", collectionId).eq("user_id", user.id);
  revalidatePath("/collections");
}

export async function addPostToCollection(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const collectionId = String(formData.get("collection_id") ?? "");
  const postId = String(formData.get("post_id") ?? "");
  if (!collectionId || !postId) return;

  await supabase.from("collection_posts").insert({ collection_id: collectionId, post_id: postId });
  revalidatePath(`/collections/${collectionId}`);
  revalidatePath("/collections");
}

export async function removePostFromCollection(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const collectionId = String(formData.get("collection_id") ?? "");
  const postId = String(formData.get("post_id") ?? "");
  if (!collectionId || !postId) return;

  await supabase
    .from("collection_posts")
    .delete()
    .eq("collection_id", collectionId)
    .eq("post_id", postId);
  revalidatePath(`/collections/${collectionId}`);
  revalidatePath("/collections");
}
