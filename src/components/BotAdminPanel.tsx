"use client";

import { useActionState } from "react";
import {
  adminCreateBot,
  adminCreateBotsBulk,
  adminDeleteAllBots,
  adminRenameBot,
  adminUpdateBot,
  adminUpdateBotProfile,
  adminDeleteBot,
  adminRunBotActivity,
  type BotProfile,
  type BotState,
} from "@/app/actions/bots";

const initialState: BotState = {};

export function BotAdminPanel({ bots, enabled }: { bots: BotProfile[]; enabled: boolean }) {
  const [createState, createAction, creating] = useActionState(adminCreateBot, initialState);
  const [bulkState, bulkAction, bulkCreating] = useActionState(adminCreateBotsBulk, initialState);
  const [runState, runAction, running] = useActionState(adminRunBotActivity, initialState);
  const [purgeState, purgeAction, purging] = useActionState(adminDeleteAllBots, initialState);
  const [renameState, renameAction, renaming] = useActionState(adminRenameBot, initialState);

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
          Runs one round: a random active bot reviews something real - a song from any era, 70s
          through now, or a film or show that&apos;s actually out - posts one chat message, and likes a
          recent post from a real member. Open a bot below to make that specific one post instead.
          Bots never review something they&apos;ve already reviewed, never invent releases, and never
          like each other.
        </p>
        <button className="btn" type="submit" disabled={running || bots.length === 0}>
          {running ? "Running…" : "Run bot activity now"}
        </button>
      </form>

      {renameState.error && <div className="form-error">{renameState.error}</div>}
      {renameState.ok && <div className="form-message">{renameState.summary}</div>}

      <div className="panel-body flush" style={{ marginBottom: 16 }}>
        {bots.length === 0 ? (
          <div className="empty-state" style={{ padding: 12 }}>
            No bots yet - create one below.
          </div>
        ) : (
          bots.map((bot) => (
            <details className="chat-row" key={bot.id}>
              <summary>
                <b>@{bot.username}</b> <span className="badge-bot">BOT</span>
                {!bot.bot_active && <span className="field-hint"> (paused)</span>}
              </summary>

              <form action={runAction} style={{ marginTop: 8 }}>
                <input type="hidden" name="bot_id" value={bot.id} />
                <button className="btn" type="submit" disabled={running || !bot.bot_active}>
                  {running ? "Posting…" : `Make @${bot.username} post now`}
                </button>
                {!bot.bot_active && (
                  <span className="field-hint"> Resume this bot first.</span>
                )}
              </form>

              <form action={renameAction} style={{ marginTop: 10 }}>
                <input type="hidden" name="bot_id" value={bot.id} />
                <div className="field">
                  <label htmlFor={`username-${bot.id}`}>Username</label>
                  <input
                    id={`username-${bot.id}`}
                    name="username"
                    type="text"
                    defaultValue={bot.username}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <div className="form-actions" style={{ marginTop: 6 }}>
                  <button className="btn btn-ghost" type="submit" disabled={renaming}>
                    {renaming ? "Renaming…" : "Rename"}
                  </button>
                </div>
              </form>

              <form action={adminUpdateBot} style={{ marginTop: 10 }}>
                <input type="hidden" name="bot_id" value={bot.id} />
                <label className="field-hint" htmlFor={`persona-${bot.id}`}>
                  Persona - taste and typing voice, which shapes everything it writes
                </label>
                <textarea
                  id={`persona-${bot.id}`}
                  name="persona"
                  rows={2}
                  defaultValue={bot.bot_persona ?? ""}
                  placeholder="How this bot writes - taste, tone, what they care about"
                />
                <div className="form-actions" style={{ marginTop: 6 }}>
                  <button className="btn" type="submit" name="active" value={bot.bot_active ? "true" : "true"}>
                    Save persona
                  </button>
                  <button className="btn btn-ghost" type="submit" name="active" value={bot.bot_active ? "false" : "true"}>
                    {bot.bot_active ? "Pause" : "Resume"}
                  </button>
                </div>
              </form>

              <form action={adminUpdateBotProfile} style={{ marginTop: 10 }}>
                <input type="hidden" name="bot_id" value={bot.id} />
                <div className="field">
                  <label htmlFor={`avatar-${bot.id}`}>Profile picture URL</label>
                  <input
                    id={`avatar-${bot.id}`}
                    name="avatar_url"
                    type="text"
                    defaultValue={bot.avatar_url ?? ""}
                    placeholder="/avatars/preset-1.svg or an image URL"
                  />
                </div>
                <div className="field">
                  <label htmlFor={`banner-${bot.id}`}>Banner URL</label>
                  <input
                    id={`banner-${bot.id}`}
                    name="banner_url"
                    type="text"
                    defaultValue={bot.banner_url ?? ""}
                    placeholder="Image URL for the profile banner"
                  />
                </div>
                <div className="field">
                  <label htmlFor={`bio-${bot.id}`}>Bio</label>
                  <textarea id={`bio-${bot.id}`} name="bio" rows={2} defaultValue={bot.bio ?? ""} />
                </div>
                <div className="field">
                  <label htmlFor={`status-title-${bot.id}`}>Status - what they&apos;re currently on</label>
                  <select
                    name="status_media_type"
                    defaultValue={bot.status_media_type ?? "music"}
                    aria-label="Status kind"
                  >
                    <option value="music">Listening to</option>
                    <option value="movie_tv">Watching</option>
                  </select>
                  <input
                    id={`status-title-${bot.id}`}
                    name="status_title"
                    type="text"
                    defaultValue={bot.status_title ?? ""}
                    placeholder="Title (leave blank to clear the status)"
                  />
                  <input
                    name="status_artist"
                    type="text"
                    defaultValue={bot.status_artist ?? ""}
                    placeholder="Artist (optional)"
                  />
                </div>
                <div className="form-actions" style={{ marginTop: 6 }}>
                  <button className="btn" type="submit">
                    Save profile
                  </button>
                </div>
              </form>

              <form action={adminDeleteBot} className="inline-form" style={{ marginTop: 8 }}>
                <input type="hidden" name="bot_id" value={bot.id} />
                <button type="submit" className="comment-action danger">
                  Delete bot and everything it posted
                </button>
              </form>
            </details>
          ))
        )}
      </div>

      {bots.length > 0 && (
        <form action={purgeAction} style={{ marginBottom: 20 }}>
          {purgeState.error && <div className="form-error">{purgeState.error}</div>}
          {purgeState.ok && <div className="form-message">{purgeState.summary}</div>}
          <button type="submit" className="comment-action danger" disabled={purging}>
            {purging ? "Removing…" : `Remove all ${bots.length} bots and everything they posted`}
          </button>
        </form>
      )}

      <form action={bulkAction} style={{ marginBottom: 20 }}>
        {bulkState.error && <div className="form-error">{bulkState.error}</div>}
        {bulkState.ok && <div className="form-message">{bulkState.summary}</div>}
        <div className="field">
          <label htmlFor="bot-count">Create bots in bulk</label>
          <input id="bot-count" name="count" type="number" min={1} max={25} defaultValue={10} />
          <span className="field-hint">
            Each one gets its own handle, taste and typing voice - dialect, punctuation habits, post
            length. Edit any of them individually above afterwards.
          </span>
        </div>
        <div className="form-actions">
          <button className="btn" type="submit" disabled={bulkCreating}>
            {bulkCreating ? "Creating…" : "Create bots"}
          </button>
        </div>
      </form>

      <form action={createAction}>
        {createState.error && <div className="form-error">{createState.error}</div>}
        {createState.ok && <div className="form-message">{createState.summary}</div>}
        <div className="field">
          <label htmlFor="bot-username">Or create one by hand</label>
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
