import * as THREE from "three";
import type { StoreFormat, StoreItem } from "@/lib/store";
import { StoreAudio } from "./audio";
import { buildItem, drawCRT, itemFace, makeRenderer, makeTextures, type CRT, type CrtMode, type Device, type ItemModel, type Renderer } from "./gfx";
import {
  buildCrate,
  buildRoom,
  buildSelector,
  buildStore,
  camLocal,
  crateSlot,
  fitStations,
  placeCrate,
  stockRoom,
  updateSelector,
  type Crate,
  type Room,
  type Selector,
  type Spot,
  type Station,
  type Store,
  type World,
} from "./worlds";

// The record store's game logic: where the camera is, what the cursor is
// on, the hand, and every animated sequence - picking a thing up, playing
// it on the listening post, dropping it in the crate, taking it home and
// playing it in the bedroom.
//
// The engine draws and animates. It does not decide anything: whether an
// item may go in the crate, or be checked out, is asked of the server by
// the React layer first, and the engine is only told to animate what the
// server agreed to.

export type WorldName = "store" | "room";
export type PlayState = { item: StoreItem; progress: number; trailer: boolean } | null;

export type EngineEvents = {
  location(world: WorldName, station: Station, index: number, stations: Station[]): void;
  focus(spot: Spot | null): void;
  held(item: StoreItem | null): void;
  busy(busy: boolean): void;
  playing(state: PlayState): void;
  activate(spot: Spot): void;
  error(message: string): void;
};

type Tween = { t: number; dur: number; fn: (k: number) => void; ease: (k: number) => number; done: () => void };
const ease = {
  io: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  back: (t: number) => {
    const c = 1.7;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
  lin: (t: number) => t,
};

const HAND = { reach: "/store/hand_reach.png", open: "/store/hand_open.png", grab: "/store/hand_grab.png" };

type Held = { spot: Spot; model: ItemModel; flipped: boolean; rot: THREE.Euler };
type Playback = {
  item: StoreItem;
  model: ItemModel;
  device: Device;
  media: THREE.Group;
  mediaHome: { pos: THREE.Vector3; rot: THREE.Euler };
  tv: CRT | null;
  trailer: boolean;
  spinning: boolean;
  returnStation: number;
};

export class StoreEngine {
  private r: Renderer;
  private T = makeTextures();
  store: Store;
  room: Room;
  private crate: Crate;
  /** Shelf spots of things now in the crate, so they can go back. */
  private crateHomes = new Map<string, Spot>();
  private sel: Selector;
  private world: WorldName = "store";
  private stationIdx: Record<WorldName, number> = { store: 0, room: 0 };
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private focusSpot: Spot | null = null;
  private held: Held | null = null;
  private play: Playback | null = null;
  private tweens: Tween[] = [];
  private busyCount = 0;
  private raf = 0;
  private last = 0;
  private hidden = false;
  private crtMode: Record<"store" | "room", CrtMode> = { store: "off", room: "off" };
  private crtItem: StoreItem | null = null;
  private crtTick = 0;
  private drag: { x: number; y: number; moved: boolean } | null = null;
  private handState: { visible: boolean; x: number; y: number; pose: keyof typeof HAND; follow: THREE.Object3D | null } = {
    visible: false,
    x: 0,
    y: 0,
    pose: "open",
    follow: null,
  };
  private speed: number;
  audio = new StoreAudio();
  private disposed = false;
  private cashierMouth = 0;
  private blinkAt = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private hand: HTMLImageElement,
    private video: HTMLVideoElement,
    data: { shelves: Record<StoreFormat, StoreItem[]>; crate: StoreItem[]; owned: StoreItem[] },
    private ev: EngineEvents,
    opts: { reducedMotion: boolean }
  ) {
    this.speed = opts.reducedMotion ? 0.35 : 1;
    this.r = makeRenderer(canvas);
    this.store = buildStore(this.T, data.shelves);
    this.room = buildRoom(this.T);
    stockRoom(this.room, data.owned);
    this.sel = buildSelector();
    this.crate = buildCrate(this.T);
    this.store.cam.add(this.crate);
    // A key light that travels with the camera, so whatever is in your
    // hand is lit even when it is held up out of the shelf's spotlight.
    for (const world of [this.store, this.room]) {
      const key = new THREE.PointLight(0xffe2c0, 1.1 * Math.PI, 9, 0);
      key.position.set(0.6, 0.8, 0.5);
      world.cam.add(key);
    }
    // What was already in the crate when the page loaded. Its shelf slot
    // is kept, so taking it out puts it back where it was.
    for (const item of data.crate) {
      const spot = this.store.spots.find((s) => s.item?.id === item.id);
      if (spot) {
        this.store.spots = this.store.spots.filter((s) => s !== spot);
        this.crateHomes.set(item.id, spot);
        this.crate.attach(spot.group);
        this.crate.userData.contents.push({ id: item.id, model: spot.group as ItemModel });
      } else {
        this.addCrateModel(item);
      }
    }
    this.layoutCrate(true);
    for (const src of Object.values(HAND)) {
      const img = new Image();
      img.src = src;
    }
    this.bind();
    this.resize();
    this.snapToStation();
    this.drawTV();
  }

  // ---------- lifecycle ----------

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      if (this.hidden) {
        this.last = now;
        return;
      }
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.tick(dt, now / 1000);
    };
    this.raf = requestAnimationFrame(loop);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.unbind();
    this.audio.dispose();
    this.video.pause();
    this.video.removeAttribute("src");
    for (const w of [this.store, this.room]) {
      w.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        for (const x of Array.isArray(mat) ? mat : mat ? [mat] : []) {
          (x as THREE.MeshBasicMaterial).map?.dispose();
          x.dispose();
        }
      });
    }
    this.r.dispose();
  }

  // ---------- input ----------

  private onResize = () => this.resize();
  private onVisibility = () => {
    this.hidden = document.hidden;
  };
  private onPointerMove = (e: PointerEvent) => {
    if (this.drag) {
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) this.drag.moved = true;
      if (this.held && this.drag.moved) this.rotateHeld(dx * 0.012, dy * 0.012);
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
      return;
    }
    if (this.busyCount > 0 || this.held || this.play) return;
    const hit = this.pick(e.clientX, e.clientY);
    if (hit && hit !== this.focusSpot) {
      this.setFocus(hit);
      this.audio.sfx.move();
    }
  };
  private onPointerDown = (e: PointerEvent) => {
    this.drag = { x: e.clientX, y: e.clientY, moved: false };
    this.canvas.setPointerCapture?.(e.pointerId);
  };
  private onPointerUp = (e: PointerEvent) => {
    const d = this.drag;
    this.drag = null;
    if (!d || d.moved || this.busyCount > 0 || this.held || this.play) return;
    const hit = this.pick(e.clientX, e.clientY);
    if (hit) {
      this.setFocus(hit);
      this.activate();
    }
  };

  private bind() {
    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
  }
  private unbind() {
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
  }

  private pick(clientX: number, clientY: number): Spot | null {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.w.cam);
    const spots = this.spotsHere();
    const hits = ray.intersectObjects(
      spots.map((s) => s.group),
      true
    );
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        const s = spots.find((x) => x.group === o);
        if (s) return s;
        o = o.parent;
      }
    }
    return null;
  }

  // ---------- worlds, stations, the cursor ----------

  private get w(): World {
    return this.world === "store" ? this.store : this.room;
  }

  get currentWorld(): WorldName {
    return this.world;
  }

  get station(): Station {
    return this.w.stations[this.stationIdx[this.world]];
  }

  private spotsHere(): Spot[] {
    const st = this.station.id;
    return this.w.spots.filter((s) => {
      if (s.group.parent === null) return false;
      if (this.world === "room" && st === "bed") return s.kind !== "item";
      return s.station === st || (this.world === "room" && st === "desk" && s.kind === "notebook");
    });
  }

  private stationCamera(st: Station): { pos: THREE.Vector3; look: THREE.Vector3 } {
    const dir = (st.dir ?? new THREE.Vector3(0, 0.12, 1)).clone().normalize();
    const pos = st.look.clone().addScaledVector(dir, st.dist + 1.2);
    if (this.world === "room") {
      // Inside the room's walls, whatever the screen shape asks for.
      pos.x = Math.max(-10.6, Math.min(10.6, pos.x));
      pos.z = Math.min(11.2, pos.z);
      pos.y = Math.min(8.6, pos.y);
    } else {
      pos.z = Math.min(19, pos.z);
      pos.y = Math.min(9.5, Math.max(3, pos.y));
    }
    return { pos, look: st.look.clone() };
  }

  private snapToStation() {
    const { pos, look } = this.stationCamera(this.station);
    this.camPos.copy(pos);
    this.camLook.copy(look);
    this.applyCam();
    this.announce();
    this.resetFocus();
  }

  private applyCam() {
    const cam = this.w.cam;
    cam.position.copy(this.camPos);
    cam.lookAt(this.camLook);
  }

  private announce() {
    this.ev.location(this.world, this.station, this.stationIdx[this.world], this.w.stations);
  }

  private resetFocus() {
    const spots = this.spotsHere();
    this.setFocus(spots[0] ?? null);
  }

  private setFocus(s: Spot | null) {
    this.focusSpot = s;
    this.ev.focus(s);
  }

  async goStation(i: number) {
    const n = this.w.stations.length;
    const next = ((i % n) + n) % n;
    if (next === this.stationIdx[this.world] || this.busyCount > 0 || this.play) return;
    if (this.held) await this.putBack();
    this.stationIdx[this.world] = next;
    this.audio.sfx.pan();
    this.setFocus(null);
    this.announce();
    await this.glideTo(this.station, 0.85);
    this.resetFocus();
  }

  nextStation(step: number) {
    return this.goStation(this.stationIdx[this.world] + step);
  }

  private async glideTo(st: Station, dur: number) {
    const { pos, look } = this.stationCamera(st);
    const p0 = this.camPos.clone();
    const l0 = this.camLook.clone();
    await this.tween(dur, (k) => {
      this.camPos.lerpVectors(p0, pos, k);
      this.camLook.lerpVectors(l0, look, k);
      this.applyCam();
    });
  }

  /** Arrow keys: the nearest thing in that direction on screen; past the edge, the next station. */
  moveCursor(dx: number, dy: number) {
    if (this.busyCount > 0 || this.play) return;
    if (this.held) {
      this.rotateHeld(dx * 0.35, dy * 0.35);
      return;
    }
    const spots = this.spotsHere();
    if (!spots.length) {
      if (dx) void this.nextStation(dx);
      return;
    }
    const cur = this.focusSpot && spots.includes(this.focusSpot) ? this.focusSpot : null;
    if (!cur) {
      this.setFocus(spots[0]);
      return;
    }
    const at = this.screenOf(cur.group);
    let best: Spot | null = null;
    let bestScore = Infinity;
    for (const s of spots) {
      if (s === cur) continue;
      const p = this.screenOf(s.group);
      const vx = p.x - at.x;
      const vy = p.y - at.y;
      const along = dx ? vx * dx : vy * dy;
      if (along <= 4) continue;
      const across = dx ? Math.abs(vy) : Math.abs(vx);
      const score = along + across * 2.5;
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    }
    if (best) {
      this.setFocus(best);
      this.audio.sfx.move();
    } else if (dx) {
      void this.nextStation(dx);
    }
  }

  focusById(itemId: string) {
    const s = this.spotsHere().find((x) => x.item?.id === itemId);
    if (s) this.setFocus(s);
  }

  /** Enter, or a click: pick up what the cursor is on, or open it. */
  activate() {
    const s = this.focusSpot;
    if (!s || this.busyCount > 0 || this.play || this.held) return;
    if (s.kind === "item") void this.pickUp(s);
    else {
      this.audio.sfx.select();
      this.ev.activate(s);
    }
  }

  // ---------- the hand ----------

  private screenOf(o: THREE.Object3D): { x: number; y: number } {
    const p = new THREE.Vector3();
    o.getWorldPosition(p);
    p.project(this.w.cam);
    const rect = this.canvas.getBoundingClientRect();
    return { x: ((p.x + 1) / 2) * rect.width, y: ((1 - p.y) / 2) * rect.height };
  }

  private setHand(pose: keyof typeof HAND, visible = true) {
    this.handState.pose = pose;
    this.handState.visible = visible;
    const src = HAND[pose];
    if (!this.hand.src.endsWith(src)) this.hand.src = src;
  }

  private drawHand() {
    const h = this.handState;
    if (h.follow) {
      const p = this.screenOf(h.follow);
      h.x = p.x;
      h.y = p.y;
    }
    this.hand.style.display = h.visible ? "block" : "none";
    if (!h.visible) return;
    // The pinch point is about 10% across and 30% down the sprite.
    const w = this.hand.clientWidth || 300;
    this.hand.style.transform = `translate(${Math.round(h.x - w * 0.1)}px, ${Math.round(h.y - w * 0.3)}px)`;
  }

  /** A point on the item's lower right edge, where a hand would hold it. */
  private gripOf(model: THREE.Object3D): THREE.Object3D {
    let grip = model.getObjectByName("grip");
    if (!grip) {
      const m = model as ItemModel;
      grip = new THREE.Object3D();
      grip.name = "grip";
      grip.position.set(m.userData.W * 0.42, -m.userData.H * 0.3, m.userData.D / 2);
      model.add(grip);
    }
    return grip;
  }

  private async reachTo(model: THREE.Object3D) {
    const target = this.gripOf(model);
    const rect = this.canvas.getBoundingClientRect();
    const end = this.screenOf(target);
    const start = { x: rect.width + 60, y: rect.height + 80 };
    this.handState.follow = null;
    this.setHand("reach");
    await this.tween(0.32, (k) => {
      this.handState.x = start.x + (end.x - start.x) * k;
      this.handState.y = start.y + (end.y - start.y) * k;
    }, ease.out);
    this.setHand("open");
    await this.wait(0.06);
    this.setHand("grab");
    this.audio.sfx.grab();
    this.handState.follow = target;
  }

  private async handAway() {
    const rect = this.canvas.getBoundingClientRect();
    const from = { x: this.handState.x, y: this.handState.y };
    this.handState.follow = null;
    this.setHand("open");
    await this.tween(0.28, (k) => {
      this.handState.x = from.x + (rect.width + 60 - from.x) * k;
      this.handState.y = from.y + (rect.height + 80 - from.y) * k;
    }, ease.io);
    this.handState.visible = false;
  }

  // ---------- holding things ----------

  private holdPose(model: ItemModel) {
    const big = Math.max(model.userData.W, model.userData.H) * model.scale.x;
    const dist = 2.6 + big * 1.45;
    const aspect = this.w.cam.aspect;
    const nx = aspect < 1 ? 0 : -0.12;
    const ny = aspect < 1 ? 0.22 : 0.04;
    return { pos: camLocal(this.w.cam, nx, ny, dist), rot: new THREE.Euler(0, 0, 0) };
  }

  async pickUp(spot: Spot) {
    if (!spot.item) return;
    const model = (this.world === "store" ? this.store.models : this.room.models).get(spot.item.id);
    if (!model) return;
    this.busy(+1);
    try {
      await this.reachTo(model);
      this.w.cam.attach(model);
      const { pos, rot } = this.holdPose(model);
      await this.moveTo(model, pos, rot, 0.55, ease.back);
      this.held = { spot, model, flipped: false, rot: rot.clone() };
      this.ev.held(spot.item);
      this.setFocus(null);
    } finally {
      this.busy(-1);
    }
  }

  rotateHeld(dx: number, dy: number) {
    const h = this.held;
    if (!h) return;
    h.rot.y = Math.max(-1.2, Math.min(1.2, h.rot.y + dx));
    h.rot.x = Math.max(-0.8, Math.min(0.8, h.rot.x + dy));
    h.model.rotation.set(h.rot.x, h.rot.y + (h.flipped ? Math.PI : 0), 0);
  }

  async flip() {
    const h = this.held;
    if (!h || this.busyCount > 0) return;
    this.busy(+1);
    const from = h.model.rotation.y;
    h.flipped = !h.flipped;
    await this.tween(0.45, (k) => {
      h.model.rotation.y = from + Math.PI * k;
    });
    this.audio.sfx.click();
    this.busy(-1);
  }

  /** Back on the shelf it came from. */
  async putBack() {
    const h = this.held;
    if (!h || !h.spot.home) return;
    this.busy(+1);
    try {
      this.held = null;
      this.ev.held(null);
      h.spot.home.parent.attach(h.model);
      await this.moveTo(h.model, h.spot.home.pos, h.spot.home.rot, 0.5, ease.io);
      this.audio.sfx.place();
      await this.handAway();
      this.setFocus(h.spot);
    } finally {
      this.busy(-1);
    }
  }

  get holding(): StoreItem | null {
    return this.held?.spot.item ?? null;
  }

  // ---------- the crate ----------

  private addCrateModel(item: StoreItem): ItemModel {
    const model = buildItem(item, this.T);
    this.crate.add(model);
    this.crate.userData.contents.push({ id: item.id, model });
    return model;
  }

  private layoutCrate(instant: boolean) {
    const list = this.crate.userData.contents;
    list.forEach(({ model }, i) => {
      const slot = crateSlot(i, list.length, model.userData.item);
      if (instant) {
        model.position.copy(slot.pos);
        model.rotation.copy(slot.rot);
        model.scale.setScalar(slot.scale);
      } else {
        void this.moveTo(model, slot.pos, slot.rot, 0.35, ease.io, slot.scale);
      }
    });
  }

  /** The held item drops into the crate. Only called once the server has said yes. */
  async crateHeld() {
    const h = this.held;
    if (!h || !h.spot.item) return;
    this.busy(+1);
    try {
      this.held = null;
      this.ev.held(null);
      this.crate.attach(h.model);
      this.crate.userData.contents.push({ id: h.spot.item.id, model: h.model });
      this.crateHomes.set(h.spot.item.id, h.spot);
      this.w.spots = this.w.spots.filter((s) => s !== h.spot);
      const list = this.crate.userData.contents;
      const slot = crateSlot(list.length - 1, list.length, h.spot.item);
      await this.moveTo(h.model, slot.pos, slot.rot, 0.55, ease.io, slot.scale);
      this.audio.sfx.place();
      this.layoutCrate(false);
      await this.handAway();
      this.resetFocus();
    } finally {
      this.busy(-1);
    }
  }

  /** Into the crate straight from the shelf, for a crate filled from the list view. */
  async crateFromShelf(itemId: string) {
    if (this.crate.userData.contents.some((c) => c.id === itemId)) return;
    if (this.held?.spot.item?.id === itemId) return this.crateHeld();
    const spot = this.store.spots.find((s) => s.item?.id === itemId);
    if (!spot) return;
    const model = spot.group as ItemModel;
    this.store.spots = this.store.spots.filter((s) => s !== spot);
    this.crateHomes.set(itemId, spot);
    this.crate.attach(model);
    this.crate.userData.contents.push({ id: itemId, model });
    this.layoutCrate(false);
    if (this.focusSpot === spot) this.resetFocus();
  }

  /** Out of the crate and back to its slot on the shelf (if it is still in the shop). */
  async uncrate(itemId: string) {
    const list = this.crate.userData.contents;
    const idx = list.findIndex((c) => c.id === itemId);
    if (idx < 0) return;
    const [{ model }] = list.splice(idx, 1);
    const shelfSpot = this.crateHomes.get(itemId) ?? null;
    this.crateHomes.delete(itemId);
    this.busy(+1);
    try {
      if (shelfSpot?.home) {
        shelfSpot.home.parent.attach(model);
        await this.moveTo(model, shelfSpot.home.pos, shelfSpot.home.rot, 0.6, ease.io, 1);
        shelfSpot.group = model;
        this.store.models.set(itemId, model);
        this.store.spots.push(shelfSpot);
      } else {
        model.parent?.remove(model);
      }
      this.audio.sfx.place();
      this.layoutCrate(false);
    } finally {
      this.busy(-1);
    }
  }

  /** After checkout: the crate's contents go home with you. */
  emptyCrate() {
    for (const { model } of this.crate.userData.contents) model.parent?.remove(model);
    this.crate.userData.contents = [];
    this.crateHomes.clear();
  }

  // ---------- playing things ----------

  private deviceFor(format: StoreFormat): Device {
    const set = this.world === "store" ? this.store.listen : this.room.devices;
    return (set as Record<StoreFormat, Device>)[format];
  }

  private tvHere(): CRT | null {
    return (this.world === "store" ? this.store.listen.tv : this.room.devices.tv) ?? null;
  }

  private stationForDevice(format: StoreFormat): number {
    const ids = this.w.stations.map((s) => s.id);
    if (this.world === "store") return ids.indexOf("listen");
    const want = format === "dvd" ? "tv" : format === "cd" ? "desk" : "hifi";
    return ids.indexOf(want);
  }

  /** Carries the held item to the right machine and plays its preview. */
  async playHeld() {
    const h = this.held;
    const item = h?.spot.item;
    if (!h || !item || this.play || this.busyCount > 0) return;
    this.busy(+1);
    try {
      const returnStation = this.stationIdx[this.world];
      const target = this.stationForDevice(item.format);
      if (target >= 0 && target !== returnStation) {
        this.stationIdx[this.world] = target;
        this.audio.sfx.pan();
        this.announce();
        await this.glideTo(this.station, 0.8);
      }
      const device = this.deviceFor(item.format);
      const model = h.model;
      // The case sets down beside the machine; the media comes out of it.
      const beside = new THREE.Vector3();
      device.getWorldPosition(beside);
      const devBox = new THREE.Box3().setFromObject(device);
      this.w.scene.attach(model);
      // Stood up on the counter in front of the machine, leaning back a
      // little, facing whoever is listening.
      const standH = (model.userData.H * model.scale.y) / 2;
      const caseAt = new THREE.Vector3(beside.x + (devBox.max.x - beside.x) * 0.55, devBox.min.y + standH + 0.02, devBox.max.z + 0.35);
      if (item.format === "vinyl") caseAt.set(devBox.min.x + 0.9, devBox.min.y + standH - 0.6, devBox.max.z + 0.25);
      if (item.format === "dvd") caseAt.set(devBox.min.x - (model.userData.W * model.scale.x) / 2 - 0.3, devBox.min.y + standH + 0.02, beside.z + 0.3);
      await this.moveTo(model, caseAt, new THREE.Euler(-0.18, item.format === "vinyl" ? 0.3 : -0.2, 0), 0.6, ease.io);
      const media = model.userData.media;
      const mediaHome = { pos: media.position.clone(), rot: media.rotation.clone() };
      const drop = new THREE.Vector3();
      device.userData.dropPoint.getWorldPosition(drop);

      if (item.format === "cd" || item.format === "dvd") {
        const tray = device.userData.tray!;
        this.audio.sfx.whirr();
        await this.tween(0.5, (k) => (tray.position.z = (device.userData.trayOut ?? 1.2) * k));
        device.userData.dropPoint.getWorldPosition(drop);
        this.w.scene.attach(media);
        await this.moveTo(media, drop.clone().add(new THREE.Vector3(0, 0.6, 0)), new THREE.Euler(0, 0, 0), 0.45, ease.io);
        await this.moveTo(media, drop, new THREE.Euler(0, 0, 0), 0.2, ease.out);
        tray.attach(media);
        this.audio.sfx.click();
        await this.tween(0.5, (k) => (tray.position.z = (device.userData.trayOut ?? 1.2) * (1 - k)));
      } else if (item.format === "vinyl") {
        this.w.scene.attach(media);
        const above = drop.clone().add(new THREE.Vector3(0, 1.2, 0));
        await this.moveTo(media, above, new THREE.Euler(0, 0, 0), 0.7, ease.io);
        await this.moveTo(media, drop, new THREE.Euler(0, 0, 0), 0.3, ease.out);
        device.userData.platter!.attach(media);
        this.audio.sfx.place();
        const arm = device.userData.arm!;
        await this.tween(0.7, (k) => (arm.rotation.y = (device.userData.armRest ?? 0.62) + ((device.userData.armPlay ?? 0.12) - (device.userData.armRest ?? 0.62)) * k));
      } else {
        const door = device.userData.door!;
        await this.tween(0.35, (k) => (door.rotation.x = 0.9 * k));
        this.w.scene.attach(media);
        await this.moveTo(media, drop.clone().add(new THREE.Vector3(0, 0, 0.9)), new THREE.Euler(0, 0, 0), 0.45, ease.io);
        await this.moveTo(media, drop, new THREE.Euler(0, 0, 0), 0.25, ease.out);
        this.audio.sfx.click();
        await this.tween(0.3, (k) => (door.rotation.x = 0.9 * (1 - k)));
      }
      await this.handAway();

      const tv = item.format === "dvd" || this.world === "room" ? this.tvHere() : null;
      this.play = { item, model, device, media, mediaHome, tv, trailer: false, spinning: true, returnStation };
      this.held = null;
      this.ev.held(null);
      await this.startMedia();
    } finally {
      this.busy(-1);
    }
  }

  private async startMedia() {
    const p = this.play;
    if (!p) return;
    const { item } = p;
    if (item.format === "dvd") {
      this.crtItem = item;
      this.crtMode[this.world] = "menu";
      this.audio.sfx.confirm();
      await this.wait(1.6);
      if (!this.play) return;
      if (item.previewUrl) {
        this.video.src = item.previewUrl;
        this.video.muted = this.audio.muted;
        this.video.onended = () => void this.stopPlaying();
        try {
          await this.video.play();
          p.trailer = true;
          this.crtMode[this.world] = "play";
        } catch {
          this.crtMode[this.world] = "play";
        }
      } else {
        this.crtMode[this.world] = "play";
      }
      this.audio.hum("dvd");
    } else {
      if (this.world === "room") {
        this.crtItem = item;
        this.crtMode.room = "viz";
      }
      const ok = item.previewUrl ? await this.audio.play(item.previewUrl, item.format) : false;
      this.audio.onPreviewEnd = () => void this.stopPlaying();
      if (!ok) this.ev.error(item.previewUrl ? "The preview wouldn't start. Tap to try again." : "No preview on file for this one.");
    }
    this.ev.playing({ item, progress: 0, trailer: p.trailer });
  }

  /** Stops, puts the media back in its case, and hands the case back. */
  async stopPlaying() {
    const p = this.play;
    if (!p) return;
    this.play = null;
    this.audio.stop();
    this.audio.onPreviewEnd = null;
    this.video.pause();
    this.video.onended = null;
    this.video.removeAttribute("src");
    this.video.style.display = "none";
    this.crtMode[this.world] = "off";
    this.drawTV();
    this.ev.playing(null);
    this.busy(+1);
    try {
      const { item, device, media, model } = p;
      const caseAt = new THREE.Vector3();
      model.getWorldPosition(caseAt);
      if (item.format === "cd" || item.format === "dvd") {
        const tray = device.userData.tray!;
        await this.tween(0.45, (k) => (tray.position.z = (device.userData.trayOut ?? 1.2) * k));
        this.w.scene.attach(media);
        await this.moveTo(media, caseAt, new THREE.Euler(Math.PI / 2, 0, 0), 0.5, ease.io);
        await this.tween(0.45, (k) => (tray.position.z = (device.userData.trayOut ?? 1.2) * (1 - k)));
      } else if (item.format === "vinyl") {
        const arm = device.userData.arm!;
        await this.tween(0.5, (k) => (arm.rotation.y = (device.userData.armPlay ?? 0.12) + ((device.userData.armRest ?? 0.62) - (device.userData.armPlay ?? 0.12)) * k));
        this.w.scene.attach(media);
        await this.moveTo(media, caseAt, new THREE.Euler(Math.PI / 2, 0, 0), 0.7, ease.io);
      } else {
        const door = device.userData.door!;
        await this.tween(0.3, (k) => (door.rotation.x = 0.9 * k));
        this.w.scene.attach(media);
        await this.moveTo(media, caseAt, new THREE.Euler(0, 0, 0), 0.45, ease.io);
        await this.tween(0.3, (k) => (door.rotation.x = 0.9 * (1 - k)));
      }
      model.attach(media);
      media.position.copy(p.mediaHome.pos);
      media.rotation.copy(p.mediaHome.rot);
      // Back into the hand.
      await this.reachTo(model);
      this.w.cam.attach(model);
      if (p.returnStation !== this.stationIdx[this.world]) {
        this.stationIdx[this.world] = p.returnStation;
        this.announce();
        const { pos, rot } = this.holdPose(model);
        void this.moveTo(model, pos, rot, 0.6, ease.io);
        await this.glideTo(this.station, 0.8);
      } else {
        const { pos, rot } = this.holdPose(model);
        await this.moveTo(model, pos, rot, 0.6, ease.io);
      }
      const spot = this.w.spots.find((s) => s.item?.id === item.id) ?? {
        kind: "item" as const,
        station: this.station.id,
        item,
        group: model,
        w: model.userData.W,
        h: model.userData.H,
        label: item.title,
      };
      this.held = { spot, model, flipped: false, rot: new THREE.Euler() };
      this.ev.held(item);
    } finally {
      this.busy(-1);
    }
  }

  get nowPlaying(): StoreItem | null {
    return this.play?.item ?? null;
  }

  // ---------- going home ----------

  async goToCounter() {
    if (this.held) await this.putBack();
    const i = this.store.stations.findIndex((s) => s.id === "counter");
    await this.goStation(i);
  }

  setWorld(name: WorldName) {
    if (this.world === name) return;
    this.world = name;
    this.crate.visible = name === "store";
    if (this.sel.ring.parent) this.sel.ring.parent.remove(this.sel.ring, this.sel.arrow);
    this.resize();
    this.snapToStation();
  }

  setOwned(owned: StoreItem[]) {
    stockRoom(this.room, owned);
    if (this.world === "room") this.resetFocus();
  }

  goRoomStation(id: string) {
    const i = this.room.stations.findIndex((s) => s.id === id);
    if (i >= 0 && this.world === "room") void this.goStation(i);
  }

  /** The bedroom's owned item, picked up for playing or reviewing. */
  async pickUpOwned(itemId: string) {
    if (this.world !== "room" || this.busyCount > 0 || this.play) return;
    if (this.held) await this.putBack();
    const shelf = this.room.stations.findIndex((s) => s.id === "shelf");
    if (this.stationIdx.room !== shelf) await this.goStation(shelf);
    const spot = this.room.spots.find((s) => s.item?.id === itemId);
    if (spot) await this.pickUp(spot);
  }

  cashierSay(text: string) {
    return this.audio.speak(text, (m) => (this.cashierMouth = m));
  }

  // ---------- frame ----------

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width || window.innerWidth);
    const h = Math.max(1, rect.height || window.innerHeight);
    this.r.fit(w, h);
    for (const world of [this.store, this.room]) {
      world.cam.aspect = w / h;
      world.cam.updateProjectionMatrix();
      fitStations(world);
    }
    placeCrate(this.crate, this.store.cam);
    if (this.busyCount === 0 && !this.play) {
      const { pos, look } = this.stationCamera(this.station);
      this.camPos.copy(pos);
      this.camLook.copy(look);
      this.applyCam();
    }
    if (this.held) {
      const { pos } = this.holdPose(this.held.model);
      this.held.model.position.copy(pos);
    }
  }

  private drawTV() {
    for (const name of ["store", "room"] as const) {
      const tv = name === "store" ? this.store.listen.tv : this.room.devices.tv;
      if (!tv) continue;
      const mode = this.crtMode[name];
      const cover = this.crtItem ? itemFace(this.crtItem).canvas : undefined;
      drawCRT(tv, mode, this.crtItem, performance.now() / 1000, this.audio.playing ? 0.75 : 0.1, cover);
    }
  }

  private placeVideo() {
    const p = this.play;
    if (!p?.trailer || !p.tv) {
      this.video.style.display = "none";
      return;
    }
    // The trailer is a real <video> laid over the TV's screen, because a
    // cross-origin video cannot be drawn into WebGL.
    const screen = p.tv.userData.screen;
    const box3 = new THREE.Box3().setFromObject(screen);
    const corners = [
      new THREE.Vector3(box3.min.x, box3.min.y, box3.max.z),
      new THREE.Vector3(box3.max.x, box3.max.y, box3.max.z),
    ];
    const rect = this.canvas.getBoundingClientRect();
    const pts = corners.map((c) => {
      c.project(this.w.cam);
      return { x: ((c.x + 1) / 2) * rect.width, y: ((1 - c.y) / 2) * rect.height };
    });
    const x = Math.min(pts[0].x, pts[1].x);
    const y = Math.min(pts[0].y, pts[1].y);
    const vw = Math.abs(pts[1].x - pts[0].x);
    const vh = Math.abs(pts[1].y - pts[0].y);
    Object.assign(this.video.style, {
      display: "block",
      left: `${x}px`,
      top: `${y}px`,
      width: `${vw}px`,
      height: `${vh}px`,
    });
  }

  private tick(dt: number, t: number) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(tw.ease(k));
      if (k >= 1) {
        this.tweens.splice(i, 1);
        tw.done();
      }
    }
    const p = this.play;
    if (p?.spinning) {
      if (p.item.format === "vinyl") p.device.userData.platter!.rotation.y -= dt * 3.5;
      if (p.item.format === "cassette") for (const reel of p.model.userData.reels) reel.rotation.y += dt * 4;
      if (p.item.format === "cd" || p.item.format === "dvd") p.media.rotation.y += dt * 9;
      if (!p.trailer || this.audio.playing) this.ev.playing({ item: p.item, progress: p.trailer ? this.videoProgress() : this.audio.progress, trailer: p.trailer });
      else this.ev.playing({ item: p.item, progress: this.videoProgress(), trailer: true });
    }
    // The TV only needs redrawing when something is on it, and at a TV's pace.
    this.crtTick += dt;
    if (this.crtTick > 1 / 15 && (this.crtMode.store !== "off" || this.crtMode.room !== "off")) {
      this.crtTick = 0;
      this.drawTV();
    }
    if (this.world === "room") this.room.tvGlow.intensity = (this.crtMode.room !== "off" ? 0.9 + Math.sin(t * 9) * 0.2 : 0.35) * Math.PI;
    // The cashier blinks, sways a little and moves her mouth when talking.
    if (this.world === "store") {
      const blink = t > this.blinkAt && t < this.blinkAt + 0.12;
      if (t > this.blinkAt + 0.12) this.blinkAt = t + 2 + Math.random() * 3;
      this.store.cashier.mesh.position.y = 5.1 + Math.sin(t * 1.6) * 0.04;
      this.store.cashier.mesh.rotation.z = Math.sin(t * 0.9) * 0.012;
      if (this.station.id === "counter") this.store.cashier.draw(this.cashierMouth, blink);
    }
    updateSelector(this.sel, this.w, this.held || this.play || this.busyCount > 0 ? null : this.focusSpot, dt);
    this.drawHand();
    this.placeVideo();
    this.r.draw(this.w.scene, this.w.cam);
  }

  private videoProgress(): number {
    const v = this.video;
    return v.duration && Number.isFinite(v.duration) ? v.currentTime / v.duration : 0;
  }

  // ---------- small helpers ----------

  private busy(d: number) {
    const before = this.busyCount > 0;
    this.busyCount = Math.max(0, this.busyCount + d);
    const after = this.busyCount > 0;
    if (before !== after) this.ev.busy(after);
  }

  get isBusy(): boolean {
    return this.busyCount > 0;
  }

  private tween(dur: number, fn: (k: number) => void, e: (k: number) => number = ease.io): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.push({ t: 0, dur: Math.max(0.001, dur * this.speed), fn, ease: e, done: resolve });
    });
  }

  private wait(s: number) {
    return this.tween(s, () => {});
  }

  private moveTo(o: THREE.Object3D, pos: THREE.Vector3, rot: THREE.Euler, dur: number, e = ease.io, scale?: number) {
    const p0 = o.position.clone();
    const q0 = o.quaternion.clone();
    const q1 = new THREE.Quaternion().setFromEuler(rot);
    const s0 = o.scale.x;
    return this.tween(
      dur,
      (k) => {
        o.position.lerpVectors(p0, pos, k);
        o.quaternion.slerpQuaternions(q0, q1, Math.min(1, k));
        if (scale !== undefined) o.scale.setScalar(s0 + (scale - s0) * k);
      },
      e
    );
  }
}
