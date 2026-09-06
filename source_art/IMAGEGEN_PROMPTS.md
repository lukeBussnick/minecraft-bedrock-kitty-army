# ImageGen source prompts

These assets were produced with OpenAI's built-in ImageGen tool on 2026-09-05. The generated source PNGs are retained beside this file; deterministic downsampling and transparency extraction are performed by `generate_assets.py`.

## v1.2 whistle transparency result

Three built-in ImageGen requests explicitly asked for real alpha. All three returned 1254×1254 RGB PNG files with opaque checkerboard pixels, confirmed with Pillow after saving. They are retained as `kittie_whistle_imagegen_transparent.png`, `kittie_whistle_imagegen_transparent_v2.png`, and `kittie_whistle_imagegen_native_attempt.png`. The third, cleanest source is used for v1.2 with a stricter high-resolution matte cleanup before downsampling.

Selected-source prompt:

```text
Use case: stylized-concept
Asset type: final transparent Minecraft Bedrock inventory item icon source
Primary request: create one original golden voxel Kittie Whistle as an isolated game item cutout
Scene/backdrop: transparent background with real alpha only
Subject: compact polished brass whistle with two cat-ear shapes, a pink paw emblem, dark whistle openings, and a short pink cord; charming, clearly recognizable, block-built Minecraft-inspired form
Style/medium: premium crisp voxel/pixel game item render with clean hard silhouette edges and readable shading at 32 by 32 pixels
Composition/framing: one centered object angled slightly upward, complete silhouette, generous transparent padding
Color palette: gold brass, deep plum shadows, vivid pink accents, small cream highlights
Technical requirement: output an RGBA PNG; all empty pixels alpha 0; object pixels cleanly antialiased; transparent holes where the cord loops and whistle openings require them
Constraints: absolutely no checkerboard pattern, no white background, no gray background, no colored background, no simulated transparency, no matte halo, no fringe, no cats, no extra objects, no text, no logo, no watermark
```

## Pack art

```text
Use case: stylized-concept
Asset type: Minecraft Bedrock add-on pack icon source artwork
Primary request: create original premium key art for a cute add-on named Kittie Army
Scene/backdrop: bright rosy-pink circular glow with subtle playful sparkles, clean uncluttered background
Subject: a joyful squad of three blocky tuxedo cats charging forward together, black-and-white fur, vivid glowing pink eyes that feel magical and friendly, with a polished brass whistle featuring tiny cat-ear details prominently in the foreground
Style/medium: high-quality Minecraft-inspired voxel and pixel-art illustration, crisp handcrafted game art, cute and energetic, readable when reduced to a small square icon
Composition/framing: centered square composition, large central cat face and whistle, supporting cats framing it symmetrically, strong silhouette, generous edge padding
Lighting/mood: cheerful warm light, playful heroic energy, child-friendly
Color palette: charcoal black, warm cream white, vivid pink accents, golden brass
Constraints: entirely original artwork; no text; no letters; no logos; no weapons; no military uniforms; no dark or threatening mood; no watermark; no photographic realism; square icon composition
```

## Whistle art

```text
Use case: stylized-concept
Asset type: Minecraft Bedrock inventory item icon source artwork
Primary request: an original magical Kittie Whistle, a small polished brass whistle with a charming cat-inspired silhouette
Scene/backdrop: genuinely transparent background
Subject: one compact golden-brass whistle angled slightly upward, with two subtle cat-ear shapes built into the top, a tiny pink paw emblem, dark openings, crisp edge highlights, and a short pink cord tucked neatly behind it
Style/medium: premium hand-painted Minecraft-inspired voxel/pixel game item, chunky block-built forms, crisp readable shading, designed to survive reduction to a 32 by 32 inventory texture
Composition/framing: single centered object, generous transparent padding, strong unmistakable whistle silhouette, no cropped edges
Lighting/mood: cheerful warm glints, cute magical polish
Color palette: golden brass, deep plum shadows, bright pink accent, small cream highlights
Constraints: transparent background with real alpha; no cats; no extra objects; no text; no letters; no logo; no watermark; no photorealism; no soft blurry edges
```
## Kitty Transformation Collar (v1.6)

Built-in image generation prompt:

> Use case: stylized-concept. Asset type: Minecraft Bedrock inventory item icon source art. A magical kitty transformation collar, viewed as a compact three-quarter inventory icon: small black leather collar in a readable curved loop, bright pink heart-shaped gem tag, tiny gold clasp, subtle pink sparkles. Polished game-item icon with clean pixel-art-inspired hard shapes suitable for downscaling to 32x32. Single centered object with transparent padding. Black/charcoal, hot pink/magenta, warm gold. Genuinely transparent background; no text, watermark, cat character, fuzzy shadow, or fragile thin detail.

The generated 1254×1254 source is `kittie_collar_imagegen.png`. The provider returned an opaque checkerboard despite the transparency request; `build_collar_texture.py` therefore isolates the largest saturated/dark collar component, downsizes it, and emits a deterministic 32×32 one-bit-alpha inventory texture. The validator requires both transparent and opaque pixels and forbids semi-transparent fringe pixels.
