"""Build immutable, offline Kittie Army proportion and face-texture candidates."""

from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ITERATION = ROOT / ".forge" / "iterations" / "014-pack-art-proportion-sweep"
SOURCE_GEO = ROOT / "resource_pack" / "models" / "entity" / "kittie_army_cat.geo.json"
SOURCE_TEX = ROOT / "resource_pack" / "textures" / "entity" / "kittie_army_cat.png"
REFERENCE = ROOT / "source_art" / "references" / "kittie_army_cat_reference_sheet_imagegen.png"
PACK_ART = ROOT / "source_art" / "kittie_army_pack_art_imagegen.png"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def bone(document: dict, name: str) -> dict:
    return next(item for item in document["minecraft:geometry"][0]["bones"] if item["name"] == name)


def paint_face(source: Path, output: Path, eye_style: str) -> None:
    image = Image.open(source).convert("RGBA")
    px = image.load()
    charcoal = (24, 20, 31, 255)
    plum = (48, 35, 52, 255)
    cream = (247, 226, 194, 255)
    cream_shadow = (220, 190, 163, 255)
    magenta = (232, 30, 139, 255)
    pink = (255, 126, 180, 255)
    highlight = (255, 238, 249, 255)
    salmon = (239, 107, 112, 255)
    mouth = (137, 35, 47, 255)

    # Harmonize the entire owned vanilla tuxedo atlas before focal pixel work.
    palette = {
        (25, 23, 42, 255): charcoal,
        (43, 39, 61, 255): plum,
        (247, 239, 230, 255): cream,
        (220, 210, 211, 255): cream_shadow,
        (255, 78, 181, 255): magenta,
        (255, 126, 177, 255): salmon,
    }
    for y in range(image.height):
        for x in range(image.width):
            px[x, y] = palette.get(px[x, y], px[x, y])

    # Head north/front face: x=5..9, y=5..8 for the 5x4x5 box UV.
    for y in range(5, 9):
        for x in range(5, 10):
            px[x, y] = charcoal
    for y in range(5, 9):
        px[7, y] = cream

    if eye_style == "wide":
        for x in (5, 6, 8, 9):
            px[x, 6] = magenta
            px[x, 7] = pink
        px[6, 6] = highlight
        px[8, 6] = highlight
    else:
        px[6, 6] = magenta
        px[8, 6] = magenta
        px[6, 7] = highlight
        px[8, 7] = highlight

    # Warm lower cheeks and the separate 3x2 muzzle/nose face.
    px[5, 8] = cream_shadow
    px[6, 8] = cream
    px[8, 8] = cream
    px[9, 8] = cream_shadow
    for y in range(26, 28):
        for x in range(2, 5):
            px[x, y] = cream
    px[3, 26] = salmon
    px[3, 27] = mouth

    # Ear front pixels for the two 1x1x2 box-UV islands.
    px[2, 12] = salmon
    px[8, 12] = salmon

    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output)


def build_candidate(slug: str, head_inflate: float, muzzle_inflate: float, ear_inflate: float, eye_style: str) -> dict:
    candidate_dir = ITERATION / "candidates" / slug
    candidate_dir.mkdir(parents=True, exist_ok=False)
    document = json.loads(SOURCE_GEO.read_text(encoding="utf-8"))
    head = bone(document, "head")
    head_cube, muzzle, ear_l, ear_r = head["cubes"]
    head_cube["inflate"] = head_inflate
    muzzle["origin"] = [-1.5, 6.75, -13.25]
    muzzle["inflate"] = muzzle_inflate
    ear_l["origin"] = [-2.25, 11.75, -9.0]
    ear_l["inflate"] = ear_inflate
    ear_r["origin"] = [1.25, 11.75, -9.0]
    ear_r["inflate"] = ear_inflate

    geometry = candidate_dir / "kittie_army_cat.geo.json"
    texture = candidate_dir / "kittie_army_cat.png"
    geometry.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    paint_face(SOURCE_TEX, texture, eye_style)
    metadata = {
        "slug": slug,
        "scope": "head, muzzle, ears, and coordinated 64x32 texture only",
        "headInflate": head_inflate,
        "muzzleInflate": muzzle_inflate,
        "earInflate": ear_inflate,
        "eyeStyle": eye_style,
        "geometrySha256": sha256(geometry),
        "textureSha256": sha256(texture),
    }
    (candidate_dir / "candidate.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    return metadata


def main() -> None:
    if ITERATION.exists():
        raise FileExistsError(f"Immutable iteration already exists: {ITERATION}")
    control = ITERATION / "control"
    control.mkdir(parents=True)
    shutil.copy2(SOURCE_GEO, control / SOURCE_GEO.name)
    shutil.copy2(SOURCE_TEX, control / SOURCE_TEX.name)
    shutil.copy2(REFERENCE, ITERATION / REFERENCE.name)
    contract = {
        "approved": True,
        "subject": "Kittie Army pack-art tuxedo cat",
        "referenceInputs": [str(PACK_ART.relative_to(ROOT)), str(REFERENCE.relative_to(ROOT))],
        "immutableControl": {
            "geometry": str(SOURCE_GEO.relative_to(ROOT)),
            "geometrySha256": sha256(SOURCE_GEO),
            "texture": str(SOURCE_TEX.relative_to(ROOT)),
            "textureSha256": sha256(SOURCE_TEX),
            "runtimeStatus": "user accepted v1.4 in Minecraft Bedrock",
        },
        "frozen": ["behavior", "animation wiring and animation files", "recipe", "whistle", "entity identifiers"],
        "target": {
            "proportions": "larger square head relative to the existing body; broad muzzle and readable ears",
            "texture": "deep charcoal/plum tuxedo fur, warm cream blaze/muzzle/chest/paws, large luminous pink eyes, salmon inner ears and nose",
            "constraints": ["cube-based Bedrock geometry", "preserve existing bone names and hierarchy", "preserve 64x32 atlas", "no collar or accessories"],
        },
    }
    (ITERATION / "design-contract.json").write_text(json.dumps(contract, indent=2) + "\n", encoding="utf-8")
    candidates = [
        build_candidate("c01-gentle", 0.5, 0.10, 0.20, "compact"),
        build_candidate("c02-balanced", 0.85, 0.25, 0.40, "wide"),
        build_candidate("c03-hero", 1.15, 0.40, 0.60, "wide"),
    ]
    (ITERATION / "iteration-manifest.json").write_text(json.dumps({"candidates": candidates}, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote immutable control and {len(candidates)} candidates to {ITERATION}")


if __name__ == "__main__":
    main()
