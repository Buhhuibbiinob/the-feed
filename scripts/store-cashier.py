#!/usr/bin/env python3
"""Turns a licensed stock photo into the record store's cashier.

    python3 scripts/store-cashier.py path/to/photo.jpg

Writes public/store/cashier.png: the person cut out of a plain white
studio background, cropped from the head to the waist (the counter hides
the rest), at the size the 3D scene draws her. The store picks the file
up automatically; without it, the painted stand-in is used.

Only run this on a photo the site holds a licence for. A stock site's
watermarked preview ("comp") is licensed for mock-ups, not for a live
page, so it must not be committed here.

The defaults are tuned for the standing, arms-crossed studio portrait
chosen for the cashier. For another photo, pass the crop as fractions of
the image (--crop left top right bottom) and say where the mouth lands in
the cropped result (--mouth x y), then set MOUTH in
src/components/store/engine/worlds.ts to match.

Needs Pillow: pip install pillow
"""
import argparse
import sys
from collections import deque

from PIL import Image, ImageFilter

OUT = "public/store/cashier.png"
WIDTH = 256  # Twice the 128px canvas the scene draws into, for a clean downscale.


def cut_out(im: Image.Image, tolerance: int) -> Image.Image:
    """Clears the white background by flood fill from the edges.

    A fill from the edges rather than "every white pixel": a white shirt
    collar or the whites of somebody's eyes are not background.
    """
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))

    def is_bg(r, g, b):
        return r >= 255 - tolerance and g >= 255 - tolerance and b >= 255 - tolerance

    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x]:
            continue
        seen[y * w + x] = 1
        r, g, b, _ = px[x, y]
        if not is_bg(r, g, b):
            continue
        px[x, y] = (r, g, b, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    # Soften the edge by a pixel so it does not shimmer when it moves.
    alpha = im.getchannel("A").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    im.putalpha(alpha)
    return im


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("photo")
    ap.add_argument("--crop", nargs=4, type=float, default=[0.25, 0.05, 0.75, 0.52],
                    metavar=("LEFT", "TOP", "RIGHT", "BOTTOM"))
    ap.add_argument("--tolerance", type=int, default=28, help="How far from pure white still counts as background.")
    ap.add_argument("--out", default=OUT)
    args = ap.parse_args()

    im = Image.open(args.photo)
    w, h = im.size
    l, t, r, b = args.crop
    im = im.crop((round(l * w), round(t * h), round(r * w), round(b * h)))
    im = cut_out(im, args.tolerance)
    scale = WIDTH / im.width
    im = im.resize((WIDTH, round(im.height * scale)), Image.LANCZOS)
    im.save(args.out, optimize=True)
    print(f"wrote {args.out} ({im.width}x{im.height})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
