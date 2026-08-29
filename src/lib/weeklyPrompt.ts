import { MEDIA_LABELS, type MediaType } from "@/lib/media";

/**
 * One question a week, for everybody.
 *
 * A review site with thirteen members has a structural problem: the feed
 * is only busy if people happen to post, and nothing ever asks them to.
 * Clubs need someone to start one, the guestbook needs someone to visit,
 * DMs need someone to write first. Every social thing here is waiting on
 * somebody else to move.
 *
 * This one moves on its own. There is a question every week, it is the
 * same question for everyone, and all the answers sit on one page - so
 * a member who opens the site on a Tuesday has something to do and
 * something new to read, without anyone having organised it.
 *
 * Deliberately not stored in a table an admin has to fill in. The week
 * picks the prompt out of this list arithmetically, so it rotates for
 * ever with nobody running anything, and the same week shows the same
 * question to everyone, on any device, without a scheduled job.
 */

export type Prompt = {
  id: string;
  /** What is being asked. */
  question: string;
  /** The category it belongs to, so the rotation stays balanced. */
  mediaType: MediaType;
  /** What the answer field is asking for. */
  placeholder: string;
  /** The label above the second field, when the answer wants one. */
  subtitleLabel: string | null;
};

export const PROMPTS: Prompt[] = [
  // --- Music
  { id: "defend", question: "An album you would defend to the death", mediaType: "music", placeholder: "Album", subtitleLabel: "Artist" },
  { id: "first-song", question: "The song that got you into your favourite artist", mediaType: "music", placeholder: "Song", subtitleLabel: "Artist" },
  { id: "loud", question: "Best song to play far too loud", mediaType: "music", placeholder: "Song", subtitleLabel: "Artist" },
  { id: "cry", question: "A song that has made you cry in public", mediaType: "music", placeholder: "Song", subtitleLabel: "Artist" },
  { id: "skip", question: "A beloved album you have never got through", mediaType: "music", placeholder: "Album", subtitleLabel: "Artist" },
  { id: "one-song", question: "One song to explain your whole taste", mediaType: "music", placeholder: "Song", subtitleLabel: "Artist" },
  { id: "cover", question: "A cover better than the original", mediaType: "music", placeholder: "Song", subtitleLabel: "Covered by" },
  { id: "night-drive", question: "The album for driving at night", mediaType: "music", placeholder: "Album", subtitleLabel: "Artist" },

  // --- Film and TV
  { id: "rewatch", question: "The film you have rewatched the most", mediaType: "movie_tv", placeholder: "Film", subtitleLabel: "Director" },
  { id: "ruined", question: "A film that ruined a whole genre for you", mediaType: "movie_tv", placeholder: "Film", subtitleLabel: "Director" },
  { id: "ending", question: "The ending you are still not over", mediaType: "movie_tv", placeholder: "Film or show", subtitleLabel: "Made by" },
  { id: "wrong", question: "Something everyone is wrong about", mediaType: "movie_tv", placeholder: "Film or show", subtitleLabel: "Made by" },
  { id: "three-am", question: "What you put on at three in the morning", mediaType: "movie_tv", placeholder: "Film or show", subtitleLabel: "Made by" },
  { id: "opening", question: "The best opening scene there is", mediaType: "movie_tv", placeholder: "Film or show", subtitleLabel: "Made by" },
  { id: "one-season", question: "A show that should have stopped at one season", mediaType: "movie_tv", placeholder: "Show", subtitleLabel: "Made by" },
  { id: "soundtrack", question: "A soundtrack better than its film", mediaType: "movie_tv", placeholder: "Film", subtitleLabel: "Composer or artist" },

  // --- Photography
  { id: "own-shot", question: "The best photo you have taken this month", mediaType: "photography", placeholder: "What it is of", subtitleLabel: null },
  { id: "photographer", question: "A photographer everyone should know", mediaType: "photography", placeholder: "Photographer", subtitleLabel: "Known for" },
  { id: "one-image", question: "An image you cannot stop thinking about", mediaType: "photography", placeholder: "The photo", subtitleLabel: "Taken by" },
  { id: "colour", question: "A photo that uses colour perfectly", mediaType: "photography", placeholder: "The photo", subtitleLabel: "Taken by" },
];

/**
 * The Monday of the week a date falls in, as YYYY-MM-DD in UTC.
 *
 * UTC throughout rather than local time: the week has to start at the
 * same instant for everyone, or two members in different timezones get
 * different questions on the same evening and their answers land in
 * different weeks.
 */
export function weekStart(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // getUTCDay is 0 for Sunday, so Sunday counts back six days rather than
  // starting a new week - otherwise Sunday is a one-day week of its own.
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

/** How many whole weeks since the Monday the prompts started. */
function weekIndex(weekStartDate: string): number {
  const epoch = Date.UTC(2024, 0, 1); // A Monday.
  const start = Date.parse(`${weekStartDate}T00:00:00Z`);
  return Math.floor((start - epoch) / (7 * 24 * 60 * 60 * 1000));
}

/**
 * The prompt for a given week.
 *
 * Strided rather than taken in order, so consecutive weeks are different
 * categories: eight music prompts in a row would read as a music site
 * that occasionally remembers film. The stride is coprime with the list
 * length, which is what makes it visit every prompt before repeating any.
 */
export function promptForWeek(weekStartDate: string): Prompt {
  const index = weekIndex(weekStartDate);
  const stride = 7;
  return PROMPTS[(((index * stride) % PROMPTS.length) + PROMPTS.length) % PROMPTS.length];
}

export function currentPrompt(now?: Date): { prompt: Prompt; week: string } {
  const week = weekStart(now);
  return { prompt: promptForWeek(week), week };
}

/** The previous N weeks, most recent first, not including this one. */
export function pastWeeks(count: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  const start = new Date(`${weekStart(now)}T00:00:00Z`);
  for (let i = 1; i <= count; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() - 7 * i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function promptCategory(prompt: Prompt): string {
  return MEDIA_LABELS[prompt.mediaType];
}

/** "5 - 11 May" for a week starting on that Monday. */
export function weekLabel(weekStartDate: string): string {
  const start = new Date(`${weekStartDate}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (d: Date, withMonth: boolean) =>
    d.toLocaleDateString("en-GB", {
      day: "numeric",
      ...(withMonth ? { month: "short" } : {}),
      timeZone: "UTC",
    });
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  return `${fmt(start, !sameMonth)} – ${fmt(end, true)}`;
}

export const MAX_ANSWER_NOTE = 280;
