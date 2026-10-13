"""Generates the PLACEHOLDER app icons in public/icons (see docs/assets.md).

A Rift crystal with a gold halo on foreground ink, using art-style.md palette values.
Run with: python3 scripts/generate-icons.py   (requires Pillow)
"""
from pathlib import Path

from PIL import Image, ImageDraw

INK = (8, 9, 15)
RIFT_VIOLET = (158, 140, 203)
LIT = (226, 218, 240)
SHADE = (88, 74, 140)
GOLD = (245, 197, 66)
OUT = Path(__file__).resolve().parent.parent / "public" / "icons"


def draw_icon(size: int, content_scale: float) -> Image.Image:
    ss = 4  # supersample for smooth edges
    s = size * ss
    image = Image.new("RGB", (s, s), INK)
    d = ImageDraw.Draw(image)
    c = s / 2
    k = s * content_scale / 2

    # Halo ring behind the crystal.
    ring_w, ring_h = k * 0.95, k * 0.26
    d.ellipse((c - ring_w, c + k * 0.05 - ring_h, c + ring_w, c + k * 0.05 + ring_h), outline=GOLD, width=int(s * 0.022))

    top, bottom = (c, c - k * 0.95), (c, c + k * 0.95)
    left, right = (c - k * 0.36, c - k * 0.1), (c + k * 0.36, c - k * 0.1)
    d.polygon([top, left, bottom], fill=LIT)  # lit left facet (light from upper left)
    d.polygon([top, right, bottom], fill=SHADE)  # violet shadow facet
    d.polygon([top, (c + k * 0.12, c - k * 0.1), bottom], fill=RIFT_VIOLET)

    # Front half of the ring passes over the crystal.
    d.arc((c - ring_w, c + k * 0.05 - ring_h, c + ring_w, c + k * 0.05 + ring_h), 0, 180, fill=GOLD, width=int(s * 0.022))
    return image.resize((size, size), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
draw_icon(192, 0.78).save(OUT / "icon-192.png", optimize=True)
draw_icon(512, 0.78).save(OUT / "icon-512.png", optimize=True)
# Maskable icons must keep content inside the central 80% safe zone.
draw_icon(512, 0.6).save(OUT / "icon-maskable-512.png", optimize=True)
print("icons written to", OUT)
