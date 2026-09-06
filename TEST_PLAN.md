# Minecraft runtime test plan

Record Minecraft version, world seed, dimension, terrain, player count, and observed entity counts for each run.

## v1.6 direct-player rendering gate — required first

Current implementation record (2026-09-06):

| Gate | Status | Evidence |
|---|---|---|
| Frozen geometry, texture, clips | PASS (static) | Validator matches the three handoff SHA-256 values; cat checks report 35 cubes, 8 bones, 210 disjoint opaque islands and planted neutral paws. |
| Existing army lifecycle regression | PASS (mock/static) | Existing 20-cat summon/ownership/dismissal/respawn/cleanup smoke test passes unchanged. |
| Collar lifecycle helper | PASS (mock/static) | Exact head-slot type, no-effect first observation, interrupted delay cancellation, sparkle, pruning and independent-player cases pass. |
| Retail v1.6 pack load | PASS (user runtime) | User reports the feature worked beautifully and supplied an in-world third-person screenshot. Content Log was not supplied. |
| Direct kitty rendering | PASS (user runtime) | Screenshot proves the approved kitty renders on the player in third person. |
| v1.6 collar edge | FAIL (user runtime) | White/gray matte was visible; v1.6.1 replaces the contaminated palette and adds multi-backdrop/hole validation. |
| v1.6 held item | FAIL (user runtime) | Screenshot shows a held block floating above the cat; v1.6.1 gates common held-item render controllers in third person. |
| v1.6 army movement/departure | FAIL (user runtime) | User observed wild screen-speed movement and inconsistent dismissal; v1.6.1 disables follow teleport/leap and strengthens bounded flee behavior. |
| v1.6.1 retail retest | PARTIAL / FAIL | User runtime testing confirmed remaining difficulty clearing one-block rises and dismissal cats lingering or moseying instead of decisively scattering. |
| v1.6.2 jump/scatter retest | FAIL (user runtime) | Cats pressed into raised terrain because the fixed-direction impulse driver competed with native pathfinding; stronger jump power did not solve route planning. |
| v1.6.3 native-navigation retest | FAIL (user runtime) | Cats largely stood still and disappeared with the recovery particle. Avoidance-only departure did not provide the intended scatter. |
| v1.6.4 independent-scatter retest | PARTIAL (user runtime) | Movement much better; cats wandered back and forth, sometimes toward the player. |
| v1.6.5 outward-waypoint retest | PASS (user runtime report) | User reports that Astra's v1.6.5 implementation resolved the send-home issue. The focused edge-case course below remains useful after future Bedrock updates. |

### v1.6.5 focused runtime checkpoint

- [ ] Reload with both packs at 1.6.5. Gather the army, then dismiss on flat ground. Cats should run out from the whistle position in varied directions, without rerolling destinations back toward it. No waypoint should be visible or push a cat/player.
- [ ] Dismiss beside a lake and a one-block mound. Cats select dry outward side paths or one-block steps. Fully blocked routes may stop and recover; timeout alone is not a successful route.
- [ ] Two players dismiss together: cats retain individual routes; one cat's disappearing destination must not attract the others. Check saved/reloaded departures and no leftover waypoints (`/testfor @e[type=kittie:departure_waypoint]` after cleanup).
- [ ] Whistle summon no longer displays the partial-arrival warning. Summon/follow/combat, transformation, and approved run clip remain unchanged.

Use a disposable retail Bedrock 1.26.45 world with experiments off. Enable only Kitty Army BP/RP first, then repeat with the normal personal pack stack. Fully exit and reopen the world after changing packs. Capture third-person back/front screenshots and the relevant Content Log excerpt.

- [ ] Both packs list version 1.6.5 with the visible name “Kitty Army”. On flat ground, whistle dismissal starts visibly varied running routes promptly, rather than standing until pink timeout. Repeat at a one-block mound; cats must navigate the terrain. Count distance and timeout cleanup separately. Check for new entity/goal/Script API errors.
- [ ] The collar has clean edges on white, black, magenta, cyan, green, grass, and checkerboard backgrounds; its central loop is transparent and no other enclosed transparent pinhole appears.
- [ ] In third person, held blocks, tools, shield, bow, crossbow, spear, whistle, and collar are hidden while the kitty body is visible; first-person held items remain usable and inventory icons remain visible.
- [ ] Following cats no longer teleport or streak across the screen. Walking/running animation quality remains unchanged.
- [ ] On one-block steps and successive one-block mound terraces with headroom, cats jump planned steps or route around without sustained wall pressing.
- [ ] At a solid two-block wall with a nearby open end, cats route around the end; do not require a sheer two-block jump.
- [ ] On dismissal in an open area, all nearby owned cats start native movement within one second, disperse along varied routes, and disappear with one pink particle after reaching 30 blocks. No distance-success cat is logged as a timeout.
- [ ] In a corner with a reachable side exit, native turning or one of the two bounded flee restarts finds the exit without forced outward steering.
- [ ] In a completely sealed enclosure, cats do not teleport, launch or reach extreme speed; after two bounded retries they receive pink recovery cleanup. Record this as recovery, not successful navigation.
- [ ] `/give @s kittie:kittie_collar` and `/function give_collar` work; the 32×32 black/gold/pink icon is crisp in inventory and hand.
- [ ] Drag/shift-click the collar to the head slot. Confirm the approved 35-cube tuxedo kitty appears, with pink eyes and planted paws, at the same apparent 0.8 scale as a summoned army kitty.
- [ ] Repeat on default classic, slim, a custom classic skin, Scarlett's actual skin, and Persona if it is part of the target pack stack. Confirm the original skin returns unchanged.
- [ ] Have a second player observe equip, settled kitty, unequip, and a player who was already transformed before entering view. Confirm one body only and no late-observer transition replay.
- [ ] Equip helmet/chest/legs/boots with trims and enchantments, a cape, and elytra. Confirm transformed players leak no armor/cape/elytra; untransformed players, an armored mob, and an armor stand remain unchanged.
- [ ] If armor or elytra leaks, capture the Content Log and the exact item/skin/view. This means the player-only attachable controller's owner head-slot query is not proven; do not globally hide armor.
- [ ] In first person, confirm no human arms/sleeves are drawn while transformed, but empty-hand use, blocks/tools, map/offhand map, shield, bow/crossbow, eating, swapping, whistle and collar remain usable and held items remain visible.
- [ ] In third person, confirm no floating human-height held item. Record any item whose attachable survives on the cat rig.
- [ ] Observe the ~0.6 second darken/compress/puff/sparkle forward transition and ~0.25 second reverse. Run 20 rapid equip/remove or helmet-swap cycles, including reversals mid-transition; no duplicate body or stuck scale is allowed.
- [ ] Walk, sprint, strafe, backpedal, turn, jump, swim, glide, ride, sleep and crouch/crawl. Idle must not treadmill; sprint must use the run clip; air/riding/sleep must suppress ground running.
- [ ] Test collar in hotbar, offhand and chest (no transform), renamed collar in head slot (transform), `/clear`, death with keepInventory off/on, save/reload human/kitty/mid-transition, Nether round trip, teleport, Spectator round trip, and F5/inventory paperdoll.
- [ ] Test two transformed players near separate armies; one removes the collar, dies, changes dimension and disconnects. Confirm no cross-player effects, hidden equipment on others, ghosts, or army ownership regression.

If the player override itself, classic/slim skin restoration, or player-only armor owner binding fails, record the exact failure in `KITTY_TRANSFORMATION_BLOCKERS.md` before changing architecture. Do not substitute a proxy or global equipment suppression.

## v1.6.5 existing regression pass

- [ ] Repeat the complete whistle/army acceptance pass below: 20 cats in four waves, ownership, follow, combat, whistle sound/cooldown, dismissal, death/dimension/orphan cleanup and two-player independence.
- [ ] Compare a transformed player beside an army kitty while idle/walking/running; proportions, atlas, scale and paw contact must match.

## v1.5 focused visual retest

- [ ] After fully leaving and reopening the world, both packs list as version 1.5.0.
- [ ] Summoned cats have the larger square head, broad muzzle, and more visible ears shown in the pack-art reference.
- [ ] The face has two large luminous pink eyes, a centered warm-cream blaze, a pink nose, and no scrambled UVs.
- [ ] Inner ears are pink and the tuxedo coat reads deep charcoal/plum rather than flat black.
- [ ] Cream paws remain attached and grounded; pink paw pads are visible from below or during running strides.
- [ ] Walk and run animations still move the head and legs correctly with no separation or clipping severe enough to break the character.
- [ ] Summon, follow, combat, dismiss, recipe, whistle texture, and whistle sound remain unchanged from the accepted v1.4 checkpoint.

## v1.4 focused retest

- [ ] After fully leaving and reopening the world, the pack lists as version 1.4.0.
- [ ] The new illustrated pack icon and gold cat-ear whistle icon appear.
- [ ] One copper ingot, one feather, and one Pink Dye craft one whistle in any crafting-table arrangement.
- [ ] Summoned cats have a horizontal four-legged torso, attached head, grounded legs, and connected tail.
- [ ] Walking cats alternate diagonally paired legs and swing the tail.
- [ ] Fast following and monster pursuit visibly use the stronger run cycle with leg reach and a small body bounce.
- [ ] The whistle has a crisp pixel edge without a dark translucent halo in inventory or in hand.
- [ ] No content-log error says `scripts | animate | child 'animate' not valid here` for `entity/army_cat.entity.json`.
- [ ] Summoning and dismissal play only the whistle tone; no meow follows.
- [ ] No new content-log error says `animation_controllers` is invalid for `entity/army_cat.entity.json`.
- [ ] No new `scan_interval` warning appears for `kittie:army_cat`.

## Full acceptance pass

- [ ] Both packs load without content-log errors.
- [ ] Kitty Whistle appears in Creative Items and `/give @s kittie:kittie_whistle` works.
- [ ] Use plays the custom whistle tone and pink sparkle particle; no meow follows.
- [ ] One use produces approximately 20 cats in four waves outside the immediate area.
- [ ] Cats approach successfully over flat, hilly, wooded, and village terrain.
- [ ] Cats follow their summoner while walking and sprinting a significant distance.
- [ ] Cats attack zombies, skeletons, spiders, and creepers; they do not attack players or army cats.
- [ ] A mixed group of hostile mobs is defeated by swarm behavior without one cat feeling overpowered.
- [ ] Second use changes all owned cats to departure behavior; they visibly run away before cleanup.
- [ ] Ten summon/dismiss cycles do not increase the post-cleanup entity count.
- [ ] Rapid use during cooldown does not stack armies.
- [ ] Player death dismisses or cleans the player's army.
- [ ] Nether/End transitions clean the prior-dimension army and permit a fresh summon after cleanup.
- [ ] Save/quit and reload preserves a legitimate owned army without multiplying it.
- [ ] Disconnect/reconnect inside 30 seconds preserves ownership; a longer absence cleans orphans.
- [ ] Two players can summon independently; neither whistle toggles the other player's cats.
- [ ] Twenty cats remain playable on the target device with no runaway script warnings.
