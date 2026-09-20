-- LastThread: only owners write.
--
-- Migration 020 let any signed-in person publish a post, on the assumption
-- that LastThread would take entries from members the way the feed does.
-- That is not what it is for. It is one person's site, so writing an article
-- and editing a page are both the owner's alone, and everybody else reads.
--
-- Page edits were already owner-only. This does the same for posts.
--
-- Accounts still exist, and anybody can still make one. What an account
-- without an owner row can do, after this, is read. That is deliberate: it
-- leaves the door open for contributors later without leaving it open now.
--
-- Safe to run more than once. Migration 020 must have been run first.
-- The undo block is at the bottom.

-- ---------- posts: owners only ----------

drop policy if exists "You can write your own LastThread posts" on public.lastthread_posts;
drop policy if exists "Owners can write LastThread posts" on public.lastthread_posts;
create policy "Owners can write LastThread posts"
  on public.lastthread_posts for insert
  with check (
    auth.uid() = author_id
    and exists (select 1 from public.lastthread_owners o where o.user_id = auth.uid())
  );

drop policy if exists "You can edit your own LastThread posts" on public.lastthread_posts;
drop policy if exists "Owners can edit LastThread posts" on public.lastthread_posts;
create policy "Owners can edit LastThread posts"
  on public.lastthread_posts for update
  using (exists (select 1 from public.lastthread_owners o where o.user_id = auth.uid()))
  with check (exists (select 1 from public.lastthread_owners o where o.user_id = auth.uid()));

drop policy if exists "You can delete your own LastThread posts" on public.lastthread_posts;
drop policy if exists "Owners can delete LastThread posts" on public.lastthread_posts;
create policy "Owners can delete LastThread posts"
  on public.lastthread_posts for delete
  using (exists (select 1 from public.lastthread_owners o where o.user_id = auth.uid()));

-- Reading is unchanged: a published post is public, a draft belongs to its
-- author. Left alone on purpose so nothing that is already readable stops
-- being readable by accident.

-- ---------- to put it back the way 020 had it ----------
--
-- drop policy if exists "Owners can write LastThread posts" on public.lastthread_posts;
-- create policy "You can write your own LastThread posts"
--   on public.lastthread_posts for insert
--   with check (auth.uid() = author_id);
--
-- drop policy if exists "Owners can edit LastThread posts" on public.lastthread_posts;
-- create policy "You can edit your own LastThread posts"
--   on public.lastthread_posts for update
--   using (auth.uid() = author_id) with check (auth.uid() = author_id);
--
-- drop policy if exists "Owners can delete LastThread posts" on public.lastthread_posts;
-- create policy "You can delete your own LastThread posts"
--   on public.lastthread_posts for delete
--   using (auth.uid() = author_id);
