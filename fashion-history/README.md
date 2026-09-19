# LastThread

A fashion history / make-culture site, built in the same format as the feed —
dated entries, channels, an archive, margins you can write in — and dressed in
the early-web fashion aesthetic of ELLE.com (2001), maryping.com and
maisonmartinmargiela.com's directory index.

Plain HTML and one stylesheet. No build step, no dependencies, nothing to
install. It does not touch the Next.js app in this repo.

It is deliberately low quality: bitmap type that never anti-aliases, a 1-bit
dither under the page, hard one-pixel borders, drop shadows with no blur, the
checkerboard a transparent GIF used to show through as, and a scanline over the
lot. That is the whole `LOW-QUALITY PASS` block at the foot of `style.css` —
delete it and the site goes back to being smooth. The pixel face is Silkscreen,
loaded from Google Fonts; with no network it falls back to Courier and still
reads as a bitmap.

## Look at it

Open `fashion-history/index.html` in a browser. That's it. Or:

```bash
cd fashion-history && python3 -m http.server 8080   # http://localhost:8080
```

## The pages

| File | What it is | Borrowed from |
|---|---|---|
| `index.html` | the feed — channel rail, masthead, dated entries, side column | ELLE.com, June 2001 |
| `archive.html` | the whole index as an Apache directory listing | maisonmartinmargiela.com |
| `entry.html` | one entry, with numbered plates and captions, plus the margin | maryping.com lookbooks |
| `label.html` | **your clothing line** — shopfront, first run, workroom notes | — |
| `find-your-style.html` | upload a fit, tag the subgenre, get shops near you + a shopping list | — |
| `stores.html` | the whole shop directory, filtered by subgenre and region | — |
| `threadle.html` | the fashion word game — five letters, six guesses, one a day | — |
| `forum.html` | the boards (reading only for now) | — |
| `profile.html` | your picture, your subgenres, your fits | — |
| `submit.html` | file an entry or a correction | — |
| `style.css` | all of it, commented by section | — |
| `app.js` | the working parts — shop data, analyser, directory, threadle, profile | — |

## The working parts

All of it runs in your browser. Nothing is uploaded, because there is no server
yet; anything you save lives in that browser's localStorage only.

- **Find your style** — you upload a photo, it displays, and you tag the
  subgenre yourself. The matching, the store results, the distance sort and the
  shopping list are all real. *Automatic* detection of what is in the photo needs
  a server and an image model, so it is marked coming soon rather than faked.
- **Location** — real browser GPS, used once to sort by nearest city and never
  stored. It needs the site served over http/https; opened as a `file://` it
  will refuse, so there is a region dropdown that always works.
- **The shops** — real independent places: vintage floors, archive resale, small
  stockists, markets, and the online sources worth the postage. Listed by city,
  not street address, because hours and addresses change and cannot be verified
  from here. **Check a shop's own site before you travel.** They live in the
  `SHOPS` array at the top of `app.js` — add your own the same shape.
- **Subgenres** — the `SUBGENRES` array in `app.js`. Add one there and it appears
  in the analyser, the store filter and the profile picker at once.
- **Threadle** — the answer is derived from the date, so everyone gets the same
  word. Words are in `THREADLE_WORDS`.
- **Profile** — pictures are downscaled to 420px before saving, because
  full-size photos fill localStorage in about four uploads.

### Archived, not deleted

Friends / following / followers are written and ready on `profile.html`, sitting
inside an HTML comment. A social feature with nobody in it looks broken, so it is
switched off until there are accounts. Uncomment that block to bring it back.

### Coming soon, honestly labelled

Posting to the forum, accounts, and automatic photo analysis all need a backend.
They are marked coming soon on the pages rather than mocked up as working.

## Making it yours

1. **The label.** `label.html` — replace "Your label goes here", the four pieces
   and the workroom notes. That page is built to be the shopfront when there is
   something to sell.
2. **Images.** Every grey box is a placeholder with its intended filename in it.
   Make a `fashion-history/img/` folder and drop the files in with those names,
   then swap the `<div class="plate">` / `.shot` / `.cover` boxes for
   `<img src="img/…">`. Sizes are set in `style.css`.
3. **Wordmark and colour.** The top of `style.css` has the palette; the masthead
   name is in `index.html` under `.wordmark`. Keep colours flat and few — the
   look depends on them reading as quantised, not blended.
4. **Images.** Save them small and let the CSS blow them up: everything carries
   `image-rendering: pixelated`, so a 300px JPEG scaled to 600 looks intended
   rather than broken. A photo downsized to ~40% and posterised to 8 or 16
   colours will sit right in.
5. **Entries.** Copy an `<article class="entry">` block in `index.html` and edit
   it. Each one wants: era, channel, place, a claim in the headline, and sources.

## Not wired up yet

The search box, both email forms and the submit form are static — they don't post
anywhere. When you want them live, the two straightforward routes are a hosted
form service (one attribute change per form) or moving these pages into the
Next.js app in this repo so they can use its Supabase database and server
actions, the way the feed's composer does.
