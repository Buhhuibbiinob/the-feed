import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getNotifications } from "@/lib/notifications";
import { markNotificationsSeen } from "@/app/actions/notifications";
import { AlertsList } from "@/components/AlertsList";

export const metadata = { title: "Alerts" };

// A real page for alerts, not just the nav dropdown. The mobile tab bar
// points here: a 280px menu hanging off a bar is fine on a desktop and
// cramped on a phone, and a page is somewhere the back button understands.
export default async function AlertsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const notifications = await getNotifications(supabase, user.id);

  // Opening the page is the same "I've seen these" signal as opening the
  // dropdown, so the badge clears either way.
  await markNotificationsSeen();

  return (
    <div className="panel">
      <div className="panel-head">
        Alerts
        <Link href="/settings" className="see-all">
          Settings ▸
        </Link>
      </div>
      {notifications.length === 0 ? (
        <div className="panel-body">
          <div className="empty-state">
            Nothing yet.
          </div>
        </div>
      ) : (
        <AlertsList initial={notifications} />
      )}
    </div>
  );
}
