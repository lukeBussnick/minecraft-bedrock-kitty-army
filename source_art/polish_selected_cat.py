"""Create the immutable final polish candidate from the selected Forge sweep."""

from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".forge" / "iterations" / "014-pack-art-proportion-sweep" / "candidates" / "c03-hero"
OUTPUT = ROOT / ".forge" / "iterations" / "015-pack-art-final-polish"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def main() -> None:
    if OUTPUT.exists():
        raise FileExistsError(f"Immutable iteration already exists: {OUTPUT}")
    candidate = OUTPUT / "candidate"
    candidate.mkdir(parents=True)
    geometry = candidate / "kittie_army_cat.geo.json"
    texture = candidate / "kittie_army_cat.png"
    shutil.copy2(SOURCE / geometry.name, geometry)

    image = Image.open(SOURCE / texture.name).convert("RGBA")
    px = image.load()
    salmon = (239, 107, 112, 255)
    pale_pad = (255, 145, 164, 255)
    # Sole UVs: back legs at [8,13], front legs at [40,0].
    for y in range(13, 15):
        for x in range(12, 14):
            px[x, y] = salmon if (x + y) % 2 else pale_pad
    for y in range(0, 2):
        for x in range(44, 46):
            px[x, y] = salmon if (x + y) % 2 else pale_pad
    image.save(texture)

    shutil.copy2(ROOT / "source_art" / "references" / "kittie_army_cat_reference_sheet_imagegen.png", OUTPUT / "kittie_army_cat_reference_sheet_imagegen.png")
    report = {
        "selectedFrom": "014-pack-art-proportion-sweep/candidates/c03-hero",
        "geometryChange": "none from selected candidate",
        "texturePolish": "added bounded warm-pink paw-pad pixels to front and back leg sole UV islands",
        "geometrySha256": sha256(geometry),
        "textureSha256": sha256(texture),
    }
    (OUTPUT / "selection.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
