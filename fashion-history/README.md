# THE CUT ROOM

A fashion history / make-culture site, built in the same format as the feed —
dated entries, channels, an archive, margins you can write in — and dressed in
the early-web fashion aesthetic of ELLE.com (2001), maryping.com and
maisonmartinmargiela.com's directory index.

Plain HTML and one stylesheet. No build step, no dependencies, nothing to
install. It does not touch the Next.js app in this repo.

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
   name is in `index.html` under `.wordmark`.
4. **Entries.** Copy an `<article class="entry">` block in `index.html` and edit
   it. Each one wants: era, channel, place, a claim in the headline, and sources.

## Not wired up yet

The search box, both email forms and the submit form are static — they don't post
anywhere. When you want them live, the two straightforward routes are a hosted
form service (one attribute change per form) or moving these pages into the
Next.js app in this repo so they can use its Supabase database and server
actions, the way the feed's composer does.
