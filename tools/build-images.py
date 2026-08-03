#!/usr/bin/env python3
"""
Doug Francisco — responsive image pipeline.

Takes the raw photography library and produces:
  • WebP at 5 responsive widths (primary format)
  • JPEG fallback at the same widths (Safari <14 / email / social)
  • A 24px LQIP data-URI per image for instant blur-up placeholders
  • assets/img/manifest.json consumed by nothing at runtime — it exists so
    a human (or a future CMS) can see dimensions, credits and aspect ratios.

Run:  python3 tools/build-images.py
Deps: pillow
"""

import base64
import io
import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------

SRC = Path(os.environ.get("DF_SRC", "/sessions/lucid-friendly-edison/mnt/good pics"))
OUT = Path(__file__).resolve().parent.parent / "assets" / "img"

WIDTHS = [480, 768, 1200, 1800, 2400]
WEBP_QUALITY = 76
JPEG_QUALITY = 78
LQIP_WIDTH = 24

# Semantic naming. Filenames from a camera roll are useless to everyone —
# these slugs are what appear in the HTML, so they double as documentation.
# (slug, source filename, alt text, credit, tags)
LIBRARY = [
    ("red-rebel-crowd", "1e-Funeral for Nature-Guy Reece-DSC_5831 ed fx crop.jpg",
     "The Red Rebel Brigade moving in silent procession through a crowded street, dozens of performers robed head to toe in red",
     "Guy Reece", ["red-rebel", "hero", "activism"]),

    ("red-rebel-archway", "IMG_3178.jpeg",
     "A single Red Rebel performer standing in a stone archway, arms raised, red fabric falling in long lines",
     "", ["red-rebel", "portrait"]),

    ("red-rebel-flare", "ddugflarae.jpg",
     "A figure silhouetted against burning red flares, arms outstretched in red smoke",
     "", ["red-rebel", "activism", "atmosphere"]),

    ("doug-directing-red-rebels", "IMG_5985.jpeg",
     "Doug Francisco in plain clothes directing the Red Rebel Brigade, briefing a group of performers in red before a procession",
     "", ["proof", "direction", "red-rebel"]),

    ("invisible-circus-ringmaster", "Andre Pattenden doug.JPG",
     "Doug Francisco in top hat and red tailcoat performing as ringmaster against a wall of projected light",
     "Andre Pattenden", ["invisible-circus", "hero", "performance"]),

    ("immersive-installation", "Copy of Credit Andre Pattenden(2).jpg",
     "A vast built environment of salvaged colour and sculpture with an aerial performer suspended above the crowd",
     "Andre Pattenden", ["immersive", "hero", "installation"]),

    ("immersive-aerial", "_DSC4894.jpg",
     "An aerial performer suspended high above a floor washed in saturated pink and blue light",
     "", ["immersive", "spectacle", "performance"]),

    ("boomtown-puppet-stall", "boomred (488 of 571).jpg",
     "Doug Francisco standing behind an elaborate hand-built puppet stall crowded with painted characters",
     "", ["immersive", "character-design", "festival"]),

    ("performance-green", "_DSC4804.jpg",
     "A performer caught mid-cry under harsh green stage light, costume and hair thrown back",
     "", ["performance", "atmosphere"]),

    ("doug-singing", "joe-clarke_IMG_1810_original.jpg",
     "Doug Francisco singing into a microphone under a hard spotlight, photographed in black and white",
     "Joe Clarke", ["performance", "music"]),

    ("doug-portrait-bw", "Dougie_francis_BnW_04.jpg",
     "Black and white portrait of Doug Francisco in a flat cap, half in shadow",
     "", ["portrait", "about"]),

    ("doug-portrait-close", "IMG_6278.jpeg",
     "Close black and white portrait of Doug Francisco looking directly into the camera",
     "", ["portrait", "about"]),

    ("doug-portrait-smiling", "DCFEE78C-2D8C-4A65-8309-7E5BAA9C7CDA.jpg",
     "Black and white portrait of Doug Francisco in a flat cap, smiling",
     "", ["portrait", "about"]),

    ("doug-character-night", "3384B9A3-35CB-4091-84B1-A55E23481151.jpg",
     "Doug Francisco in stage makeup outdoors at night, lit blue beneath a full moon",
     "", ["character-design", "performance"]),

    ("doug-mask", "doug.carnyville2010.jpg",
     "Doug Francisco in a top hat holding a pale theatrical mask beside his own face",
     "", ["character-design", "performance"]),

    ("doug-ringmaster-cane", "doug.sm.jpg",
     "Doug Francisco in ringmaster costume and clown makeup holding a cane against a red curtain",
     "", ["performance", "character-design"]),

    ("doug-puppeteer", "1210200821.jpg",
     "Doug Francisco operating marionettes at a painted puppet booth",
     "", ["performance", "character-design"]),

    ("ringmaster-london", "ringmaster london.jpg",
     "A performer in a yellow and red costume playing an improvised instrument against an industrial backdrop",
     "", ["performance", "character-design"]),

    ("panto-stage", "091220_HMA_Panto_0056.jpg",
     "A performer in an ornate gold and cream costume mid-gesture on a lit stage",
     "", ["performance", "cabaret"]),

    ("cabaret-feathers", "20101119-_DSC5677-Edited.jpg",
     "A cabaret performer in a dark feathered headdress and corset under low stage light",
     "", ["cabaret", "performance"]),

    ("cabaret-flowers", "DDA3C9A7-5C88-424E-8BF3-526627E8FA12.JPEG",
     "A cabaret performer wearing a headdress of red flowers, photographed against black",
     "", ["cabaret", "performance"]),

    ("cabaret-chair", "SSOC25-Web-41.jpeg",
     "A cabaret performer on a chair mid-routine, one leg kicked high under warm stage light",
     "", ["cabaret", "performance"]),

    ("stage-set-purple", "IMG_6177.jpeg",
     "A built stage set washed in purple and pink light with a performer at a microphone",
     "", ["production-design", "performance"]),

    ("performer-red-boots", "IMG_8392.jpeg",
     "A performer in a red jacket and tall red boots standing against weathered timber boarding",
     "", ["character-design", "performance"]),

    ("woodland-portrait", "IMG_6174.jpeg",
     "A performer in a long blue gown framed by a heart shape woven from woodland branches",
     "", ["installation", "performance"]),

    ("venue-red-drapes", "IMG_9928.JPG",
     "Performers on a dark stage framed by heavy red drapes",
     "", ["performance", "atmosphere"]),

    ("artwork-circus", "FECF4745-1F19-478F-A9A2-B63A32A398B6.jpg",
     "An illustrated poster in stained-glass style showing a clown figure surrounded by circus characters",
     "", ["visual-art", "illustration"]),

    ("musician-guitar", "149269_1651920068753_1559558516_1573938_5199063_n.jpg",
     "A black and white photograph of a seated musician with an acoustic guitar",
     "", ["music", "archive"]),
]


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def lqip(im: Image.Image) -> str:
    """Tiny blurred base64 JPEG used as a CSS background while the real image loads."""
    small = im.copy()
    small.thumbnail((LQIP_WIDTH, LQIP_WIDTH * 4), Image.Resampling.LANCZOS)
    small = small.filter(ImageFilter.GaussianBlur(radius=1))
    buf = io.BytesIO()
    small.convert("RGB").save(buf, "JPEG", quality=35, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def process(slug, filename, alt, credit, tags):
    path = SRC / filename
    if not path.exists():
        print(f"  !! missing source: {filename}", file=sys.stderr)
        return None

    im = Image.open(path)
    im = ImageOps.exif_transpose(im)          # honour camera rotation
    im = im.convert("RGB")
    ow, oh = im.size

    widths = [w for w in WIDTHS if w <= ow] or [ow]
    if ow not in widths and ow < max(WIDTHS):
        widths.append(ow)                     # never upscale, but keep the native size

    written = []
    for w in sorted(set(widths)):
        h = round(oh * w / ow)
        resized = im.resize((w, h), Image.Resampling.LANCZOS)
        resized.save(OUT / f"{slug}-{w}.webp", "WEBP",
                     quality=WEBP_QUALITY, method=6)
        resized.save(OUT / f"{slug}-{w}.jpg", "JPEG",
                     quality=JPEG_QUALITY, optimize=True, progressive=True)
        written.append(w)

    return {
        "slug": slug,
        "source": filename,
        "alt": alt,
        "credit": credit,
        "tags": tags,
        "width": ow,
        "height": oh,
        "aspect": round(ow / oh, 4),
        "widths": written,
        "lqip": lqip(im),
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    total_before = total_after = 0

    for entry in LIBRARY:
        print(f"→ {entry[0]}")
        src_size = (SRC / entry[1]).stat().st_size if (SRC / entry[1]).exists() else 0
        rec = process(*entry)
        if rec:
            manifest[rec["slug"]] = rec
            total_before += src_size
            total_after += sum(
                (OUT / f"{rec['slug']}-{w}.webp").stat().st_size for w in rec["widths"]
            )

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))

    print(f"\n{len(manifest)} images processed")
    print(f"source:  {total_before/1024/1024:.1f} MB")
    print(f"webp:    {total_after/1024/1024:.1f} MB (all sizes combined)")
    print(f"manifest: {OUT/'manifest.json'}")


if __name__ == "__main__":
    main()
