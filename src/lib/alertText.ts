import type { NotificationType } from "@/lib/notifications";

// The wording for one alert, shared by the nav dropdown and the alerts
// page. Two copies of this drifted the moment a new alert type shipped -
// the dropdown knew about it and the page said "undefined".
//
// The type list is imported rather than repeated for the same reason.
// Restating the union here meant adding an alert type failed to compile
// in a file that had nothing to do with it, and the fix was to paste the
// new member into a second list - which is the drift this file exists to
// prevent, one level up. Now the switch below is exhaustive by
// construction: a new NotificationType is a compile error here until it
// has words.

export type AlertItem = {
  id: string;
  type: NotificationType;
  actorUsername: string;
  actorAvatarUrl: string | null;
  postId: string | null;
  postTitle: string | null;
  subject: string | null;
  emoji: string | null;
  createdAt: string;
};

export function describeAlert(item: AlertItem): string {
  switch (item.type) {
    case "like":
      return item.postTitle ? `liked your review "${item.postTitle}"` : "liked your review";
    case "comment":
      return item.postTitle
        ? `commented on your review "${item.postTitle}"`
        : "commented on your review";
    case "reply":
      return "replied to your comment";
    case "view":
      return "looked at your profile";
    case "reaction":
      return item.subject
        ? `reacted ${item.emoji ?? ""} to your pick "${item.subject}"`.trim()
        : "reacted to one of your picks";
    case "twin":
      return item.subject ? `is your taste twin - ${item.subject} match` : "is your taste twin";
    case "duet":
      return item.postTitle
        ? `answered your review of "${item.postTitle}" with their own`
        : "answered your review with their own";
    case "follow":
      return "started following you";
  }
}
