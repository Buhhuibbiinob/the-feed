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
| `submit.html` | file an entry or a correction | — |
| `style.css` | all of it, commented by section | — |

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
