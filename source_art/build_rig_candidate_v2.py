"""Build a modern review surrogate by baking legacy bind rotations per cube."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "resource_pack" / "models" / "entity" / "kittie_army_cat.geo.json"
OUTPUT = ROOT / ".forge" / "iterations" / "009-cube-baked-rig-surrogate" / "candidate" / "kittie_army_cat.geo.json"


def main() -> None:
    document = json.loads(SOURCE.read_text(encoding="utf-8"))
    converted: list[str] = []
    for bone in document["minecraft:geometry"][0]["bones"]:
        bind_rotation = bone.pop("bind_pose_rotation", None)
        if bind_rotation is None:
            continue
        for cube in bone.get("cubes", []):
            cube["pivot"] = bone["pivot"]
            cube["rotation"] = bind_rotation
        converted.append(bone["name"])
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    print(f"Surrogate written to {OUTPUT}; cube-baked bind rotations on: {', '.join(converted)}")


if __name__ == "__main__":
    main()
