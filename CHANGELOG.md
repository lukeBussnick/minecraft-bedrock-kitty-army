# Changelog

## 1.6.5 - 2026-09-06

- Replaced directionless departure wandering with stable, per-kitty outward
  waypoint routes using native `follow_mob` navigation.
- Added dry-ground, clearance, hazard, one-block-step, shoreline, and alternate
  side-route checks without scripted pushing, teleporting, or forced jumping.
- Isolated up to 64 concurrent routes through invisible waypoint channels and
  added reload recovery, marker expiry, and cleanup coverage.
- Removed the repeated partial-arrival chat warning while retaining diagnostic
  logging.
- Preserved the accepted player transformation, kitty geometry, texture, and
  walk/run animation assets.

## 1.6.1–1.6.4 - 2026-09-06

- Added the Kitty Transformation Collar and direct player-to-kitty rendering.
- Added forward and reverse transformation effects with multiplayer lifecycle
  handling and normal-camera behavior.
- Cleaned the collar's transparency and hid common third-person held items in
  kitty form while keeping first-person interaction usable.
- Removed teleporting and excessive-speed army movement, then iterated on
  dismissal navigation from bounded flee behavior to independent native paths.

## 1.5.0 - 2026-09-05

- Rebuilt the tuxedo kitty around the approved reference: 35 cubes, eight
  animation bones, a 256×256 texture, oversized head, pink eyes, cream blaze,
  sturdy paws, and upright tail.
- Preserved summon, ownership, combat, recipe, whistle, and animation behavior.

## 1.4.0 - 2026-09-05

- Added the illustrated pack icon, cat-ear whistle icon, dedicated whistle
  sound, and explicit walk/run animation-controller routing.
- Added hard-alpha validation for crisp inventory artwork.
