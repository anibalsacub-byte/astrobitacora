"""Genera los iconos PNG de la PWA (sol dorado en círculo azul noche). Uso: python make_icons.py <carpeta_salida>"""
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

NAVY, GOLD, CREAM = (19, 32, 59, 255), (216, 195, 143, 255), (243, 234, 215, 255)


def icon(size: int, maskable: bool) -> Image.Image:
    s = 4  # sobremuestreo para bordes suaves
    W = size * s
    img = Image.new("RGBA", (W, W), NAVY if maskable else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = W / 2
    # En los iconos «maskable» el dibujo debe caber en el 80 % central.
    R = W * (0.40 if maskable else 0.48)
    if not maskable:
        d.ellipse([c - R, c - R, c + R, c + R], fill=NAVY)
    lw = max(2, int(W * 0.012))
    r_ring = R * 0.78
    d.ellipse([c - r_ring, c - r_ring, c + r_ring, c + r_ring], outline=GOLD, width=lw)
    r_sun = R * 0.30
    for i in range(16):
        a = i * math.pi / 8
        r2 = R * (0.62 if i % 2 else 0.70)
        d.line([c + math.cos(a) * r_sun * 1.25, c + math.sin(a) * r_sun * 1.25, c + math.cos(a) * r2, c + math.sin(a) * r2],
               fill=GOLD, width=lw)
    d.ellipse([c - r_sun, c - r_sun, c + r_sun, c + r_sun], fill=GOLD)
    # Luna creciente en la esquina superior derecha del anillo
    mx, my, mr = c + R * 0.52, c - R * 0.52, R * 0.17
    d.ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=CREAM)
    d.ellipse([mx - mr + mr * 0.5, my - mr - mr * 0.1, mx + mr + mr * 0.5, my + mr - mr * 0.1], fill=NAVY)
    return img.resize((size, size), Image.LANCZOS)


out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
icon(192, False).save(out / "icon-192.png")
icon(512, False).save(out / "icon-512.png")
icon(512, True).save(out / "icon-maskable-512.png")
icon(180, True).save(out / "apple-touch-icon.png")
print("ok")
