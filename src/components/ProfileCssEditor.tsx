"use client";

import { useState, useSyncExternalStore } from "react";
import { savePageAppearance } from "@/app/actions/pageConfig";
import { decorateServerSnapshot, isDecorating, subscribeDecorate } from "@/lib/decorate";
import { MAX_PROFILE_CSS } from "@/lib/profileCss";
import type { PageConfig } from "@/lib/pageConfig";
import { Portal } from "@/components/Portal";

/**
 * The unlimited lever: write your own CSS for your page.
 *
 * Everything else on the profile is a control someone had to think of
 * in advance. This is the one that does not run out - which is what
 * made decorating a page somewhere you could sit for an hour.
 *
 * It is only shown while decorating, and only to the owner. What gets
 * typed here is never trusted: it is rewritten at render time so every
 * rule is scoped to this profile, and the ways out of that scope are
 * tested by attacking it in scripts/profile-css-attacks.ts.
 */
export function ProfileCssEditor({ ownerId, config }: { ownerId: string; config: PageConfig }) {
  const decorating = useSyncExternalStore(subscribeDecorate, isDecorating, decorateServerSnapshot);
  const [open, setOpen] = useState(false);
  const [css, setCss] = useState(config.css ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!decorating) return null;

  async function save() {
    setSaving(true);
    try {
      const data = new FormData();
      data.set("surface", "profile");
      data.set("owner_id", ownerId);
      data.set("config", JSON.stringify({ ...config, css }));
      await savePageAppearance({}, data);
      setSaved(true);
      // The page has to reload for a new stylesheet to take effect -
      // the CSS is rendered on the server, scoped to this profile.
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Portal>
      <div className="css-editor-launch">
        <button type="button" className="acct-btn" onClick={() => setOpen((v) => !v)}>
          {open ? "Close CSS" : "Custom CSS"}
        </button>
      </div>
      {open && (
        <div className="css-editor">
          <div className="css-editor-head">
            <b>Your CSS</b>
            <span className="field-hint">
              {css.length}/{MAX_PROFILE_CSS}
            </span>
          </div>
          <textarea
            value={css}
            onChange={(e) => {
              setCss(e.target.value.slice(0, MAX_PROFILE_CSS));
              setSaved(false);
            }}
            spellCheck={false}
            placeholder={".panel { border-radius: 20px }\n.pf-photo { transform: rotate(-3deg) }"}
          />
          <div className="css-editor-foot">
            <span className="field-hint">
              Rules only apply to your page. Background images from anywhere are fine; anything that
              would cover the whole screen is dropped.
            </span>
            <button type="button" className="btn" onClick={save} disabled={saving}>
              {saving ? "Saving…" : saved ? "Saved" : "Save CSS"}
            </button>
          </div>
        </div>
      )}
    </Portal>
  );
}
