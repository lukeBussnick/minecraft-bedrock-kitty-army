# Private release checklist

- [x] Keep editable `behavior_pack/` and `resource_pack/` directories authoritative.
- [x] Exclude local deployment backups, Forge evidence, generated packages, and unmodified vanilla reference inputs from Git.
- [x] Document generated-art, Minecraft-derived asset, screenshot, and sound provenance.
- [x] Apply MIT to original source code and documentation with a prominent asset exclusion.
- [x] Add the owner-supplied gameplay and recipe screenshots with repository-safe paths.
- [x] Validate v1.6.5 source, route planning, lifecycle behavior, transformation behavior, and frozen assets.
- [x] Build and archive-verify a fresh `Kitty Army.mcaddon` for the GitHub release.
- [x] Inspect the exact staged repository and rescan it for secrets and machine-specific paths.
After publication, verify the private GitHub repository, pushed commit, release
tag, and attached package directly against GitHub. Public visibility is not
part of this release; a separate public-readiness review is required before
changing repository visibility.
