"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Covers, clips and years for the records somebody can actually see.
 *
 * The shelf used to look up everything on it: fifty records, two at a
 * time, with a wait between each pair. Two things were wrong with that
 * and only one of them is the arithmetic.
 *
 * The arithmetic is that it took about a minute, in twenty five round
 * trips, each carrying a session check and a route lookup around a
 * request that Apple usually answered from cache. That is the slowness
 * that got reported.
 *
 * The other thing is that it asked at all. Nobody looks at record forty
 * on a fifty record shelf without scrolling to it, and most people never
 * scroll. Forty of those fifty lookups were for covers no one would see,
 * spent out of a budget Apple caps at roughly twenty calls a minute -
 * so the records somebody WAS looking at queued behind the ones they
 * were not, and the top of the shelf filled in last.
 *
 * So this asks for a record when it comes into view, batches whatever
 * came into view together, and remembers the answer for as long as the
 * tab is open. A shelf costs one request for the screenful you land on,
 * and another when you scroll.
 */

export type SleeveInfo = {
  artworkUrl: string | null;
  previewUrl: string | null;
  trackUrl: string | null;
  year?: number | null;
};

export type SleeveAsk = { key: string; title: string; artist: string };

/**
 * Whether this page's shelf is going to check the years.
 *
 * Only Year and Decade claim a span, and only they throw a record off
 * for being from the wrong time. Everywhere else the year is not used
 * for anything, so looking one up would be a request spent on nothing.
 *
 * Set once per hook rather than per record, because a shelf is one axis
 * from top to bottom.
 */
export type SleeveOptions = { needYear?: boolean };

/**
 * Answers already paid for, kept for the life of the tab.
 *
 * Module level rather than component state, and this is the fix for a
 * bug as much as a speed-up: Year, Decade and Scene are the same
 * component in the same place in the tree, so switching between them
 * threw away everything the last shelf had looked up and asked for it
 * all again. Records shared between two shelves are now free the second
 * time, and a shelf you have already opened comes back instantly.
 */
const answers = new Map<string, SleeveInfo>();
/** In flight or already asked, so nothing is requested twice. */
const asked = new Set<string>();

/**
 * How many times a record has been asked for and not answered.
 *
 * Only counts the answers Apple refused to give. A record that is
 * genuinely not in the catalogue gets one attempt and an answer, and is
 * never asked again; a record caught in a throttle gets a few more,
 * spaced out, because the throttle clears in seconds and the cover is
 * really there. Capped, because a shelf that keeps asking forever is a
 * shelf making the throttle worse.
 */
const attempts = new Map<string, number>();
const MAX_ATTEMPTS = 3;

/** Long enough for Apple's minute-long window to move on. */
const RETRY_MS = 1400;

/** How many go in one request. Matches the route's own cap. */
const BATCH = 24;
/** Long enough to collect a screenful, short enough to feel immediate. */
const COALESCE_MS = 60;

export function useSleeves({ needYear = false }: SleeveOptions = {}) {
  const [, bump] = useState(0);
  const queue = useRef(new Map<string, SleeveAsk>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  // flush needs to be able to schedule another flush, for whatever
  // scrolled into view while a batch was in the air. It cannot name
  // itself inside its own definition, so the timer calls it through a
  // ref that is kept pointing at the current one.
  const latest = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const schedule = useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      // Cleared BEFORE the call, not inside it.
      //
      // This is the bug behind "it never loads until I refresh and come
      // back". latest started as a no-op, because it cannot be assigned
      // until the effect below runs, and a no-op does not clear the
      // timer handle. So if the timer ever fired first, nothing was
      // fetched AND timer.current stayed set - which makes this function
      // return early on every subsequent call, forever. The queue was
      // stranded for the life of the page, and the only thing that
      // looked like a fix was navigating away and back, because the
      // answers map survives and the second visit paints from it.
      timer.current = null;
      void latest.current?.();
    }, COALESCE_MS);
  }, []);

  /**
   * Put items back and try them again shortly.
   *
   * A batch that fails outright used to release its keys and stop there,
   * which sounds harmless and is not: the element that asked has long
   * since disconnected its observer, so nothing would ever ask again and
   * one bad response left those records blank for the life of the page.
   * Releasing a key is only half the job; something has to pick it up.
   */
  const requeue = useCallback((items: SleeveAsk[]) => {
    let any = false;
    for (const item of items) {
      const tries = (attempts.get(item.key) ?? 0) + 1;
      attempts.set(item.key, tries);
      asked.delete(item.key);
      if (tries < MAX_ATTEMPTS) {
        asked.add(item.key);
        queue.current.set(item.key, item);
        any = true;
      }
    }
    if (any && alive.current && !timer.current) {
      timer.current = setTimeout(() => {
        timer.current = null;
        void latest.current?.();
      }, RETRY_MS);
    }
  }, []);

  const flush = useCallback(async () => {
    timer.current = null;
    const items = [...queue.current.values()].slice(0, BATCH);
    if (items.length === 0) return;
    for (const item of items) queue.current.delete(item.key);

    try {
      const res = await fetch("/api/crate/sleeves", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items, needYear }),
      });
      // A failed batch is not an answer. Leaving these out of `answers`
      // and dropping them from `asked` means they can be tried again
      // when they next scroll past, rather than being remembered
      // forever as "this record has no cover" - which is how a throttle
      // used to turn into a permanent blank square.
      if (!res.ok) {
        requeue(items);
        return;
      }
      const data = (await res.json()) as { results?: Record<string, SleeveInfo> };
      const results = data.results ?? {};
      for (const [key, info] of Object.entries(results)) answers.set(key, info);
      // Anything the batch did not answer for is released rather than
      // remembered as an empty answer.
      //
      // The server leaves out the lookups Apple refused to serve, which
      // is the difference between "no cover exists" and "we could not
      // ask right now". Keeping those in `asked` would mean one
      // throttled moment blanks a record permanently - and on a busy
      // shelf that is most of the shelf.
      const refused: SleeveAsk[] = [];
      for (const item of items) {
        if (item.key in results) attempts.delete(item.key);
        // Not in the answer means Apple would not serve it, not that the
        // record has no cover. Same treatment as a failed batch.
        else refused.push(item);
      }
      if (refused.length > 0) requeue(refused);
    } catch {
      requeue(items);
      return;
    }
    if (alive.current) bump((n) => n + 1);
    // More came into view while that was in the air. schedule() does
    // nothing if the retry above already set a timer, which is what we
    // want: one timer, the slower of the two.
    if (queue.current.size > 0 && alive.current) schedule();
  }, [schedule, requeue, needYear]);

  useEffect(() => {
    latest.current = flush;
    // Anything that queued up before this ref was wired still needs
    // sending. Cheap to check and it closes the window entirely.
    if (queue.current.size > 0) schedule();
  }, [flush, schedule]);

  /** Say that a record is on screen. Safe to call on every render. */
  const want = useCallback(
    (ask: SleeveAsk) => {
      if (asked.has(ask.key)) return;
      asked.add(ask.key);
      queue.current.set(ask.key, ask);
      // Repaint, so the sleeve can show that it is working.
      //
      // Without this the loading state could never appear at all.
      // `asked` is a plain module-level Set, so adding to it changes
      // nothing React watches: the shelf carried on showing the settled
      // blank until the batch came back, at which point the answer
      // existed and the record was no longer pending. The one state
      // that says "this is in hand" was unreachable for the entire
      // window it describes.
      //
      // Safe from here: want is called from an IntersectionObserver
      // callback, never during a render.
      bump((n) => n + 1);
      schedule();
    },
    [schedule]
  );

  const get = useCallback((key: string): SleeveInfo | undefined => answers.get(key), []);

  /**
   * Whether this record has been asked for and not yet answered.
   *
   * The shelf needs this to tell two identical-looking things apart: a
   * record whose cover is on its way, and a record the catalogue does
   * not have. Both were drawn as a blank sleeve, so a shelf that had
   * finished looked exactly like a shelf that was still working, and the
   * only way to know was to keep staring at it.
   */
  const pending = useCallback(
    (key: string): boolean => asked.has(key) && !answers.has(key),
    []
  );

  return { want, get, pending };
}

/**
 * A ref that reports when its element is on screen.
 *
 * Given a margin, so a record is looked up just before it is scrolled
 * to rather than as it lands - the cover is there by the time it
 * arrives instead of appearing under somebody's eye.
 */
export function useOnScreen(onScreen: () => void, enabled = true) {
  const ref = useRef<HTMLElement | null>(null);
  const fn = useRef(onScreen);
  // In an effect rather than straight in the body: writing a ref while
  // rendering is a real hazard under concurrent React, where a render
  // can be thrown away after it has already changed something outside
  // itself.
  useEffect(() => {
    fn.current = onScreen;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    // No IntersectionObserver (old browsers, some test environments)
    // means ask straight away. Slower, and correct, which is the right
    // way round for a fallback.
    if (typeof IntersectionObserver === "undefined") {
      fn.current();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            fn.current();
            observer.disconnect();
          }
        }
      },
      // Just ahead of the fold, not the whole page.
      //
      // Four hundred pixels on a grid of fifty sleeves catches almost
      // all of them at once, so "only look up what somebody can see"
      // was in practice looking up the entire shelf. That is fifty
      // requests to a catalogue that allows about twenty a minute, and
      // it is the reason the search box in the post form - a person,
      // waiting, typing - kept being told the catalogue was busy. It was
      // busy with us.
      //
      // A hundred and twenty was the panicked version of that fix, and
      // it was a trade rather than a balance: covers only started
      // loading once a row was practically on screen, so the shelves
      // looked slow to save a search box. Now that a seen cover is
      // remembered in the database, a screenful ahead is mostly free -
      // it is a read, not a lookup - so the margin goes back to
      // something that loads a row before you reach it.
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return ref;
}
