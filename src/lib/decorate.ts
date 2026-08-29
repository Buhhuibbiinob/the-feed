/**
 * One "decorating" flag, shared by the panel arranger and the sticker
 * layer.
 *
 * They each had their own toggle: "Rearrange panels" in one toolbar and
 * a sticker-editing button in another, plus nine separate links in the
 * Customize box. Three systems for one activity, and none of them told
 * you the others existed - so decorating a page meant discovering it in
 * pieces.
 *
 * Kept as a tiny external store rather than React context because the
 * two components are in different subtrees of a server-rendered page,
 * and threading a provider between them would mean turning parts of the
 * profile into client components purely to pass a boolean.
 */
const listeners = new Set<() => void>();
let decorating = false;

export function subscribeDecorate(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function isDecorating() {
  return decorating;
}

/** The server has no mode, so it always renders the page at rest. */
export function decorateServerSnapshot() {
  return false;
}

export function setDecorating(next: boolean) {
  if (decorating === next) return;
  decorating = next;
  for (const onChange of listeners) onChange();
}
