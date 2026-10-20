#!/usr/bin/env python3
"""The record store's surface textures, generated rather than downloaded.

    python3 scripts/store-textures.py

Writes public/store/tex/*.png. Everything is drawn from noise here, so
there is nothing to license and the textures can be remade or retuned at
any time. They are sized the way a PS2 game would have them (128-256px,
tiling) and given the slightly over-sharpened, photo-sourced look those
games had: grain, grime and wear, not clean vector colour.

Needs numpy and Pillow.
"""
import os

import numpy as np
from PIL import Image, ImageFilter

OUT = "public/store/tex"
rng = np.random.default_rng(1977)


def value_noise(w, h, cells_x, cells_y, seed):
    """Tileable smooth noise: a random lattice, interpolated."""
    r = np.random.default_rng(seed)
    grid = r.random((cells_y, cells_x))
    ys = np.linspace(0, cells_y, h, endpoint=False)
    xs = np.linspace(0, cells_x, w, endpoint=False)
    y0 = np.floor(ys).astype(int)
    x0 = np.floor(xs).astype(int)
    fy = (ys - y0)[:, None]
    fx = (xs - x0)[None, :]
    fy = fy * fy * (3 - 2 * fy)
    fx = fx * fx * (3 - 2 * fx)
    y1 = (y0 + 1) % cells_y
    x1 = (x0 + 1) % cells_x
    a = grid[y0][:, x0]
    b = grid[y0][:, x1]
    c = grid[y1][:, x0]
    d = grid[y1][:, x1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(w, h, base_x, base_y, octaves, seed):
    out = np.zeros((h, w))
    amp = 1.0
    total = 0.0
    for o in range(octaves):
        out += amp * value_noise(w, h, base_x * 2**o, base_y * 2**o, seed + o)
        total += amp
        amp *= 0.5
    return out / total


def save(name, rgb, sharpen=True):
    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")
    if sharpen:
        img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
    img.save(os.path.join(OUT, f"{name}.png"), optimize=True)
    print("wrote", name, img.size)


def lerp(c1, c2, t):
    c1 = np.array(c1, float)
    c2 = np.array(c2, float)
    return c1 + (c2 - c1) * t[..., None]


def wood(name, light, dark, w=256, h=256, rings=9.0, seed=1, knots=2, stain=1.0):
    """Plank wood: long grain along x, growth rings, a knot or two, varnish wear."""
    y = np.linspace(0, 1, h, endpoint=False)[:, None]
    warp = fbm(w, h, 3, 6, 4, seed) - 0.5
    # Fine grain runs along the plank: fast across y, slow along x.
    fine = fbm(w, h, 2, 72, 3, seed + 10)
    ring = np.sin((y * rings + warp * 1.8) * 2 * np.pi) * 0.5 + 0.5
    ring = ring**3
    t = 0.5 * ring + 0.4 * fine**1.4 + 0.1 * fbm(w, h, 8, 8, 2, seed + 20)
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.random.default_rng(seed)
    for _ in range(knots):
        kx, ky = r.integers(0, w), r.integers(0, h)
        dx = np.minimum(np.abs(xx - kx), w - np.abs(xx - kx)) / 1.6
        dy = np.minimum(np.abs(yy - ky), h - np.abs(yy - ky))
        dist = np.sqrt(dx**2 + dy**2)
        t += np.exp(-dist / 6.0) * 0.6 + (np.sin(dist / 2.2) * 0.5 + 0.5) * np.exp(-dist / 16.0) * 0.25
    t = np.clip(t, 0, 1)
    rgb = lerp(light, dark, t * stain)
    # Plank seams every quarter, and a little scuffing.
    seam = (np.abs(((yy / h) * 4) % 1 - 0.0) < 0.012) | (np.abs(((yy / h) * 4) % 1 - 1.0) < 0.012)
    rgb[seam] *= 0.55
    rgb *= (0.92 + 0.08 * fbm(w, h, 16, 16, 2, seed + 30))[..., None]
    save(name, rgb)


def plaster(name, base, w=256, h=256, seed=5):
    """Painted wall: plaster bumps, water staining towards the bottom, grime."""
    n = fbm(w, h, 8, 8, 5, seed)
    stain = fbm(w, h, 2, 3, 3, seed + 1)
    y = np.linspace(0, 1, h)[:, None]
    shade = 0.82 + 0.22 * n - 0.18 * np.clip(stain - 0.55, 0, 1) - 0.08 * y
    rgb = np.array(base, float)[None, None, :] * shade[..., None]
    speck = rng.random((h, w)) < 0.004
    rgb[speck] *= 0.6
    save(name, rgb)


def wallpaper(name, a, b, w=128, h=128, seed=6):
    """Striped wallpaper with a small damask dot, faded and a bit dirty."""
    xx, yy = np.mgrid[0:h, 0:w][1], np.mgrid[0:h, 0:w][0]
    stripe = ((xx // 16) % 2).astype(float)
    rgb = lerp(a, b, stripe)
    dots = ((xx % 16 - 8) ** 2 + (yy % 16 - 8) ** 2) < 4
    rgb[dots] = rgb[dots] * 0.8 + np.array([220, 210, 190]) * 0.2
    rgb *= (0.86 + 0.18 * fbm(w, h, 6, 6, 4, seed))[..., None]
    save(name, rgb)


def checker_floor(name, light, dark, w=256, h=256, tiles=4, seed=7):
    """Lino tiles: checker, grout, scuffs and the shine worn off in places."""
    yy, xx = np.mgrid[0:h, 0:w]
    s = w // tiles
    check = ((xx // s + yy // s) % 2).astype(float)
    rgb = lerp(light, dark, check)
    grout = ((xx % s) < 2) | ((yy % s) < 2)
    rgb[grout] = rgb[grout] * 0.5
    wear = fbm(w, h, 6, 6, 4, seed)
    rgb *= (0.82 + 0.26 * wear)[..., None]
    scuff = fbm(w, h, 40, 6, 2, seed + 3) > 0.8
    rgb[scuff] *= 0.88
    save(name, rgb)


def carpet(name, base, w=128, h=128, seed=8):
    n = fbm(w, h, 32, 32, 3, seed)
    fleck = rng.random((h, w))
    rgb = np.array(base, float)[None, None, :] * (0.75 + 0.35 * n)[..., None]
    rgb[fleck > 0.985] *= 1.3
    rgb[fleck < 0.015] *= 0.65
    save(name, rgb, sharpen=False)


def cork(name, w=128, h=128, seed=9):
    n = fbm(w, h, 24, 24, 3, seed)
    grains = rng.random((h, w))
    rgb = lerp((196, 140, 78), (120, 78, 36), n)
    rgb[grains > 0.93] = rgb[grains > 0.93] * 0.7
    rgb[grains < 0.04] = rgb[grains < 0.04] * 1.18
    save(name, rgb)


def metal(name, base, w=128, h=128, seed=10):
    """Brushed metal: streaks along x."""
    n = fbm(w, h, 2, 64, 3, seed)
    rgb = np.array(base, float)[None, None, :] * (0.8 + 0.3 * n)[..., None]
    save(name, rgb)


def fabric(name, a, b, w=128, h=128, seed=11):
    """A woven bedspread: a check of two colours with a twill texture."""
    yy, xx = np.mgrid[0:h, 0:w]
    check = (((xx // 32) + (yy // 32)) % 2).astype(float) * 0.6 + ((yy // 8) % 2) * 0.15
    weave = (((xx + yy) % 4) < 2).astype(float) * 0.08
    rgb = lerp(a, b, np.clip(check, 0, 1))
    rgb *= (0.9 + weave + 0.1 * fbm(w, h, 8, 8, 3, seed))[..., None]
    save(name, rgb, sharpen=False)


def main():
    os.makedirs(OUT, exist_ok=True)
    wood("oak", (214, 160, 88), (128, 78, 30), rings=7, seed=1, knots=2)
    wood("walnut", (112, 70, 38), (48, 26, 12), rings=11, seed=2, knots=1)
    wood("pine", (230, 190, 122), (170, 112, 52), rings=6, seed=3, knots=3, stain=0.8)
    wood("mdf_black", (52, 40, 34), (22, 16, 14), rings=14, seed=4, knots=0, stain=0.6)
    plaster("wall_store", (128, 58, 38))
    plaster("wall_trim", (64, 38, 22), seed=12)
    wallpaper("wall_room", (46, 58, 108), (54, 68, 124))
    checker_floor("floor_store", (196, 178, 132), (34, 28, 24))
    carpet("carpet_room", (82, 62, 92))
    cork("cork")
    metal("metal", (176, 176, 184))
    fabric("bedspread", (178, 58, 40), (120, 34, 26))


if __name__ == "__main__":
    main()
