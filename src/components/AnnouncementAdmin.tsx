"use client";

import { useActionState, useState } from "react";
import {
  createAnnouncement,
  deleteAnnouncement,
  setAnnouncementActive,
  type AnnouncementFormState,
} from "@/app/actions/announcements";
import {
  isLive,
  MAX_BODY,
  MAX_BUTTON_LABEL,
  MAX_TITLE,
  type Announcement,
} from "@/lib/announcements";

// The admin side of announcements.
//
// A live preview sits above the form on purpose. The whole point of this
// feature is that whatever is typed here appears in front of everybody at
// once, so the last thing anyone should have to do is publish it to find
// out how it reads.

function describe(a: Announcement, now: Date): string {
  if (!a.active) return "switched off";
  if (a.starts_at && new Date(a.starts_at) > now) {
    return `starts ${new Date(a.starts_at).toLocaleString()}`;
  }
  if (a.ends_at && new Date(a.ends_at) <= now) return "finished";
  if (a.ends_at) return `live until ${new Date(a.ends_at).toLocaleString()}`;
  return "live now";
}

export function AnnouncementAdmin({ announcements }: { announcements: Announcement[] }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [style, setStyle] = useState<"alert" | "banner">("alert");
  const [linkUrl, setLinkUrl] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");
  const now = new Date();
  // Publishing reports what happened now, rather than looking like it
  // worked whatever the database said.
  const [state, publish, publishing] = useActionState<AnnouncementFormState, FormData>(
    createAnnouncement,
    {}
  );

  return (
    <div className="panel">
      <div className="panel-head">Announcements</div>
      <div className="panel-body">
        <div className="tagline" style={{ marginBottom: 12 }}>
          Everyone on the site sees this - members and visitors. An alert
          interrupts once and has to be closed; a banner sits under the nav
          until it is dismissed or runs out.
        </div>

        {/* ---- Preview ---- */}
        <div className="sk-announce-preview">
          <div className="sk-announce-preview-label">Preview</div>
          {style === "alert" ? (
            <div className="sk-announce sk-announce-static">
              <div className="sk-announce-title">{title || "Your title"}</div>
              {(body || !title) && (
                <div className="sk-announce-message">{body || "Your message goes here."}</div>
              )}
              <div className="sk-announce-actions">
                <button type="button" disabled>
                  {linkUrl.trim() ? "Close" : "OK"}
                </button>
                {linkUrl.trim() && (
                  <button type="button" className="sk-announce-go" disabled>
                    {buttonLabel.trim() || "Take a look"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="sk-announce-banner sk-announce-static">
              <div className="sk-announce-banner-inner">
                <span className="sk-announce-banner-icon" aria-hidden="true">
                  !
                </span>
                <div className="sk-announce-banner-text">
                  <b>{title || "Your title"}</b>
                  {body && <span> {body}</span>}
                </div>
                {linkUrl.trim() && (
                  <span className="sk-announce-banner-btn">{buttonLabel.trim() || "Take a look"}</span>
                )}
                <span className="sk-announce-banner-close" aria-hidden="true">
                  ×
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ---- Compose ---- */}
        <form action={publish}>
          <div className="field">
            <label htmlFor="announce-title">Title</label>
            <input
              id="announce-title"
              name="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MAX_TITLE}
              placeholder="New stickers are up"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="announce-body">Message</label>
            <textarea
              id="announce-body"
              name="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={MAX_BODY}
              rows={3}
              placeholder="Sporty, swag, Cali and Tumblr packs - go and decorate something."
            />
          </div>
          <div className="field">
            <label htmlFor="announce-style">How loud?</label>
            <select
              id="announce-style"
              name="style"
              value={style}
              onChange={(e) => setStyle(e.target.value === "banner" ? "banner" : "alert")}
            >
              <option value="alert">Alert - interrupts once, has to be closed</option>
              <option value="banner">Banner - a strip under the nav</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="announce-link">Button link (optional)</label>
            <input
              id="announce-link"
              name="link_url"
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="/post/new"
            />
          </div>
          {linkUrl.trim() && (
            <div className="field">
              <label htmlFor="announce-button">Button label</label>
              <input
                id="announce-button"
                name="button_label"
                type="text"
                value={buttonLabel}
                onChange={(e) => setButtonLabel(e.target.value)}
                maxLength={MAX_BUTTON_LABEL}
                placeholder="Take a look"
              />
            </div>
          )}
          <div className="sk-announce-when">
            <div className="field">
              <label htmlFor="announce-start">Start (optional)</label>
              <input id="announce-start" type="datetime-local" name="starts_at" />
            </div>
            <div className="field">
              <label htmlFor="announce-end">End (optional)</label>
              <input id="announce-end" type="datetime-local" name="ends_at" />
            </div>
          </div>
          {state.error && <div className="form-error">{state.error}</div>}
          {state.ok && <div className="form-message">Published - it's live now.</div>}
          <div className="form-actions">
            <button type="submit" className="btn" disabled={publishing}>
              {publishing ? "Publishing…" : "Publish"}
            </button>
          </div>
        </form>

        {/* ---- What is already out there ---- */}
        <div className="sk-announce-list">
          {announcements.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              Nothing announced yet.
            </div>
          ) : (
            announcements.map((a) => (
              <div className="chat-row" key={a.id}>
                <b>{a.title}</b>
                <span>
                  {" "}
                  · {a.style} · {describe(a, now)}
                  {isLive(a, now) ? " ·" : ""}
                  {isLive(a, now) ? <b> showing</b> : null}
                </span>
                <span className="chat-msg-actions">
                  <form action={setAnnouncementActive} className="inline-form">
                    <input type="hidden" name="announcement_id" value={a.id} />
                    <input type="hidden" name="active" value={a.active ? "0" : "1"} />
                    <button type="submit" className="comment-action">
                      {a.active ? "Switch off" : "Switch on"}
                    </button>
                  </form>
                  <form action={deleteAnnouncement} className="inline-form">
                    <input type="hidden" name="announcement_id" value={a.id} />
                    <button type="submit" className="comment-action">
                      Delete
                    </button>
                  </form>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
