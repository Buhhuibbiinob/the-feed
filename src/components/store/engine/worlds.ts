import * as THREE from "three";
import { SECTIONS, type StoreFormat, type StoreItem } from "@/lib/store";
import {
  DIM,
  LIGHT,
  basic,
  box,
  buildCDDeck,
  buildCRT,
  buildDVDPlayer,
  buildItem,
  buildTapeDeck,
  buildTurntable,
  canvasTex,
  cyl,
  labelTex,
  lambert,
  phong,
  plane,
  shelfUnit,
  signTex,
  type CRT,
  type Device,
  type ItemModel,
  type Slot,
  type Textures,
} from "./gfx";

// The two places: the shop and the bedroom. Ported from the prototype's
// c2_world.js, but built from data - today's shelves and the viewer's
// own collection - rather than a fixed catalogue.

export type Spot = {
  kind: "item" | "notebook" | "board" | "device";
  station: string;
  item?: StoreItem;
  group: THREE.Object3D;
  w: number;
  h: number;
  label: string;
  home?: { pos: THREE.Vector3; rot: THREE.Euler; parent: THREE.Object3D };
  /** For a shelf item: its slot label, as on the blue tags. */
  slotLabel?: string;
};

export type Station = {
  id: string;
  name: string;
  tag: string;
  x: number;
  /** Where the camera looks, and from how far. */
  look: THREE.Vector3;
  dist: number;
  /** The box the camera has to fit in view. */
  fitW: number;
  fitH: number;
  /** Which way the camera stands back from `look`. Defaults to straight out from the wall (+z). */
  dir?: THREE.Vector3;
};

export type World = {
  scene: THREE.Scene;
  cam: THREE.PerspectiveCamera;
  stations: Station[];
  spots: Spot[];
  devices: Partial<Record<StoreFormat, Device>> & { tv?: CRT };
  disposables: { dispose(): void }[];
};

function makeWorld(bg: number, near: number, far: number, fov: number): World {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  scene.fog = new THREE.Fog(bg, near, far);
  const cam = new THREE.PerspectiveCamera(fov, 16 / 9, 0.1, 220);
  scene.add(cam);
  return { scene, cam, stations: [], spots: [], devices: {}, disposables: [] };
}

function spot(scene: THREE.Scene, x: number, y: number, z: number, tx: number, ty: number, tz: number, color = 0xffb866, intensity = 1.4, angle = 0.62) {
  // decay 0 with a cutoff distance: the old, non-physical falloff the
  // look was tuned for, where a pool of light is a pool and not a point.
  const s = new THREE.SpotLight(color, intensity * LIGHT, 46, angle, 0.7, 0);
  s.position.set(x, y, z);
  s.target.position.set(tx, ty, tz);
  scene.add(s, s.target);
  return s;
}
function point(color: number, intensity: number, distance: number) {
  return new THREE.PointLight(color, intensity * LIGHT, distance, 0);
}
function beamCone(scene: THREE.Scene, T: Textures, x: number, y: number, z: number, h: number, r: number) {
  const m = new THREE.Mesh(
    new THREE.ConeGeometry(r, h, 16, 1, true),
    new THREE.MeshBasicMaterial({
      map: T.beam,
      color: 0xffcc88,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  );
  m.position.set(x, y - h / 2, z);
  scene.add(m);
  cyl(0.34, 0.6, lambert(0x1a1410), x, y + 0.1, z, scene, 10);
  cyl(0.28, 0.05, basic(0xffe2a8), x, y - 0.22, z, scene, 10);
}
function floorPool(scene: THREE.Scene, T: Textures, x: number, z: number, r: number) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2, r * 2),
    new THREE.MeshBasicMaterial({ map: T.glow, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.03, z);
  scene.add(m);
}
export function blobShadow(parent: THREE.Object3D, T: Textures, x: number, y: number, z: number, w: number, d: number, op = 0.5) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: T.blob, transparent: true, opacity: op, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function plant(T: Textures) {
  const p = new THREE.Group();
  cyl(0.7, 0.9, lambert(0x6a3a22), 0, 0.45, 0, p, 8);
  for (let i = 0; i < 9; i++) {
    const l = box(0.12, 1.5, 0.5, lambert(0x2a6a2a), 0, 1.4, 0, p);
    l.rotation.z = (i - 4) * 0.17;
    l.rotation.y = i * 0.7;
    l.position.set(Math.sin(i) * 0.2, 1.6, Math.cos(i) * 0.2);
  }
  void T;
  return p;
}

// ---------- the shop ----------

type SectionLayout = { cols: number; rows: number; cw: number; ch: number; y0: number; dep: number; lip: boolean; x: number };
const LAYOUT: Record<StoreFormat, SectionLayout> = {
  cd: { cols: 4, rows: 3, cw: 1.85, ch: 2.05, y0: 1.0, dep: 1.5, lip: false, x: 0 },
  vinyl: { cols: 4, rows: 2, cw: 3.6, ch: 3.9, y0: 1.0, dep: 1.4, lip: true, x: 15 },
  cassette: { cols: 5, rows: 2, cw: 1.25, ch: 1.75, y0: 3.0, dep: 1.1, lip: false, x: 47.5 },
  dvd: { cols: 5, rows: 2, cw: 1.8, ch: 2.55, y0: 1.8, dep: 1.3, lip: false, x: 62 },
};
export const LISTEN_X = 31;
export const COUNTER_X = 77;

export type Store = World & {
  cashier: Cashier;
  /** Where each format's item is placed to be heard or watched. */
  listen: { vinyl: Device; cd: Device; cassette: Device; dvd: Device; tv: CRT };
  /** Shelf item models, by item id. */
  models: Map<string, ItemModel>;
};

export function buildStore(T: Textures, shelves: Record<StoreFormat, StoreItem[]>): Store {
  const w = makeWorld(0x0b0705, 26, 70, 50) as Store;
  const sc = w.scene;
  w.models = new Map();
  sc.add(new THREE.AmbientLight(0x6a4a34, 0.8 * LIGHT));
  sc.add(new THREE.HemisphereLight(0xffe0b0, 0x2a1a10, 0.35 * LIGHT));

  // Walls, floor and ceiling, subdivided so vertex lighting can make pools.
  plane(130, 12, lambert(T.wall), 32, 6, -1.0, sc, 86, 10);
  plane(130, 3, lambert(T.wainscot), 32, 1.5, -0.98, sc, 60, 3);
  const floor = plane(130, 22, lambert(T.floor), 32, 0, 9, sc, 86, 16);
  floor.rotation.x = -Math.PI / 2;
  const ceil = plane(130, 22, lambert(T.ceil), 32, 11.5, 9, sc, 40, 8);
  ceil.rotation.x = Math.PI / 2;
  for (let x = -10; x <= 100; x += 12) box(0.5, 0.7, 22, lambert(0x1a100a), x, 11.1, 9, sc);
  box(130, 0.3, 0.5, lambert(0x1a1410), 32, 10.4, 8.5, sc);
  const lw = plane(22, 12, lambert(T.wall), -18, 6, 9, sc, 10, 6);
  lw.rotation.y = Math.PI / 2;
  const rw = plane(22, 12, lambert(T.wall), 96, 6, 9, sc, 10, 6);
  rw.rotation.y = -Math.PI / 2;

  const xs = [LAYOUT.cd.x, LAYOUT.vinyl.x, LISTEN_X, LAYOUT.cassette.x, LAYOUT.dvd.x, COUNTER_X];
  for (const x of xs) {
    spot(sc, x, 10.2, 8.8, x, 4.2, 0, 0xffb25a, x === LISTEN_X ? 1.25 : 1.55, 0.58);
    beamCone(sc, T, x, 10.35, 8.8, 10.5, 2.6);
    floorPool(sc, T, x, 5.2, 6);
  }
  for (const x of [7.5, 23, 54.5, 69]) {
    const f = point(0xff9040, 0.38, 26);
    f.position.set(x, 5, 6);
    sc.add(f);
  }

  // The shelves, filled with today's stock.
  for (const sec of SECTIONS) {
    const L = LAYOUT[sec.id];
    const u = shelfUnit(sc, T, L.x, L.y0, L.cols, L.rows, L.cw, L.ch, L.dep, L.lip);
    plane(
      Math.min(u.W, 5),
      1.1,
      lambert(signTex(sec.name.toUpperCase(), 256, 56, "#2a1608", "#f2b24a", sec.tag.toUpperCase())),
      L.x,
      L.y0 + u.H + 1.1,
      0.4,
      sc
    );
    box(0.06, 1.4, 0.06, lambert(0x111111), L.x - 1.9, L.y0 + u.H + 1.1, 0.4, sc);
    box(0.06, 1.4, 0.06, lambert(0x111111), L.x + 1.9, L.y0 + u.H + 1.1, 0.4, sc);
    const items = shelves[sec.id] ?? [];
    u.slots.forEach((sl: Slot, i) => {
      const label = `${sec.label} ${i + 1}`;
      // On the shelf's front edge, like a shelf talker, so the case never hides it.
      plane(Math.min(L.cw * 0.7, 1.3), 0.26, lambert(labelTex(label, 128, 24)), sl.x, sl.yb - 0.1, L.dep / 2 + 0.012, sc);
      const item = items[i];
      if (!item) {
        // An empty slot says so, the way a shop would.
        const sold = plane(Math.min(L.cw * 0.7, 1.2), 0.3, lambert(labelTex("SOLD OUT", 128, 24, "#3a1a10", "#f2b24a")), sl.x, sl.yb + 0.7, 0, sc);
        sold.rotation.x = -0.1;
        return;
      }
      const g = buildItem(item, T);
      const [W, H, D] = DIM[item.format];
      const z = L.dep / 2 - D / 2 - 0.18 - (L.lip ? 0.12 : 0);
      g.position.set(sl.x, sl.yb + H / 2 + (L.lip ? 0.12 : 0.01), z);
      g.rotation.x = -0.06;
      sc.add(g);
      blobShadow(sc, T, sl.x, sl.yb + (L.lip ? 0.13 : 0.02), z, W * 0.95, D + 0.7);
      w.models.set(item.id, g);
      w.spots.push({
        kind: "item",
        station: sec.id,
        item,
        group: g,
        w: W,
        h: H,
        label,
        slotLabel: label,
        home: { pos: g.position.clone(), rot: g.rotation.clone(), parent: sc },
      });
    });
    w.stations.push({
      id: sec.id,
      name: sec.name,
      tag: sec.tag,
      x: L.x,
      // Room above for the section's sign.
      look: new THREE.Vector3(L.x, L.y0 + u.H / 2 + 0.55, 0),
      dist: 0,
      fitW: u.W + 1.0,
      fitH: u.H + 3.0,
    });
  }

  // Decor.
  for (const x of [-5.5, 24, 83.5]) {
    const p = plant(T);
    p.position.set(x, 0, 4.4);
    sc.add(p);
  }
  const clock = cyl(
    0.9,
    0.15,
    lambert(
      canvasTex(64, 64, (c) => {
        c.fillStyle = "#f0e8d0";
        c.beginPath();
        c.arc(32, 32, 31, 0, 7);
        c.fill();
        c.strokeStyle = "#111";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(32, 32);
        c.lineTo(32, 12);
        c.moveTo(32, 32);
        c.lineTo(44, 38);
        c.stroke();
        c.fillStyle = "#111";
        for (let i = 0; i < 12; i++) c.fillRect(32 + Math.sin((i / 12) * 6.283) * 27 - 1, 32 - Math.cos((i / 12) * 6.283) * 27 - 1, 2, 2);
      })
    ),
    7.7,
    8.2,
    -0.7,
    sc,
    18
  );
  clock.rotation.x = Math.PI / 2;
  for (const [x, t] of [
    [7.6, "NEW ARRIVALS"],
    [22.8, "STAFF PICKS"],
    [39.3, "TRY BEFORE YOU BUY"],
    [54.8, "NOW ON DVD"],
    [69.4, "5 PER DAY"],
  ] as const) {
    plane(2.8, 0.9, lambert(signTex(t, 160, 52, "#1a3a6a", "#e8f0ff")), x, 6.6, -0.9, sc);
  }
  for (const [x, y, a, b] of [
    [7.6, 4.2, "#e8571f", "#2a0a04"],
    [22.8, 5.4, "#1f4fa8", "#06142e"],
    [39.3, 5.4, "#7a2a9a", "#1a0830"],
    [69.4, 3.2, "#2a8a4a", "#06200e"],
  ] as const) {
    const t = canvasTex(64, 96, (c, cw, ch) => {
      const g = c.createLinearGradient(0, 0, cw, ch);
      g.addColorStop(0, a);
      g.addColorStop(1, b);
      c.fillStyle = g;
      c.fillRect(0, 0, cw, ch);
      c.fillStyle = "rgba(255,255,255,.22)";
      c.beginPath();
      c.arc(cw / 2, ch * 0.42, cw * 0.28, 0, 7);
      c.fill();
      c.fillRect(0, ch * 0.78, cw, 3);
    });
    plane(1.9, 2.8, lambert(t), x, y + 1.5, -0.9, sc);
  }

  // The listening post.
  const bx = LISTEN_X;
  box(12.4, 3.0, 3.6, lambert(T.shelfDark), bx, 1.5, 0.9, sc);
  box(12.8, 0.22, 4, lambert(T.shelf), bx, 3.1, 0.9, sc);
  const tt = buildTurntable();
  tt.position.set(bx - 4.2, 3.2, 1.0);
  sc.add(tt);
  const cd = buildCDDeck();
  cd.position.set(bx - 0.1, 3.2, 1.0);
  sc.add(cd);
  const tp = buildTapeDeck();
  tp.position.set(bx + 3.5, 3.2, 1.0);
  tp.scale.setScalar(0.95);
  sc.add(tp);
  box(13, 0.22, 3, lambert(T.shelf), bx + 0.6, 5.8, 0.35, sc);
  box(0.3, 2.6, 2.6, lambert(T.shelfDark), bx - 5.4, 4.5, 0.35, sc);
  box(0.3, 2.6, 2.6, lambert(T.shelfDark), bx + 6.7, 4.5, 0.35, sc);
  const tv = buildCRT();
  tv.position.set(bx + 3.2, 5.9, 0.2);
  sc.add(tv);
  const dv = buildDVDPlayer();
  dv.position.set(bx - 1.7, 5.9, 0.6);
  sc.add(dv);
  plane(5, 1, lambert(signTex("LISTENING POST", 256, 52, "#0e2a52", "#cfe2ff", "PLACE IT ON · PRESS PLAY")), bx - 1.2, 8.6, -0.9, sc);
  const hp = new THREE.Group();
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.09, 6, 14, Math.PI), lambert(0x111111));
  arc.position.y = 0.3;
  hp.add(arc);
  cyl(0.34, 0.2, lambert(0xb8281c), -0.7, 0.2, 0, hp, 10).rotation.z = Math.PI / 2;
  cyl(0.34, 0.2, lambert(0xb8281c), 0.7, 0.2, 0, hp, 10).rotation.z = Math.PI / 2;
  hp.position.set(bx + 6.2, 7.4, -0.8);
  sc.add(hp);
  w.listen = { vinyl: tt, cd, cassette: tp, dvd: dv, tv };
  w.stations.splice(2, 0, {
    id: "listen",
    name: "Listening Post",
    tag: "Try before you buy",
    x: bx,
    look: new THREE.Vector3(bx, 5.6, 0.6),
    dist: 0,
    fitW: 13.5,
    fitH: 7.6,
  });

  // The till.
  const cx = COUNTER_X;
  box(9, 3.3, 2.4, lambert(T.shelfDark), cx, 1.65, 2.7, sc);
  box(9.4, 0.28, 2.9, lambert(T.shelf), cx, 3.4, 2.7, sc);
  box(9, 0.2, 0.2, lambert(0xf2b24a), cx, 3.0, 3.95, sc);
  const reg = new THREE.Group();
  box(1.9, 0.8, 1.5, phong(0x3a3a40), 0, 0.4, 0, reg);
  const rs = box(
    1.1,
    0.7,
    0.1,
    lambert(
      canvasTex(64, 40, (c, cw, ch) => {
        c.fillStyle = "#021a10";
        c.fillRect(0, 0, cw, ch);
        c.fillStyle = "#5aff9a";
        c.font = '12px "Share Tech Mono", monospace';
        c.fillText("TOTAL", 4, 16);
        c.fillText("5 / DAY", 4, 32);
      })
    ),
    0,
    1.05,
    -0.1,
    reg
  );
  rs.rotation.x = -0.35;
  reg.position.set(cx + 2.6, 3.54, 2.4);
  sc.add(reg);
  cyl(0.5, 0.8, phong(0x88c8e8, { transparent: true, opacity: 0.5 }), cx - 3.6, 3.9, 2.4, sc, 10);
  box(1.6, 0.9, 0.9, lambert(0x8a5a2a), cx - 2.4, 3.97, 2.2, sc);
  plane(4.4, 1, lambert(signTex("CHECKOUT", 256, 58, "#3a0e0a", "#ffd27a", "THANK YOU · COME AGAIN")), cx, 8.4, -0.9, sc);
  w.cashier = makeCashier();
  w.cashier.mesh.position.set(cx, 5.1, 0.6);
  sc.add(w.cashier.mesh);
  w.stations.push({
    id: "counter",
    name: "Checkout",
    tag: "Pay here",
    x: cx,
    look: new THREE.Vector3(cx, 4.6, 1.2),
    dist: 0,
    fitW: 10,
    fitH: 8.6,
  });
  return w;
}

// ---------- the cashier ----------
//
// A painted stand-in, drawn as a stock-photo cut-out (white sticker
// outline, soft shading, grain), until there is a photograph the site
// has the rights to. Drop a transparent PNG at public/store/cashier.png
// and it is used instead, with a mouth drawn over it at MOUTH.

export type Cashier = { mesh: THREE.Mesh; draw(mouth: number, blink: boolean): void };

/**
 * Where the mouth is on public/store/cashier.png, as fractions of its size.
 * Set for the arms-crossed portrait as cropped by scripts/store-cashier.py's
 * defaults; change both together for a different photo.
 */
const MOUTH = { x: 0.5, y: 0.27 };

function makeCashier(): Cashier {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 192;
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 7.2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.3 })
  );
  let photo: HTMLImageElement | null = null;
  const img = new Image();
  img.onload = () => {
    photo = img;
    draw(0, false);
  };
  img.src = "/store/cashier.png";
  const x = c.getContext("2d", { willReadFrequently: true })!;

  function draw(mouth: number, blink: boolean) {
    x.clearRect(0, 0, 128, 192);
    if (photo) {
      // Head to waist, full width, standing on the counter.
      const s = Math.min(128 / photo.width, 192 / photo.height);
      const pw = photo.width * s;
      const ph = photo.height * s;
      x.drawImage(photo, (128 - pw) / 2, 192 - ph, pw, ph);
      // The scene's grain and 5-bit crush, so a photograph sits in it.
      const im = x.getImageData(0, 0, 128, 192);
      for (let i = 0; i < im.data.length; i += 4) {
        im.data[i] &= 0xf8;
        im.data[i + 1] &= 0xf8;
        im.data[i + 2] &= 0xf8;
      }
      x.putImageData(im, 0, 0);
      if (mouth > 0) {
        const mx = (128 - pw) / 2 + MOUTH.x * pw;
        const my = 192 - ph + MOUTH.y * ph;
        x.fillStyle = "#2a0a0c";
        x.beginPath();
        x.ellipse(mx, my, pw * 0.05, pw * (0.01 + 0.03 * mouth), 0, 0, 7);
        x.fill();
      }
      tex.needsUpdate = true;
      return;
    }
    const skin = "#e0a982";
    const skinD = "#b9825c";
    const hair = "#2a1a14";
    const body = () => {
      x.beginPath();
      x.moveTo(8, 192);
      x.quadraticCurveTo(10, 138, 42, 126);
      x.lineTo(86, 126);
      x.quadraticCurveTo(118, 138, 120, 192);
      x.closePath();
    };
    const head = () => {
      x.beginPath();
      x.ellipse(64, 66, 29, 36, 0, 0, 7);
    };
    x.lineJoin = "round";
    x.strokeStyle = "#fff";
    x.lineWidth = 8;
    body();
    x.stroke();
    head();
    x.stroke();
    x.beginPath();
    x.ellipse(64, 50, 38, 40, 0, 0, 7);
    x.stroke();
    let g = x.createLinearGradient(0, 126, 0, 192);
    g.addColorStop(0, "#3d7be0");
    g.addColorStop(1, "#1d3f8a");
    x.fillStyle = g;
    body();
    x.fill();
    x.fillStyle = "#f2f2f2";
    x.beginPath();
    x.moveTo(50, 126);
    x.lineTo(64, 150);
    x.lineTo(78, 126);
    x.closePath();
    x.fill();
    x.fillStyle = "#fff";
    x.fillRect(84, 146, 26, 14);
    x.fillStyle = "#d8281c";
    x.fillRect(84, 146, 26, 3);
    x.fillStyle = "#222";
    x.font = "700 8px Arial";
    x.fillText("SAM", 89, 157);
    x.fillStyle = skinD;
    x.fillRect(54, 100, 20, 28);
    x.fillStyle = hair;
    x.beginPath();
    x.ellipse(64, 46, 36, 36, 0, Math.PI, 0);
    x.lineTo(98, 86);
    x.quadraticCurveTo(92, 60, 64, 52);
    x.quadraticCurveTo(36, 60, 30, 86);
    x.closePath();
    x.fill();
    g = x.createRadialGradient(56, 60, 4, 64, 70, 40);
    g.addColorStop(0, "#f0c29c");
    g.addColorStop(1, skin);
    x.fillStyle = g;
    head();
    x.fill();
    x.fillStyle = hair;
    x.beginPath();
    x.moveTo(33, 60);
    x.quadraticCurveTo(64, 26, 95, 60);
    x.quadraticCurveTo(80, 42, 64, 44);
    x.quadraticCurveTo(46, 42, 33, 60);
    x.fill();
    const ey = blink ? 2 : 6;
    x.fillStyle = "#fff";
    for (const ex of [48, 80]) {
      x.beginPath();
      x.ellipse(ex, 66, 7, ey, 0, 0, 7);
      x.fill();
    }
    x.fillStyle = "#3a2414";
    if (!blink)
      for (const ex of [48, 80]) {
        x.beginPath();
        x.arc(ex + 1, 66, 3.2, 0, 7);
        x.fill();
      }
    x.strokeStyle = hair;
    x.lineWidth = 2.5;
    for (const a of [
      [41, 56, 55, 54],
      [73, 54, 87, 56],
    ]) {
      x.beginPath();
      x.moveTo(a[0], a[1]);
      x.lineTo(a[2], a[3]);
      x.stroke();
    }
    x.strokeStyle = skinD;
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(64, 70);
    x.lineTo(61, 82);
    x.lineTo(66, 83);
    x.stroke();
    x.fillStyle = "rgba(220,110,100,.35)";
    for (const cx of [44, 84]) {
      x.beginPath();
      x.ellipse(cx, 84, 6, 4, 0, 0, 7);
      x.fill();
    }
    const my = 94;
    if (mouth <= 0) {
      x.strokeStyle = "#8a2a2a";
      x.lineWidth = 2.5;
      x.beginPath();
      x.moveTo(52, my);
      x.quadraticCurveTo(64, my + 7, 76, my);
      x.stroke();
    } else {
      x.fillStyle = "#3a0a10";
      x.beginPath();
      x.ellipse(64, my + 1, 10 + mouth * 2, 2 + mouth * 6, 0, 0, 7);
      x.fill();
      x.fillStyle = "#fff";
      x.fillRect(57, my - 2, 14, 3);
      x.fillStyle = "#c85a5a";
      x.beginPath();
      x.ellipse(64, my + 2 + mouth * 4, 6, 2.5, 0, 0, 7);
      x.fill();
    }
    // Photographic grain, crushed to 5 bits. Seeded, so it does not
    // crawl from frame to frame, and kept off the white outline.
    const im = x.getImageData(0, 0, 128, 192);
    const d = im.data;
    let seed = 12345;
    for (let i = 0; i < d.length; i += 4) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if (d[i + 3] > 20 && d[i] + d[i + 1] + d[i + 2] < 720) {
        const n = (seed % 17) - 8;
        d[i] = (d[i] + n) & 0xf8;
        d[i + 1] = (d[i + 1] + n) & 0xf8;
        d[i + 2] = (d[i + 2] + n) & 0xf8;
      }
    }
    x.putImageData(im, 0, 0);
    tex.needsUpdate = true;
  }
  draw(0, false);
  return { mesh, draw };
}

// ---------- the crate, riding on the camera ----------

export type Crate = THREE.Group & { userData: { contents: { id: string; model: ItemModel }[] } };

export function buildCrate(T: Textures): Crate {
  const crate = new THREE.Group() as Crate;
  const wood = lambert(T.shelf);
  const dk = lambert(T.shelfDark);
  box(4.6, 0.22, 3.4, dk, 0, 0.11, 0, crate);
  for (const z of [-1.7, 1.7]) for (const y of [0.35, 0.8, 1.25]) box(4.6, 0.3, 0.12, wood, 0, y, z, crate);
  for (const x of [-2.3, 2.3]) for (const y of [0.35, 0.8, 1.25]) box(0.12, 0.3, 3.4, wood, x, y, 0, crate);
  for (const [x, z] of [
    [-2.3, -1.7],
    [2.3, -1.7],
    [-2.3, 1.7],
    [2.3, 1.7],
  ])
    box(0.2, 1.55, 0.2, dk, x, 0.78, z, crate);
  box(1.2, 0.14, 0.1, lambert(0x1a100a), 0, 1.0, 1.77, crate);
  crate.userData = { contents: [] };
  return crate;
}

/** Where the nth of n items leans in the crate, fanned along x. */
export function crateSlot(i: number, n: number, item: StoreItem): { pos: THREE.Vector3; rot: THREE.Euler; scale: number } {
  const t = n <= 1 ? 0 : i / (n - 1) - 0.5;
  const [, H] = DIM[item.format];
  const scale = item.format === "vinyl" ? 0.55 : 1;
  return {
    pos: new THREE.Vector3(t * (Math.min(n, 5) - 1) * 0.8, (H * scale) / 2 + 0.12, -0.4 + (i % 2) * 0.18),
    rot: new THREE.Euler(-0.16, 0, t * 0.1),
    scale,
  };
}

export function placeCrate(crate: Crate, cam: THREE.PerspectiveCamera) {
  const tn = Math.tan((cam.fov * Math.PI) / 360);
  const d = 10;
  const asp = cam.aspect;
  const nx = asp < 1 ? -0.5 : -0.74;
  const ny = asp < 1 ? -0.84 : -0.8;
  crate.scale.setScalar(asp < 1 ? 0.36 : 0.5);
  crate.position.set(nx * d * tn * asp, ny * d * tn - 0.2, -d);
  crate.rotation.set(0.62, 0.28, 0);
}

/** A point in front of the camera, in normalised screen coordinates and depth. */
export function camLocal(cam: THREE.PerspectiveCamera, nx: number, ny: number, dist: number) {
  const tn = Math.tan((cam.fov * Math.PI) / 360);
  return new THREE.Vector3(nx * dist * tn * cam.aspect, ny * dist * tn, -dist);
}

// ---------- the selection frame and arrow, from the reference ----------

export type Selector = { ring: THREE.Mesh; arrow: THREE.Mesh; t: number };

export function buildSelector(): Selector {
  const ringTex = canvasTex(128, 128, (c, w, h) => {
    c.shadowColor = "#36d6ff";
    c.shadowBlur = 14;
    c.strokeStyle = "#36d6ff";
    c.lineWidth = 9;
    c.strokeRect(14, 14, w - 28, h - 28);
    c.shadowBlur = 0;
    c.strokeStyle = "#d8f8ff";
    c.lineWidth = 3;
    c.strokeRect(14, 14, w - 28, h - 28);
    c.fillStyle = "rgba(54,214,255,.12)";
    c.fillRect(14, 14, w - 28, h - 28);
  });
  ringTex.minFilter = ringTex.magFilter = THREE.NearestFilter;
  const arrowTex = canvasTex(64, 64, (c) => {
    c.fillStyle = "#2c8cff";
    c.strokeStyle = "#d8f0ff";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(6, 6);
    c.lineTo(32, 18);
    c.lineTo(58, 6);
    c.lineTo(32, 58);
    c.closePath();
    c.fill();
    c.stroke();
  });
  arrowTex.minFilter = arrowTex.magFilter = THREE.NearestFilter;
  const mat = (t: THREE.Texture) =>
    new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, fog: false });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat(ringTex));
  const arrow = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), mat(arrowTex));
  ring.renderOrder = 999;
  arrow.renderOrder = 1000;
  ring.visible = arrow.visible = false;
  return { ring, arrow, t: 0 };
}

export function updateSelector(sel: Selector, world: World, target: Spot | null, dt: number) {
  sel.t += dt;
  if (!target) {
    sel.ring.visible = sel.arrow.visible = false;
    return;
  }
  if (sel.ring.parent !== world.scene) world.scene.add(sel.ring, sel.arrow);
  sel.ring.visible = sel.arrow.visible = true;
  const p = new THREE.Vector3();
  target.group.getWorldPosition(p);
  const scale = new THREE.Vector3();
  target.group.getWorldScale(scale);
  const toCam = world.cam.position.clone().sub(p).normalize();
  const pulse = 1 + Math.sin(sel.t * 6) * 0.045;
  const sw = target.w * scale.x * 1.3 + 0.2;
  const sh = target.h * scale.y * 1.26 + 0.2;
  sel.ring.position.copy(p).addScaledVector(toCam, 0.45);
  sel.ring.quaternion.copy(world.cam.quaternion);
  sel.ring.scale.set(sw * pulse, sh * pulse, 1);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(world.cam.quaternion);
  sel.arrow.position
    .copy(sel.ring.position)
    .addScaledVector(up, sh / 2 + 0.32 + Math.abs(Math.sin(sel.t * 4)) * 0.22);
  sel.arrow.quaternion.copy(world.cam.quaternion);
  const as = Math.max(0.5, Math.min(1.6, sw * 0.38));
  sel.arrow.scale.set(as, as, 1);
}

// ---------- the bedroom ----------

export type Room = World & {
  shelfHolder: THREE.Group;
  shelfSlots: Slot[];
  tvGlow: THREE.PointLight;
  models: Map<string, ItemModel>;
  T: Textures;
};

const ROOM_SHELF = { cols: 6, rows: 3, cw: 2.05, ch: 2.6, dep: 1.4 };

export function buildRoom(T: Textures): Room {
  const w = makeWorld(0x07080f, 34, 80, 56) as Room;
  w.T = T;
  w.models = new Map();
  const sc = w.scene;
  sc.add(new THREE.AmbientLight(0x3a3a5a, 0.75 * LIGHT));
  sc.add(new THREE.HemisphereLight(0x8aa0d8, 0x2a1a10, 0.3 * LIGHT));
  const wp = canvasTex(
    64,
    64,
    (c, cw, ch) => {
      c.fillStyle = "#2c3a6a";
      c.fillRect(0, 0, cw, ch);
      c.fillStyle = "#34447a";
      for (let x = 0; x < cw; x += 16) c.fillRect(x, 0, 8, ch);
      c.fillStyle = "rgba(255,255,255,.07)";
      for (let y = 8; y < ch; y += 16) for (let x = 8; x < cw; x += 16) c.fillRect(x, y, 2, 2);
    },
    [12, 3]
  );
  const carpet = canvasTex(
    64,
    64,
    (c, cw, ch) => {
      c.fillStyle = "#4a3a52";
      c.fillRect(0, 0, cw, ch);
      for (let i = 0; i < 500; i++) {
        c.fillStyle = ["#5a4a64", "#3a2c42", "#6a5a74"][i % 3];
        c.fillRect((i * 37) % cw, (i * 53) % ch, 1, 1);
      }
    },
    [16, 12]
  );
  plane(24, 10, lambert(wp), 0, 5, -9, sc, 24, 8);
  const lw = plane(20, 10, lambert(wp), -12, 5, 0, sc, 10, 8);
  lw.rotation.y = Math.PI / 2;
  const rw = plane(20, 10, lambert(wp), 12, 5, 0, sc, 10, 8);
  rw.rotation.y = -Math.PI / 2;
  const fl = plane(24, 22, lambert(carpet), 0, 0, 1, sc, 24, 16);
  fl.rotation.x = -Math.PI / 2;
  const cl = plane(24, 22, lambert(0x1a1620), 0, 10, 1, sc, 8, 8);
  cl.rotation.x = Math.PI / 2;
  box(24, 0.5, 0.3, lambert(0x1a1420), 0, 0.25, -8.85, sc);
  const rug = plane(
    8,
    6,
    lambert(
      canvasTex(64, 48, (c, cw, ch) => {
        c.fillStyle = "#8a2a3a";
        c.fillRect(0, 0, cw, ch);
        c.strokeStyle = "#e8c070";
        c.lineWidth = 3;
        c.strokeRect(4, 4, cw - 8, ch - 8);
        c.strokeRect(10, 10, cw - 20, ch - 20);
        c.fillStyle = "#e8c070";
        c.beginPath();
        c.arc(cw / 2, ch / 2, 8, 0, 7);
        c.fill();
      })
    ),
    0,
    0.03,
    0,
    sc
  );
  rug.rotation.x = -Math.PI / 2;
  const night = canvasTex(96, 64, (c, cw, ch) => {
    const g = c.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, "#05061a");
    g.addColorStop(1, "#3a2a5a");
    c.fillStyle = g;
    c.fillRect(0, 0, cw, ch);
    c.fillStyle = "#fff";
    for (let i = 0; i < 30; i++) c.fillRect((i * 29) % cw, (i * 11) % (ch * 0.5), 1, 1);
    for (let x = 0; x < cw; x += 9) {
      const bh = 10 + ((x * 7) % 26);
      c.fillStyle = "#0a0a14";
      c.fillRect(x, ch - bh, 8, bh);
      c.fillStyle = "#ffd27a";
      for (let k = 0; k < 5; k++) if ((x + k) % 3 === 0) c.fillRect(x + 2 + (k % 2) * 3, ch - bh + 3 + Math.floor(k / 2) * 5, 2, 2);
    }
    c.fillStyle = "#e8e8f0";
    c.beginPath();
    c.arc(78, 12, 4, 0, 7);
    c.fill();
  });
  plane(5, 3.4, new THREE.MeshBasicMaterial({ map: night }), 7.5, 6.2, -8.95, sc);
  for (const y of [1.8, -1.8]) box(5.4, 0.25, 0.3, lambert(0xd8d0c0), 7.5, 6.2 + y, -8.85, sc);
  for (const x of [-2.6, 2.6]) box(0.25, 3.8, 0.3, lambert(0xd8d0c0), 7.5 + x, 6.2, -8.85, sc);
  box(0.15, 3.6, 0.2, lambert(0xd8d0c0), 7.5, 6.2, -8.85, sc);
  const moon = point(0x8aa8ff, 0.5, 20);
  moon.position.set(7.5, 6.2, -6);
  sc.add(moon);
  const lamp = new THREE.Group();
  cyl(0.5, 0.15, lambert(0x222222), 0, 0.08, 0, lamp, 10);
  cyl(0.06, 1.6, lambert(0x333333), 0, 0.9, 0, lamp, 6);
  cyl(0.8, 0.9, new THREE.MeshBasicMaterial({ color: 0xffd28a }), 0, 2.0, 0, lamp, 12, 0.45);
  lamp.position.set(11.2, 3.2, -7.8);
  sc.add(lamp);
  const lp = point(0xffa850, 1.15, 30);
  lp.position.set(10.6, 5.6, -6.4);
  sc.add(lp);
  const ceilLamp = point(0xffb56a, 0.55, 34);
  ceilLamp.position.set(-1, 8.6, -1);
  sc.add(ceilLamp);
  w.tvGlow = point(0x6a9cff, 0.45, 12);
  w.tvGlow.position.set(-1.2, 5, -6);
  sc.add(w.tvGlow);
  spot(sc, -8, 9, 4, -8, 3.4, -8, 0xffc27a, 1.1, 0.55);
  spot(sc, 0, 9, 4, 0, 3, -8, 0xffc27a, 0.9, 0.6);
  spot(sc, 8.2, 9, 4, 8.2, 3.4, -8, 0xffb060, 1.0, 0.55);
  spot(sc, -8, 9, 2, -11.5, 4, -1, 0xffc27a, 1.0, 0.6);
  // The bed, where the camera starts.
  box(9, 0.7, 9, lambert(0x3a2412), 0, 0.9, 8.2, sc);
  box(
    8.6,
    1.2,
    8.6,
    lambert(
      canvasTex(
        32,
        32,
        (c, cw, ch) => {
          c.fillStyle = "#b8402a";
          c.fillRect(0, 0, cw, ch);
          c.fillStyle = "#d8583a";
          for (let x = 0; x < cw; x += 8) c.fillRect(x, 0, 4, ch);
        },
        [4, 4]
      )
    ),
    0,
    1.6,
    8.2,
    sc
  );
  box(3, 0.5, 1.6, lambert(0xe8e0d0), -2.4, 2.4, 5.2, sc);
  box(9, 3.4, 0.5, lambert(0x3a2412), 0, 2.5, 12.4, sc);
  // Dresser and hi-fi.
  box(8, 3.0, 2.6, lambert(T.shelfDark), -8, 1.5, -7.5, sc);
  box(8.4, 0.22, 3, lambert(T.shelf), -8, 3.1, -7.5, sc);
  for (const x of [-9.8, -6.2]) for (const r of [0, 1]) box(3, 1.2, 0.1, lambert(T.shelf), x, 0.9 + r * 1.1, -6.15, sc);
  const tt = buildTurntable();
  tt.position.set(-9.5, 3.2, -7.4);
  sc.add(tt);
  const tp = buildTapeDeck();
  tp.position.set(-5.4, 3.2, -7.4);
  sc.add(tp);
  // TV and DVD.
  box(7.6, 2.2, 2.6, lambert(T.shelfDark), 0, 1.1, -7.5, sc);
  box(8, 0.2, 3, lambert(T.shelf), 0, 2.3, -7.5, sc);
  const tv = buildCRT(4.2, 3.2, 3.2);
  tv.position.set(-1.4, 2.4, -7.6);
  sc.add(tv);
  const dv = buildDVDPlayer();
  dv.position.set(2.4, 2.4, -7.2);
  sc.add(dv);
  // Desk, CD player and the notebook.
  box(8, 0.3, 3.2, lambert(T.shelf), 8.4, 3.3, -7.4, sc);
  for (const x of [-3.7, 3.7]) box(0.4, 3.2, 3, lambert(T.shelfDark), 8.4 + x, 1.6, -7.4, sc);
  box(7.4, 2.2, 0.3, lambert(T.shelfDark), 8.4, 2.2, -8.6, sc);
  const cd = buildCDDeck();
  cd.position.set(10.6, 3.45, -7.4);
  sc.add(cd);
  w.devices = { vinyl: tt, cassette: tp, dvd: dv, cd, tv };
  const nb = new THREE.Group();
  box(2.5, 0.12, 3.1, lambert(0x2a5a9a), 0, 0.06, 0, nb);
  box(
    2.3,
    0.06,
    2.9,
    lambert(
      canvasTex(64, 64, (c, cw, ch) => {
        c.fillStyle = "#efe6cf";
        c.fillRect(0, 0, cw, ch);
        c.strokeStyle = "#8fb3d9";
        for (let y = 8; y < ch; y += 6) {
          c.beginPath();
          c.moveTo(4, y);
          c.lineTo(cw - 4, y);
          c.stroke();
        }
        c.strokeStyle = "#d36060";
        c.beginPath();
        c.moveTo(12, 0);
        c.lineTo(12, ch);
        c.stroke();
      })
    ),
    0.05,
    0.15,
    0,
    nb
  );
  const pen = cyl(0.05, 1.7, lambert(0xd8281c), 0.6, 0.24, 0.3, nb, 6);
  pen.rotation.z = Math.PI / 2;
  pen.rotation.y = 0.5;
  nb.position.set(6.6, 3.5, -6.6);
  nb.rotation.y = -0.18;
  sc.add(nb);
  // Corkboard on the right wall.
  const cb = new THREE.Group();
  box(0.3, 6.2, 9, lambert(0x5b3414), 0, 0, 0, cb);
  const cork = plane(
    8.4,
    5.6,
    lambert(
      canvasTex(64, 48, (c, cw, ch) => {
        c.fillStyle = "#a8743a";
        c.fillRect(0, 0, cw, ch);
        for (let i = 0; i < 500; i++) {
          c.fillStyle = ["#8a5a2a", "#c8904a", "#6a4220"][i % 3];
          c.fillRect((i * 37) % cw, (i * 53) % ch, 1, 1);
        }
      })
    ),
    -0.18,
    0,
    0,
    cb
  );
  cork.rotation.y = -Math.PI / 2;
  (
    [
      [-2.6, 1.2, 0xfff8dc],
      [-0.6, 1.5, 0xd8f0ff],
      [1.5, 1.1, 0xfff8dc],
      [3.0, 1.6, 0xffe0e0],
      [-1.8, -1.3, 0xe8ffd8],
      [0.8, -1.4, 0xfff8dc],
      [2.8, -1.2, 0xd8f0ff],
    ] as const
  ).forEach(([z, y, col], i) => {
    const n = plane(1.6, 1.8, lambert(col), -0.2, y, z, cb);
    n.rotation.y = -Math.PI / 2;
    n.rotation.x = ((i % 3) - 1) * 0.06;
  });
  plane(5, 0.9, lambert(signTex("COMMUNITY BOARD", 256, 48, "#2a1608", "#f2b24a")), -0.2, 3.5, 0, cb).rotation.y = -Math.PI / 2;
  cb.position.set(11.7, 5, -1);
  sc.add(cb);
  // The collection shelf, on the left wall.
  const holder = new THREE.Group();
  holder.rotation.y = Math.PI / 2;
  holder.position.set(-11.5, 0, -1);
  sc.add(holder);
  const unit = shelfUnit(holder, T, 0, 1.0, ROOM_SHELF.cols, ROOM_SHELF.rows, ROOM_SHELF.cw, ROOM_SHELF.ch, ROOM_SHELF.dep, true);
  w.shelfHolder = holder;
  w.shelfSlots = unit.slots;
  plane(4.2, 0.8, lambert(signTex("MY COLLECTION", 256, 48, "#2a1608", "#f2b24a")), 0, 1.0 + unit.H + 0.7, 0.3, holder);
  // Posters and the console.
  for (const [x, y, a, b] of [
    [-5.2, 6.8, "#e8571f", "#2a0a04"],
    [-2.4, 6.8, "#1f4fa8", "#06142e"],
    [3.4, 6.9, "#7a2a9a", "#1a0830"],
  ] as const) {
    const t = canvasTex(48, 64, (c, cw, ch) => {
      const g = c.createLinearGradient(0, 0, cw, ch);
      g.addColorStop(0, a);
      g.addColorStop(1, b);
      c.fillStyle = g;
      c.fillRect(0, 0, cw, ch);
      c.fillStyle = "rgba(255,255,255,.25)";
      c.beginPath();
      c.arc(cw / 2, ch * 0.4, cw * 0.26, 0, 7);
      c.fill();
    });
    box(1.9, 2.5, 0.1, lambert(0x111111), x, y, -8.85, sc);
    plane(1.7, 2.3, lambert(t), x, y, -8.78, sc);
  }
  const ps = new THREE.Group();
  box(2.4, 0.35, 1.5, phong(0x15151a), 0, 0.18, 0, ps);
  box(0.5, 0.3, 0.05, lambert(0x36d6ff), 0.7, 0.2, 0.78, ps);
  ps.position.set(-3.4, 0.04, -5.2);
  ps.rotation.y = 0.4;
  sc.add(ps);

  w.stations = [
    { id: "bed", name: "On the Bed", tag: "Home", x: 0, look: new THREE.Vector3(0, 3.6, -7), dist: 0, fitW: 20, fitH: 9, dir: new THREE.Vector3(0, 0.12, 1) },
    { id: "shelf", name: "My Collection", tag: "Everything you own", x: -11.5, look: new THREE.Vector3(-11.5, 4.9, -1), dist: 0, fitW: 13.6, fitH: 9, dir: new THREE.Vector3(1, 0.08, 0) },
    { id: "hifi", name: "Hi-Fi Dresser", tag: "Records · Tapes", x: -8, look: new THREE.Vector3(-7.6, 3.9, -7.4), dist: 0, fitW: 9.5, fitH: 5 },
    { id: "tv", name: "TV & DVD", tag: "Movie night", x: 0, look: new THREE.Vector3(0.2, 3.9, -7.4), dist: 0, fitW: 9, fitH: 5.4 },
    { id: "desk", name: "Desk", tag: "Notebook · CD player", x: 8.4, look: new THREE.Vector3(8.4, 3.8, -7.0), dist: 0, fitW: 9, fitH: 4.6 },
    { id: "board", name: "Community Board", tag: "Reviews", x: 11.7, look: new THREE.Vector3(11.7, 5, -1), dist: 0, fitW: 10, fitH: 7.4, dir: new THREE.Vector3(-1, 0.08, 0) },
  ];
  w.spots.push({ kind: "notebook", station: "desk", group: nb, w: 3, h: 1.4, label: "NOTEBOOK" });
  w.spots.push({ kind: "board", station: "board", group: cb, w: 9, h: 6.2, label: "COMMUNITY BOARD" });
  return w;
}

/** Puts the viewer's collection on the bedroom shelf. Rebuilt whenever it changes. */
export function stockRoom(room: Room, owned: StoreItem[]) {
  for (const s of room.spots.filter((x) => x.kind === "item")) s.group.parent?.remove(s.group);
  room.spots = room.spots.filter((x) => x.kind !== "item");
  room.models.clear();
  owned.slice(0, room.shelfSlots.length).forEach((item, i) => {
    const sl = room.shelfSlots[i];
    const [W, H, D] = DIM[item.format];
    const k = item.format === "vinyl" ? 0.62 : 1;
    const g = buildItem(item, room.T);
    g.scale.setScalar(k);
    g.position.set(sl.x, sl.yb + (H * k) / 2 + 0.12, ROOM_SHELF.dep / 2 - (D * k) / 2 - 0.3);
    g.rotation.x = -0.06;
    room.shelfHolder.add(g);
    room.models.set(item.id, g);
    room.spots.push({
      kind: "item",
      station: "shelf",
      item,
      group: g,
      w: W,
      h: H,
      label: item.title,
      home: { pos: g.position.clone(), rot: g.rotation.clone(), parent: room.shelfHolder },
    });
  });
}

/** Sets each station's camera distance so its contents fit on this screen. */
export function fitStations(world: World) {
  const cam = world.cam;
  const tn = Math.tan((cam.fov * Math.PI) / 360);
  for (const s of world.stations) {
    const byH = s.fitH / 2 / tn;
    const byW = s.fitW / 2 / (tn * cam.aspect);
    s.dist = Math.max(byH, byW);
  }
}
