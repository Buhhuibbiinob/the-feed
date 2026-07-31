import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PostForm } from "@/components/PostForm";

export const metadata = { title: "New Post - Feedback" };

export default async function NewPostPage() {
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

  return <PostForm />;
}
