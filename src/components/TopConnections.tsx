"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  addTopConnection,
  moveTopConnection,
  removeTopConnection,
  type ModuleFormState,
} from "@/app/actions/pageModules";

const initialState: ModuleFormState = {};

export type Connection = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

export function TopConnections({
  connections,
  isOwner,
  ownerId,
}: {
  connections: Connection[];
  isOwner: boolean;
  ownerId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [state, formAction, pending] = useActionState(addTopConnection, initialState);

  const [lastOk, setLastOk] = useState(state.ok);
  if (lastOk !== state.ok) {
    setLastOk(state.ok);
    if (state.ok) setUsername("");
  }

  return (
    <div className="connections">
      {connections.length === 0 ? (
        <div className="empty-state">
          {isOwner ? "Pick your eight." : "Nobody up here."}
        </div>
      ) : (
        <div className="connections-grid">
          {connections.map((person) => (
            <Link href={`/profile/${person.username}`} className="connection" key={person.id}>
              <img src={person.avatarUrl || "/avatars/preset-1.svg"} alt="" />
              <span>{person.username}</span>
            </Link>
          ))}
        </div>
      )}

      {isOwner && !editing && (
        <button type="button" className="comment-action" onClick={() => setEditing(true)}>
          Edit top 8
        </button>
      )}

      {isOwner && editing && (
        <div className="avatar-picker">
          {state.error && <div className="form-error">{state.error}</div>}

          {connections.map((person, index) => (
            <div className="favorites-edit-row" key={person.id}>
              <img src={person.avatarUrl || "/avatars/preset-1.svg"} alt="" />
              <span className="favorites-edit-title">
                <b>{person.username}</b>
              </span>
              <span className="layout-move">
                <form action={moveTopConnection}>
                  <input type="hidden" name="owner_id" value={ownerId} />
                  <input type="hidden" name="friend_id" value={person.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button type="submit" className="comment-action" disabled={index === 0}>
                    ↑
                  </button>
                </form>
                <form action={moveTopConnection}>
                  <input type="hidden" name="owner_id" value={ownerId} />
                  <input type="hidden" name="friend_id" value={person.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    type="submit"
                    className="comment-action"
                    disabled={index === connections.length - 1}
                  >
                    ↓
                  </button>
                </form>
                <form action={removeTopConnection}>
                  <input type="hidden" name="owner_id" value={ownerId} />
                  <input type="hidden" name="friend_id" value={person.id} />
                  <button type="submit" className="comment-action danger">
                    ✕
                  </button>
                </form>
              </span>
            </div>
          ))}

          <form action={formAction} className="comment-form">
            <input type="hidden" name="owner_id" value={ownerId} />
            <input
              type="text"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="off"
            />
            <div className="form-actions">
              <button className="btn" type="submit" disabled={pending || !username.trim()}>
                {pending ? "Adding…" : "Add"}
              </button>
              <button type="button" className="comment-action" onClick={() => setEditing(false)}>
                Done
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
