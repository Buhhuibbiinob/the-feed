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

export async function toggleCollectionFollow(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const collectionId = String(formData.get("collection_id") ?? "");
  if (!collectionId) return;

  // Owner is read from the row, not the form: following your own collection
  // would inflate the count that makes a collection worth following.
  const { data: collection } = await supabase
    .from("collections")
    .select("user_id")
    .eq("id", collectionId)
    .maybeSingle();
  if (!collection || collection.user_id === user.id) return;

  const { data: existing } = await supabase
    .from("collection_follows")
    .select("collection_id")
    .eq("collection_id", collectionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("collection_follows")
      .delete()
      .eq("collection_id", collectionId)
      .eq("user_id", user.id);
  } else {
    await supabase.from("collection_follows").insert({ collection_id: collectionId, user_id: user.id });
  }

  const { data: owner } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", collection.user_id)
    .maybeSingle();

  revalidatePath("/collections");
  revalidatePath(`/collections/${collectionId}`);
  if (owner?.username) revalidatePath(`/profile/${owner.username}`);
}
