export const metadata = { title: "Banned — the feed" };

export default function BannedPage() {
  return (
    <div className="panel">
      <div className="panel-head">Account Suspended</div>
      <div className="panel-body">
        <p>Your account has been banned from the feed for violating community guidelines.</p>
      </div>
    </div>
  );
}
