/**
 * A fetch that is actually cached, and that cannot get stuck on a failure.
 *
 * This site's whole budget arithmetic rested on an assumption that is
 * not true in this version of Next. Every outward call was written as
 * `fetch(url, { next: { revalidate: 3600 } })`, on the understanding
 * that naming a revalidate window opts the request into the data cache.
 * It does not. `next.revalidate` sets a cache LIFETIME; the thing that
 * opts in is `cache`, whose default is "auto no cache" - and the docs
 * are explicit that when a route uses request-time APIs, an auto-no-cache
 * fetch goes to the remote server on every request.
 *
 * Every page doing this calls supabase.auth.getUser(), which reads
 * cookies, which makes the route request-time. So none of it was cached.
 * Not "cached less than intended" - not cached at all.
 *
 * That is one YouTube search per page view at a hundred units of a ten
 * thousand a day quota, which a hundred views spends; one iTunes lookup
 * per record per view against a limit of about twenty a minute; and a
 * Last.fm call for every rail on every load. It is why the trailer rails
 * report a rate limit, why covers come back blank, and a good part of
 * why any of it is slow. The comments all over this codebase about
 * everybody in the same lane sharing one cached answer were describing
 * something that was never happening.
 *
 * So: force-cache, plus the lifetime, which is what was meant all along.
 *
 * The second half matters as much. force-cache caches the response
 * whatever its status, so a 403 from a spent quota would be served back
 * for the full window - the rail would keep saying "rate limited" for
 * half an hour after the limit had cleared, and there would be no way to
 * tell that from the real thing. A failed response therefore gets one
 * uncached retry, so a stale failure can never outlive the condition
 * that caused it. That costs an extra call only on the path that is
 * already broken, and it buys a system that heals itself on the next
 * page view rather than at the end of a timer.
 */
export async function cachedFetch(
  url: string,
  revalidateSeconds: number,
  init: RequestInit = {}
): Promise<Response | null> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      cache: "force-cache",
      next: { revalidate: revalidateSeconds },
    });
  } catch {
    return null;
  }
  if (res.ok) return res;

  // Might be a failure from an earlier request still inside its window.
  // Ask again without the cache before believing it.
  try {
    return await fetch(url, { ...init, cache: "no-store" });
  } catch {
    return null;
  }
}
