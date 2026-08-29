import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { WeeklyAnswerForm, type ExistingAnswer } from "@/components/WeeklyAnswerForm";
import {
  currentPrompt,
  pastWeeks,
  promptCategory,
  promptForWeek,
  weekLabel,
} from "@/lib/weeklyPrompt";

export const metadata = {
  title: "This Week — Feedback",
  description: "One question a week, answered by everybody.",
};

type AnswerRow = {
  id: string;
  user_id: string;
  week_start: string;
  title: string;
  subtitle: string | null;
  note: string | null;
  created_at: string;
};

type ProfileRow = { id: string; username: string; avatar_url: string | null };

function AnswerCard({
  answer,
  profile,
}: {
  answer: AnswerRow;
  profile: ProfileRow | undefined;
}) {
  return (
    <div className="weekly-answer">
      <Link href={`/profile/${profile?.username ?? ""}`} className="weekly-answer-who">
        <img src={profile?.avatar_url || "/avatars/preset-1.svg"} alt="" />
        <b>{profile?.username ?? "someone"}</b>
      </Link>
      <div className="weekly-answer-pick">
        <b>{answer.title}</b>
        {answer.subtitle && <span className="sub">{answer.subtitle}</span>}
      </div>
      {answer.note && <p className="weekly-answer-note">{answer.note}</p>}
    </div>
  );
}

export default async function WeeklyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { prompt, week } = currentPrompt();
  const previous = pastWeeks(3);

  const { data: answerRows } = await supabase
    .from("weekly_answers")
    .select("id, user_id, week_start, title, subtitle, note, created_at")
    .in("week_start", [week, ...previous])
    .order("created_at", { ascending: false })
    .returns<AnswerRow[]>();

  const answers = answerRows ?? [];
  const authorIds = [...new Set(answers.map((a) => a.user_id))];
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", authorIds.length > 0 ? authorIds : ["00000000-0000-0000-0000-000000000000"])
    .returns<ProfileRow[]>();
  const profiles = new Map((profileRows ?? []).map((p) => [p.id, p]));

  const thisWeek = answers.filter((a) => a.week_start === week);
  const mine = user ? thisWeek.find((a) => a.user_id === user.id) ?? null : null;

  // Yours first when you have answered - the page is partly a record of
  // what you said, and hunting for it in a list of everybody is work.
  const others = thisWeek.filter((a) => a.user_id !== user?.id);

  const existing: ExistingAnswer | null = mine
    ? { title: mine.title, subtitle: mine.subtitle, note: mine.note }
    : null;

  return (
    <>
      <div className="panel weekly-panel">
        <div className="panel-head">
          This Week
          <span className="see-all">{weekLabel(week)}</span>
        </div>
        <div className="panel-body">
          <div className="weekly-kicker">{promptCategory(prompt)}</div>
          <h1 className="weekly-question">{prompt.question}</h1>

          {user ? (
            <WeeklyAnswerForm prompt={prompt} existing={existing} />
          ) : (
            <div className="field-hint">
              <Link href="/sign-in">Sign in</Link> to answer.
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          Everyone&apos;s answers
          <span className="see-all">{thisWeek.length}</span>
        </div>
        <div className="panel-body">
          {thisWeek.length === 0 ? (
            <div className="empty-state">
              Nobody has answered yet. Be the first and everyone else sees it here.
            </div>
          ) : (
            <div className="weekly-answers">
              {mine && <AnswerCard answer={mine} profile={profiles.get(mine.user_id)} />}
              {others.map((answer) => (
                <AnswerCard key={answer.id} answer={answer} profile={profiles.get(answer.user_id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {previous.map((pastWeek) => {
        const forWeek = answers.filter((a) => a.week_start === pastWeek);
        if (forWeek.length === 0) return null;
        return (
          <div className="panel" key={pastWeek}>
            <div className="panel-head">
              {promptForWeek(pastWeek).question}
              <span className="see-all">{weekLabel(pastWeek)}</span>
            </div>
            <div className="panel-body">
              <div className="weekly-answers">
                {forWeek.map((answer) => (
                  <AnswerCard key={answer.id} answer={answer} profile={profiles.get(answer.user_id)} />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
