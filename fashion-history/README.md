# LastThread

A fashion history / make-culture site, built in the same format as the feed -
dated entries, channels, an archive, margins you can write in, and dressed in
the early-web fashion aesthetic of ELLE.com (2001), maryping.com and
maisonmartinmargiela.com's directory index.

Plain HTML and one stylesheet. No build step, no dependencies, nothing to
install. It does not touch the Next.js app in this repo.

The look is read off the three reference screenshots, closely.

- **ELLE.com, June 2001.** Grey channel bar and channel column (#e9e9e9), big
  navy Times wordmark with `.com` set vertically beside it, swatch strip, bold
  date line, the grey edition band (#9d9d9d), a grey panel down the right
  (#e2e2e2), and centred legal small print at the foot.
- **maryping.com.** Wide rows of Times links, underlined, black. Bracketed
  plate numbers in the left margin. Captions in bold navy Arial under each
  photo. Lots of white space. See `entry.html`.
- **maisonmartinmargiela.com.** Courier throughout, blue underlined links,
  folder icons, one grey rule under the column heads, and a server line at the
  foot. See `archive.html`.

One navy (#2a2a8c), a few flat greys, white everywhere else. Arial at 12px for
body copy, Times for navigation, Courier for the directory. No pixel fonts, no
dither, no scanline: those sites were plain, and the rough quality in the
screenshots is in the photographs, not the interface.

The writing is meant to be flat and factual. Short sentences, no em dashes in
prose, no aphorisms, sources named. If a line sounds like it is selling
something, rewrite it.

## Look at it

Open `fashion-history/index.html` in a browser. That's it. Or:

```bash
cd fashion-history && python3 -m http.server 8080   # http://localhost:8080
```

## The pages

| File | What it is | Borrowed from |
|---|---|---|
| `index.html` | the feed, channel rail, masthead, dated entries, side column | ELLE.com, June 2001 |
| `archive.html` | the whole index as an Apache directory listing | maisonmartinmargiela.com |
| `entry.html` | one entry, with numbered plates and captions, plus the margin | maryping.com lookbooks |
| `label.html` | **your clothing line**, shopfront, first run, workroom notes |, |
| `find-your-style.html` | upload a fit, tag the subgenre, get shops near you + a shopping list |, |
| `stores.html` | the whole shop directory, filtered by subgenre and region |, |
| `threadle.html` | the fashion word game, five letters, six guesses, one a day |, |
| `forum.html` | the boards (reading only for now) |, |
| `profile.html` | your picture, your subgenres, your fits |, |
| `submit.html` | file an entry or a correction |, |
| `style.css` | all of it, commented by section |, |
| `app.js` | the working parts, shop data, analyser, directory, threadle, profile |, |

## Editing the site without touching code

Every page carries a grey bar at the foot of the window. That bar is the whole
content system.

| Button | What it does |
|---|---|
| **edit this page** | Every heading, paragraph, list item and caption becomes typeable. Click one and type. Click any picture or grey placeholder to replace it with a file from your computer. A formatting toolbar appears above the bar while this is on. Click the button again to stop. |
| **write a post** | Headline, era, place, channel, body, sources and a picture. It goes to the top of the feed and gets its own page. |
| **save page as HTML** | Downloads the page with your edits, formatting and colours baked into the file. **This is how a change becomes permanent.** |
| **export** / **import** | All your edits and posts as one JSON file, to move between computers or keep as a backup. |
| **undo all** | Throws away every edit on the current page. Posts are kept. |

### Formatting, while edit mode is on

Select some text and use the toolbar: eight colour swatches plus a full colour
picker, three highlight colours, bold, italic, underline, seven text sizes, five
fonts (Arial, Times, Courier, Georgia, Helvetica), left/centre/right, add a
link, and clear formatting. Each change saves as soon as you make it.

**site colours** on the toolbar opens the scheme for the whole site: the navy
used by links, headings and the wordmark; the body text colour; the channel bar;
the rooms band; the side panel; and the page background. Those six feed the
custom properties at the top of `style.css`, so changing one changes every page
at once. There is a button to put them all back.

`submit.html` files an entry the same way, if you would rather use a form than
the bar.

### How the saving works, and its one catch

Edits live in your browser's own storage, under this site's address. Nothing is
uploaded, because there is no server. So:

- Your edits are visible **to you, on that browser**, straight away.
- To publish them to everybody, press **save page as HTML** and put the
  downloaded file into `fashion-history/` in the repo, replacing the old one.
  That is a real code change made without writing code.
- Export regularly. Clearing your browser data clears the edits.
- An edit is pinned to an element's position in the page. If that page's HTML is
  later rewritten, an edit pinned to something that no longer exists is dropped.

### What is still in the files rather than the bar

Shops, subgenres and Threadle words live in `app.js`, in three plainly named
lists at the top. They are one line each to add.

## The working parts

All of it runs in your browser. Nothing is uploaded, because there is no server
yet; anything you save lives in that browser's localStorage only.

- **Find your style**, you upload a photo, it displays, and you tag the
  subgenre yourself. The matching, the store results, the distance sort and the
  shopping list are all real. *Automatic* detection of what is in the photo needs
  a server and an image model, so it is marked coming soon rather than faked.
- **Location**, real browser GPS, used once to sort by nearest city and never
  stored. It needs the site served over http/https; opened as a `file://` it
  will refuse, so there is a region dropdown that always works.
- **The shops**, real independent places: vintage floors, archive resale, small
  stockists, markets, and the online sources worth the postage. Listed by city,
  not street address, because hours and addresses change and cannot be verified
  from here. **Check a shop's own site before you travel.** They live in the
  `SHOPS` array at the top of `app.js`, add your own the same shape.
- **Subgenres**, the `SUBGENRES` array in `app.js`. Add one there and it appears
  in the analyser, the store filter and the profile picker at once.
- **Threadle**, the answer is derived from the date, so everyone gets the same
  word. Words are in `THREADLE_WORDS`.
- **Profile**, pictures are downscaled to 420px before saving, because
  full-size photos fill localStorage in about four uploads.

### Archived, not deleted

Friends / following / followers are written and ready on `profile.html`, sitting
inside an HTML comment. A social feature with nobody in it looks broken, so it is
switched off until there are accounts. Uncomment that block to bring it back.

### Coming soon, honestly labelled

Posting to the forum, accounts, and automatic photo analysis all need a backend.
They are marked coming soon on the pages rather than mocked up as working.

## Making it yours

1. **The label.** `label.html`, replace "Your label goes here", the four pieces
   and the workroom notes. That page is built to be the shopfront when there is
   something to sell.
2. **Images.** Every grey box is a placeholder with its intended filename in it.
   Make a `fashion-history/img/` folder and drop the files in with those names,
   then swap the `<div class="plate">` / `.shot` / `.cover` boxes for
   `<img src="img/…">`. Sizes are set in `style.css`.
3. **Wordmark and colour.** The top of `style.css` has the palette; the masthead
   name is in `index.html` under `.wordmark`. Keep colours flat and few, the
   look depends on them reading as quantised, not blended.
4. **Images.** Save them small and let the CSS blow them up: everything carries
   `image-rendering: pixelated`, so a 300px JPEG scaled to 600 looks intended
   rather than broken. A photo downsized to ~40% and posterised to 8 or 16
   colours will sit right in.
5. **Entries.** Copy an `<article class="entry">` block in `index.html` and edit
   it. Each one wants: era, channel, place, a claim in the headline, and sources.

## Not wired up yet

The search box, both email forms and the submit form are static, they don't post
anywhere. When you want them live, the two straightforward routes are a hosted
form service (one attribute change per form) or moving these pages into the
Next.js app in this repo so they can use its Supabase database and server
actions, the way the feed's composer does.
