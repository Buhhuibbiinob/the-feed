# PS2 store: discovery

Step 1 of `HANDOFF.md`, written from the repo as it stood at `3a85678`.
Nothing has been built yet. The questions at the end need answers first.

Assumption: "Myler Feed" in the handoff is this repo,
`Buhhuibbiinob/the-feed`. The site calls itself Feedback, at mythefeed.com.

## 1. Framework, build, deploy

- Next.js 16.2 (App Router, server components by default), React 19.2,
  TypeScript, npm (`package-lock.json`). `AGENTS.md`: read
  `node_modules/next/dist/docs/` before writing Next code.
- The middleware file is `src/proxy.ts`, the Next 16 name for it.
- `npm run lint` runs about 25 repo-specific `scripts/*-check.ts` files and
  then eslint. `npm run build` runs `next build`.
- No test framework. Tests are plain `npx tsx scripts/<name>-check.ts`
  scripts that print `ok`/`FAIL` and exit non-zero on failure.
- Deployed on Vercel (`vercel.json`: two crons, `/lastthread` rewrites). There
  is also an iOS wrapper built with Capacitor (`capacitor.config.ts`, `ios/`,
  `.github/workflows/ios-build.yml`). The 3D page has to work in its WKWebView.

## 2. Auth

- Supabase Auth via `@supabase/ssr`.
- Server: `createClient()` in `src/lib/supabase/server.ts` (cookie session),
  then `supabase.auth.getUser()`.
- Browser: `src/lib/supabase/client.ts`.
- Admin: `src/lib/supabase/admin.ts` (service role, server only) and
  `isAdmin()` in `src/lib/admin.ts` (`profiles.is_admin`).
- `src/proxy.ts` refreshes the session on every request and signs out banned
  users. It does not protect routes. Each page or action checks
  `getUser()` itself.
- Pages can be turned off: `guardBuiltinPage(supabase, slug)` in
  `src/lib/pages.ts` hides a built-in page from non-admins once it is
  archived in Admin. Nav entries come from `src/lib/builtinPages.ts`.
  This is the existing "flag" mechanism the new route should use.
- Writes are server actions in `src/app/actions/*.ts`, not API routes
  (README: "server actions instead of API routes for writes"). API routes
  in `src/app/api/` are mostly crons, OAuth and batch lookups.

## 3. Database

- Supabase Postgres with RLS on every table. The full schema is in
  `supabase/schema.sql`. Changes go in `supabase/migrations/NNN-*.sql`
  (last is `021`). **They are applied by hand** in the Supabase SQL editor,
  and must be safe to re-run.
- **There is no separate test database** (README). Local dev talks to the
  live one, which matters for the concurrency tests in handoff §8.2.
- Relevant tables:
  - `profiles`: `username` (unique, case-insensitive), `is_admin`, `banned`.
  - `posts`: **these are the reviews.** `user_id`, `media_type` enum
    (`music|movie|tv`), `title`, `artist`, `body`, `rating` 1–5,
    `cover_url`, `spotify_track_id`, `youtube_video_id`, `genre`, `work_id`,
    `club_id`, `pinned`, `created_at`. There is no one-per-user rule.
  - `works`: one row per album/film (`work_key` unique, built only in
    `src/lib/works.ts`), `media_type` `music|movie_tv|photography`, `title`,
    `artist`, `cover_url`. Reviews point at works through `posts.work_id`.
  - `collections` + `collection_posts`: user lists of *posts*, not of items.
  - `queue_items` ("Your Shelf", `/queue`): a private per-user list of
    things to get to, unique `(user_id, media_type, lower(title))`. This is
    the closest thing to "items I own".
  - `likes`, `follows`, `comments`, `post_reactions`.
  - `track_covers` (see `src/lib/coverCache.ts`, migration `015`): shared art/preview cache
    keyed by work key, written only with the service role.
- Nothing like `daily_checkout` or a shop inventory exists.

## 4. Third-party integrations (env var names only)

All are server-side unless marked.

| Provider | Code | Env vars | Used for |
|---|---|---|---|
| Supabase | `src/lib/supabase/*` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public by design), `SUPABASE_SERVICE_ROLE_KEY` (server) | everything |
| Apple iTunes Search | `src/lib/itunes.ts`, `src/lib/catalogue.ts` | none | album art + **30 s `previewUrl`**, about 20 calls/min |
| Deezer | `src/lib/deezer.ts` | none | fallback art + 30 s `preview` |
| Spotify | `src/lib/spotify.ts`, `src/app/api/spotify/*` | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | search, embeds, user OAuth |
| Last.fm | `src/lib/lastfm.ts` | `LASTFM_API_KEY` | tags, eras, what fills the crate and shelves |
| TMDB | `src/lib/tmdb.ts` | `TMDB_API_KEY` | movie/TV posters (`image.tmdb.org/t/p/w342`) |
| YouTube | `src/lib/youtube.ts`, `src/lib/trailers.ts`, `youtubeBudget.ts` | `YOUTUBE_API_KEY`, `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` | **trailers** for films, with a daily quota budget |
| Wikipedia | `src/lib/wikipedia.ts` | none | blurbs |
| Gemini | `src/lib/gemini.ts` | `GEMINI_API_KEY`, `GEMINI_MODEL` | |
| Resend | `src/lib/email.ts` | `RESEND_API_KEY`, `RESEND_FROM_*` | email |
| Crons | `src/app/api/*/run` | `CRON_SECRET` | |

The env template is `.env.local.example`, not `.env.example`. New names go
there. `.env*` is gitignored except `!.env*.example`. No `.env` file and no
key-shaped string appears anywhere in git history (checked by count only;
nothing was printed).

Every need in handoff §4 already has a provider here, so no new provider
is needed:

| Need | Existing source |
|---|---|
| Album metadata + art | iTunes → Deezer fallback, via `track_covers` and `/api/crate/sleeves` |
| 30 s previews | same (`previewUrl`). Already played in `Crate.tsx` with one shared `Audio` |
| Movie metadata + posters | TMDB |
| DVD cover | TMDB poster on a DVD-case texture (question 4) |
| Trailers | YouTube, already used by the crate and shelves |
| Users, reviews, collections | `profiles`, `posts`, `works`, `queue_items` |

## 5. Reviews today

- Created by `createPost` in `src/app/actions/posts.ts`. It runs
  `checkReviewSafety` (`src/lib/contentSafety.ts`), links or creates the
  `works` row, then does after-post logic (`src/lib/afterPost.ts`).
- Rating 1–5, optional. Several reviews of one thing per user are allowed.
- Moderation: admins can delete anything and ban users. There are report
  tables for chat, DMs, clubs and artist posts, **but not for posts**.
- The feed (`src/app/page.tsx`, the largest file) lists posts through
  `src/lib/postQuery.ts`, which degrades when a column is missing.
- `/work/[id]` already shows every review of one thing. That is the
  per-item "Reviews" action.

## 6. Media proxying, CSP, images

- No CSP and no security headers. `next.config.ts` only raises the server
  action body limit. `next/image` is not used: the eslint config turns its
  rule off on purpose, and images are plain `<img>`.
- Art is not proxied. URLs are cached, then loaded directly from Apple,
  Deezer and TMDB. WebGL needs the image hosts to send CORS headers.
  **To verify** (this container could not reach them) for `is1-ssl.mzstatic.com`, Deezer's CDN and
  `image.tmdb.org`, or add a same-origin `/api/art` proxy as the handoff
  suggests.
- Audio previews play from provider URLs through `<audio>`. They can't
  feed WebAudio analysers without CORS either. That matters only if the TV
  visualiser should react to the real audio.

## 7. 3D / canvas

No three.js or other 3D dependency. `three` would be new.

## 8. Things in the repo that overlap with the brief

The site already has a 2D version of most of this:

- `/crate` (`Crate.tsx`, `src/lib/crate.ts`): sleeves from Last.fm tags plus
  films from YouTube, flipped one at a time, with previews. "Take it" adds
  to Your Shelf.
- `/shelves`: genre/decade/place dividers. `RecordRack`, `DvdRack`,
  `FilmShelf`, `ShelfRecords` draw the physical objects.
- `src/lib/physicalMedia.ts`: `formatForYear()` picks vinyl, cassette or CD
  by release year, with `scripts/media-format-check.ts`. **This already
  answers the handoff's "which format is this item" question.**
- `ProfileStore.tsx` / `src/lib/profileStore.ts`: a per-member record-store
  page.
- `FeedTV.tsx`, `src/lib/tvEra.ts`: a CRT-style TV.

The 3D store should take its stock from these sources (`crateSources`, the
shelf builders) instead of a new hand-curated catalogue.

## 9. Proposed plan (for approval)

1. **Route:** `/store` as a new built-in page (`builtinPages.ts`), guarded by
   `guardBuiltinPage`, and **off by default** (added to
   `DEFAULT_ARCHIVED_SLUGS`) until you switch it on in Admin. `/` stays the
   feed. Replacing the homepage is a separate, later decision.
2. **Migration `022-store.sql`:**
   - `store_checkouts`: `user_id`, `day` date, `media_type`, `title`,
     `artist`, `cover_url`, `preview_url`, `work_id`, `format`,
     `created_at`. Unique `(user_id, media_type, lower(title))` if an item
     can be owned only once.
   - A `security definer` Postgres function `store_checkout(items jsonb)`
     that locks the caller's rows for the day, counts them, refuses past 5,
     and inserts, all in one transaction. supabase-js has no client
     transactions, so the limit has to live in SQL to be race-safe.
   - Members can read only their own rows. There is no direct insert
     policy: writes go only through the function.
3. **Writes:** server actions in `src/app/actions/store.ts` (`checkout`,
   plus the review submit), following the repo's convention instead of the
   handoff's REST routes. The notebook review **calls the existing
   `createPost`**, so a review from the bedroom is an ordinary review. It
   lands in the feed, on `/work/[id]` and on the board.
4. **Board:** reads `posts` with the existing query helpers. No new review
   table.
5. **Art:** reuse `/api/crate/sleeves` and `track_covers`. Add a small
   same-origin image proxy only if the CORS check in §6 fails.
6. **3D:** `three` as a client-only dynamic import under
   `src/components/store/`, ported from `prototype/`. The list view (§6 of
   the handoff) is the existing `/crate` and `/shelves` pages, linked
   from the HUD.
7. **Checks:** `scripts/store-limit-check.ts` for the pure rules (day key,
   validation). The concurrency test needs a database, and there is only
   the live one. See question 8.

## 10. Questions before building

1. **Day boundary** for the five-item limit: UTC, or the member's local
   time? The site has no per-user time zone. `NEWSLETTER_TIMEZONE` is the
   only zone setting.
2. **Owning and reviewing:** can somebody check out the same item twice?
   Must they own an item to review it from the bedroom? Ordinary reviews
   from the composer would stay open to everyone either way.
3. **Providers:** OK to use only what's already here (iTunes/Deezer art and
   previews, TMDB posters, YouTube trailers)?
4. **DVD covers:** is the TMDB poster on a DVD case acceptable?
5. **Stock:** take it from the existing crate/shelves sources, rotating
   like `/crate` does, or a fixed inventory curated in Admin?
6. **The feed:** add the store as a new page first and keep `/` as the
   feed (recommended), or make it the homepage straight away?
7. **Cashier:** do you have a photo you hold the rights to, and the two
   recorded lines?
8. **Testing the limit:** there is no test database. OK to create a free
   second Supabase project for the concurrency test, or test the SQL
   function locally only?
9. **Checked-out items and Your Shelf:** should a checked-out item also be
   added to Your Shelf (`queue_items`), or should "owned" stay separate?
