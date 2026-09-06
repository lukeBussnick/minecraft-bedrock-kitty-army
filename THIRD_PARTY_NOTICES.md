# Third-party notices and asset provenance

Kitty Army is an unofficial Minecraft Bedrock add-on and is not approved by or
associated with Mojang or Microsoft. Minecraft is a trademark of Microsoft.

## Minecraft-compatible assets

The add-on necessarily uses Minecraft Bedrock schemas, identifiers, component
names, materials, animation conventions, and player-rendering structures.
The player client definition and selected rendering paths were adapted against
the locally installed vanilla resource definitions so the transformation can
preserve normal player behavior and equipment compatibility.

Two unmodified vanilla reference inputs used by historical asset generators
are intentionally excluded from Git. The distributable behavior and resource
packs contain the files required to run the add-on, including modified or
custom Minecraft-compatible outputs.

Minecraft content remains subject to Microsoft and Mojang's applicable
[Minecraft Usage Guidelines](https://www.minecraft.net/en-us/usage-guidelines),
terms, and intellectual-property rights. The project MIT License cannot grant
rights in third-party material.

## Original and generated artwork

The tuxedo-kitty reference sheet, pack graphic, whistle artwork, and collar
artwork were generated specifically for this project with OpenAI image
generation, then converted into deterministic Minecraft-ready assets by the
scripts in `source_art/`. The final kitty model and texture were refined for
this add-on and are guarded by fixed SHA-256 values in the validator.

The whistle tone is generated locally by `source_art/generate_assets.py`; it
does not contain a sampled commercial recording.

The gameplay and recipe screenshots under `docs/` were captured and supplied
by the project owner on September 6, 2026. They contain Minecraft visuals and
are excluded from the MIT grant.

See [ASSET_LICENSE.md](ASSET_LICENSE.md) for the exact asset exclusions.
