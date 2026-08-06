"use client";

import { useActionState } from "react";
import {
  adminCreateBot,
  adminUpdateBot,
  adminDeleteBot,
  adminRunBotActivity,
  type BotProfile,
  type BotState,
} from "@/app/actions/bots";

const initialState: BotState = {};

export function BotAdminPanel({ bots, enabled }: { bots: BotProfile[]; enabled: boolean }) {
  const [createState, createAction, creating] = useActionState(adminCreateBot, initialState);
  const [runState, runAction, running] = useActionState(adminRunBotActivity, initialState);

  return (
    <>
      {!enabled && (
        <div className="form-error">
          Bots are switched off. Turn on &quot;AI bot accounts&quot; in Homepage Sections above to let them post.
        </div>
      )}

      <form action={runAction} style={{ marginBottom: 16 }}>
        {runState.error && <div className="form-error">{runState.error}</div>}
        {runState.ok && <div className="form-message">{runState.summary}</div>}
        <p className="field-hint" style={{ marginBottom: 8 }}>
          Runs one round: a random active bot reviews a real trending track, posts one chat message, and likes
          a recent post from a real member. Bots never review something they&apos;ve already reviewed, never
          invent releases, and never like each other.
        </p>
        <button className="btn" type="submit" disabled={running || bots.length === 0}>
          {running ? "Running…" : "Run bot activity now"}
        </button>
      </form>

      <div className="panel-body flush" style={{ marginBottom: 16 }}>
        {bots.length === 0 ? (
          <div className="empty-state" style={{ padding: 12 }}>
            No bots yet - create one below.
          </div>
        ) : (
          bots.map((bot) => (
            <div className="chat-row" key={bot.id}>
              <b>@{bot.username}</b> <span className="badge-bot">BOT</span>
              {!bot.bot_active && <span className="field-hint"> (paused)</span>}
              <form action={adminUpdateBot} style={{ marginTop: 6 }}>
                <input type="hidden" name="bot_id" value={bot.id} />
                <textarea
                  name="persona"
                  rows={2}
                  defaultValue={bot.bot_persona ?? ""}
                  placeholder="How this bot writes - taste, tone, what they care about"
                />
                <div className="form-actions" style={{ marginTop: 6 }}>
                  <button className="btn" type="submit" name="active" value={bot.bot_active ? "true" : "true"}>
                    Save
                  </button>
                  <button className="btn btn-ghost" type="submit" name="active" value={bot.bot_active ? "false" : "true"}>
                    {bot.bot_active ? "Pause" : "Resume"}
                  </button>
                </div>
              </form>
              <form action={adminDeleteBot} className="inline-form" style={{ marginTop: 4 }}>
                <input type="hidden" name="bot_id" value={bot.id} />
                <button type="submit" className="comment-action danger">
                  Delete bot and everything it posted
                </button>
              </form>
            </div>
          ))
        )}
      </div>

      <form action={createAction}>
        {createState.error && <div className="form-error">{createState.error}</div>}
        {createState.ok && <div className="form-message">{createState.summary}</div>}
        <div className="field">
          <label htmlFor="bot-username">Username</label>
          <input id="bot-username" name="username" type="text" placeholder="vinylghost" />
        </div>
        <div className="field">
          <label htmlFor="bot-persona">Persona</label>
          <textarea
            id="bot-persona"
            name="persona"
            rows={3}
            placeholder="e.g. a 2000s R&B obsessive who compares everything to early Neptunes production and writes in short punchy sentences"
          />
        </div>
        <div className="form-actions">
          <button className="btn" type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create bot"}
          </button>
        </div>
      </form>
    </>
  );
}
