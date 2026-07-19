# the feed

A music/movie/TV community site — post reviews, chat live, and (soon) connect Spotify/Apple Music. Built with Next.js (App Router) + TypeScript + Supabase.

## Stack

- **Next.js 16** (App Router, Turbopack, TypeScript)
- **Supabase** — Postgres database, Auth (email/password + magic link), Realtime (live chat)

## MVP features

- Accounts: sign up / sign in (password or magic link)
- Feed: post and browse music/movie/TV reviews
- Live chat, backed by Supabase Realtime

Not yet built: Wrapped, New Releases, Recs, Spotify/Apple Music/Letterboxd connect.

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a free project, then open **Project Settings → API** and copy:
- Project URL
- `anon` `public` API key

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Set up the database

In your Supabase project, open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates the `profiles`, `posts`, and `chat_messages` tables, row-level security policies, an auto-create-profile trigger, and enables Realtime on `chat_messages`.

By default Supabase requires email confirmation for new signups. To skip that while developing locally, go to **Authentication → Providers → Email** and turn off "Confirm email" (or just click the confirmation link Supabase emails you).

### 4. Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
src/
  app/
    page.tsx                # Feed (home)
    chat/page.tsx            # Live chat
    sign-in/, sign-up/       # Auth pages
    auth/callback/route.ts   # OAuth/magic-link/email-confirm redirect target
    actions/                 # Server actions (auth.ts, posts.ts)
  components/                # SiteHeader, SiteFooter, PostForm, ChatRoom
  lib/supabase/               # Browser + server Supabase clients
  proxy.ts                    # Refreshes the Supabase session on each request
supabase/schema.sql            # Database schema + RLS policies
```

## Next steps (post-MVP)

- Spotify/Apple Music OAuth (Supabase Auth supports Spotify as a built-in provider)
- New Releases, Recs, Wrapped pages
- Comments/likes on posts
