// What to show somebody the second after they post a review.
//
// This used to be nothing at all. The action returned ok, the form blanked
// its own fields, and that was the entire reward for posting - from the
// compose sheet it was worse, because the sheet stayed open over a blank
// form and the way out was a button marked Cancel.
//
// It matters more than a confirmation usually would, because of what the
// numbers say: the people who fill in a profile become the people who
// review five, nine, eleven times, and the people who skip it post once
// and leave. Customizing was reachable only from the avatar menu, then a
// scroll - never mentioned in the welcome modal, the welcome email, or
// anywhere near the review flow. So the one thing that predicts sticking
// around was never offered at the one moment somebody is plainly engaged.
//
// One step, not a checklist. A list of five things to do next is a chore;
// one thing is an invitation, and it can be the right one for this person
// because we know what they have and haven't done.

export type NextStepKind = "avatar" | "banner" | "club" | "profile";

export type NextStep = {
  kind: NextStepKind;
  /** The pitch. Why this is worth doing, in the member's terms. */
  text: string;
  cta: string;
  href: string;
};

export type AfterPostFacts = {
  username: string;
  hasAvatar: boolean;
  hasBanner: boolean;
  /** Their review count including this one. */
  reviewCount: number;
  /** The club this review belongs to, if it has one. */
  club: { id: string; name: string } | null;
  /** Whether this review is what started that club. */
  foundedClub: boolean;
};

/** Where the profile editor lives, as a link. */
function customizeHref(username: string): string {
  return `/profile/${encodeURIComponent(username)}#customize`;
}

/**
 * The single next step, in priority order.
 *
 * A face first, because an avatar is the cheapest edit on the site and
 * the one that makes a name in the feed look like a person. Then the
 * banner, which is the other half of the same job. Only once the page is
 * actually theirs does the club win - it's a nice thing to be told, but
 * being told it doesn't make anybody come back tomorrow.
 */
export function chooseNextStep(facts: AfterPostFacts): NextStep {
  if (!facts.hasAvatar) {
    return {
      kind: "avatar",
      text:
        facts.reviewCount === 1
          ? "That's your first one. Your name in the feed is still a blank circle though - give people a face to put to it."
          : "Your name in the feed is still a blank circle. Give people a face to put to it.",
      cta: "Pick a picture",
      href: customizeHref(facts.username),
    };
  }

  if (!facts.hasBanner) {
    return {
      kind: "banner",
      text: "Your page has a face but no wallpaper. A banner takes about ten seconds and it's the bit people remember.",
      cta: "Add a banner",
      href: customizeHref(facts.username),
    };
  }

  if (facts.club) {
    return {
      kind: "club",
      text: facts.foundedClub
        ? `Nobody here had reviewed ${facts.club.name} before, so that club is yours. It goes public once it's approved.`
        : `${facts.club.name} already has a club here. See who else is in it.`,
      cta: facts.foundedClub ? "See your club" : "See the club",
      href: `/clubs/${facts.club.id}`,
    };
  }

  return {
    kind: "profile",
    text: "Your reviews all land on your page. Worth a look at what it says about you.",
    cta: "See your profile",
    href: `/profile/${encodeURIComponent(facts.username)}`,
  };
}
