"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Portal } from "@/components/Portal";
import { ClassicEmoji, EMOJI_GROUPS, emojiLabel, searchEmoji } from "@/components/ClassicEmoji";

type Field = HTMLTextAreaElement | HTMLInputElement;

/**
 * Setting `.value` on a React-controlled field does nothing useful: React
 * holds the value in state, and the next render puts the old one back.
 *
 * The way through is the prototype's own setter - which React's onChange
 * plumbing is listening to - followed by an `input` event, so React sees
 * a real edit and updates state. Assigning to `field.value` directly
 * bypasses that setter and the character appears until the component
 * re-renders, then silently vanishes.
 */
function setFieldValue(field: Field, value: string) {
  const proto =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(field, value);
  else field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

/** The `:word` being typed immediately before the caret, if any. */
function activeShortcode(field: Field): { query: string; start: number } | null {
  const caret = field.selectionStart;
  if (caret == null) return null;
  const before = field.value.slice(0, caret);
  // Anchored to the start of a word so a URL or a time - https:// or
  // 10:30 - never opens the keyboard mid-sentence.
  const match = /(?:^|\s)(:([a-z]{1,20}))$/i.exec(before);
  if (!match) return null;
  return { query: match[2], start: caret - match[1].length };
}

function isEmojiField(el: EventTarget | null): el is Field {
  if (!(el instanceof HTMLTextAreaElement) && !(el instanceof HTMLInputElement)) return false;
  if (el.dataset.noEmoji !== undefined) return false;
  if (el instanceof HTMLInputElement) {
    // Only opted-in single-line fields. Search boxes, passwords and the
    // URL fields are not places anyone wants a smiley panel.
    return el.dataset.emoji !== undefined;
  }
  return true;
}

/**
 * The emoji keyboard.
 *
 * One instance for the whole site, mounted in the layout, watching for
 * focus rather than being wired into each of the eight composers by
 * hand. Every textarea on the site is somewhere you write to someone -
 * a review, a comment, the guestbook, a DM, your bio - so they all get
 * it, and anything that should not opt out with `data-no-emoji`.
 *
 * Two ways in, because people expect both:
 *
 *  - Type `:` and a couple of letters and it appears, filtered, the way
 *    it does in every chat app made since about 2015.
 *  - Or press the smiley that sits in the corner of the field.
 *
 * The panel never takes focus - every button cancels its own mousedown -
 * so the caret stays where you left it and you can keep typing with the
 * keyboard open.
 */
export function EmojiKeyboard() {
  const [field, setField] = useState<Field | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [group, setGroup] = useState(0);
  const [anchor, setAnchor] = useState<{
    left: number;
    right: number;
    top: number;
    bottom: number;
  } | null>(null);
  // The same field, held in a ref as well as state: the document-level
  // listeners below need to read the current one without the effect
  // re-subscribing every time focus moves, and the render needs the
  // state. Both are written through selectField, never during render.
  const fieldRef = useRef<Field | null>(null);

  const selectField = useCallback((next: Field | null) => {
    fieldRef.current = next;
    setField(next);
  }, []);

  const place = useCallback((el: Field) => {
    const box = el.getBoundingClientRect();
    setAnchor({ left: box.left, right: box.right, top: box.top, bottom: box.bottom });
  }, []);

  useEffect(() => {
    function onFocusIn(e: FocusEvent) {
      if (!isEmojiField(e.target)) return;
      selectField(e.target);
      place(e.target);
      setOpen(false);
      setQuery(null);
    }

    function onFocusOut(e: FocusEvent) {
      // Only when focus actually leaves for something that is not the
      // panel - the panel prevents its own mousedown, so a click inside
      // it never blurs the field in the first place.
      if (e.target === fieldRef.current) {
        selectField(null);
        setOpen(false);
        setQuery(null);
      }
    }

    function onInput(e: Event) {
      const el = e.target;
      if (!isEmojiField(el) || el !== fieldRef.current) return;
      place(el);
      const code = activeShortcode(el);
      if (code && searchEmoji(code.query).length > 0) {
        setQuery(code.query);
        setOpen(true);
      } else if (query !== null) {
        // Typed past a shortcode that no longer matches: close the
        // auto-opened panel, but leave one the smiley opened alone.
        setQuery(null);
        setOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
        setQuery(null);
      }
    }

    function onReflow() {
      const el = fieldRef.current;
      if (el) place(el);
    }

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("input", onInput, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open, query, place, selectField]);

  function insert(char: string) {
    const el = fieldRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? el.value.length;
    const code = activeShortcode(el);
    // Typing `:cry` and picking a face replaces what you typed. Leaving
    // the `:cry` in beside the emoji is the thing that makes people stop
    // using shortcodes.
    const from = code ? code.start : caret;
    const next = el.value.slice(0, from) + char + el.value.slice(caret);
    setFieldValue(el, next);

    const at = from + char.length;
    el.setSelectionRange(at, at);
    el.focus();
    setQuery(null);
    setOpen(false);
  }

  if (!field || !anchor) return null;

  // Typing `:` searches across every group; the tabs are for browsing.
  const faces = query !== null ? searchEmoji(query) : EMOJI_GROUPS[group].chars;
  // Above the field when there is room, below when there isn't - the
  // panel should never be the thing covering what you are writing.
  const above = anchor.top > 260;

  return (
    <Portal>
      <button
        type="button"
        className="emoji-launch"
        // Bottom-right inside the field, where every composer since
        // about 2010 has put it - and out of the way of the text, which
        // bottom-left was sitting on top of.
        style={{ left: anchor.right - 32, top: anchor.bottom - 31 }}
        // Cancels the blur, so the caret survives the click.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          setQuery(null);
          setOpen((v) => !v);
        }}
        aria-label={open ? "Hide emoji" : "Emoji"}
        aria-expanded={open}
      >
        <ClassicEmoji char={"\u{1F642}"} size={19} />
      </button>

      {open && faces.length > 0 && (
        <div
          className="emoji-kb"
          style={
            above
              ? { left: anchor.left, bottom: window.innerHeight - anchor.top + 6 }
              : { left: anchor.left, top: anchor.bottom + 6 }
          }
          onMouseDown={(e) => e.preventDefault()}
          role="listbox"
          aria-label="Emoji"
        >
          {query !== null ? (
            <div className="emoji-kb-head">:{query}</div>
          ) : (
            <div className="seg emoji-kb-tabs">
              {EMOJI_GROUPS.map((g, i) => (
                <button
                  type="button"
                  key={g.name}
                  className={`seg-item${group === i ? " active" : ""}`}
                  onClick={() => setGroup(i)}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}
          <div className="emoji-kb-grid">
            {faces.map((char) => (
              <button
                type="button"
                key={char}
                className="emoji-key"
                onClick={() => insert(char)}
                title={emojiLabel(char)}
                aria-label={emojiLabel(char)}
              >
                <ClassicEmoji char={char} size={26} />
              </button>
            ))}
          </div>
        </div>
      )}
    </Portal>
  );
}
