import * as THREE from "three";
import type { StoreItem } from "@/lib/store";

// Rendering for the record store: a low-resolution target with a PS2
// post pass, procedural textures, and every model in the shop.
//
// Ported from the prototype (docs/ps2-store/prototype/c1_gfx.js), with
// real catalogue artwork in place of its placeholder covers.
//
// Colour management is off on purpose. The look was designed for the
// old three.js pipeline - textures and output in the same space, light
// pools that blow out a little - and the PS2 never did gamma-correct
// lighting either. The lights below are scaled to match.

THREE.ColorManagement.enabled = false;

/** three.js lights since r155 are physical; this restores roughly the old brightness. */
export const LIGHT = 1.9;

// ---------- renderer ----------

export type Renderer = {
  gl: THREE.WebGLRenderer;
  rt: THREE.WebGLRenderTarget;
  post: { scene: THREE.Scene; cam: THREE.OrthographicCamera; mat: THREE.ShaderMaterial };
  size: { w: number; h: number; cssW: number; cssH: number };
  fit(cssW: number, cssH: number): void;
  draw(scene: THREE.Scene, cam: THREE.PerspectiveCamera): void;
  dispose(): void;
};

export function makeRenderer(canvas: HTMLCanvasElement): Renderer {
  const gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  gl.setPixelRatio(1);
  const rt = new THREE.WebGLRenderTarget(480, 270, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
  });
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      t: { value: rt.texture },
      res: { value: new THREE.Vector2(480, 270) },
      fade: { value: 1 },
      tint: { value: new THREE.Vector3(1, 0.97, 0.9) },
    },
    vertexShader: "varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}",
    // Ordered dither into 5 bits a channel, a touch of extra saturation,
    // vignette and faint scanlines: the PS2's framebuffer, more or less.
    fragmentShader: `uniform sampler2D t;uniform vec2 res;uniform float fade;uniform vec3 tint;varying vec2 v;
      void main(){vec3 c=texture2D(t,v).rgb;vec2 p=floor(v*res);
      float d=fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))))-.5;
      c=floor(c*31.+.5+d*.9)/31.;
      float g=dot(c,vec3(.3,.59,.11));c=mix(vec3(g),c,1.08)*tint;
      float vg=1.-.42*pow(length(v-.5)*1.3,2.2);c*=vg;
      c*=mix(.93,1.,mod(p.y,2.));
      gl_FragColor=vec4(c*fade,1.);}`,
    depthTest: false,
    depthWrite: false,
  });
  const post = { scene: new THREE.Scene(), cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), mat };
  post.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  const size = { w: 480, h: 270, cssW: 960, cssH: 540 };
  return {
    gl,
    rt,
    post,
    size,
    fit(cssW, cssH) {
      // About 230-300 pixels tall, whatever the screen: the resolution is
      // the look, so it does not scale up with the display.
      const h = Math.max(210, Math.min(300, Math.round(cssH / 2.3)));
      const w = Math.max(1, Math.round((h * cssW) / Math.max(1, cssH)));
      size.w = w;
      size.h = h;
      size.cssW = cssW;
      size.cssH = cssH;
      gl.setSize(w, h, false);
      rt.setSize(w, h);
      mat.uniforms.res.value.set(w, h);
    },
    draw(scene, cam) {
      gl.setRenderTarget(rt);
      gl.render(scene, cam);
      gl.setRenderTarget(null);
      gl.render(post.scene, post.cam);
    },
    dispose() {
      rt.dispose();
      mat.dispose();
      gl.dispose();
    },
  };
}

// ---------- textures ----------

type Draw = (c: CanvasRenderingContext2D, w: number, h: number) => void;

export function canvasTex(w: number, h: number, draw: Draw, repeat?: [number, number]): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapNearestFilter;
  return t;
}

function soft(t: THREE.Texture): THREE.Texture {
  t.minFilter = t.magFilter = THREE.LinearFilter;
  return t;
}

// A seeded random, so the speckle on a texture is the same every visit.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function speckle(c: CanvasRenderingContext2D, w: number, h: number, n: number, cols: string[], sz = 1, seed = 7) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    c.fillStyle = cols[i % cols.length];
    c.fillRect(r() * w, r() * h, sz, sz);
  }
}

export const FONT_UI = '"Chakra Petch", "Trebuchet MS", Arial, sans-serif';
export const FONT_MONO = '"Share Tech Mono", ui-monospace, monospace';

export type Textures = ReturnType<typeof makeTextures>;

export function makeTextures() {
  const r = rng(11);
  return {
    shelf: canvasTex(128, 128, (c, w, h) => {
      c.fillStyle = "#d9a44a";
      c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 2) {
        c.fillStyle = `rgba(${120 + r() * 30},${70 + r() * 20},20,${0.12 + r() * 0.14})`;
        c.fillRect(0, y, w, 1);
      }
      speckle(c, w, h, 260, ["#b8802c", "#e8bc66", "#9c6a22"], 2, 1);
    }),
    shelfDark: canvasTex(128, 128, (c, w, h) => {
      c.fillStyle = "#4a2c14";
      c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 3) {
        c.fillStyle = `rgba(0,0,0,${0.1 + r() * 0.2})`;
        c.fillRect(0, y, w, 1);
      }
      speckle(c, w, h, 200, ["#5e3a1c", "#3a2210"], 2, 2);
    }),
    wall: canvasTex(
      128,
      128,
      (c, w, h) => {
        c.fillStyle = "#5a2a1c";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#6a3322";
        for (let x = 0; x < w; x += 16) c.fillRect(x, 0, 8, h);
        speckle(c, w, h, 320, ["#3e1c10", "#7a4430"], 1, 3);
        c.fillStyle = "rgba(0,0,0,.18)";
        for (let y = 0; y < h; y += 32) c.fillRect(0, y, w, 2);
      },
      [10, 3]
    ),
    wainscot: canvasTex(
      64,
      64,
      (c, w, h) => {
        c.fillStyle = "#35200f";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#4a2d16";
        c.fillRect(2, 2, w - 4, h - 4);
        c.fillStyle = "#2a1809";
        c.fillRect(w / 2 - 1, 0, 2, h);
        speckle(c, w, h, 100, ["#3a2210", "#5a3a1c"], 1, 4);
      },
      [24, 1]
    ),
    floor: canvasTex(
      64,
      64,
      (c, w, h) => {
        c.fillStyle = "#2b2018";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#c8b080";
        c.fillRect(0, 0, 32, 32);
        c.fillRect(32, 32, 32, 32);
        c.fillStyle = "#1a1410";
        c.fillRect(32, 0, 32, 32);
        c.fillRect(0, 32, 32, 32);
        speckle(c, w, h, 220, ["rgba(0,0,0,.25)", "rgba(255,255,255,.1)"], 1, 5);
      },
      [22, 5]
    ),
    ceil: canvasTex(
      64,
      64,
      (c, w, h) => {
        c.fillStyle = "#1a1210";
        c.fillRect(0, 0, w, h);
        speckle(c, w, h, 120, ["#2a1c16", "#120c0a"], 1, 6);
      },
      [20, 3]
    ),
    glow: soft(
      canvasTex(128, 128, (c, w, h) => {
        const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        g.addColorStop(0, "rgba(255,190,100,.9)");
        g.addColorStop(0.5, "rgba(255,150,60,.35)");
        g.addColorStop(1, "rgba(255,120,30,0)");
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
      })
    ),
    blob: soft(
      canvasTex(64, 64, (c, w, h) => {
        const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        g.addColorStop(0, "rgba(0,0,0,.7)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
      })
    ),
    beam: soft(
      canvasTex(32, 128, (c, w, h) => {
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, "rgba(255,200,120,.5)");
        g.addColorStop(1, "rgba(255,170,80,0)");
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
      })
    ),
    shine: soft(
      canvasTex(64, 64, (c, w, h) => {
        const g = c.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, "rgba(255,255,255,.34)");
        g.addColorStop(0.35, "rgba(255,255,255,.05)");
        g.addColorStop(0.5, "rgba(255,255,255,.2)");
        g.addColorStop(0.6, "rgba(255,255,255,0)");
        g.addColorStop(1, "rgba(255,255,255,.12)");
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
      })
    ),
    disc: canvasTex(128, 128, (c) => {
      c.fillStyle = "#c9ccd2";
      c.beginPath();
      c.arc(64, 64, 63, 0, 7);
      c.fill();
      for (let i = 0; i < 48; i++) {
        c.fillStyle = `hsla(${i * 7.5},70%,70%,.28)`;
        c.beginPath();
        c.moveTo(64, 64);
        c.arc(64, 64, 63, (i / 48) * 6.283, ((i + 1) / 48) * 6.283);
        c.fill();
      }
      c.fillStyle = "#e8e8ec";
      c.beginPath();
      c.arc(64, 64, 24, 0, 7);
      c.fill();
      c.fillStyle = "#222";
      c.beginPath();
      c.arc(64, 64, 7, 0, 7);
      c.fill();
    }),
  };
}

export function labelTex(text: string, w = 128, h = 24, bg = "#1f4fa8", fg = "#fff") {
  return canvasTex(w, h, (c) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#8fb4f0";
    c.fillRect(0, 0, w, 2);
    c.fillStyle = fg;
    c.font = `700 ${h * 0.72}px ${FONT_UI}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, w / 2, h / 2 + 1);
  });
}

export function signTex(text: string, w = 256, h = 64, bg = "#3a2210", fg = "#f2b24a", sub?: string) {
  return canvasTex(w, h, (c) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = fg;
    c.lineWidth = 3;
    c.strokeRect(5, 5, w - 10, h - 10);
    c.fillStyle = fg;
    c.font = `700 ${sub ? h * 0.4 : h * 0.5}px ${FONT_UI}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, w / 2, sub ? h * 0.38 : h / 2 + 2, w - 16);
    if (sub) {
      c.font = `${h * 0.2}px ${FONT_MONO}`;
      c.fillText(sub, w / 2, h * 0.74, w - 16);
    }
  });
}

export function wrapText(c: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (c.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------- materials and primitives ----------

export const lambert = (o: THREE.Texture | number | THREE.MeshLambertMaterialParameters) =>
  new THREE.MeshLambertMaterial(
    o instanceof THREE.Texture ? { map: o } : typeof o === "number" ? { color: o } : o
  );
export const phong = (color: number, o: THREE.MeshPhongMaterialParameters = {}) =>
  new THREE.MeshPhongMaterial({ color, shininess: 35, specular: 0x665544, ...o });
export const basic = (color: number) => new THREE.MeshBasicMaterial({ color });

export function box(
  w: number,
  h: number,
  d: number,
  m: THREE.Material | THREE.Material[],
  x = 0,
  y = 0,
  z = 0,
  parent?: THREE.Object3D
) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  parent?.add(o);
  return o;
}
export function cyl(
  r: number,
  h: number,
  m: THREE.Material | THREE.Material[],
  x = 0,
  y = 0,
  z = 0,
  parent?: THREE.Object3D,
  seg = 16,
  r2?: number
) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r2 ?? r, h, seg), m);
  o.position.set(x, y, z);
  parent?.add(o);
  return o;
}
export function plane(
  w: number,
  h: number,
  m: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  parent?: THREE.Object3D,
  sx = 1,
  sy = 1
) {
  const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h, sx, sy), m);
  o.position.set(x, y, z);
  parent?.add(o);
  return o;
}

// ---------- artwork ----------
//
// Each item's face is a canvas: the real catalogue artwork drawn into the
// shape of its packaging, with the packaging's own furniture (the DVD
// logo, the cassette's J-card strip) around it. Until the image arrives
// the face shows the title in type - a label, never a made-up cover.

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
export function loadImage(url: string): Promise<HTMLImageElement | null> {
  let p = imageCache.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
    imageCache.set(url, p);
  }
  return p;
}

function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** Two colours for an item's plastic and spine, stable per item. */
export function itemColors(item: StoreItem): [string, string] {
  const h = hashString(item.id) % 360;
  return [`hsl(${h} 45% 42%)`, `hsl(${(h + 30) % 360} 40% 18%)`];
}

export const FACE_SIZE: Record<StoreItem["format"], [number, number]> = {
  cd: [192, 192],
  vinyl: [192, 192],
  cassette: [128, 200],
  dvd: [160, 226],
};

function drawLabelFace(c: CanvasRenderingContext2D, w: number, h: number, item: StoreItem) {
  const [c1, c2] = itemColors(item);
  const g = c.createLinearGradient(0, 0, w * 0.4, h);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#fff6e0";
  c.textBaseline = "top";
  const pad = w * 0.08;
  let fs = w * 0.14;
  let lines: string[];
  do {
    c.font = `700 ${fs}px ${FONT_UI}`;
    lines = wrapText(c, item.title, w - pad * 2);
    fs -= 1.5;
  } while (lines.length > 4 && fs > 9);
  lines.slice(0, 4).forEach((l, i) => c.fillText(l, pad, pad + i * fs * 1.08));
  if (item.artist) {
    c.font = `600 ${Math.max(9, w * 0.065)}px ${FONT_UI}`;
    c.textBaseline = "bottom";
    c.fillText(item.artist, pad, h - pad, w - pad * 2);
  }
}

function drawPackaging(c: CanvasRenderingContext2D, w: number, h: number, item: StoreItem, img: HTMLImageElement | null) {
  const cover = (x: number, y: number, cw: number, ch: number) => {
    if (!img) return;
    const s = Math.max(cw / img.width, ch / img.height);
    const dw = img.width * s;
    const dh = img.height * s;
    c.save();
    c.beginPath();
    c.rect(x, y, cw, ch);
    c.clip();
    c.drawImage(img, x + (cw - dw) / 2, y + (ch - dh) / 2, dw, dh);
    c.restore();
  };
  if (!img) {
    drawLabelFace(c, w, h, item);
  } else if (item.format === "cassette") {
    // A J-card: the sleeve square at the top, the title strip below.
    const [, c2] = itemColors(item);
    c.fillStyle = c2;
    c.fillRect(0, 0, w, h);
    cover(0, 0, w, w);
    c.fillStyle = "#f2efe6";
    c.fillRect(0, w, w, h - w);
    c.fillStyle = "#1a1208";
    c.font = `700 ${Math.round(w * 0.11)}px ${FONT_UI}`;
    c.textBaseline = "top";
    c.fillText(item.title, 6, w + 6, w - 12);
    c.font = `${Math.round(w * 0.09)}px ${FONT_MONO}`;
    if (item.artist) c.fillText(item.artist, 6, w + 6 + w * 0.14, w - 12);
    c.fillStyle = "#b8281c";
    c.fillRect(0, h - 8, w, 8);
  } else {
    cover(0, 0, w, h);
  }
  if (item.format === "dvd") {
    // The early-2000s case furniture: the DVD VIDEO mark, bottom left.
    c.fillStyle = "rgba(0,0,0,.72)";
    c.fillRect(6, h - 22, 58, 16);
    c.strokeStyle = "#fff";
    c.lineWidth = 1;
    c.strokeRect(6.5, h - 21.5, 57, 15);
    c.fillStyle = "#fff";
    c.font = `700 10px ${FONT_UI}`;
    c.textBaseline = "middle";
    c.fillText("DVD VIDEO", 10, h - 13.5);
  }
}

export type Face = { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; ready: Promise<boolean> };
const faceCache = new Map<string, Face>();

/** The item's front, as a texture that sharpens into the real artwork once it loads. */
export function itemFace(item: StoreItem): Face {
  const hit = faceCache.get(item.id);
  if (hit) return hit;
  const [w, h] = FACE_SIZE[item.format];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  drawPackaging(ctx, w, h, item, null);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapNearestFilter;
  const ready = loadImage(item.art).then((img) => {
    if (!img) return false;
    ctx.clearRect(0, 0, w, h);
    drawPackaging(ctx, w, h, item, img);
    tex.needsUpdate = true;
    return true;
  });
  const face = { canvas, tex, ready };
  faceCache.set(item.id, face);
  return face;
}

function spineTex(item: StoreItem, w: number, h: number) {
  const [c1, c2] = itemColors(item);
  return canvasTex(w, h, (c) => {
    c.fillStyle = item.format === "dvd" ? "#0c0c10" : c2;
    c.fillRect(0, 0, w, h);
    c.fillStyle = c1;
    c.fillRect(0, 0, w, h * 0.08);
    c.fillRect(0, h * 0.92, w, h * 0.08);
    c.save();
    c.translate(w / 2, h / 2);
    c.rotate(-Math.PI / 2);
    c.fillStyle = item.format === "dvd" ? "#f2f2f2" : lum("#1a1208") < 0.5 ? "#fff6e0" : "#1a1208";
    let fs = w * 0.62;
    const text = item.artist && item.format !== "dvd" ? `${item.artist} · ${item.title}` : item.title;
    c.font = `700 ${fs}px ${FONT_UI}`;
    while (c.measureText(text).width > h * 0.8 && fs > 5) {
      fs -= 1;
      c.font = `700 ${fs}px ${FONT_UI}`;
    }
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, 0, 0);
    c.restore();
  });
}

function vinylTex(label: string) {
  const r = rng(3);
  return canvasTex(128, 128, (c) => {
    c.fillStyle = "#0a0a0c";
    c.beginPath();
    c.arc(64, 64, 63, 0, 7);
    c.fill();
    for (let rad = 22; rad < 62; rad += 1.6) {
      c.strokeStyle = `rgba(255,255,255,${0.04 + r() * 0.07})`;
      c.beginPath();
      c.arc(64, 64, rad, 0, 7);
      c.stroke();
    }
    c.fillStyle = label;
    c.beginPath();
    c.arc(64, 64, 21, 0, 7);
    c.fill();
    c.fillStyle = "#fff6e0";
    c.fillRect(46, 58, 36, 3);
    c.fillRect(50, 66, 28, 2);
    c.fillStyle = "#000";
    c.beginPath();
    c.arc(64, 64, 3, 0, 7);
    c.fill();
  });
}

function tapeLabelTex(item: StoreItem) {
  return canvasTex(128, 80, (c, w, h) => {
    c.fillStyle = "#d8d4c8";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#1a1208";
    c.font = `700 11px ${FONT_UI}`;
    c.fillText(item.title.slice(0, 22), 8, 9);
    c.fillStyle = "#22222a";
    c.fillRect(8, 14, 112, 34);
    c.fillStyle = "#e8e4d8";
    c.beginPath();
    c.arc(36, 31, 13, 0, 7);
    c.arc(92, 31, 13, 0, 7);
    c.fill();
    c.fillStyle = "#22222a";
    c.beginPath();
    c.arc(36, 31, 5, 0, 7);
    c.arc(92, 31, 5, 0, 7);
    c.fill();
    c.fillRect(8, 56, 112, 2);
    c.fillRect(8, 64, 70, 2);
  });
}

// ---------- the media ----------
//
// Real proportions, in decimetres: a jewel case is 14.2 x 12.5 x 1.2 cm,
// an LP sleeve 31 cm square, an Amaray DVD case 13.5 x 19 x 1.5 cm, a
// cassette case 6.9 x 10.8 x 1.7 cm standing up. Fronts face +z.

export const DIM: Record<StoreItem["format"], [number, number, number]> = {
  cd: [1.42, 1.25, 0.12],
  vinyl: [3.1, 3.1, 0.07],
  cassette: [0.69, 1.08, 0.17],
  dvd: [1.35, 1.9, 0.15],
};

export type ItemModel = THREE.Group & {
  userData: {
    item: StoreItem;
    W: number;
    H: number;
    D: number;
    media: THREE.Group;
    disc: THREE.Mesh | null;
    reels: THREE.Mesh[];
  };
};

export function buildItem(item: StoreItem, T: Textures): ItemModel {
  const g = new THREE.Group() as ItemModel;
  const [W, H, D] = DIM[item.format];
  const front = lambert(itemFace(item).tex);
  const plastic = phong(0x1b1b20, { shininess: 60, specular: 0x888888 });
  const dark = lambert(0x141416);
  const media = new THREE.Group();
  let disc: THREE.Mesh | null = null;
  const reels: THREE.Mesh[] = [];
  let mats: THREE.Material[];
  // Box face order: +x, -x, +y, -y, +z (front), -z (back).
  if (item.format === "cd") {
    mats = [plastic, lambert(spineTex(item, 24, 192)), plastic, plastic, front, dark];
    disc = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.012, 22), [
      lambert(0x888888),
      lambert(T.disc),
      lambert(0x888888),
    ]);
  } else if (item.format === "dvd") {
    const shell = phong(0x0c0c10, { shininess: 70 });
    mats = [shell, lambert(spineTex(item, 24, 226)), shell, shell, front, shell];
    disc = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.012, 22), [
      lambert(0x888888),
      lambert(T.disc),
      lambert(0x888888),
    ]);
  } else if (item.format === "vinyl") {
    const card = lambert(0x1a1612);
    mats = [card, lambert(spineTex(item, 16, 192)), card, card, front, lambert(0x22201c)];
    disc = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.02, 34), [
      lambert(0x0a0a0c),
      lambert(vinylTex(itemColors(item)[0])),
      lambert(0x0a0a0c),
    ]);
  } else {
    mats = [plastic, lambert(spineTex(item, 24, 96)), plastic, plastic, front, phong(0x22222a)];
    // The tape itself, lying flat inside the case, landscape.
    box(0.62, 0.4, 0.09, lambert(0x202026), 0, 0, 0, media);
    plane(0.56, 0.32, lambert(tapeLabelTex(item)), 0, 0, 0.047, media);
    for (const x of [-0.15, 0.15]) {
      const reel = cyl(0.06, 0.02, lambert(0xe8e4d8), x, 0.03, 0.05, media, 10);
      reel.rotation.x = Math.PI / 2;
      reels.push(reel);
    }
  }
  if (disc) {
    media.add(disc);
    media.rotation.x = Math.PI / 2;
  }
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mats);
  g.add(body);
  if (item.format === "cd") {
    // The obi strip, as on the reference photo's import CDs.
    plane(
      0.24,
      H,
      lambert(
        canvasTex(32, 128, (c, w, h) => {
          c.fillStyle = "#f2c230";
          c.fillRect(0, 0, w, h);
          c.fillStyle = "#b8281c";
          c.fillRect(4, 6, w - 8, 10);
          c.save();
          c.translate(w / 2, h / 2 + 8);
          c.rotate(-Math.PI / 2);
          c.fillStyle = "#1a1208";
          c.font = `700 13px ${FONT_UI}`;
          c.textAlign = "center";
          c.fillText("IMPORT", 0, 5);
          c.restore();
        })
      ),
      -W / 2 + 0.12,
      0,
      D / 2 + 0.004,
      g
    );
  }
  if (item.format !== "vinyl") {
    // Cellophane.
    plane(W, H, new THREE.MeshBasicMaterial({ map: T.shine, transparent: true, depthWrite: false }), 0, 0, D / 2 + 0.008, g);
  }
  if (item.format === "dvd") plane(0.03, H * 0.98, lambert(0x000000), -W / 2 + 0.12, 0, D / 2 + 0.003, g);
  g.add(media);
  g.userData = { item, W, H, D, media, disc, reels };
  return g;
}

// ---------- shelving ----------

export type Slot = { c: number; r: number; x: number; yb: number; zf: number };

export function shelfUnit(
  parent: THREE.Object3D,
  T: Textures,
  cx: number,
  y0: number,
  cols: number,
  rows: number,
  cw: number,
  ch: number,
  depth: number,
  lip = false
) {
  const W = cols * cw + 0.5;
  const H = rows * ch + 0.45;
  const g = new THREE.Group();
  const wood = lambert(T.shelf);
  const dk = lambert(T.shelfDark);
  box(W, H, 0.12, dk, 0, y0 + H / 2, -depth / 2, g);
  box(0.26, H, depth, wood, -W / 2 + 0.13, y0 + H / 2, 0, g);
  box(0.26, H, depth, wood, W / 2 - 0.13, y0 + H / 2, 0, g);
  box(W, 0.3, depth, wood, 0, y0 + H - 0.15, 0, g);
  for (let r = 0; r <= rows; r++) {
    box(W - 0.5, 0.14, depth, wood, 0, y0 + 0.07 + r * ch, 0, g);
    if (lip && r < rows) box(W - 0.5, 0.3, 0.1, wood, 0, y0 + 0.3 + r * ch, depth / 2 - 0.05, g);
  }
  box(W, 0.4, depth + 0.15, dk, 0, y0 - 0.1, 0.05, g);
  g.position.set(cx, 0, 0);
  parent.add(g);
  const slots: Slot[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      slots.push({ c, r, x: cx + (c - (cols - 1) / 2) * cw, yb: y0 + 0.14 + (rows - 1 - r) * ch, zf: depth / 2 });
  return { group: g, slots, W, H };
}

// ---------- devices ----------

export type Device = THREE.Group & {
  userData: {
    kind: "turntable" | "cd" | "tape" | "dvd";
    dropPoint: THREE.Object3D;
    platter?: THREE.Group;
    arm?: THREE.Group;
    armRest?: number;
    armPlay?: number;
    tray?: THREE.Group;
    trayOut?: number;
    door?: THREE.Group;
    display?: { ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture };
  };
};

function lcd(w: number, text: string) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 16;
  const ctx = c.getContext("2d")!;
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  const draw = (t: string) => {
    ctx.fillStyle = "#021a10";
    ctx.fillRect(0, 0, 64, 16);
    ctx.fillStyle = "#5aff9a";
    ctx.font = `10px ${FONT_MONO}`;
    ctx.fillText(t, 4, 12, w);
    tex.needsUpdate = true;
  };
  draw(text);
  return { ctx, tex, draw };
}

export function buildTurntable(): Device {
  const g = new THREE.Group() as Device;
  const wood = lambert(0x3a2412);
  const metal = phong(0xb8b8bc, { shininess: 80 });
  box(4.4, 0.5, 3.5, wood, 0, 0.25, 0, g);
  box(4.2, 0.12, 3.3, phong(0x14141a), 0, 0.56, 0, g);
  const platter = new THREE.Group();
  platter.position.set(-0.35, 0.7, 0.05);
  g.add(platter);
  cyl(1.62, 0.16, phong(0x888890, { shininess: 70 }), 0, 0, 0, platter, 26);
  cyl(1.5, 0.03, lambert(0x1a1a1e), 0, 0.1, 0, platter, 26);
  const dropPoint = new THREE.Object3D();
  dropPoint.position.set(-0.35, 0.9, 0.05);
  g.add(dropPoint);
  cyl(0.12, 0.3, metal, 1.6, 0.75, -1.0, g, 10);
  const arm = new THREE.Group();
  arm.position.set(1.6, 0.95, -1.0);
  g.add(arm);
  box(0.09, 0.09, 2.4, metal, 0, 0, 1.2, arm);
  box(0.28, 0.1, 0.38, phong(0x202024), 0, -0.05, 2.45, arm);
  arm.rotation.y = 0.62;
  box(0.35, 0.2, 0.35, lambert(0xd8d8d0), -1.7, 0.7, 1.3, g);
  cyl(0.14, 0.14, phong(0xd8b040), 1.7, 0.64, 1.25, g, 10);
  for (const x of [-1.8, 1.8]) for (const z of [-1.4, 1.4]) cyl(0.14, 0.2, lambert(0x111111), x, -0.05, z, g, 8);
  g.userData = { kind: "turntable", platter, arm, dropPoint, armRest: 0.62, armPlay: 0.12 };
  return g;
}

export function buildCDDeck(): Device {
  const g = new THREE.Group() as Device;
  const body = phong(0x15151a, { shininess: 50 });
  box(3.4, 0.95, 2.8, body, 0, 0.475, 0, g);
  box(3.4, 0.1, 2.8, phong(0x2a2a30), 0, 0.95, 0, g);
  const screen = lcd(60, "CD  --:--");
  box(1.0, 0.22, 0.04, lambert(screen.tex), -0.9, 0.55, 1.42, g);
  const tray = new THREE.Group();
  tray.position.set(0.55, 0.45, 0);
  g.add(tray);
  box(1.9, 0.08, 2.0, phong(0x2c2c32), 0, 0, 0.7, tray);
  cyl(0.62, 0.03, lambert(0x181820), 0, 0.06, 0.6, tray, 22);
  const dropPoint = new THREE.Object3D();
  dropPoint.position.set(0, 0.1, 0.6);
  tray.add(dropPoint);
  for (const [i, col] of [[0, 0x444444], [1, 0x5aff9a], [2, 0x444444]] as const) {
    cyl(0.07, 0.04, lambert(col), -1.4 + i * 0.25, 0.25, 1.42, g, 8).rotation.x = Math.PI / 2;
  }
  for (const x of [-1.4, 1.4]) for (const z of [-1.1, 1.1]) cyl(0.1, 0.1, lambert(0x111111), x, -0.04, z, g, 8);
  g.userData = { kind: "cd", tray, trayOut: 1.3, dropPoint, display: { ctx: screen.ctx, tex: screen.tex } };
  return g;
}

export function buildTapeDeck(): Device {
  const g = new THREE.Group() as Device;
  box(3.4, 1.5, 2.4, phong(0x26262c, { shininess: 50 }), 0, 0.75, 0, g);
  box(1.55, 0.8, 0.05, phong(0x0a0a10), -0.3, 0.85, 1.22, g);
  const door = new THREE.Group();
  door.position.set(-0.3, 0.45, 1.24);
  g.add(door);
  box(1.6, 0.95, 0.08, phong(0x15151a, { transparent: true, opacity: 0.55 }), 0, 0.4, 0, door);
  const dropPoint = new THREE.Object3D();
  dropPoint.position.set(-0.3, 0.85, 1.18);
  g.add(dropPoint);
  for (let i = 0; i < 4; i++)
    box(0.28, 0.2, 0.12, lambert(i === 0 ? 0xb82a1c : 0x888890), 1.0 + (i % 2) * 0.3, 0.4 + Math.floor(i / 2) * 0.3, 1.2, g);
  box(0.5, 0.28, 0.05, lambert(0x111118), 1.0, 1.2, 1.21, g);
  for (const x of [-1.4, 1.4]) for (const z of [-0.9, 0.9]) cyl(0.1, 0.1, lambert(0x111111), x, -0.04, z, g, 8);
  g.userData = { kind: "tape", door, dropPoint };
  return g;
}

export function buildDVDPlayer(): Device {
  const g = new THREE.Group() as Device;
  box(3.2, 0.5, 2.2, phong(0x1a1a20, { shininess: 60 }), 0, 0.25, 0, g);
  box(1.8, 0.06, 0.03, lambert(0x050508), -0.3, 0.28, 1.12, g);
  const tray = new THREE.Group();
  tray.position.set(-0.3, 0.28, 0);
  g.add(tray);
  box(1.5, 0.04, 1.5, phong(0x2a2a30), 0, 0, 0.5, tray);
  const dropPoint = new THREE.Object3D();
  dropPoint.position.set(0, 0.06, 0.5);
  tray.add(dropPoint);
  box(0.3, 0.08, 0.04, lambert(0x3ad87a), 1.2, 0.3, 1.12, g);
  g.userData = { kind: "dvd", tray, trayOut: 1.2, dropPoint };
  return g;
}

export type CRT = THREE.Group & {
  userData: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; screen: THREE.Mesh };
};

export function buildCRT(w = 3.6, h = 2.8, d = 3): CRT {
  const g = new THREE.Group() as CRT;
  const shell = phong(0x6a6a70, { shininess: 30 });
  box(w, h, d * 0.55, shell, 0, h / 2, d * 0.2, g);
  box(w * 0.72, h * 0.72, d * 0.5, shell, 0, h / 2, -d * 0.3, g);
  box(w * 0.88, h * 0.82, 0.05, lambert(0x0a0a0a), -w * 0.04, h / 2 + 0.05, d * 0.475, g);
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 96;
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  const screen = plane(w * 0.8, h * 0.7, new THREE.MeshBasicMaterial({ map: tex }), -w * 0.04, h / 2 + 0.05, d * 0.475 + 0.04, g);
  for (let i = 0; i < 3; i++)
    cyl(0.1, 0.05, lambert(0x222222), w * 0.43, h * 0.7 - i * 0.35, d * 0.475 + 0.03, g, 8).rotation.x = Math.PI / 2;
  g.userData = { canvas, ctx: canvas.getContext("2d")!, tex, screen };
  return g;
}

export type CrtMode = "off" | "static" | "menu" | "play" | "viz";

/** Draws one frame of the TV. `level` is 0-1 audio energy for the visualiser. */
export function drawCRT(tv: CRT, mode: CrtMode, item: StoreItem | null, t: number, level = 0, cover?: HTMLCanvasElement) {
  const c = tv.userData.ctx;
  const w = 128;
  const h = 96;
  if (mode === "off") {
    c.fillStyle = "#07090a";
    c.fillRect(0, 0, w, h);
    const g = c.createRadialGradient(64, 48, 2, 64, 48, 70);
    g.addColorStop(0, "rgba(60,70,70,.35)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  } else if (mode === "static") {
    const im = c.createImageData(w, h);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = Math.random() * 150;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = 255;
    }
    c.putImageData(im, 0, 0);
  } else if ((mode === "menu" || mode === "play") && item) {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#14308a");
    g.addColorStop(1, "#050a24");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    if (cover) c.drawImage(cover, 6, 10, 44, Math.min(70, (44 * cover.height) / cover.width));
    c.fillStyle = "#fff";
    c.font = `700 9px ${FONT_UI}`;
    wrapText(c, item.title, 68)
      .slice(0, 3)
      .forEach((l, i) => c.fillText(l, 56, 22 + i * 10));
    c.font = `7px ${FONT_MONO}`;
    c.fillStyle = "#9fc3f2";
    c.fillText([item.year, item.genre].filter(Boolean).join(" · "), 56, 58, 70);
    if (mode === "menu") {
      ["PLAY MOVIE", "SCENE SELECT", "SETUP"].forEach((s, i) => {
        const on = i === 0 || Math.floor(t * 0.8) % 3 === i;
        c.fillStyle = on && i === 0 ? "#36d6ff" : "#bcd6ff";
        c.font = `700 8px ${FONT_UI}`;
        c.fillText(`${i === 0 ? "▶ " : "  "}${s}`, 56, 70 + i * 9);
      });
    } else {
      c.fillStyle = "#02060f";
      c.fillRect(0, 78, w, 18);
      c.fillStyle = "#fff";
      c.font = `7px ${FONT_MONO}`;
      c.fillText(`▶ ${item.previewUrl ? "TRAILER" : "NO TRAILER ON FILE"}`, 6, 89);
      c.fillStyle = "#36d6ff";
      c.fillRect(6, 92, (t * 3) % 116, 2);
    }
  } else if (mode === "viz" && item) {
    c.fillStyle = "#04060c";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 24; i++) {
      const v = Math.max(0.05, Math.min(1, level * (0.55 + 0.45 * Math.sin(t * (3 + i * 0.37) + i * 1.7))));
      c.fillStyle = `hsl(${190 + i * 4},90%,${40 + v * 30}%)`;
      c.fillRect(6 + i * 5, 70 - v * 54, 4, v * 54 + 2);
    }
    c.fillStyle = "#fff";
    c.font = `700 8px ${FONT_UI}`;
    c.fillText(item.title.slice(0, 26), 6, 84);
    c.fillStyle = "#9fc3f2";
    c.font = `7px ${FONT_MONO}`;
    c.fillText((item.artist ?? "").slice(0, 30), 6, 92);
  }
  c.fillStyle = "rgba(0,0,0,.18)";
  for (let y = 0; y < h; y += 2) c.fillRect(0, y, w, 1);
  tv.userData.tex.needsUpdate = true;
}
