from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ICON = ROOT / "resource_pack" / "textures" / "items" / "kittie_collar.png"


image = Image.open(ICON).convert("RGBA")
assert image.size == (32, 32), f"expected 32x32 collar, got {image.size}"
alpha = image.getchannel("A")
assert set(alpha.getdata()) == {0, 255}, "collar must contain only fully transparent and fully opaque pixels"

transparent = {(x, y) for y in range(32) for x in range(32) if image.getpixel((x, y))[3] == 0}
groups = []
while transparent:
    start = transparent.pop()
    queue = deque([start])
    group = [start]
    while queue:
        x, y = queue.popleft()
        for point in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if point in transparent:
                transparent.remove(point)
                queue.append(point)
                group.append(point)
    groups.append(group)

outer = [group for group in groups if any(x in (0, 31) or y in (0, 31) for x, y in group)]
inner = [group for group in groups if group not in outer]
assert len(outer) == 1, f"expected one connected exterior transparent region, found {len(outer)}"
assert len(inner) == 1, f"expected exactly one intentional enclosed opening, found {len(inner)}"
assert 60 <= len(inner[0]) <= 120, f"collar opening area is suspicious: {len(inner[0])} pixels"

bad_edge = []
for y in range(32):
    for x in range(32):
        r, g, b, a = image.getpixel((x, y))
        if not a:
            continue
        touches_transparency = any(
            0 <= nx < 32 and 0 <= ny < 32 and image.getpixel((nx, ny))[3] == 0
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
        )
        if touches_transparency and max(r, g, b) - min(r, g, b) < 24 and min(r, g, b) > 105:
            bad_edge.append((x, y, (r, g, b)))
assert not bad_edge, f"neutral light matte pixels remain on collar edge: {bad_edge}"

print(f"Collar alpha checks passed: one exterior region, one {len(inner[0])}-pixel intended opening, no pinholes, no light neutral edge matte.")
