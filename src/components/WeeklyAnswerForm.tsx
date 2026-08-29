"use client";

import { useActionState, useState } from "react";
import { answerWeekly, deleteWeeklyAnswer, type WeeklyState } from "@/app/actions/weekly";
import { MAX_ANSWER_NOTE, type Prompt } from "@/lib/weeklyPrompt";

const initialState: WeeklyState = {};

export type ExistingAnswer = {
  title: string;
  subtitle: string | null;
  note: string | null;
};

/**
 * Answering the week's question.
 *
 * Shows what you already said rather than an empty form, because the
 * most common second visit is changing your mind about the third field,
 * not starting again.
 */
export function WeeklyAnswerForm({
  prompt,
  existing,
}: {
  prompt: Prompt;
  existing: ExistingAnswer | null;
}) {
  const [state, formAction, pending] = useActionState(answerWeekly, initialState);
  const [note, setNote] = useState(existing?.note ?? "");

  return (
    <form action={formAction} className="comment-form weekly-form">
      {state.error && <div className="form-error">{state.error}</div>}

      <label className="weekly-field">
        <span>{prompt.placeholder}</span>
        <input
          type="text"
          name="title"
          defaultValue={existing?.title ?? ""}
          maxLength={160}
          required
          placeholder={prompt.placeholder}
        />
      </label>

      {prompt.subtitleLabel && (
        <label className="weekly-field">
          <span>{prompt.subtitleLabel}</span>
          <input
            type="text"
            name="subtitle"
            defaultValue={existing?.subtitle ?? ""}
            maxLength={160}
            placeholder={prompt.subtitleLabel}
          />
        </label>
      )}

      <label className="weekly-field">
        <span>Why</span>
        <textarea
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, MAX_ANSWER_NOTE))}
          rows={3}
          placeholder="A line about why. Optional."
        />
      </label>
      <div className="field-hint">
        {note.length}/{MAX_ANSWER_NOTE}
      </div>

      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : existing ? "Change my answer" : "Post my answer"}
        </button>
        {existing && (
          <button type="button" className="comment-action danger" onClick={() => void deleteWeeklyAnswer()}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
