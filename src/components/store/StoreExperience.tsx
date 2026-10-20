"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addToCrate,
  cancelStoreCountdown,
  checkout,
  getStoreBoard,
  refreshStore,
  removeFromCrate,
  startStoreCountdown,
  submitStoreReview,
  type StoreResult,
} from "@/app/actions/store";
import {
  FORMAT_NAMES,
  SECTIONS,
  nextUtcMidnight,
  type BoardReview,
  type StoreItem,
  type StoreSnapshot,
} from "@/lib/store";
import type { Spot, Station } from "./engine/worlds";
import type { PlayState, StoreEngine, WorldName } from "./engine/engine";

// The record store's interface: every menu, panel and line of text over
// the 3D scene. The scene itself is engine/engine.ts.
//
// Everything that changes anything goes to the server first (the actions
// in app/actions/store.ts, which the database checks again), and only
// once the server agrees does the engine animate it. So the crate on
// screen is never ahead of the crate in the database.

type Phase = "start" | "store" | "loading" | "room";
type Dialog = { text: string; choices: { label: string; run: () => void }[] } | null;
type Loc = { world: WorldName; station: Station | null; index: number; stations: Station[] };

const DEVICE_NAME: Record<StoreItem["format"], string> = {
  vinyl: "turntable",
  cd: "CD player",
  cassette: "tape deck",
  dvd: "DVD player",
};

function stars(n: number | null) {
  if (!n) return "";
  return "★".repeat(n) + "☆".repeat(5 - n);
}

export function StoreExperience({
  initial,
  launchAt: initialLaunch,
  serverNow,
}: {
  initial: StoreSnapshot;
  launchAt: string | null;
  serverNow: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<StoreEngine | null>(null);
  const [snap, setSnap] = useState(initial);
  const snapRef = useRef(initial);
  useEffect(() => {
    snapRef.current = snap;
  }, [snap]);
  const [phase, setPhase] = useState<Phase>("start");
  const [loc, setLoc] = useState<Loc>({ world: "store", station: null, index: 0, stations: [] });
  const [focus, setFocus] = useState<Spot | null>(null);
  const [held, setHeld] = useState<StoreItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState<PlayState>(null);
  const [crateOpen, setCrateOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [board, setBoard] = useState<{ open: boolean; reviews: BoardReview[] | null; kind: "all" | "music" | "movie_tv"; sort: "new" | "top"; itemId: string | null }>({
    open: false,
    reviews: null,
    kind: "all",
    sort: "new",
    itemId: null,
  });
  const [notebook, setNotebook] = useState<{ open: boolean; itemId: string | null }>({ open: false, itemId: null });
  const [listView, setListView] = useState(false);
  const [toast, setToast] = useState<{ text: string; bad: boolean } | null>(null);
  const [muted, setMuted] = useState(false);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState({ text: "Almost home...", filled: 0 });
  const [glFailed, setGlFailed] = useState(false);
  const [launchAt, setLaunchAt] = useState(initialLaunch);
  // The server's clock, kept as an offset from this device's, and read
  // once a minute: enough for "restocks at" and the launch line.
  const [timeOffset] = useState(() => new Date(serverNow).getTime() - Date.now());
  const [now, setNow] = useState(() => new Date(serverNow).getTime());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() + timeOffset), 30_000);
    return () => window.clearInterval(id);
  }, [timeOffset]);

  const say = useCallback((text: string, bad = false) => {
    setToast({ text, bad });
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 3200);
  }, []);

  const openBoard = useCallback(async (itemId: string | null) => {
    setBoard((b) => ({ ...b, open: true, itemId }));
    const reviews = await getStoreBoard();
    setBoard((b) => ({ ...b, reviews }));
  }, []);

  // ---------- the engine ----------

  useEffect(() => {
    document.documentElement.classList.add("ps2-open");
    return () => document.documentElement.classList.remove("ps2-open");
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const hand = handRef.current;
    const video = videoRef.current;
    if (!canvas || !hand || !video) return;
    let engine: StoreEngine | null = null;
    let cancelled = false;
    import("./engine/engine")
      .then(({ StoreEngine }) => {
        if (cancelled) return;
        try {
          const s = snapRef.current;
          engine = new StoreEngine(
            canvas,
            hand,
            video,
            { shelves: s.shelves, crate: s.crate, owned: s.owned },
            {
              location: (world, station, index, stations) => setLoc({ world, station, index, stations }),
              focus: setFocus,
              held: setHeld,
              busy: setBusy,
              playing: setPlaying,
              activate: (spot) => {
                if (spot.kind === "notebook") setNotebook({ open: true, itemId: null });
                if (spot.kind === "board") openBoard(null);
              },
              error: (m) => say(m, true),
            },
            { reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches }
          );
          engineRef.current = engine;
          engine.start();
        } catch {
          // No WebGL: the list view is the whole shop.
          setGlFailed(true);
          setListView(true);
        }
      })
      .catch(() => {
        setGlFailed(true);
        setListView(true);
      });
    return () => {
      cancelled = true;
      engine?.dispose();
      engineRef.current = null;
    };
    // The engine is built once per visit; later snapshots are applied to it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = useCallback(
    (res: StoreResult): boolean => {
      if (!res.ok) {
        engineRef.current?.audio.sfx.error();
        say(res.error, true);
        return false;
      }
      setSnap(res.snapshot);
      if (res.note) say(res.note);
      return true;
    },
    [say]
  );

  // ---------- actions ----------

  const status = snap.status;
  const crateIds = useMemo(() => new Set(snap.crate.map((i) => i.id)), [snap.crate]);
  const ownedIds = useMemo(() => new Set(snap.owned.map((i) => i.id)), [snap.owned]);
  const room = phase === "room";

  const pressStart = () => {
    engineRef.current?.audio.start();
    engineRef.current?.audio.sfx.confirm();
    setPhase("store");
    canvasRef.current?.focus();
  };

  const putInCrate = async () => {
    const e = engineRef.current;
    if (!held || pending) return;
    if (!snap.signedIn) return say("Sign in to fill a crate.", true);
    setPending(true);
    const res = await addToCrate(held.id);
    setPending(false);
    if (apply(res)) await e?.crateHeld();
  };

  const takeOutOfCrate = async (item: StoreItem) => {
    if (pending) return;
    setPending(true);
    const res = await removeFromCrate(item.id);
    setPending(false);
    if (apply(res)) await engineRef.current?.uncrate(item.id);
  };

  const goHome = async () => {
    const e = engineRef.current;
    setPhase("loading");
    setLoading({ text: "Almost home...", filled: 0 });
    for (let i = 1; i <= 14; i++) {
      await new Promise((r) => window.setTimeout(r, 120 + Math.random() * 90));
      setLoading((l) => ({ ...l, filled: i }));
    }
    e?.emptyCrate();
    e?.setOwned(snapRef.current.owned);
    e?.setWorld("room");
    setPhase("room");
    say("Home. Your things are on the shelf.");
  };

  const goToStore = async () => {
    const e = engineRef.current;
    if (e?.nowPlaying) await e.stopPlaying();
    setPhase("loading");
    setLoading({ text: "Heading out...", filled: 0 });
    const refreshed = refreshStore();
    for (let i = 1; i <= 14; i++) {
      await new Promise((r) => window.setTimeout(r, 90));
      setLoading((l) => ({ ...l, filled: i }));
    }
    const res = await refreshed;
    if (res.ok) setSnap(res.snapshot);
    e?.setWorld("store");
    setPhase("store");
  };

  const runCheckout = async () => {
    const e = engineRef.current;
    setDialog({ text: "One moment...", choices: [] });
    setPending(true);
    const res = await checkout();
    setPending(false);
    if (!res.ok) {
      e?.audio.sfx.error();
      setDialog({ text: res.error, choices: [{ label: "Okay.", run: () => setDialog(null) }] });
      return;
    }
    setSnap(res.snapshot);
    e?.audio.sfx.register();
    setDialog({ text: "Okay. Come back soon!", choices: [] });
    await e?.cashierSay("Okay. Come back soon!");
    setDialog(null);
    if (res.note) say(res.note);
    await goHome();
  };

  const toCounter = async () => {
    const e = engineRef.current;
    setCrateOpen(false);
    if (!e) return;
    await e.goToCounter();
    const s = snapRef.current;
    if (!s.signedIn) {
      setDialog({ text: "You'll need to sign in before I can ring anything up.", choices: [{ label: "Okay.", run: () => setDialog(null) }] });
      return;
    }
    if (s.crate.length === 0) {
      const line = "Your crate's empty. Grab something off the shelves first.";
      setDialog({ text: line, choices: [{ label: "Okay.", run: () => setDialog(null) }] });
      void e.cashierSay(line);
      return;
    }
    const line = "Are you sure these are all the items you want?";
    setDialog({
      text: line,
      choices: [
        { label: "Yes, check out.", run: () => void runCheckout() },
        { label: "No, take me back.", run: () => setDialog(null) },
      ],
    });
    void e.cashierSay(line);
  };

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    engineRef.current?.audio.setMuted(m);
    if (videoRef.current) videoRef.current.muted = m;
  };

  // ---------- the keyboard ----------

  const overlayOpen = board.open || notebook.open || listView || !!dialog || phase === "start" || phase === "loading";
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const e = engineRef.current;
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (ev.key === "Escape") {
        if (board.open) setBoard((b) => ({ ...b, open: false }));
        else if (notebook.open) setNotebook({ open: false, itemId: null });
        else if (listView && !glFailed) setListView(false);
        else if (crateOpen) setCrateOpen(false);
        else if (e?.nowPlaying) void e.stopPlaying();
        else if (e?.holding) void e.putBack();
        return;
      }
      if (overlayOpen || !e) return;
      // Buttons keep their own Enter and Space.
      if ((tag === "BUTTON" || tag === "A") && (ev.key === "Enter" || ev.key === " ")) return;
      const k = ev.key.toLowerCase();
      if (k === "arrowleft" || k === "a") e.moveCursor(-1, 0);
      else if (k === "arrowright" || k === "d") e.moveCursor(1, 0);
      else if (k === "arrowup" || k === "w") e.moveCursor(0, -1);
      else if (k === "arrowdown" || k === "s") e.moveCursor(0, 1);
      else if (k === "q" || k === "pageup") void e.nextStation(-1);
      else if (k === "e" || k === "pagedown") void e.nextStation(1);
      else if (k === "enter") {
        if (e.nowPlaying) void e.stopPlaying();
        else if (!e.holding) e.activate();
      } else if (k === " ") {
        if (e.holding) void e.flip();
        else e.activate();
      } else if (k === "c" && !room) setCrateOpen((o) => !o);
      else if (k === "b") void openBoard(null);
      else return;
      ev.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlayOpen, board.open, notebook.open, listView, glFailed, crateOpen, room, openBoard]);

  // ---------- render helpers ----------

  const remainingText =
    status.remaining === 0
      ? `That's five today · restocks ${nextUtcMidnight(new Date(now)).toISOString().slice(11, 16)} UTC`
      : `${status.remaining} pick-up${status.remaining === 1 ? "" : "s"} left today`;

  const focusLabel =
    focus?.kind === "item" && focus.item
      ? `${focus.slotLabel ? `${focus.slotLabel} · ` : ""}${focus.item.title}${focus.item.artist ? ` — ${focus.item.artist}` : ""}`
      : focus?.label ?? "";

  const hints = held ? (
    <>
      <kbd>←→↑↓</kbd> turn it · <kbd>Space</kbd> flip · <kbd>Esc</kbd> put back
    </>
  ) : playing ? (
    <>
      <kbd>Enter</kbd> stop · <kbd>Esc</kbd> stop
    </>
  ) : (
    <>
      <kbd>←→↑↓</kbd> move · <kbd>Enter</kbd> pick up · <kbd>Q</kbd>/<kbd>E</kbd> aisles
      {!room && (
        <>
          {" "}
          · <kbd>C</kbd> crate
        </>
      )}{" "}
      · <kbd>B</kbd> board
    </>
  );

  const heldPanel = held && !playing && (
    <div className="ps2-hud ps2-pane ps2-info" role="dialog" aria-label={held.title}>
      <img className="ps2-cover" src={held.art} alt={`Cover of ${held.title}`} />
      <div className="ps2-chip">{FORMAT_NAMES[held.format]}</div>
      <h2>{held.title}</h2>
      {held.artist && <div className="by">{held.format === "dvd" ? `Directed by ${held.artist}` : held.artist}</div>}
      <div className="ps2-meta">
        {held.year && <span className="ps2-chip">{held.year}</span>}
        {held.genre && <span className="ps2-chip">{held.genre}</span>}
        {crateIds.has(held.id) && <span className="ps2-chip">In crate</span>}
        {ownedIds.has(held.id) && <span className="ps2-chip">Yours</span>}
      </div>
      {held.blurb && <p>{held.blurb}</p>}
      {held.previewLabel && held.format !== "dvd" && <p className="ps2-credit">Preview: “{held.previewLabel}”</p>}
      <div className="ps2-menu">
        {room ? (
          <>
            <button disabled={busy} onClick={() => void engineRef.current?.playHeld()}>
              {held.format === "dvd" ? "Watch" : "Play"} on the {DEVICE_NAME[held.format]}
            </button>
            <button disabled={busy} onClick={() => setNotebook({ open: true, itemId: held.id })}>
              {snap.reviewed.includes(held.id) ? "Edit your review" : "Write a review"}
            </button>
          </>
        ) : (
          <>
            <button disabled={busy} onClick={() => void engineRef.current?.playHeld()}>
              {held.format === "dvd" ? "Watch the trailer" : "Listen"} at the listening post
            </button>
            <button
              disabled={busy || pending || (snap.signedIn && status.remaining === 0)}
              onClick={() => void putInCrate()}
            >
              Put in crate
              <span className="k">{snap.signedIn ? `${status.remaining} left` : "sign in"}</span>
            </button>
          </>
        )}
        <button disabled={busy} onClick={() => void engineRef.current?.flip()}>
          Flip it over <span className="k">Space</span>
        </button>
        <button disabled={busy} onClick={() => void openBoard(held.id)}>
          Reviews on the board
        </button>
        <button disabled={busy} onClick={() => void engineRef.current?.putBack()}>
          Put it back <span className="k">Esc</span>
        </button>
      </div>
      {held.storeUrl && (
        <p className="ps2-credit">
          Artwork and preview from{" "}
          <a href={held.storeUrl} target="_blank" rel="noopener noreferrer">
            Apple
          </a>
        </p>
      )}
    </div>
  );

  const playingPanel = playing && (
    <div className="ps2-hud ps2-pane ps2-info" role="status">
      <span className="ps2-lbl">{playing.item.format === "dvd" ? "Now showing" : "Now playing"}</span>
      <h2>{playing.item.title}</h2>
      {playing.item.artist && <div className="by">{playing.item.artist}</div>}
      <div className="ps2-np">
        {playing.item.format === "dvd"
          ? playing.trailer
            ? "▶ TRAILER"
            : playing.item.previewUrl
              ? "LOADING TRAILER..."
              : "NO TRAILER ON FILE · TITLE MENU"
          : playing.item.previewUrl
            ? `▶ ${playing.item.previewLabel ?? "PREVIEW"} · 30 SEC CLIP`
            : "NO PREVIEW ON FILE"}
        <div className="bar">
          <i style={{ width: `${Math.round(playing.progress * 100)}%` }} />
        </div>
      </div>
      <div className="ps2-menu">
        <button disabled={busy} onClick={() => void engineRef.current?.stopPlaying()}>
          Stop and take it out <span className="k">Enter</span>
        </button>
      </div>
    </div>
  );

  const crateItems = snap.crate;
  const cratePanel = crateOpen && !room && (
    <div className="ps2-hud ps2-pane ps2-crate" role="dialog" aria-label="Your crate">
      <h3>Your crate</h3>
      {crateItems.length === 0 ? (
        <p className="ps2-lbl">Empty. Pick something up and put it in.</p>
      ) : (
        crateItems.map((it) => (
          <div className="ps2-row" key={it.id}>
            <img src={it.art} alt="" />
            <div>
              <b>{it.title}</b>
              <span>
                {FORMAT_NAMES[it.format]}
                {it.artist ? ` · ${it.artist}` : ""}
              </span>
            </div>
            <div className="btns">
              <button disabled={pending || busy} onClick={() => void takeOutOfCrate(it)}>
                Put back
              </button>
            </div>
          </div>
        ))
      )}
      <div className="ps2-btnrow" style={{ marginTop: 8 }}>
        <button className="ps2-btn" onClick={() => setCrateOpen(false)}>
          Keep browsing
        </button>
        <button className="ps2-btn amber" disabled={busy || crateItems.length === 0} onClick={() => void toCounter()}>
          Check out
        </button>
      </div>
    </div>
  );

  const launch = launchAt ? new Date(launchAt) : null;
  const adminBox = snap.isAdmin && (
    <div className="ps2-launch">
      <div>
        {launch
          ? launch.getTime() > now
            ? `Public from ${launch.toISOString().slice(0, 16).replace("T", " ")} UTC`
            : "Open to everybody"
          : "Admins only. Members still see the feed."}
      </div>
      {!launch ? (
        <button
          className="ps2-btn amber"
          onClick={async () => {
            if (!window.confirm("Start the three-day countdown? Members will see it on the homepage straight away.")) return;
            const res = await startStoreCountdown();
            if (res.ok) {
              setLaunchAt(res.launchAt);
              say("Countdown started.");
            } else say(res.error, true);
          }}
        >
          Start 3-day countdown
        </button>
      ) : (
        launch.getTime() > now && (
          <button
            className="ps2-btn"
            onClick={async () => {
              if (!window.confirm("Cancel the countdown? The homepage goes back to the feed for members.")) return;
              const res = await cancelStoreCountdown();
              if (res.ok) {
                setLaunchAt(null);
                say("Countdown cancelled.");
              } else say(res.error, true);
            }}
          >
            Cancel countdown
          </button>
        )
      )}
    </div>
  );

  const tabs = loc.stations;

  return (
    <div className="ps2" aria-label="The Record Store">
      <canvas ref={canvasRef} className="ps2-gl" tabIndex={0} aria-label={`3D ${room ? "bedroom" : "record store"}. ${focusLabel}`} />
      <img ref={handRef} className="ps2-hand" alt="" draggable={false} style={{ display: "none" }} />
      <video ref={videoRef} className="ps2-video" playsInline style={{ display: "none" }} />

      {(phase === "store" || phase === "room") && (
        <>
          <div className="ps2-hud ps2-top">
            <div className="ps2-pane ps2-where">
              <span className="ps2-lbl">{loc.station?.tag ?? "Location"}</span>
              <b>{loc.station?.name ?? "The Record Store"}</b>
              <div className="ps2-tabs" role="tablist" aria-label={room ? "Bedroom" : "Aisles"}>
                {tabs.map((s, i) => (
                  <button
                    key={s.id}
                    role="tab"
                    aria-selected={i === loc.index}
                    className={i === loc.index ? "on" : ""}
                    disabled={busy}
                    onClick={() => void engineRef.current?.goStation(i)}
                  >
                    {s.name.replace("Import ", "").replace("Community ", "")}
                  </button>
                ))}
              </div>
            </div>
            <div className="ps2-pane ps2-meter">
              <span className="ps2-lbl">{snap.signedIn ? `@${snap.username ?? "you"} · pick-ups today` : "Pick-ups today"}</span>
              <div className="ps2-pips" aria-hidden="true">
                {Array.from({ length: status.limit }, (_, i) => (
                  <span
                    key={i}
                    className={`ps2-pip${i < status.usedToday ? " used" : i < status.usedToday + crateItems.length ? " crate" : ""}`}
                  />
                ))}
              </div>
              <small>{snap.signedIn ? remainingText : "Sign in to take things home"}</small>
              <div className="ps2-links">
                {!room && (
                  <button onClick={() => setCrateOpen((o) => !o)}>Crate ({crateItems.length})</button>
                )}
                <button onClick={() => void openBoard(null)}>Board</button>
                <button onClick={() => setListView(true)}>List view</button>
                <button onClick={toggleMute} aria-pressed={muted}>
                  {muted ? "Sound off" : "Sound on"}
                </button>
                <Link href="/feed">Feed</Link>
                {!snap.signedIn && <Link href="/sign-in">Sign in</Link>}
              </div>
              {adminBox}
            </div>
          </div>

          {heldPanel}
          {playingPanel}
          {cratePanel}

          <div className="ps2-hud ps2-bottom">
            <div className="ps2-pane ps2-hints" aria-live="polite">
              {focusLabel && !held && !playing && <div style={{ color: "#fff", marginBottom: 2 }}>{focusLabel}</div>}
              {hints}
            </div>
            <div className="ps2-btnrow">
              {room ? (
                <>
                  <button className="ps2-btn" disabled={busy} onClick={() => setNotebook({ open: true, itemId: null })}>
                    Notebook
                  </button>
                  <button className="ps2-btn amber" disabled={busy} onClick={() => void goToStore()}>
                    Back to the store
                  </button>
                </>
              ) : (
                <>
                  {snap.owned.length > 0 && (
                    <button className="ps2-btn" disabled={busy} onClick={() => void goHome()}>
                      Go home
                    </button>
                  )}
                  <button className="ps2-btn amber" disabled={busy} onClick={() => void toCounter()}>
                    Checkout ({crateItems.length})
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {dialog && (
        <div className="ps2-hud ps2-pane ps2-dlg" role="dialog" aria-label="Cashier">
          <div className="who">CASHIER</div>
          <div className="txt">{dialog.text}</div>
          {dialog.choices.length > 0 && (
            <div className="ps2-menu">
              {dialog.choices.map((c, i) => (
                <button key={c.label} autoFocus={i === 0} disabled={pending} onClick={c.run}>
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {phase === "start" && (
        <div className="ps2-overlay ps2-start">
          <h1>
            The Record
            <br />
            Store
            <em>MUSIC &amp; MOVIES</em>
          </h1>
          <p>
            Walk the aisles, pick things up, try them at the listening post and fill your crate: five a day, music and
            films together. Take them home, play them in your room, and write your review on paper for the community
            board.
          </p>
          <p>
            {snap.signedIn ? (
              <>Shopping as @{snap.username}.</>
            ) : (
              <>
                You can look around. <Link href="/sign-in">Sign in</Link> to take things home.
              </>
            )}
          </p>
          <button className="ps2-btn amber" autoFocus onClick={pressStart}>
            <span className="ps2-blink">Press start</span>
          </button>
          <span className="ps2-lbl">
            Arrows or WASD to move · Enter to pick up · Q / E between aisles ·{" "}
            <button className="ps2-btn" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => { pressStart(); setListView(true); }}>
              List view
            </button>
          </span>
          {glFailed && <span className="ps2-lbl">3D isn&apos;t available on this device, so the shop opens as a list.</span>}
        </div>
      )}

      {phase === "loading" && (
        <div className="ps2-overlay ps2-loading" role="status">
          <div className="ps2-pillars" aria-hidden="true">
            {[6, 19, 33, 48, 62, 77, 91].map((x, i) => (
              <i key={x} style={{ left: `${x}%`, animationDelay: `${-i * 1.3}s` }} />
            ))}
          </div>
          <div className="t">{loading.text}</div>
          <div className="ps2-segbar" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => (
              <i key={i} className={i < loading.filled ? "on" : ""} />
            ))}
          </div>
          <div className="tip">TIP: EVERYTHING YOU TAKE HOME STAYS ON YOUR SHELF FOR GOOD</div>
        </div>
      )}

      {board.open && (
        <Board
          state={board}
          onChange={(b) => setBoard((s) => ({ ...s, ...b }))}
          onClose={() => setBoard((s) => ({ ...s, open: false }))}
        />
      )}

      {notebook.open && (
        <Notebook
          owned={snap.owned}
          reviewed={snap.reviewed}
          initialId={notebook.itemId}
          onClose={() => setNotebook({ open: false, itemId: null })}
          onSubmit={async (itemId, rating, body) => {
            const res = await submitStoreReview(itemId, rating, body);
            if (!res.ok) return res.error;
            setSnap(res.snapshot);
            setBoard((b) => ({ ...b, reviews: null }));
            engineRef.current?.audio.sfx.confirm();
            say("Pinned to the community board.");
            return null;
          }}
        />
      )}

      {listView && (
        <ListView
          snap={snap}
          crateIds={crateIds}
          pending={pending}
          glFailed={glFailed}
          onClose={() => setListView(false)}
          onAdd={async (item) => {
            if (!snap.signedIn) return say("Sign in to fill a crate.", true);
            setPending(true);
            const res = await addToCrate(item.id);
            setPending(false);
            if (apply(res)) {
              // Keep the 3D shop in step: the model goes in the crate too.
              void engineRef.current?.crateFromShelf(item.id);
              say(`${item.title} is in your crate.`);
            }
          }}
          onRemove={(item) => void takeOutOfCrate(item)}
          onCheckout={async () => {
            if (!window.confirm("Are you sure these are all the items you want?")) return;
            setPending(true);
            const res = await checkout();
            setPending(false);
            if (apply(res)) {
              engineRef.current?.emptyCrate();
              engineRef.current?.setOwned(res.ok ? res.snapshot.owned : []);
              say("Checked out. They're yours.");
            }
          }}
          onReview={(item) => setNotebook({ open: true, itemId: item.id })}
        />
      )}

      {toast && (
        <div className={`ps2-toast${toast.bad ? " bad" : ""}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}

// ---------- the community board ----------

function Board({
  state,
  onChange,
  onClose,
}: {
  state: { reviews: BoardReview[] | null; kind: "all" | "music" | "movie_tv"; sort: "new" | "top"; itemId: string | null };
  onChange: (b: Partial<{ kind: "all" | "music" | "movie_tv"; sort: "new" | "top"; itemId: string | null }>) => void;
  onClose: () => void;
}) {
  const list = useMemo(() => {
    let r = state.reviews ?? [];
    if (state.itemId) r = r.filter((x) => x.itemId === state.itemId);
    if (state.kind !== "all") r = r.filter((x) => x.mediaType === state.kind);
    if (state.sort === "top") r = [...r].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return r;
  }, [state]);
  return (
    <div className="ps2-overlay" role="dialog" aria-label="Community board">
      <div className="ps2-cork">
        <header>
          <h2>Community Board</h2>
          <div className="ps2-tools">
            {(
              [
                ["all", "All"],
                ["music", "Music"],
                ["movie_tv", "Movies"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} className={state.kind === k ? "on" : ""} onClick={() => onChange({ kind: k })}>
                {label}
              </button>
            ))}
            <span style={{ width: 8 }} />
            <button className={state.sort === "new" ? "on" : ""} onClick={() => onChange({ sort: "new" })}>
              Newest
            </button>
            <button className={state.sort === "top" ? "on" : ""} onClick={() => onChange({ sort: "top" })}>
              Top rated
            </button>
            {state.itemId && <button onClick={() => onChange({ itemId: null })}>Show everything</button>}
          </div>
          <button className="ps2-btn" onClick={onClose} autoFocus>
            Close
          </button>
        </header>
        <div className="ps2-cards">
          {state.reviews === null ? (
            <div className="ps2-empty">Loading the board...</div>
          ) : list.length === 0 ? (
            <div className="ps2-empty">
              {state.itemId ? "Nobody has pinned a review of this one yet." : "Nothing pinned yet. Take something home and be first."}
            </div>
          ) : (
            list.map((r, i) => (
              <Link
                key={r.postId}
                href={`/post/${r.postId}`}
                className="ps2-card"
                style={{ ["--r" as string]: `${((i * 37) % 7) - 3}deg` }}
              >
                <div className="row">
                  <img src={r.art} alt={`Cover of ${r.title}`} />
                  <div>
                    <h4>{r.title}</h4>
                    <div className="who">
                      @{r.username} · {FORMAT_NAMES[r.format]}
                    </div>
                    <div className="ps2-stars" aria-label={r.rating ? `${r.rating} out of 5` : "No rating"}>
                      {stars(r.rating)}
                    </div>
                  </div>
                </div>
                {r.body && <p>{r.body}</p>}
                <time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleDateString()}</time>
              </Link>
            ))
          )}
        </div>
        <footer>
          <span>Reviews written at home, by people who took the thing home.</span>
          <span>{list.length} pinned</span>
        </footer>
      </div>
    </div>
  );
}

// ---------- the notebook ----------

function Notebook({
  owned,
  reviewed,
  initialId,
  onClose,
  onSubmit,
}: {
  owned: StoreItem[];
  reviewed: string[];
  initialId: string | null;
  onClose: () => void;
  onSubmit: (itemId: string, rating: number | null, body: string) => Promise<string | null>;
}) {
  const [itemId, setItemId] = useState<string | null>(initialId ?? owned.find((o) => !reviewed.includes(o.id))?.id ?? owned[0]?.id ?? null);
  const [rating, setRating] = useState<number | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [flying, setFlying] = useState(false);
  const item = owned.find((o) => o.id === itemId) ?? null;
  return (
    <div className="ps2-overlay" role="dialog" aria-label="Review notebook">
      <div className={`ps2-notebook${flying ? " ps2-fly" : ""}`}>
        <aside>
          <h3>Your collection</h3>
          {owned.length === 0 && <p className="ps2-lbl">Nothing yet. Check something out at the store first.</p>}
          {owned.map((o) => (
            <button
              key={o.id}
              className={`ps2-pick${o.id === itemId ? " on" : ""}`}
              onClick={() => {
                setItemId(o.id);
                setError(null);
              }}
            >
              <img src={o.art} alt="" />
              <span>
                <b>{o.title}</b>
                <span>{FORMAT_NAMES[o.format]}</span>
                {reviewed.includes(o.id) && <span className="done"> · reviewed</span>}
              </span>
            </button>
          ))}
        </aside>
        <div className="ps2-sheet">
          <button className="ps2-close" onClick={onClose}>
            Close
          </button>
          <div className="inner">
            {item ? (
              <form
                style={{ display: "contents" }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSending(true);
                  setError(null);
                  const err = await onSubmit(item.id, rating, body);
                  setSending(false);
                  if (err) return setError(err);
                  setFlying(true);
                  window.setTimeout(onClose, 850);
                }}
              >
                <h2>{item.title}</h2>
                <div className="sub">
                  {item.artist ? `${item.artist} · ` : ""}
                  {FORMAT_NAMES[item.format]}
                  {reviewed.includes(item.id) ? " · writing again replaces your review" : ""}
                </div>
                <div className="ps2-starrow" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      type="button"
                      key={n}
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={`${n} star${n === 1 ? "" : "s"}`}
                      className={rating !== null && n <= rating ? "on" : ""}
                      onClick={() => setRating(rating === n ? null : n)}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <label className="ps2-sr" htmlFor="ps2-review">
                  Your review
                </label>
                <textarea
                  id="ps2-review"
                  value={body}
                  maxLength={5000}
                  placeholder="Dear diary..."
                  onChange={(e) => setBody(e.target.value)}
                />
                <div className="foot">
                  <span>{body.length} / 5000</span>
                  {error && <span className="err">{error}</span>}
                  <button className="ps2-btn amber" type="submit" disabled={sending || (!body.trim() && rating === null)}>
                    {sending ? "Pinning..." : "Pin it to the board"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h2>Nothing to write about yet</h2>
                <div className="sub">Everything you take home from the store shows up here.</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- the list view, for anyone who would rather not walk ----------

function ListView({
  snap,
  crateIds,
  pending,
  glFailed,
  onClose,
  onAdd,
  onRemove,
  onCheckout,
  onReview,
}: {
  snap: StoreSnapshot;
  crateIds: Set<string>;
  pending: boolean;
  glFailed: boolean;
  onClose: () => void;
  onAdd: (item: StoreItem) => void;
  onRemove: (item: StoreItem) => void;
  onCheckout: () => void;
  onReview: (item: StoreItem) => void;
}) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audioRef.current?.pause(), []);
  const preview = (item: StoreItem) => {
    audioRef.current?.pause();
    if (playingId === item.id || !item.previewUrl) return setPlayingId(null);
    if (item.format === "dvd") {
      window.open(item.previewUrl, "_blank", "noopener");
      return;
    }
    const a = new Audio(item.previewUrl);
    audioRef.current = a;
    a.onended = () => setPlayingId(null);
    void a.play().then(() => setPlayingId(item.id)).catch(() => setPlayingId(null));
  };
  const row = (it: StoreItem, actions: React.ReactNode) => (
    <div className="ps2-row" key={it.id}>
      <img src={it.art} alt={`Cover of ${it.title}`} />
      <div>
        <b>{it.title}</b>
        <span>
          {FORMAT_NAMES[it.format]}
          {it.artist ? ` · ${it.artist}` : ""}
          {it.year ? ` · ${it.year}` : ""}
        </span>
      </div>
      <div className="btns">{actions}</div>
    </div>
  );
  return (
    <div className="ps2-overlay" role="dialog" aria-label="The shop as a list">
      <div className="ps2-pane" style={{ width: "min(760px, 100%)", maxHeight: "100%", overflow: "auto", padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>The Record Store</h2>
          <div className="ps2-btnrow">
            {!glFailed && (
              <button className="ps2-btn" onClick={onClose} autoFocus>
                Back to 3D
              </button>
            )}
            <Link className="ps2-btn" href="/feed">
              Feed
            </Link>
          </div>
        </div>
        <p className="ps2-lbl">
          {snap.signedIn ? `${snap.status.remaining} of ${snap.status.limit} pick-ups left today (resets midnight UTC)` : "Sign in to take things home."}
        </p>
        <h3>Your crate ({snap.crate.length})</h3>
        {snap.crate.map((it) =>
          row(
            it,
            <button disabled={pending} onClick={() => onRemove(it)}>
              Remove
            </button>
          )
        )}
        {snap.crate.length > 0 && (
          <button className="ps2-btn amber" disabled={pending} onClick={onCheckout}>
            Check out {snap.crate.length}
          </button>
        )}
        {SECTIONS.map((sec) => (
          <section key={sec.id}>
            <h3>{sec.name}</h3>
            {(snap.shelves[sec.id] ?? [])
              .filter((it) => !crateIds.has(it.id))
              .map((it) =>
                row(
                  it,
                  <>
                    {it.previewUrl && (
                      <button onClick={() => preview(it)}>{playingId === it.id ? "Stop" : it.format === "dvd" ? "Trailer" : "Listen"}</button>
                    )}
                    <button disabled={pending || (snap.signedIn && snap.status.remaining === 0)} onClick={() => onAdd(it)}>
                      Crate
                    </button>
                  </>
                )
              )}
            {(snap.shelves[sec.id] ?? []).length === 0 && <p className="ps2-lbl">Sold out today.</p>}
          </section>
        ))}
        <h3>Your collection ({snap.owned.length})</h3>
        {snap.owned.map((it) =>
          row(
            it,
            <button onClick={() => onReview(it)}>{snap.reviewed.includes(it.id) ? "Edit review" : "Review"}</button>
          )
        )}
      </div>
    </div>
  );
}
