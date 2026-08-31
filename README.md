# Feedback

mythefeed.com — a community site for reviewing music, film, TV and photography.
Next.js 16 (App Router) + TypeScript + Supabase, deployed on Vercel.

---

## Changing something, without breaking anything

Three ways in, easiest first. All of them end with Vercel deploying automatically.

### 1. Edit one file on github.com (no setup at all)

Best for wording, a colour, a number. On github.com, open the file, press the
pencil, change it, and **commit to a new branch** rather than to `main`. Vercel
builds that branch and comments a preview link on the pull request — that is the
site with your change, live, at a URL nobody else has. If it looks right, merge
the pull request. If it looks wrong, close it and nothing ever reached anybody.

Committing straight to `main` skips the preview and deploys to the real site.
Fine for a typo you can see is safe; not fine for anything you would want to
look at first.

### 2. Run it on your own machine

```bash
git clone https://github.com/Buhhuibbiinob/the-feed
cd the-feed
npm install
cp .env.local.example .env.local     # then fill it in, see below
npm run dev                          # http://localhost:3000
```

You need Node 20+ and git. Every file you save reloads the page instantly, and
you are talking to the **real database** — a review you post locally appears on
the live site. There is no separate test database.

### 3. Ask Claude Code

What we have been doing. Worth knowing anyway: everything it does is an ordinary
pull request you can read, question or close.

---

## Before you push: the checks

```bash
npm run lint     # types, style, plus this repo's own rules
npm run build    # what Vercel will do
```

If both pass, you have probably not broken anything structural. `lint` includes
custom checks that exist because each of these mistakes has actually been made
here before:

| Check | Catches |
|---|---|
| `check:themes` | a theme setting layout or spacing, not just colour |
| `check:contrast` | text nobody can read on its background |
| `check:shadows` | a list item wearing a modal's drop shadow |
| `check:owner` | a Customize form that would edit the wrong person's page |

And these, run individually, cover the logic most likely to break quietly:

```bash
npm run check:postcolumns   # a missing column must not empty the feed
npm run check:works         # two reviews of one film group; two films don't
npm run check:genres        # a genre is only valid for its own category
npm run check:afterpost     # the right next step after posting a review
npm run check:winback       # nobody gets an email who shouldn't
npm run check:stickers      # stickers survive a database that's behind
npm run check:announcements # the right announcement shows, once, and stays closed
```

---

## The two things that need care

**1. Database changes are applied by hand.** A file in `supabase/migrations/`
does nothing until somebody pastes it into the Supabase SQL editor and runs it.
Code that reads a column which doesn't exist yet used to take every review off
the site; `src/lib/postQuery.ts` now degrades instead, but the rule stands: ship
the migration and the code together, and run the migration.

Migrations so far: `001`–`009`. They are safe to re-run.

**2. Secrets live in two places.** `.env.local` on your machine, and Vercel →
Settings → Environment Variables for the live site. Changing one does not change
the other, and Vercel only picks up a new value on the next deploy.

---

## Where things are

```
src/
  app/                     43 pages, one folder per route
    page.tsx               the feed (the biggest file in the project)
    post/new/              the composer
    post/[id]/             one review
    work/[id]/             one thing, and every review of it
    profile/[username]/    a member's page, including all the customizing
    queue/                 Up Next
    clubs/ collections/ polls/ weekly/ chat/ leaderboard/ recs/ wrapped/
    admin/                 moderation, bots, site text, the works backfill
    actions/               35 files: everything that WRITES to the database
    api/                   13 routes, mostly scheduled jobs and OAuth
  components/              99 components; PostCard and PostForm are the hearts
  lib/                     80 modules: the rules, with no UI in them
supabase/
  schema.sql               the whole database, as one file
  migrations/              the changes, one file each, applied by hand
scripts/                   the checks listed above
```

**The useful habit:** `src/lib/` is where decisions live and `src/app/actions/`
is where writes live. If you want to change *what the site does*, look there
first — the pages mostly just arrange what those two produce.

### Common changes, and where

| You want to | Look in |
|---|---|
| change wording on a page | that page's `page.tsx` |
| change wording you can edit without deploying | Admin → Site Text |
| put a message in front of everybody at once | Admin → Announcements |
| change how anything looks | `src/app/globals.css` |
| change the genres offered | `src/lib/genres.ts` |
| change what the bots post | `src/app/actions/bots.ts` |
| change an email | `src/lib/emailTemplates.ts` |
| change who gets emailed, and when | `src/lib/digest.ts`, `src/lib/winback.ts` |
| add a page to the nav | `src/lib/builtinPages.ts` |
| change what happens after someone posts | `src/lib/afterPost.ts` |

---

## Environment variables

Required:

```
NEXT_PUBLIC_SUPABASE_URL         Supabase → Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY    same page, the "anon public" key
NEXT_PUBLIC_SITE_URL             http://localhost:3000 locally
```

Optional, each switching off one feature when absent rather than breaking
anything: `SUPABASE_SERVICE_ROLE_KEY` (bots, digests, admin edits of bot pages),
`YOUTUBE_API_KEY` (search in the composer), `TMDB_API_KEY`, `LASTFM_API_KEY`,
`SPOTIFY_CLIENT_ID`/`SECRET`, `CRON_SECRET` (the scheduled jobs — all of them
return 404 without it, deliberately, since they send email and write posts).

**Never commit `.env.local`.** It is gitignored; keep it that way.

---

## Scheduled jobs

Configured in `vercel.json`, authenticated by Vercel sending
`Authorization: Bearer $CRON_SECRET` automatically.

| Path | When | Does |
|---|---|---|
| `/api/mail/run` | daily 17:00 UTC | activity digests, then win-back nudges |
| `/api/bots/run` | daily 13:00 UTC | one round of bot activity |
| `/api/works/backfill` | by hand | links old reviews to works (also a button in Admin) |

Vercel's Hobby plan allows two cron jobs at one run a day, which is why the two
mail jobs share a URL.

---

## A warning about the framework

This is Next.js 16, which differs from most of what is written about Next.js
online — App Router, server components by default, and server actions instead of
API routes for writes. Answers you find for older versions are often wrong here
rather than merely old. The version's own documentation is in
`node_modules/next/dist/docs/`.
