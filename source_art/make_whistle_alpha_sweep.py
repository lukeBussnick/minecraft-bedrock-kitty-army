"""Compare hard-alpha thresholds for the exact 32 px whistle texture."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "resource_pack" / "textures" / "items" / "kittie_whistle.png"
OUT = ROOT / ".forge" / "iterations" / "012-whistle-hard-alpha-sweep"
THRESHOLDS = (64, 96, 128, 160, 192, 224)
SCALE = 7
CELL_W = 256
CELL_H = 540


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    OUT.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGB", (CELL_W * 3, CELL_H * 2), (20, 20, 26))
    draw = ImageDraw.Draw(sheet)
    for index, threshold in enumerate(THRESHOLDS):
        candidate = source.copy()
        alpha = candidate.getchannel("A").point(lambda value: 255 if value >= threshold else 0)
        candidate.putalpha(alpha)
        candidate.save(OUT / f"threshold-{threshold}.png")
        x = (index % 3) * CELL_W
        y = (index // 3) * CELL_H
        draw.rectangle((x, y, x + CELL_W, y + CELL_H), fill=(12, 14, 22))
        draw.text((x + 10, y + 8), f"ALPHA >= {threshold}", fill=(255, 255, 255))
        enlarged = candidate.resize((32 * SCALE, 32 * SCALE), Image.Resampling.NEAREST)
        black = Image.new("RGBA", enlarged.size, (8, 10, 18, 255))
        green = Image.new("RGBA", enlarged.size, (36, 190, 86, 255))
        black.alpha_composite(enlarged)
        green.alpha_composite(enlarged)
        sheet.paste(black.convert("RGB"), (x + 16, y + 38))
        sheet.paste(green.convert("RGB"), (x + 16, y + 38 + enlarged.height + 14))
    sheet.save(OUT / "contact-sheet.png")
    print(f"Saved {len(THRESHOLDS)} candidates and contact sheet to {OUT}")


if __name__ == "__main__":
    main()
