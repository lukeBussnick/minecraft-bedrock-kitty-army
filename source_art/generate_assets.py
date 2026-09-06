"""Deterministically generate Kittie Army bitmap and audio assets."""

from __future__ import annotations

import math
import os
import json
import struct
import wave
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
RP = ROOT / "resource_pack"
LOCAL_LAYOUT = ROOT / "source_art" / "tuxedo_layout_source.png"
VANILLA = Path(os.environ.get("KITTIE_VANILLA_TUXEDO", str(LOCAL_LAYOUT)))
PACK_ART = ROOT / "source_art" / "kittie_army_pack_art_imagegen.png"
WHISTLE_ART = ROOT / "source_art" / "kittie_whistle_imagegen_native_attempt.png"
CAT_GEOMETRY = ROOT / "source_art" / "cat_geometry_source.geo.json"


def ensure_dirs() -> None:
    for path in (
        RP / "textures" / "items",
        RP / "textures" / "entity",
        RP / "textures" / "particle",
        RP / "sounds" / "kittie",
        RP / "models" / "entity",
    ):
        path.mkdir(parents=True, exist_ok=True)


def make_whistle() -> None:
    source = Image.open(WHISTLE_ART).convert("RGB")
    width, height = source.size
    pixels = source.load()
    background = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def is_background(x: int, y: int) -> bool:
        r, g, b = pixels[x, y]
        return min(r, g, b) >= 220 and max(r, g, b) - min(r, g, b) <= 14

    for x in range(width):
        queue.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        queue.extend(((0, y), (width - 1, y)))
    while queue:
        x, y = queue.popleft()
        index = y * width + x
        if background[index] or not is_background(x, y):
            continue
        background[index] = 1
        if x > 0: queue.append((x - 1, y))
        if x + 1 < width: queue.append((x + 1, y))
        if y > 0: queue.append((x, y - 1))
        if y + 1 < height: queue.append((x, y + 1))

    image = source.convert("RGBA")
    rgba = image.load()
    for y in range(height):
        for x in range(width):
            if background[y * width + x]:
                rgba[x, y] = (0, 0, 0, 0)
    clean_alpha = image.getchannel("A").filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(0.55))
    image.putalpha(clean_alpha)
    alpha_box = image.getchannel("A").getbbox()
    if not alpha_box:
        raise ValueError("ImageGen whistle extraction produced no foreground.")
    image = image.crop(alpha_box)
    side = max(image.size)
    padding = max(1, round(side * 0.12))
    square = Image.new("RGBA", (side + padding * 2, side + padding * 2), (0, 0, 0, 0))
    square.alpha_composite(image, ((square.width - image.width) // 2, (square.height - image.height) // 2))
    final = square.resize((32, 32), Image.Resampling.LANCZOS)
    hard_alpha = final.getchannel("A").point(lambda value: 255 if value >= 160 else 0)
    final.putalpha(hard_alpha)
    final.save(RP / "textures" / "items" / "kittie_whistle.png")


def make_cat_texture() -> None:
    if not VANILLA.exists():
        raise FileNotFoundError(f"Vanilla tuxedo layout reference not found: {VANILLA}")
    image = Image.open(VANILLA).convert("RGBA")
    pixels = image.load()
    charcoal = (24, 20, 31, 255)
    plum = (48, 35, 52, 255)
    cream = (247, 226, 194, 255)
    cream_shadow = (220, 190, 163, 255)
    magenta = (232, 30, 139, 255)
    pink = (255, 126, 180, 255)
    highlight = (255, 238, 249, 255)
    salmon = (239, 107, 112, 255)
    pale_pad = (255, 145, 164, 255)
    mouth = (137, 35, 47, 255)
    replacements = {
        (90, 157, 18, 255): magenta,
        (190, 115, 115, 255): salmon,
        (28, 24, 39, 255): charcoal,
        (36, 36, 49, 255): plum,
        (234, 234, 234, 255): cream,
        (206, 206, 206, 255): cream_shadow,
    }
    for y in range(image.height):
        for x in range(image.width):
            value = pixels[x, y]
            if value in replacements:
                pixels[x, y] = replacements[value]

    # Pack-art face on the head's 5x4 north UV face.
    for y in range(5, 9):
        for x in range(5, 10):
            pixels[x, y] = charcoal
        pixels[7, y] = cream
    for x in (5, 6, 8, 9):
        pixels[x, 6] = magenta
        pixels[x, 7] = pink
    pixels[6, 6] = highlight
    pixels[8, 6] = highlight
    pixels[5, 8] = cream_shadow
    pixels[6, 8] = cream
    pixels[8, 8] = cream
    pixels[9, 8] = cream_shadow

    # Broad muzzle, pink nose, mouth, inner ears, and paw pads.
    for y in range(26, 28):
        for x in range(2, 5):
            pixels[x, y] = cream
    pixels[3, 26] = salmon
    pixels[3, 27] = mouth
    pixels[2, 12] = salmon
    pixels[8, 12] = salmon
    for y in range(13, 15):
        for x in range(12, 14):
            pixels[x, y] = salmon if (x + y) % 2 else pale_pad
    for y in range(0, 2):
        for x in range(44, 46):
            pixels[x, y] = salmon if (x + y) % 2 else pale_pad
    image.save(RP / "textures" / "entity" / "kittie_army_cat.png")


def make_sparkle() -> None:
    image = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    d.polygon([(8, 0), (10, 6), (16, 8), (10, 10), (8, 16), (6, 10), (0, 8), (6, 6)], fill=(255, 255, 255, 245))
    d.rectangle((7, 4, 8, 11), fill=(255, 139, 207, 255))
    d.rectangle((4, 7, 11, 8), fill=(255, 139, 207, 255))
    image.save(RP / "textures" / "particle" / "kittie_sparkle.png")


def cat_face(canvas: Image.Image, x: int, y: int, scale: int = 1) -> None:
    d = ImageDraw.Draw(canvas)
    black = (31, 27, 44, 255)
    dark = (54, 46, 70, 255)
    cream = (247, 239, 230, 255)
    pink = (255, 82, 183, 255)
    d.polygon([(x, y + 6 * scale), (x + 3 * scale, y), (x + 7 * scale, y + 4 * scale)], fill=black)
    d.polygon([(x + 9 * scale, y + 4 * scale), (x + 13 * scale, y), (x + 16 * scale, y + 6 * scale)], fill=black)
    d.rectangle((x + 1 * scale, y + 4 * scale, x + 15 * scale, y + 16 * scale), fill=black)
    d.rectangle((x + 3 * scale, y + 5 * scale, x + 13 * scale, y + 14 * scale), fill=dark)
    d.polygon([(x + 7 * scale, y + 5 * scale), (x + 10 * scale, y + 5 * scale), (x + 12 * scale, y + 14 * scale), (x + 5 * scale, y + 14 * scale)], fill=cream)
    d.rectangle((x + 4 * scale, y + 8 * scale, x + 5 * scale, y + 9 * scale), fill=pink)
    d.rectangle((x + 11 * scale, y + 8 * scale, x + 12 * scale, y + 9 * scale), fill=pink)
    d.rectangle((x + 7 * scale, y + 11 * scale, x + 9 * scale, y + 12 * scale), fill=(255, 139, 188, 255))


def make_pack_icon() -> None:
    icon = ImageOps.fit(Image.open(PACK_ART).convert("RGBA"), (256, 256), method=Image.Resampling.LANCZOS)
    icon.save(RP / "pack_icon.png")
    icon.save(ROOT / "behavior_pack" / "pack_icon.png")


def make_sound() -> None:
    rate = 44100
    duration = 0.48
    count = int(rate * duration)
    samples: list[int] = []
    phase = 0.0
    for i in range(count):
        t = i / rate
        attack = min(1.0, t / 0.025)
        release = min(1.0, max(0.0, (duration - t) / 0.16))
        env = attack * release
        progress = t / duration
        freq = 1390 + 280 * math.sin(progress * math.pi) + 24 * math.sin(t * 35)
        phase += 2 * math.pi * freq / rate
        value = 0.62 * math.sin(phase) + 0.13 * math.sin(phase * 2.01)
        sample = max(-1.0, min(1.0, value * env * 0.68))
        samples.append(int(sample * 32767))

    output = RP / "sounds" / "kittie" / "whistle_tone.wav"
    with wave.open(str(output), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(b"".join(struct.pack("<h", sample) for sample in samples))


def make_cat_geometry() -> None:
    legacy = json.loads(CAT_GEOMETRY.read_text(encoding="utf-8"))
    source = legacy["geometry.cat"]
    bones = source["bones"]
    for bone in bones:
        bind_rotation = bone.pop("bind_pose_rotation", None)
        if bind_rotation is None:
            continue
        for cube in bone.get("cubes", []):
            cube["pivot"] = bone["pivot"]
            cube["rotation"] = bind_rotation

    geometry = {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": "geometry.kittie_army.cat",
                "texture_width": source["texturewidth"],
                "texture_height": source["textureheight"],
                "visible_bounds_width": source["visible_bounds_width"],
                "visible_bounds_height": source["visible_bounds_height"],
                "visible_bounds_offset": source["visible_bounds_offset"],
            },
            "bones": bones,
        }],
    }
    output = RP / "models" / "entity" / "kittie_army_cat.geo.json"
    output.write_text(json.dumps(geometry, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    ensure_dirs()
    make_whistle()
    make_cat_texture()
    make_sparkle()
    make_pack_icon()
    make_sound()
    make_cat_geometry()
    print("Generated ImageGen-based icons, cat texture/geometry, particle, and whistle tone.")


if __name__ == "__main__":
    main()
