#!/usr/bin/env python3
"""Régénère les icônes de la PWA (static/app/icons/) — toque de chef blanche
sur le rose du site. Dépendance : Pillow (pip install Pillow)."""

import os

from PIL import Image, ImageDraw

ROSE = (239, 24, 100, 255)
WHITE = (255, 255, 255, 255)
OUT = os.path.join(os.path.dirname(__file__), "..", "static", "app", "icons")


def toque(draw, cx, cy, s):
    """Toque de chef stylisée centrée sur (cx, cy), échelle s (1 = icône 512)."""
    # bombé : trois cercles
    draw.ellipse([cx - 105 * s, cy - 170 * s, cx - 15 * s, cy - 80 * s], fill=WHITE)
    draw.ellipse([cx + 15 * s, cy - 170 * s, cx + 105 * s, cy - 80 * s], fill=WHITE)
    draw.ellipse([cx - 60 * s, cy - 195 * s, cx + 60 * s, cy - 75 * s], fill=WHITE)
    # corps
    draw.rectangle([cx - 105 * s, cy - 125 * s, cx + 105 * s, cy + 60 * s], fill=WHITE)
    # bande basse séparée par un liseré rose
    draw.rectangle([cx - 105 * s, cy + 60 * s, cx + 105 * s, cy + 75 * s], fill=ROSE)
    draw.rounded_rectangle(
        [cx - 105 * s, cy + 75 * s, cx + 105 * s, cy + 140 * s], radius=18 * s, fill=WHITE
    )


def make_icon(size, maskable=False, rounded=True):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded and not maskable:
        d.rounded_rectangle([0, 0, size, size], radius=size * 0.18, fill=ROSE)
    else:
        d.rectangle([0, 0, size, size], fill=ROSE)
    # la maskable garde son contenu dans le cercle central (zone sûre)
    s = (size / 512) * (0.72 if maskable else 1.0)
    toque(d, size / 2, size / 2 + 20 * s, s)
    return img


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    make_icon(192).save(f"{OUT}/icon-192.png")
    make_icon(512).save(f"{OUT}/icon-512.png")
    make_icon(512, maskable=True).save(f"{OUT}/icon-maskable-512.png")
    # iOS masque lui-même : fond plein, ni coins arrondis ni transparence
    make_icon(180, rounded=False).convert("RGB").save(f"{OUT}/apple-touch-icon.png")
    print("Icônes régénérées dans", os.path.normpath(OUT))
