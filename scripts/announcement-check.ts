/**
 * Which announcement, if any, a person should be looking at.
 *
 * Worth pinning down because both ways of getting it wrong are bad in
 * public: an announcement that never appears is a message the admin
 * thinks 13 people have read and nobody has, and one that will not stay
 * closed is a modal standing between everybody and the site.
 *
 * The clock is fixed here, so "does it stop being news on Saturday" is a
 * test rather than something you find out on Saturday.
 *
 * Run: npx tsx scripts/announcement-check.ts
 */
import {
  buttonFor,
  isLive,
  pickAnnouncement,
  type Announcement,
} from "../src/lib/announcements";

const NOW = new Date("2026-08-31T12:00:00Z");
const hoursFromNow = (n: number) => new Date(NOW.getTime() + n * 3600 * 1000).toISOString();

function make(over: Partial<Announcement> = {}): Announcement {
  return {
    id: "a1",
    title: "Down for an hour tonight",
    body: "Back by 9.",
    style: "alert",
    button_label: null,
    link_url: null,
    active: true,
    starts_at: null,
    ends_at: null,
    created_at: hoursFromNow(-1),
    ...over,
  };
}

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

// ---- isLive: the window ----
check("no dates: live", isLive(make(), NOW));
check("switched off: not live", !isLive(make({ active: false }), NOW));
check("starts later today: not live yet", !isLive(make({ starts_at: hoursFromNow(3) }), NOW));
check("started an hour ago: live", isLive(make({ starts_at: hoursFromNow(-1) }), NOW));
check("ended an hour ago: not live", !isLive(make({ ends_at: hoursFromNow(-1) }), NOW));
check("ends in an hour: still live", isLive(make({ ends_at: hoursFromNow(1) }), NOW));
// Exclusive end, so one ending at midnight is gone AT midnight rather
// than hanging on for the last millisecond of the day.
check("ends exactly now: over", !isLive(make({ ends_at: NOW.toISOString() }), NOW));
check(
  "off beats a live window",
  !isLive(make({ active: false, starts_at: hoursFromNow(-5), ends_at: hoursFromNow(5) }), NOW)
);

// ---- pickAnnouncement: which one ----
check("nothing on the books: nothing shown", pickAnnouncement([], [], NOW) === null);
check(
  "the only live one wins",
  pickAnnouncement([make({ id: "x" })], [], NOW)?.id === "x"
);
check(
  "dismissed is not shown again",
  pickAnnouncement([make({ id: "x" })], ["x"], NOW) === null
);
check(
  "dismissing one does not hide the other",
  pickAnnouncement([make({ id: "x" }), make({ id: "y" })], ["x"], NOW)?.id === "y"
);
// One at a time: two stacked modals is not twice the message, it is a
// website that will not let you in.
check(
  "newest of two alerts wins",
  pickAnnouncement(
    [make({ id: "old", created_at: hoursFromNow(-48) }), make({ id: "new", created_at: hoursFromNow(-1) })],
    [],
    NOW
  )?.id === "new"
);
check(
  "an alert outranks a newer banner",
  pickAnnouncement(
    [
      make({ id: "alert", created_at: hoursFromNow(-48) }),
      make({ id: "banner", style: "banner", created_at: hoursFromNow(-1) }),
    ],
    [],
    NOW
  )?.id === "alert"
);
check(
  "a banner shows when the alert has been closed",
  pickAnnouncement(
    [make({ id: "alert" }), make({ id: "banner", style: "banner" })],
    ["alert"],
    NOW
  )?.id === "banner"
);
check(
  "a switched-off one is skipped for a live one",
  pickAnnouncement(
    [make({ id: "off", active: false, created_at: hoursFromNow(-1) }), make({ id: "on", created_at: hoursFromNow(-2) })],
    [],
    NOW
  )?.id === "on"
);
check(
  "a scheduled one waits its turn",
  pickAnnouncement([make({ id: "later", starts_at: hoursFromNow(6) })], [], NOW) === null
);

// ---- buttonFor: no button without somewhere to go ----
check("no url: no button", buttonFor(make()) === null);
check("blank url: no button", buttonFor(make({ link_url: "   " })) === null);
check(
  "label with no url is ignored",
  buttonFor(make({ button_label: "Go on then" })) === null
);
check(
  "url with no label gets a sensible one",
  buttonFor(make({ link_url: "/post/new" }))?.label === "Take a look"
);
check(
  "url and label travel together",
  buttonFor(make({ link_url: "/post/new", button_label: "Write one" }))?.label === "Write one"
);

if (failures > 0) {
  console.error(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nThe right announcement shows, once, and stays closed.");
