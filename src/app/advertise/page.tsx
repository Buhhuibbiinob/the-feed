import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdvertiseForm } from "@/components/AdvertiseForm";

export const metadata = { title: "Advertise - Feedback" };

export default async function AdvertisePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <div className="page-header">
        <h1>Advertise</h1>
        <div className="tagline">Get your music, film, or project in front of the community.</div>
      </div>

      <div className="panel">
        <div className="panel-head">Request a Banner</div>
        <div className="panel-body">
          <p className="field-hint" style={{ marginBottom: 12 }}>
            Banners run in the sidebar, free for now. Submissions are reviewed before going live and
            aren&apos;t guaranteed to be approved.
          </p>
          {user ? (
            <AdvertiseForm />
          ) : (
            <p>
              <Link href="/sign-in">Sign in</Link> or <Link href="/sign-up">create an account</Link> to
              submit a banner request.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
