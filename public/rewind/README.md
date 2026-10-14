# Rewind Theory

A "coming soon" site about nostalgia, memory and color, dressed like a 2005
Flash-era agency site: a framed window with a script logo, a dark tab bar, a
soft pillow panel, tilted polaroids and a scalloped seal, with the character
lying across the tab bar and breaking out of the frame.

One HTML file and one picture. No build step.

- `index.html`: the whole site. Three tabs: coming soon, my statement, and
  "what do you miss?", the wall.
- `girl.webp`: the character.

## Where it lives

- **Its own domain**, once that is set up (below). On that domain the visitor
  sees Rewind Theory and nothing else: any other address goes back to the
  front page.
- **mythefeed.com/rewind**, always. This is where you edit it, because this is
  where you are signed in.

## Editing

Sign in to mythefeed.com with an admin account and open mythefeed.com/rewind.
An **edit page** button appears bottom right. In edit mode you can click any
words to change them, add or change the polaroid photos, and drag the
character to move her. **save** makes it live for everyone, on both addresses.

Saved edits are one row in `site_content` (key `rewind`). See
`src/app/rewind/data/route.ts`.

## The wall

Anybody can pin something they miss: a YouTube link or a picture, with an
optional name. Nobody needs an account. A post shows on the wall only after an
admin approves it. When you are signed in as an admin, the wall tab shows
"Waiting for you to approve" with **approve** and **delete** on each post, and
**take down** on posts that are already up. Your own posts go up straight away.

YouTube posts play in a little TV on the page. Pictures are shrunk in the
browser to 402x300 before they are sent.

The posts are the `rewind_wall` table (migration 022). See
`src/app/rewind/wall/route.ts`.

## Setting up the domain

1. **Run the migration.** Supabase > SQL Editor > paste
   `supabase/migrations/022-rewind-wall.sql` > Run.
2. **Add the domain to Vercel.** Vercel > the-feed project > Settings >
   Domains > Add. Add both `yourdomain.com` and `www.yourdomain.com`. Vercel
   shows the DNS records to add where you bought the domain. If you buy the
   domain through Vercel itself, it does this for you.
3. **Tell the site which domain is Rewind Theory's.** Vercel > Settings >
   Environment Variables > add `REWIND_HOSTS` with the value
   `yourdomain.com,www.yourdomain.com` (no `https://`, comma-separated) for
   Production.
4. **Redeploy** (Deployments > the latest > Redeploy) so the new variable is
   picked up.

Until `REWIND_HOSTS` is set, adding the domain to Vercel would show the feed
there, so set it before or at the same time as the domain.

`SUPABASE_SERVICE_ROLE_KEY` is optional here. When it is set, the wall
refuses new posts once 300 are waiting for approval, so nobody can flood it.
