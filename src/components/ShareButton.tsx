"use client";

import { useState } from "react";

export function ShareButton({ postId, title }: { postId: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/post/${postId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user cancelled the native share sheet - not an error
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable - nothing more we can do
    }
  }

  return (
    <button type="button" className="comment-action share-btn" onClick={share}>
      {copied ? "Copied!" : "Share"}
    </button>
  );
}
