"""Render the exact shipping whistle texture over high-contrast solid colors."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "resource_pack" / "textures" / "items" / "kittie_whistle.png"
OUTPUT = ROOT / ".forge" / "iterations" / "013-v1.4-alpha-final" / "whistle-alpha-diagnostic.png"

PANEL = 384
SCALE = 10
BACKGROUNDS = (
    ("BLACK", (8, 10, 18, 255)),
    ("GREEN", (36, 190, 86, 255)),
    ("MAGENTA", (220, 20, 150, 255)),
    ("WHITE", (245, 245, 240, 255)),
)


def main() -> None:
    item = Image.open(SOURCE).convert("RGBA").resize((32 * SCALE, 32 * SCALE), Image.Resampling.NEAREST)
    sheet = Image.new("RGBA", (PANEL * 2, PANEL * 2), (0, 0, 0, 255))
    draw = ImageDraw.Draw(sheet)
    for index, (label, color) in enumerate(BACKGROUNDS):
        x = (index % 2) * PANEL
        y = (index // 2) * PANEL
        sheet.paste(color, (x, y, x + PANEL, y + PANEL))
        sheet.alpha_composite(item, (x + (PANEL - item.width) // 2, y + 42))
        text_color = (255, 255, 255, 255) if sum(color[:3]) < 350 else (15, 15, 20, 255)
        draw.text((x + 12, y + 12), label, fill=text_color)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(OUTPUT)
    alpha = Image.open(SOURCE).convert("RGBA").getchannel("A")
    histogram = alpha.histogram()
    partial = sum(histogram[1:255])
    print(f"Saved {OUTPUT}; alpha pixels: transparent={histogram[0]}, partial={partial}, opaque={histogram[255]}")


if __name__ == "__main__":
    main()
