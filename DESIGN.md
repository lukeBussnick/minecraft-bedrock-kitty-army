# Visual contract

Status: approved by the supplied project brief.

- Style: vanilla-readable, cute, bright, and playful; never grim or militaristic.
- Cat: the approved ImageGen reference sheet governs proportions: oversized square head, stepped triangular ears, compact torso, sturdy cream paws, upright cream-tipped tail, vivid pink eyes, and soft pink nose.
- Whistle: compact brass whistle with a dark outline, warm highlight, cat-ear crown, and pink paw accent.
- Pack icon: a pink radial field, three tuxedo cat faces, sparkles, and a prominent gold whistle; readable at 64 px.
- Focal hierarchy: pink eyes first on the cats; whistle silhouette first in inventory; central cat plus whistle first on the pack icon.
- Forbidden tendencies: realistic gradients, noisy pixel texture, weapons, camouflage, blood, or generic placeholder art.

The entity uses owned `geometry.kittie_army.cat` geometry and owned locomotion controllers. The September 5 reference reconstruction supersedes the former vanilla-proportion/four-head-cube/64x32 constraints. It retains all eight bone names and the animation hierarchy, with revised pivots appropriate to the shorter body. The atlas is 256x256 with explicit face ownership. Existing animations still require an in-game movement check on the revised proportions.

Current visual evidence: `.forge/iterations/018-reference-final/`. Iterations 016 and 017 preserve the preceding reconstruction trials; 018 includes the original v1.5 geometry and texture as its control. Rendered validation is not Minecraft runtime proof. The visible product name is now **Kitty Army**; compatibility-critical `kittie:*` identifiers, UUIDs, properties, and deployment folder names remain unchanged. Development packs are synced with source/live SHA-256 verification and scoped deployment backups.
