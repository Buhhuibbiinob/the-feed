# Where things are

A map of this codebase, written so you can open a file, change one line,
and know what will happen. Line numbers drift as the code changes — the
names next to them don't, so search for the name if the number is stale.

Run `npm run lint` after any change. It is 570+ checks and it is fast,
and it is how you find out you broke something before your members do.

---

## The things you change most

### Add an artist to a genre shelf

**`src/lib/lastfm.ts` → `SCENE_ROSTER`** (~line 385)

A map of genre slug → artist names. An artist here goes to the **front**
of that genre's shelf, ahead of anything Last.fm suggests.

```ts
"uk-rnb": ["KWN", "Sasha Keable", ...],
```

Add a name to a list and they are on that shelf. That is the whole
change. A name can be under several genres — most artists are.

The genre slug has to be a real one or the artist is filed under a shelf
that doesn't exist. `npm run lint` checks this and tells you which slug
is wrong.

### An artist whose genre you don't know

**`src/lib/lastfm.ts` → `ROSTER_UNPLACED`** (~line 483)

Names that belong on the site but whose scene nobody can name. Instead
of guessing, the shelf asks Last.fm what tags people have put on them
and files them accordingly. If nobody has tagged them, they keep
whatever broad placement they have in `SCENE_ROSTER`.

When you find out what somebody actually makes: take them out of here,
put them in `SCENE_ROSTER` under the right genre.

### Add a genre

**`src/lib/genres.ts`** — the list of every genre, grouped by family.

If the genre's name on Last.fm differs from your slug, add a line to
**`src/lib/lastfm.ts` → `TAG_TEXT`** (~line 222). This matters more than
it looks: `uk-rnb` returns nothing on Last.fm and `uk r&b` returns the
scene, so without the mapping that shelf comes back empty.

### Change how a shelf behaves

All in **`src/lib/shelves.ts`** — search for the name:

| What | Name | Now |
|---|---|---|
| Records on a shelf | `SHELF_SIZE` | 50 |
| Spares held back for dead records | `SHELF_SPARE` | 40 |
| Most places your roster may take | `ROSTER_SHARE` | a third |
| Listeners above which a song is "a hit" | `HIT_CEILING` | 120,000 |
| Artists examined per shelf | `ARTISTS_CHECKED` | 90 |
| Listeners under which "untagged" is believable | `STILL_UNKNOWN` | 50,000 |

Two records per artist is set in the loop in `sceneShelfFromArtists`
(search for `taken >= 2`).

### Change which shelves exist

**`src/lib/shelfAxes.ts`** — the dividers you walk along: which axes
exist, the list of places, the decades, the film categories, and what a
shelf is called once you pick one. Nearly all data, no network.

`FIRST_YEAR` (1960) is the earliest year the Year axis offers.

### Your YouTube allowance

**`src/lib/youtubeBudget.ts`**

- `DAILY_UNITS` (~35) — 10,000, what Google gives you per day.
- `BACKGROUND_SHARE` (~45) — 0.7. Shelves may spend 70%; the last 30% is
  held back for people pressing buttons. This is why a heavy day gives
  you stale shelves instead of dead play buttons.

A search costs 100 units. Embedding a video costs nothing.

---

## How a genre shelf gets filled

Worth knowing before you change any of the above, because most "wrong
record on a shelf" problems are one of these steps.

1. **Your roster first** (`SCENE_ROSTER`), up to `ROSTER_SHARE` of the
   shelf. Rotated, so a different few lead each visit.
2. **Artists Last.fm says are that genre** — two pages, ~200 names,
   least famous first. Each is checked against *their own* tags, so one
   stray tag doesn't put three wrong records on a shelf.
3. **YouTube**, only for scenes Last.fm doesn't know (dariacore,
   sigilkore). Costs budget; everything else above is free.
4. **Your members' own posts**, which can't fail or run out.

Each artist gives up to 2 records, skipping their biggest songs.

---

## The rest of the map

```
src/
  app/
    page.tsx            The feed. Filters, For You, Following.
    shelves/            Browse by genre / year / decade / place.
    profile/[username]/ Someone's profile.
      followers/        Who follows them.
      following/        Who they follow.
    post/new/           Writing a review.
    actions/            Everything that WRITES to the database.
    api/                Called by the browser, not by pages.
  components/           Everything visual.
    PostCard.tsx        One review in the feed.
    ShelfRecords.tsx    The records on a shelf.
    FollowButton.tsx    Follow, both sizes.
  lib/                  Logic with no markup in it.
    shelves.ts          How a shelf gets filled: where records come from.
    shelfAxes.ts        What the shelves are: axes, places, decades, names.
    lastfm.ts           Genre data. Your roster lives here.
    catalogue.ts        Cover art and clips: Apple, then Deezer.
    youtube.ts          Video search, and the budget that guards it.
    coverCache.ts       What's already been looked up, so nothing is paid for twice.
  app/globals.css       All the styling, one file.

supabase/
  schema.sql            Every table.
  migrations/           Changes to run by hand, in order.

scripts/                The checks. One file per area.
```

### Which outside service does what

| | Free? | Used for |
|---|---|---|
| **Last.fm** | yes, no real limit | which artists are which genre |
| **Deezer** | yes, generous | cover art and 30-second clips |
| **Apple / iTunes** | yes, ~20 calls a minute | cover art, clips, release years |
| **Spotify** | yes, needs keys | release years |
| **YouTube** | 10,000 units a day | playing a video |

Apple's 20-a-minute limit is behind most of this codebase's history. When
it refuses, it answers `403`, which reads exactly like "no such record" —
so a lot of the code is careful to tell those two apart.

---

## Changing the database

Migrations are numbered and run **by hand** in the Supabase SQL editor:
open `supabase/migrations/`, take the highest number, write the next one.

Every migration must be safe to run twice (`if not exists`,
`add column if not exists`) and the code must work *before* it's run —
look at how `artist_posts.genre` is handled if you want the pattern. A
member posting shouldn't fail because you haven't run a migration yet.

## Running it

```
npm run dev     # locally, on :3000
npm run lint    # the checks — run this before pushing
npm run build   # what Vercel runs
```

Pushing to `main` deploys.

## About the checks

They aren't unit tests. Each one states a thing that must stay true,
usually because it stopped being true once and somebody noticed.

If you change behaviour deliberately and a check fails, the check is now
wrong — update it to describe the new rule. If you can't say what rule
it should describe instead, that's a sign the change needs more thought.

One habit worth keeping: after writing a check, **break the thing on
purpose and confirm the check fails.** A check that passes whether or not
the code works is worse than no check, and this codebase has been caught
by that seven times.
