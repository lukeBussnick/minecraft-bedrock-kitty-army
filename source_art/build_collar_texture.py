from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source_art" / "kittie_collar_imagegen.png"
OUTPUT = ROOT / "resource_pack" / "textures" / "items" / "kittie_collar.png"
DARK = ROOT / "resource_pack" / "textures" / "particle" / "kitty_transform_dark.png"
INVISIBLE = ROOT / "resource_pack" / "textures" / "entity" / "kittie_collar_invisible.png"


def components(mask: list[list[bool]]) -> list[list[tuple[int, int]]]:
    height = len(mask)
    width = len(mask[0])
    seen: set[tuple[int, int]] = set()
    found: list[list[tuple[int, int]]] = []
    for y in range(height):
        for x in range(width):
            if not mask[y][x] or (x, y) in seen:
                continue
            group: list[tuple[int, int]] = []
            queue = deque([(x, y)])
            seen.add((x, y))
            while queue:
                px, py = queue.popleft()
                group.append((px, py))
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if 0 <= nx < width and 0 <= ny < height and mask[ny][nx] and (nx, ny) not in seen:
                        seen.add((nx, ny))
                        queue.append((nx, ny))
            found.append(group)
    return found


def palette_color(pixel: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    r, g, b, _ = pixel
    light = (r + g + b) / 3
    if r > g * 1.25 and b > r * 0.55:
        palette = [(91, 13, 61), (151, 20, 98), (212, 29, 135), (244, 61, 163), (255, 151, 208)]
    elif r > b * 1.28 and g > b * 1.08 and r > 90:
        palette = [(82, 43, 5), (137, 73, 7), (194, 117, 12), (236, 164, 31), (255, 215, 91)]
    else:
        palette = [(17, 14, 20), (29, 25, 34), (44, 38, 49), (62, 53, 66), (83, 70, 84)]
    index = min(len(palette) - 1, int(light / 256 * len(palette)))
    return (*palette[index], 255)


source = Image.open(SOURCE).convert("RGBA")
pixels = source.load()
mask = []
for y in range(source.height):
    row = []
    for x in range(source.width):
        r, g, b, _ = pixels[x, y]
        row.append(min(r, g, b) < 185 or max(r, g, b) - min(r, g, b) > 45)
    mask.append(row)

largest = max(components(mask), key=len)
xs = [point[0] for point in largest]
ys = [point[1] for point in largest]
box = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
cropped = source.crop(box)
crop_mask = Image.new("L", cropped.size, 0)
mask_pixels = crop_mask.load()
for x, y in largest:
    mask_pixels[x - box[0], y - box[1]] = 255

# Close tiny highlight gaps while retaining the collar's large center opening.
closed = crop_mask.resize((32, 32), Image.Resampling.LANCZOS)
closed = closed.point(lambda value: 255 if value >= 96 else 0)
icon_rgb = cropped.resize((28, 28), Image.Resampling.LANCZOS)
icon_alpha = crop_mask.resize((28, 28), Image.Resampling.LANCZOS).point(lambda value: 255 if value >= 72 else 0)
icon_rgb.putalpha(icon_alpha)
icon = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
icon.alpha_composite(icon_rgb, (2, 2))

# The ImageGen source contains a baked checkerboard. Quantize every opaque pixel
# into an intentional collar palette so no white/gray matte survives at an edge.
for y in range(icon.height):
    for x in range(icon.width):
        pixel = icon.getpixel((x, y))
        if pixel[3]:
            icon.putpixel((x, y), palette_color(pixel))

# Keep the large central collar opening, but fill isolated transparent pinholes.
transparent = [[icon.getpixel((x, y))[3] == 0 for x in range(icon.width)] for y in range(icon.height)]
for group in components(transparent):
    if len(group) > 4:
        continue
    for x, y in group:
        neighbors = []
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < icon.width and 0 <= ny < icon.height and icon.getpixel((nx, ny))[3]:
                neighbors.append(icon.getpixel((nx, ny)))
        if neighbors:
            icon.putpixel((x, y), max(neighbors, key=lambda value: sum(value[:3])))
icon.save(OUTPUT)

dark = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
dark_pixels = dark.load()
for y in range(16):
    for x in range(16):
        distance = ((x - 7.5) ** 2 + (y - 7.5) ** 2) ** 0.5
        if distance <= 6.6:
            dark_pixels[x, y] = (34, 12, 42, 255 if distance < 4.8 else 190)
dark.save(DARK)

Image.new("RGBA", (1, 1), (0, 0, 0, 0)).save(INVISIBLE)
print(f"Wrote {OUTPUT.relative_to(ROOT)}, {DARK.relative_to(ROOT)}, and {INVISIBLE.relative_to(ROOT)}")
