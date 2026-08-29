"use client";

import { Portal } from "@/components/Portal";

export function AlertModal({
  title,
  message,
  cancelLabel = "Cancel",
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  cancelLabel?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Through a portal: this is rendered from inside a post card, and a
  // backdrop that is meant to cover the window would otherwise be
  // trapped by the page wrapper's transform and cover only the article -
  // so a delete confirmation could appear well off screen.
  return (
    <Portal>
      <div className="alert-modal-backdrop" onClick={onCancel}>
      <div className="alert-modal" onClick={(e) => e.stopPropagation()}>
        <div className="alert-modal-title">{title}</div>
        <div className="alert-modal-message">{message}</div>
        <div className="alert-modal-actions">
          <button type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="destructive" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
        </div>
      </div>
    </Portal>
  );
}
