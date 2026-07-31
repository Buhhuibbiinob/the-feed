"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendMessage, type MessageFormState } from "@/app/actions/messages";

const initialState: MessageFormState = {};

export function MessageComposer({
  recipientId,
  recipientUsername,
}: {
  recipientId: string;
  recipientUsername: string;
}) {
  const [state, formAction, pending] = useActionState(sendMessage, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form action={formAction} className="comment-form" ref={formRef}>
      <input type="hidden" name="recipient_id" value={recipientId} />
      <input type="hidden" name="recipient_username" value={recipientUsername} />
      {state.error && <div className="form-error">{state.error}</div>}
      <textarea name="body" placeholder={`Message ${recipientUsername}...`} required />
      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Sending..." : "Send"}
        </button>
      </div>
    </form>
  );
}
