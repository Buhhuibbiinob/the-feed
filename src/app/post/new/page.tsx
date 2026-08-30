import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PostForm } from "@/components/PostForm";
import { isMediaType } from "@/lib/media";

export const metadata = { title: "New Post - Feedback" };

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{
    responds_to?: string;
    type?: string;
    title?: string;
    artist?: string;
    queue?: string;
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="panel">
        <div className="panel-head">New Post</div>
        <div className="panel-body">
          <p>
            <Link href="/sign-up">Create an account</Link> or <Link href="/sign-in">sign in</Link> to
            post a review.
          </p>
        </div>
      </div>
    );
  }

  // Answering someone: show what you are answering, so the form is not
  // just a blank review that happens to be linked to something.
  const { responds_to: respondsTo, type, title, artist, queue } = await searchParams;
  let answering: { id: string; title: string; username: string } | null = null;
  if (respondsTo) {
    const { data } = await supabase
      .from("posts")
      .select("id, title, profiles(username)")
      .eq("id", respondsTo)
      .maybeSingle<{ id: string; title: string; profiles: { username: string } | { username: string }[] | null }>();
    if (data) {
      const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
      answering = { id: data.id, title: data.title, username: profile?.username ?? "someone" };
    }
  }

  // Arriving from a queue item: the composer opens already filled in,
  // and carries the item's id so posting ticks it off without anybody
  // having to go back and do it by hand.
  return (
    <PostForm
      answering={answering}
      prefill={{
        mediaType: isMediaType(type) ? type : null,
        title: title ?? null,
        artist: artist ?? null,
        queueItemId: queue ?? null,
      }}
    />
  );
}
