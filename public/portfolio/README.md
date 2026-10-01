# Portfolio

A live resume and portfolio, dressed as a 2006 DVD mini-site: the lavender
and pink homepage with the flowers, the flip phone and the swirl frame, and
the pink and orange inside pages with the stars, the white box with orange
tabs, and the row of little DVD and CD cases along the bottom.

Like LastThread, it is plain HTML in `public/portfolio/`, served as static
files, with three small routes in `src/app/portfolio/` for the parts that
need a server. Once merged it is live at:

    https://mythefeed.com/portfolio

To give it its own domain, buy one, add it in Vercel under the project's
Domains, and point it at this path.

## The pages

| File | What it is | Borrowed from |
|---|---|---|
| `index.html` | home: logo, title, menu, featured DVD, framed portrait, the phone, the flower, the shelf | the lavender Makeover Madness page |
| `about.html` | about me: My Story and Bonus Features (the resume) tabs | the pink Disguise The Limit page |
| `work.html?c=dj` | one category: its cover and story, then one entry per project down the right | the same pink page |
| `site.js` | the starting content (`DEFAULTS`), the three layouts, edit mode | |
| `art.js` | every flower, swirl, star and background, drawn as SVG | |
| `style.css` | the look, commented by section | |
| `fonts.css`, `fonts/` | the fonts, hosted here rather than loaded from Google | |

## Editing it

Sign in on the feed with an admin account, then open the portfolio. A pink
bar appears at the foot of the window.

- **edit this page**: click any words and type. Every word on the site can be
  typed over, down to the little ones (HOME, GIG FINDER, SCROLL, the rating). Click any picture (a DVD
  cover, the framed portrait) to upload a new one from your phone or
  computer. Every change saves for everybody as soon as you click away.
- **Styling text**: click any words and a style row opens in the bar: font
  (the site's fonts plus extra cursive and 2000s ones), size, color, outline
  color, bold, italic, and reset to undo it.
- **site colors**: the background, pink panel, flowers, frame, stars, bottom
  wave, orange bars and tabs, and the white box's border and text. Each one
  recolors every page at once; reset colors puts them back.
- **Pictures**: the little DVD and CD cases on the bottom shelf take uploads
  too (that picture is the category's cover). Hover any picture for
  **remove**.
- **booking email**: where every Book Me button sends people.
- On a category page: **+ add a project**, **delete this project**,
  **+ add a category**, **case: CD / DVD** (which case it sits in on the
  shelf), **delete category**.

The little ♥ in the bottom corner is the sign in link, for when you are
signed out.

## Where things are kept

All the words, and the addresses of the pictures, are one JSON document in
the `site_content` table under the key `portfolio`. That table is already
readable by everyone and writable by admins only, so this needed no
migration. Pictures are uploaded to the `avatars` storage bucket under
`portfolio/`, shrunk in the browser to 1800px first.

Until the first edit is saved, the site shows `DEFAULTS` from `site.js`.

## The fonts

The original lettering was drawn for the show and was never sold as a font,
so these are the closest free ones, all SIL Open Font License:

| Where | Font |
|---|---|
| the bouncy purple title, the cover titles | Chewy |
| the round logo | Fredoka |
| the glowing small-caps menu, the magenta side menu, the phone | Sansita |
| the text in the white box | Didact Gothic |
| the orange tab labels | Nunito Black |
| the captions under the little cases | Archivo Narrow |
| the site name in the top bar (the cursive) | Pacifico |

The Disney, Disney Channel, TV rating and HP marks from the references are
left out on purpose; everything else is drawn to match.
