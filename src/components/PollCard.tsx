"use client";

import { votePoll, deletePoll } from "@/app/actions/polls";
import { sharePercent, type Poll } from "@/lib/polls";
import { EmojiText } from "@/lib/emojiText";
import { MEDIA_LABELS } from "@/lib/media";

/**
 * One matchup.
 *
 * The result is hidden until you vote. A poll showing 80/20 before you
 * pick is not a poll, it is a leaderboard - you read the winner and move
 * on. Hiding it is what makes the tap worth doing.
 */
export function PollCard({
  poll,
  signedIn,
  isOwner,
}: {
  poll: Poll;
  signedIn: boolean;
  isOwner: boolean;
}) {
  const total = poll.votesA + poll.votesB;
  const [shareA, shareB] = sharePercent(poll.votesA, poll.votesB);
  const voted = poll.myVote !== null;

  function vote(choice: "a" | "b") {
    if (!signedIn) return;
    const data = new FormData();
    data.set("poll_id", poll.id);
    data.set("choice", choice);
    data.set("previous", poll.myVote ?? "");
    void votePoll(data);
  }

  const side = (key: "a" | "b") => {
    const label = key === "a" ? poll.optionA : poll.optionB;
    const sub = key === "a" ? poll.subtitleA : poll.subtitleB;
    const share = key === "a" ? shareA : shareB;
    const count = key === "a" ? poll.votesA : poll.votesB;
    const mine = poll.myVote === key;
    const winning = voted && total > 0 && share >= 50;

    return (
      <button
        type="button"
        className={`poll-side${mine ? " mine" : ""}${voted ? " voted" : ""}${winning ? " winning" : ""}`}
        onClick={() => vote(key)}
        disabled={!signedIn}
        aria-pressed={mine}
      >
        {/* The fill is the result. It stays at zero width until you have
            voted, so the bar animating in is the answer arriving. */}
        <span className="poll-fill" style={{ width: voted ? `${share}%` : "0%" }} aria-hidden="true" />
        <span className="poll-side-text">
          <b>
            <EmojiText size={15}>{label}</EmojiText>
          </b>
          {sub && (
            <span className="sub">
              <EmojiText size={13}>{sub}</EmojiText>
            </span>
          )}
        </span>
        {voted && (
          <span className="poll-share">
            {share}%<span className="poll-count">{count}</span>
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="poll-card">
      <div className="poll-head">
        <span className="poll-kicker">{MEDIA_LABELS[poll.mediaType]}</span>
        <span className="poll-by">by {poll.authorUsername}</span>
        {isOwner && (
          <form action={deletePoll} className="poll-delete">
            <input type="hidden" name="poll_id" value={poll.id} />
            <button type="submit" className="comment-action danger" aria-label="Delete poll">
              ✕
            </button>
          </form>
        )}
      </div>

      <div className="poll-question">
        {poll.question ? <EmojiText size={17}>{poll.question}</EmojiText> : "Which one?"}
      </div>

      <div className="poll-sides">
        {side("a")}
        <span className="poll-vs" aria-hidden="true">
          vs
        </span>
        {side("b")}
      </div>

      <div className="poll-foot">
        {!signedIn
          ? "Sign in to vote."
          : voted
            ? `${total} vote${total === 1 ? "" : "s"} · tap your pick again to undo`
            : "Tap one to see the split."}
      </div>
    </div>
  );
}
