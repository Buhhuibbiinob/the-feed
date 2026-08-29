import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PostForm } from "@/components/PostForm";

export const metadata = { title: "New Post - Feedback" };

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ responds_to?: string }>;
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
  const { responds_to: respondsTo } = await searchParams;
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

  return <PostForm answering={answering} />;
}
