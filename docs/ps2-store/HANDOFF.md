# Handoff: PS2-style 3D record store + bedroom for the Myler Feed app

Paste this whole file into Claude Code at the root of the Myler Feed repository.

## 0. Ground rules (read first)

- You are **extending the existing app**, not starting a new one. The previous feed UI is being replaced by this experience, but the app's accounts, database, API integrations and deployment stay as they are.
- **Inspect before you write.** The author of this brief (a Claude chat session) has NOT seen this repo. Everything about the repo below is an assumption to verify. Do not trust the "Existing app" section; replace it with what you find.
- **Secrets:** never print, log, hardcode, commit or echo API keys, tokens or `.env` contents. Read env var *names* only. All third-party calls that need a key go through server code. Never expose a key to the browser bundle (no `NEXT_PUBLIC_`/`VITE_`-style prefix for secrets). If a key is already in git history, tell the user; do not copy it anywhere.
- Add new env vars only as names in `.env.example` (no values). Confirm `.env*` is gitignored before you finish.
- Work on a branch. Do not touch auth, session handling, DB connection code or existing API clients except to reuse them. Run the existing tests/lint/build before and after.
- Keep the old feed reachable behind a flag or route until the user approves removal.

## 1. Step 1: discover the repo (write findings to `docs/ps2-store/DISCOVERY.md`)

Answer each of these from the code, with file paths:

1. Framework, language, package manager, build and test commands, deploy target.
2. Auth: provider, how the server identifies the current user, how routes are protected.
3. Database + ORM, existing tables/models for users, albums/movies, reviews, collections, likes/follows.
4. Existing third-party integrations (names only): which music, movie, artwork or preview APIs are already wired in, where the client code lives, and which env var NAMES they use. List which are server-side vs exposed to the browser.
5. Existing review model: fields, rating scale, one-per-user rules, moderation, how they are listed in the old feed.
6. Whether any media (audio/images) is proxied or cached already, and the CSP / image-domain config (for example `next.config` image domains, security headers).
7. Whether a 3D or canvas dependency (three.js etc.) is already present.

Stop and ask the user if auth or DB are missing or unclear. Do not invent them.

## 2. Product vision (what the user asked for)

A fully interactive, game-like 3D experience in the style of PlayStation 2-era games, replacing the feed:

**Flow:** browse the 3D store → pick up albums / DVD cases → preview music or read movie info → put up to five items in the crate → check out with the cashier → "Almost home..." loading screen → PS2-style bedroom → play the media on matching devices → write a review on virtual paper → it appears on the public community board.

Important: the user said "don't make this look like a modern site with a retro filter." Priorities in their words: accurate DVD covers, recognizable packaging, authentic PS2 visuals, the five-item daily limit, paper-based reviews, a working public scoreboard.

### 2.1 Visual direction
- Reference photo: `IMG_0058.jpg` (user supplied; a Japanese record-shop wall of CDs with plastic wrap, yellow obi strips, blue "DISC n" shelf labels, a cyan selection frame around "DISC 2", a blue arrow above it, and a large cut-out hand reaching in from the lower right). Ask the user for the file if it is not in the repo.
- Warm, golden spotlights on shelves; soft pools of light with dark between them; cozy, slightly moody; no flat or cold lighting. Not photoreal.
- PS2 feel: low-poly handcrafted models, nearest-neighbour/compressed textures, vertex lighting (Lambert) on subdivided walls/floors so light pools show, fog, low internal resolution (about 230–300 px tall) upscaled with pixelated filtering, ordered dither + 5-bit colour quantisation post pass, faint scanlines, vignette, blob shadows instead of real shadows.
- Retro UI: translucent blue "memory-card" panels, bevelled borders, controller-style hint bar, cursor arrow menus, blue shelf labels (`DISC 1`, `LP 1`, `TAPE 1`, `DVD 1`).
- Selection indicator (required): a pulsing cyan square frame around the highlighted object plus a bobbing blue arrow above it.
- Fonts used in the prototype: Chakra Petch (UI), Share Tech Mono (labels), Caveat (handwriting on paper).

### 2.2 Store (single long wall, camera "stations")
Sections left to right: Import CDs (4×3), Vinyl Wall (4×2 face-out sleeves with a lip), Listening Post (record player, CD deck, cassette deck, CRT TV + DVD player), Tapes & Mixtapes (5×2), DVD Wall (5×2), Checkout counter. Camera glides between stations (L1/R1 or Q/E, tabs, arrow keys at the edges). Signs, plants, clock, posters, track-lighting cones.

Media models (all must be real 3D, correct proportions):
- CD jewel case 14.2×12.5×1.2 cm with cellophane shine and a yellow obi strip.
- Vinyl sleeve 31 cm with a disc inside.
- Cassette in a clear case with visible reels.
- DVD Amaray case 13.5×19×1.5 cm: front cover, spine with title, hinge line, "DVD-VIDEO" strip, early-2000s packaging.

### 2.3 Interactions
- Move the cursor with arrows/WASD, mouse hover, or touch; Enter/click picks up.
- **Pick up:** PNG hand sprite reaches (open pose), grabs (grab pose), item lifts off the shelf and comes to a hold position near the camera. Drag or arrow keys rotate it; Space flips it.
- Info panel (PS2 menu): format chip, title, artist/director, year, genre, blurb, average rating from the community, and actions: Listen/Watch preview, Put in crate, Reviews, Flip, Return to shelf.
- **Physical preview (required, fully animated):** the hand carries the item to the Listening Post. Vinyl: disc slides out of the sleeve, goes on the turntable, platter spins, tonearm swings in, preview plays. CD/DVD: tray slides out, disc is placed, tray closes. Cassette: door opens, tape goes in, reels turn. Stop → the hand picks the media up and returns it to the case; the user can then return it to the shelf or put it in the crate.
- DVD "preview" = the CRT shows a title-menu screen with the cover, then playback with a progress bar (trailer if a licensed source exists; otherwise synopsis/metadata).
- **Crate:** a physical wooden crate drawn at the bottom-left of the screen that rides on the camera. Items visibly stand in it. Panel: open crate, remove, preview again, continue browsing, checkout.
- **Checkout:** counter scene, cashier PNG cut-out (photographic, stock-photo look, facing the player), idle motion and blinking, mouth animation while speaking. Dialogue box: "Are you sure these are all the items you want?" → choices "Yes, check out." / "No, take me back." Yes → "Okay. Come back soon!" then loading.
- Cashier voice: human-sounding speech with a lo-fi/bit-crushed treatment. Note the Web Speech API cannot be routed through WebAudio, so it cannot be bit-crushed. Recommended: pre-record the two lines (or generate them with a TTS service server-side), process them with a bitcrusher offline, ship them as static audio, and drive mouth frames from the audio amplitude. The prototype uses speechSynthesis plus a noisy lo-fi layer as a stand-in.
- **Loading screen:** "Almost home..." with a segmented progress bar, drifting translucent pillars/particles on a blue gradient, retro tip line.
- **Bedroom:** player starts on the bed. Camera stations: Bed, Collection Shelf (owned items), Hi-Fi dresser (turntable + cassette deck), TV & DVD, Desk (notebook + CD player), Community Board. Selecting an owned item makes the hand carry it to the matching device (vinyl → turntable, CD → CD deck, tape/mixtape → cassette deck, DVD → DVD player + TV). The TV shows a visualiser for music and a DVD menu/playback screen for movies.
- **Review on paper:** selecting the notebook opens a ruled-paper UI (handwriting font) with a list of owned items, 1–5 stars, a text area, and Submit; the sheet folds and flies off, and the review lands on the board. Writing must stay easy to read and use (keyboard, mobile).
- **Community board:** a corkboard/leaderboard overlay with pinned note cards: reviewer handle, item title, correct cover art, rating, review text, date. Filters (All/Music/Movies), sort (Newest/Top), click for details. Also reachable from the store HUD, and a per-item "Reviews" action.

### 2.4 Rules
- **Five items per day across music and movies combined**, and the UI must show how many are left (pips + text).
- The limit must be **enforced by the server**, not just displayed (see section 5).
- Accuracy: every item shows the correct artwork and title. No AI-generated or distorted text on covers. Real metadata and artwork come from the app's existing providers or from providers approved by the user.

## 3. What exists today vs what is missing (honest status)

The previous chat produced a **standalone prototype that is NOT connected to Myler Feed**. It was never run end to end, never published, and has no connection to this repo, its database or its APIs. Its files are in `prototype/` (if the user attached them). Treat it as reference code and design spec, not as working software.

| Area | Status |
|---|---|
| Hand PNG sprites (reach / open / grab) | **Done.** Cut from the user's reference photo and warped; ~300 px wide each. Verified visually only. Pose change is a soft finger bend, so a grab-with-object frame may still be needed. |
| HUD/overlay HTML + CSS (menus, crate panel, dialog, loader, board, notebook) | **Written, untested.** `a_head.html` |
| Catalog of 40 real titles with metadata (placeholder data) | **Written.** Replace with the app's real catalog. Blurbs are short placeholder text. |
| Typographic placeholder covers | **Written, placeholder only.** These are NOT real cover art. Real art must come from your APIs. |
| Audio engine: UI sfx, WebAudio synth previews per item, vinyl crackle / tape hiss | **Written, untested.** The synth previews are original loops, **not the actual songs**. Replace with real 30 s preview clips. |
| Cashier speech + mouth sync | **Partial.** Uses speechSynthesis; real bit-crushed audio still needed. |
| Persistence adapter (reviews, per-day limit, owned items) | **Written against a sandbox-only DB; must be rewritten against your backend** (section 5). The prototype's limit check is client-side logic and is not tamper-proof. |
| three.js renderer, low-res post pass, textures, shelves, item models, turntable/CD/tape/DVD/CRT models, store scene, bedroom scene, crate, selection ring, cashier sprite | **Written, never rendered or looked at.** `c1_gfx.js`, `c2_world.js`. Expect bugs (UV orientation on box faces, camera framing, sizes). |
| **Game logic**: input, cursor navigation, state machine, hand tweening, pick-up/preview/crate/checkout/bedroom sequences, overlays, board, notebook, loading screen | **Not written.** |
| Server API, DB schema/migrations, auth integration, rate limiting, moderation | **Not started.** |
| Real artwork + real audio previews + movie data from the app's providers | **Not started.** |
| Tests, accessibility pass, mobile pass, performance pass | **Not started.** |

## 4. APIs: how to decide what to use (verify, do not assume)

I cannot see which integrations the app already has. In `DISCOVERY.md`, map each need to an **existing** integration first. Only propose a new provider if nothing fits, and ask the user before adding one.

| Need | Look for first | Candidates to evaluate if missing (check current terms/limits; these change) |
|---|---|---|
| Album metadata + cover art | existing music API client | MusicBrainz + Cover Art Archive, Spotify Web API, Apple iTunes Search API, Deezer API, Discogs |
| 30-second music previews | existing preview URLs in stored data | iTunes Search API `previewUrl`; Deezer `preview`; note Spotify has restricted `preview_url` for newer apps, so verify before relying on it |
| Movie metadata + posters | existing movie/TV client | TMDB (image attribution and terms apply), OMDb |
| DVD-style cover | the movie poster, re-wrapped as a DVD case texture | no official "DVD cover" API is assumed; confirm with the user that posters are acceptable |
| Trailers | existing integration | usually not licensed for in-page playback; fall back to synopsis |
| Users, collections, reviews | the app's own DB/auth | extend existing models |

Rules for artwork and audio in the 3D scene:
- Textures must come from same-origin or CORS-enabled URLs. Prefer a server route that fetches, validates and caches provider art (`/api/art/[type]/[id]`) so that WebGL can use it without taint errors and so keys stay on the server. Respect provider caching/attribution terms.
- Downscale artwork for the PS2 look (about 128–256 px) but keep text legible. Keep the original for the detail view.
- Audio previews: stream through a server proxy or use provider URLs allowed by CSP; update CSP (`img-src`, `media-src`, `connect-src`) explicitly rather than loosening it globally.
- If an item lacks art or a preview, show a clear fallback state; never fabricate art.

## 5. Backend design (adapt to the repo's ORM and conventions)

Propose these as new tables/models, matched to existing naming and types. Write migrations in the project's own migration tool.

- `catalog_item` (or reuse the existing album/movie tables): id, kind (`cd|vinyl|cassette|mixtape|dvd`), external ids, title, artist/director, year, genre, blurb, art URL, preview URL. Format kind is a *presentation* attribute of the physical shop; decide whether it is stored per item or derived (for example, assign by a stable hash, or a curated "shop inventory" table).
- `shop_inventory`: which items are on which shelf/slot (so the store is data-driven, not hardcoded).
- `daily_checkout`: `user_id`, `day` (date), `count`, unique `(user_id, day)`.
- `checkout_item`: `user_id`, `item_id`, `day`, `created_at`, unique `(user_id, item_id)` if a user may only own an item once (confirm with the user).
- `collection`: derived from `checkout_item`, or reuse the existing collection/library table if one exists.
- `review`: reuse the existing one if present; ensure `user_id`, `item_id`, `rating` (1–5; confirm against the existing scale), `body`, `created_at`, `updated_at`; unique `(user_id, item_id)`.

Endpoints (use the repo's routing style; all require the existing auth except the public GET):
- `GET /api/shop/inventory` → sections + items with art/preview URLs; plus the caller's owned ids and remaining count today.
- `GET /api/shop/status` → `{ usedToday, remaining, limit: 5 }`.
- `POST /api/shop/checkout` `{ itemIds: [] }` → in **one DB transaction**: lock/upsert the `daily_checkout` row, reject if `count + n > 5`, reject unknown/duplicate/already-owned ids, insert items, increment count. Return the new status. This is the real enforcement; the crate UI only mirrors it. Define "day" explicitly (user's timezone vs UTC) and ask the user which they want; store the zone setting if per-user.
- `POST /api/reviews` `{ itemId, rating, body }` → require auth, require that the user **owns** the item (ask the user to confirm this rule), validate length and rating, sanitise, rate-limit, upsert. `GET /api/reviews?kind=&sort=&cursor=&itemId=` is public (or follows the existing visibility rules). Escape on render; never `dangerouslySetInnerHTML`.
- Moderation: reuse any existing report/moderation flow; if none, flag as a follow-up and at least add a report endpoint and a soft-delete.
- Handle (username) shown on the board comes from the existing profile/username field, not from a new free-text field.

Security checklist: server-side validation of every input; no trust in client counts; per-user and per-IP rate limits on checkout and review posts; authorisation checks on every write; no secrets in client code, logs or error messages; CSRF handling consistent with the existing auth.

## 6. Frontend integration

- Mount the experience as a new route (for example `/shop`) inside the existing app shell; keep existing nav, auth gating and theming.
- Isolate it as a client-only module (dynamic import, no SSR). Use three.js (prototype targets r128 UMD; use the npm `three` package at a current stable version with the repo's bundler and port the few legacy APIs, such as the `outputEncoding` and geometry usage).
- Suggested structure (adapt): `renderer/` (low-res target + post pass), `textures/` (procedural textures), `models/` (item, shelf, devices, crate, cashier), `worlds/` (store, bedroom), `ui/` (HUD, panels, board, notebook, loader), `audio/` (sfx, preview player, cashier voice), `state/` (state machine), `api/` (typed client for the endpoints above).
- State machine: `browse → reaching → inspect → (previewing | crating | returning) → browse`; `counter → dialog → confirm → loading → room`; `room: browse → carrying → playing → browse`; overlays: board, notebook.
- Accessibility and usability: every 3D action also available by keyboard and pointer; visible focus; a "classic list" fallback (button in the HUD) for people who cannot or do not want to use the 3D scene; `prefers-reduced-motion` shortens animations; captions for cashier dialogue; mute control; audio starts only after a user gesture.
- Performance: render at low internal resolution, cap frame rate on mobile, share textures/geometries, dispose on route exit, pause rendering when the tab is hidden, lazy-load the bedroom scene.
- Mobile: portrait layout moves the info panel to the bottom, shrinks the crate, hides the hint bar.

## 7. Hand and cashier assets

- Hand: three PNG poses cut out of the user's reference photo (`hand_reach.png`, `hand_open.png`, `hand_grab.png`; ~300×295, transparent). Anchor for the pinch point is about (10%, 30%) of the image. Rendered as a 2D overlay above the 3D canvas, following projected positions of the held item. Needs extra frames: holding (with object occluding fingers), placing, releasing, rotating.
- Cashier: the prototype draws a painted stand-in. The user wants a **photographic stock-photo cut-out**; get a licensed photo from the user, cut it out (transparent PNG), and add 3 mouth-shape frames or a mouth overlay at a configurable point. Do not use a photo of a real person without clear rights.

## 8. Order of work

1. Discovery (section 1), then a short plan posted to the user for approval (which APIs, schema, route, flag).
2. Backend first: schema, status/inventory/checkout/reviews endpoints with tests (including concurrency tests for the five-item limit and an "already owned" test).
3. Data plumbing: art proxy/cache, preview URLs, CSP.
4. Port renderer + models; get the store looking right against the reference photo (screenshot comparisons).
5. Port interactions and the full preview sequence; then crate/checkout/cashier.
6. Loading screen + bedroom + device playback.
7. Notebook + board wired to the real API.
8. Accessibility, mobile, performance, tests, cleanup; remove the standalone prototype's fake persistence.

## 9. Definition of done

- Existing features, auth, DB connections and integrations still work; existing tests pass.
- No secrets in git or in the client bundle; `.env.example` updated with names only.
- Five-item limit enforced server-side under concurrent requests.
- Reviews persist for all users and appear on the board with correct artwork.
- Every shelf item shows the correct title and artwork from real data; previews play real audio.
- The experience works with keyboard, mouse and touch, and has a non-3D fallback.
- A short `docs/ps2-store/README.md` describes routes, env var names (no values), and how to add inventory.

## 10. Questions to ask the user before building

1. Day boundary for the limit: UTC or the user's local time?
2. Can a user own the same item twice? Can a user review without owning it?
3. Which providers are approved for artwork and previews if the app has none?
4. Is a poster acceptable as the DVD cover, or is there a specific DVD-art source?
5. Who curates the shop inventory, and should it rotate?
6. Keep or remove the old feed after launch?
7. Do they have a licensed cashier photo and a voice recording?
