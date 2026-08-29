"use client";

import { useState, useSyncExternalStore } from "react";
import { savePageAppearance } from "@/app/actions/pageConfig";
import { decorateServerSnapshot, isDecorating, subscribeDecorate } from "@/lib/decorate";
import { MAX_PROFILE_CSS } from "@/lib/profileCss";
import type { PageConfig } from "@/lib/pageConfig";
import { Portal } from "@/components/Portal";

/**
 * The escape hatch, for the few people who want one.
 *
 * This used to be presented as the way to customize a page properly,
 * and its own placeholder told you to write `border-radius: 20px` and
 * `rotate(-3deg)` - the two most obvious things anyone wants, reachable
 * only by learning a language. Both are sliders now, along with glow,
 * spacing, transparency, text size and a photo behind the page, in
 * Customize > Shape & photo. Nothing here is needed for any of it.
 *
 * What is left is genuinely open-ended: one person's idea nobody
 * building the sliders thought of. So it stays, labelled as the extra
 * it is rather than as the main event.
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
          {open ? "Close CSS" : "CSS (optional)"}
        </button>
      </div>
      {open && (
        <div className="css-editor">
          <div className="css-editor-head">
            <b>Your own CSS</b>
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
            // Code, not prose. The emoji keyboard would open on `:hover`.
            data-no-emoji=""
            placeholder={".panel { border-radius: 20px }\n.pf-photo { transform: rotate(-3deg) }"}
          />
          <div className="css-editor-foot">
            <span className="field-hint">
              You don&apos;t need this. Corners, glow, tilt, spacing, transparency and a background
              photo are all sliders under Customize. This is here for the thing they don&apos;t
              cover. Rules only apply to your page.
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
