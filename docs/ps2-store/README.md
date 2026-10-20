# The Record Store

A PS2-style 3D record shop that is becoming the homepage. You walk the
aisles, pick up CDs, LPs, tapes and DVDs, try them at the listening post,
fill a crate (five a day), check out with the cashier, and take them home
to a bedroom. There you play them on the matching machine and write a
review on paper, and it is pinned to the community board.

## Going live, in order

1. **Run the migration.** Paste `supabase/migrations/022-store.sql` into the
   Supabase SQL editor and run it. It only adds new tables and functions.
   Nothing existing is changed, and it is safe to run twice. Until it has
   run, admins see a note on the homepage and everyone else sees the feed
   as normal.
2. **Check `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel.** The bots already
   use it. The shop needs it to fill its catalogue.
3. **Fill the shelves.** Signed in as an admin, open
   `/api/store/restock` a few times. Each visit asks Apple about a dozen
   artists and films and reports what it added. The shop also restocks
   itself in the background every ten minutes while people browse.
4. **Try it.** As an admin, `/` is the store straight away.
5. **Start the countdown.** In the store, the panel at the top right has
   **Start 3-day countdown**. From then on, members see a PS2-style
   countdown above the feed. Exactly three days later (UTC) the store
   becomes the homepage for everybody, without a deploy. **Cancel
   countdown** puts things back.

## Routes

| Path | What |
|---|---|
| `/` | The store for admins (and for everybody after launch). Otherwise the feed, with the countdown once started |
| `/feed` | The feed, always. Old `/?filter=…` links redirect here after launch |
| `/api/store/art?u=&s=` | Catalogue artwork served from this site, so WebGL can use it. Apple's image CDN only |
| `/api/store/restock` | One round of restocking. Admin session, or `Authorization: Bearer $CRON_SECRET` |

## Environment variables

There are no new ones. The store uses `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (restock
only), plus `CRON_SECRET` if you want to call the restock route from a
script. Apple's Search API needs no key.

## The rules, and where they are enforced

All of these are enforced in the database (migration 022), because the
anon key is public and the functions can be called without the site:

- **Five a day**, music and films together. The day is the UTC date, and
  the count is taken under a per-person lock.
- **Nothing twice.** Owning something is permanent, and the crate and
  checkout both refuse an owned item. Two Apple editions of one album are
  one item.
- **Crate and collection are separate.** The crate (`store_crate`) is
  temporary and cleared at checkout or at UTC midnight. The collection
  (`store_owned`) is permanent and is what the bedroom shows.
- **Reviews from the bedroom require ownership**, through a foreign key.
  A bedroom review is also an ordinary review (a row in `posts`), so it
  shows in the feed and on the work's page. Deleting the post removes it
  from the board.
- **Admins only until launch.** Every write checks the launch time in
  `site_settings` (`store_launch_at`).
- **Members can't write the store tables directly.** Direct writes are
  revoked, and everything goes through the functions.

## Stock

- **Where it comes from.** The catalogue (`store_items`) is filled from
  Apple's iTunes Search API, which the site already uses for album art
  and previews. It covers films as well: poster, synopsis, director and
  trailer, all on one record.
- **What gets asked about.** The seeds are `src/lib/storeSeeds.ts`, the
  site's own artist rosters, and whatever members have recently reviewed.
- **Accurate artwork.** A film is stocked only when Apple has exactly one
  film with that title within a year of the seed's year. A remake, a
  sequel or a same-name film is refused, never guessed. An album is
  stocked only from the exact artist (Prince is not Prince Royce).
  `scripts/store-catalogue-check.ts` pins all of this.
- **Daily shelves.** Each UTC day the shelves (`store_stock`) are picked
  fresh from the catalogue. Whatever was out yesterday goes to the back
  of the queue, so the shop changes from day to day once the catalogue
  is big enough.
- **Format by year.** The format follows the year: pre-1979 is vinyl, the
  80s are tape, the 2000s are CD, and overlapping eras are split.
- **Removing an item.** If something on a shelf ever looks wrong, set its
  `active` to false in `store_items`. It leaves the shelves the next day,
  and nobody can add it to a crate from then on.
- **Credit.** The item panel credits Apple and links to the item's store
  page, as Apple's terms ask.

## The cashier

The scene uses a painted stand-in until there is a photograph the site is
licensed to use. To switch to a photo:

1. Buy the licence. A stock site's watermarked preview isn't licensed for
   a live site.
2. Run `python3 scripts/store-cashier.py path/to/photo.jpg`. It cuts the
   person out of a white studio background, crops them from head to
   waist, and writes `public/store/cashier.png`.
3. Commit the PNG. The scene picks it up on its own.

The defaults suit the standing, arms-crossed portrait chosen for the
cashier. For another photo, pass `--crop`, and set `MOUTH` in
`src/components/store/engine/worlds.ts`.

The voice is the browser's speech with tape hiss underneath. Browser
speech can't be bit-crushed, so for the real thing record the two lines,
crush them offline, and play them as audio files.

## Testing

```bash
npm run check:storedb         # the database rules, in a throwaway local Postgres
npm run check:storecatalogue  # matching, formats, access (also part of npm run lint)
```

`check:storedb` never touches Supabase. It starts a private Postgres,
loads `schema.sql`, every migration and a few Supabase stand-ins
(`supabase/test/`), and checks every rule above, including simultaneous
crate adds and checkouts. It needs the Postgres 16 server binaries
(`apt install postgresql-16`, or `brew install postgresql@16`).

## Code

| Where | What |
|---|---|
| `supabase/migrations/022-store.sql` | Tables and the functions that enforce the rules |
| `src/lib/store.ts` | Shared types, sections and error messages |
| `src/lib/storeCatalogue.ts`, `storeSeeds.ts` | Matching against Apple, and restocking |
| `src/lib/storeData.ts` | Reading shelves, crate, collection and the board |
| `src/lib/storeAccess.ts` | Who gets the store, and when |
| `src/app/actions/store.ts` | Crate, checkout, reviews, the countdown |
| `src/components/store/StoreExperience.tsx` | The HUD, menus, notebook, board and list view |
| `src/components/store/engine/` | three.js: renderer and models (`gfx`), the shop and bedroom (`worlds`), game logic (`engine`), sound (`audio`) |
| `src/app/page.tsx` | Which homepage each person gets |
| `docs/ps2-store/prototype/` | The original design prototype, kept for reference. Not built |

## Not done yet

- Models made in Blender. Everything is currently built in code at real
  proportions.
- A report button for bedroom reviews. Admins can already delete any
  review, which removes it from the board.
- A recorded, bit-crushed cashier voice, and a licensed cashier photo.
- Per-member rate limiting on review posts. The daily limit and the
  ownership rule bound how much one member can post.
