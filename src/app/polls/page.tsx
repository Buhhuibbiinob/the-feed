import { createClient } from "@/lib/supabase/server";
import { loadPolls } from "@/lib/polls";
import { PollCard } from "@/components/PollCard";
import { CreatePollForm } from "@/components/CreatePollForm";

export const metadata = {
  title: "Matchups — Feedback",
  description: "Two options, one tap. Which one's better?",
};

export default async function PollsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const polls = await loadPolls(supabase, user?.id ?? null);

  return (
    <>
      <div className="panel">
        <div className="panel-head">Matchups</div>
        <div className="panel-body">
          <div className="field-hint" style={{ marginTop: 0 }}>
            Two options, one tap. The split stays hidden until you pick.
          </div>
          {user ? (
            <CreatePollForm />
          ) : (
            <div className="field-hint">Sign in to start one.</div>
          )}
        </div>
      </div>

      {polls.length === 0 ? (
        <div className="panel">
          <div className="panel-body">
            <div className="empty-state">
              No matchups yet. Start one and everybody gets something to argue about.
            </div>
          </div>
        </div>
      ) : (
        polls.map((poll) => (
          <PollCard
            key={poll.id}
            poll={poll}
            signedIn={!!user}
            isOwner={poll.createdBy === user?.id}
          />
        ))
      )}
    </>
  );
}
