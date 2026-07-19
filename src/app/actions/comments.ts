"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CommentFormState = {
  error?: string;
  ok?: boolean;
};

export async function createComment(
  _prevState: CommentFormState,
  formData: FormData
): Promise<CommentFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to comment." };
  }

  const postId = String(formData.get("post_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const parentCommentId = String(formData.get("parent_comment_id") ?? "").trim() || null;

  if (!postId || !body) {
    return { error: "Comment can't be empty." };
  }

  if (parentCommentId) {
    const { data: parent } = await supabase
      .from("comments")
      .select("parent_comment_id")
      .eq("id", parentCommentId)
      .eq("post_id", postId)
      .maybeSingle();

    if (!parent || parent.parent_comment_id) {
      return { error: "Replies can only be one level deep." };
    }
  }

  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    user_id: user.id,
    parent_comment_id: parentCommentId,
    body,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/post/${postId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function updateComment(
  _prevState: CommentFormState,
  formData: FormData
): Promise<CommentFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const commentId = String(formData.get("comment_id") ?? "");
  const postId = String(formData.get("post_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!commentId || !body) {
    return { error: "Comment can't be empty." };
  }

  const { error } = await supabase
    .from("comments")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/post/${postId}`);
  return { ok: true };
}

export async function deleteComment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const commentId = String(formData.get("comment_id") ?? "");
  const postId = String(formData.get("post_id") ?? "");
  if (!commentId) return;

  await supabase.from("comments").delete().eq("id", commentId).eq("user_id", user.id);

  revalidatePath(`/post/${postId}`);
  revalidatePath("/");
}
