// Script chooses destinations; Bedrock follow_mob owns all cat locomotion.
export const ROUTE_SLOTS = 64;
export const MARKER_ID = "kittie:departure_waypoint";
const ORIGIN = "kittie:scatter_origin";
const HEADING = "kittie:scatter_heading";
const DANGEROUS = /water|lava|fire|magma|cactus|campfire|powder_snow|sweet_berry|wither_rose/;
// Block.isSolid is pre-release, so stable 2.9.0 uses known dry support blocks.
const SUPPORT = new Set(["stone", "grass_block", "grass", "dirt", "coarse_dirt", "rooted_dirt", "podzol", "mycelium", "dirt_path", "grass_path", "farmland", "sand", "red_sand", "gravel", "clay", "snow", "snow_block", "moss_block", "cobblestone", "mossy_cobblestone", "bedrock", "deepslate", "cobbled_deepslate", "granite", "diorite", "andesite", "tuff", "calcite", "netherrack", "end_stone", "obsidian", "crying_obsidian", "sandstone", "red_sandstone", "smooth_stone", "stonebrick", "bricks"]);
function drySupport(block) {
  if (!block || block.isAir || block.isLiquid || block.isWaterlogged || DANGEROUS.test(block.typeId ?? "")) return false;
  if (!block.typeId?.startsWith("minecraft:")) return false;
  const name = block.typeId.slice(10);
  return SUPPORT.has(name) || /_(planks|log|wood|wool|concrete|terracotta|ore|bricks)$/.test(name);
}
const horizontal2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const validVector = (v) => v && [v.x, v.y, v.z].every(Number.isFinite);

function dryFooting(dimension, x, z, previousY) {
  for (const y of [previousY, previousY + 1, previousY - 1]) {
    let safe = true;
    let supported = false;
    for (const [ox, oz] of [[-.31, -.31], [-.31, .31], [.31, -.31], [.31, .31]]) {
      try {
        const p = { x: Math.floor(x + ox), y, z: Math.floor(z + oz) };
        const ground = dimension.getBlock({ ...p, y: y - 1 });
        const feet = dimension.getBlock(p);
        const head = dimension.getBlock({ ...p, y: y + 1 });
        // Conservative full-block corridors; unknown/unloaded space is not safe.
        const lower = ground?.isAir ? dimension.getBlock({ ...p, y: y - 2 }) : ground;
        if (drySupport(ground)) supported = true;
        // A stepping cat may straddle two adjacent ground heights; never bridge water/holes.
        if (!(drySupport(ground) || (ground?.isAir && drySupport(lower))) || !feet?.isAir || !head?.isAir) safe = false;
      } catch { safe = false; }
      if (!safe) break;
    }
    if (safe && supported) return y;
  }
  return undefined;
}

export function traceDryRoute(dimension, start, end, origin) {
  const length = Math.sqrt(horizontal2(start, end));
  const steps = Math.ceil(length * 2);
  let y = Math.floor(start.y);
  let last = { ...start };
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = start.x + (end.x - start.x) * t;
    const z = start.z + (end.z - start.z) * t;
    if (horizontal2({ x, z }, origin) + 0.001 < horizontal2(last, origin)) break;
    const nextY = dryFooting(dimension, x, z, y);
    if (nextY === undefined) break;
    y = nextY;
    last = { x, y: y + 0.05, z };
  }
  return last;
}

export function chooseOutwardWaypoint(dimension, start, origin, heading) {
  const radial = Math.atan2(start.z - origin.z, start.x - origin.x);
  const offsets = [0, .35, -.35, .7, -.7, 1.05, -1.05, 1.4, -1.4];
  let best;
  let bestScore = -Infinity;
  for (const offset of offsets) {
    const angle = heading + offset;
    if (horizontal2(start, origin) > 0.25 && Math.cos(angle - radial) < 0.08) continue;
    const wanted = { x: start.x + Math.cos(angle) * 8, z: start.z + Math.sin(angle) * 8 };
    const end = traceDryRoute(dimension, start, wanted, origin);
    const distance = Math.sqrt(horizontal2(start, end));
    if (distance < 2.5) continue;
    const score = distance - Math.abs(offset) * 2;
    if (score > bestScore) { bestScore = score; best = end; }
    if (offset === 0 && distance > 7.5) break;
  }
  return best;
}

export function createOutwardRoutes(world) {
  const routes = new Map();
  const used = new Set();
  let initialized = false;
  function removeMarker(route) {
    try { if (route.marker?.isValid) route.marker.remove(); } catch {}
    route.marker = undefined;
  }
  function release(id) {
    const route = routes.get(id);
    if (!route) return;
    removeMarker(route);
    used.delete(route.slot);
    routes.delete(id);
  }
  function update(cat, owner, tick, force = false) {
    if (!cat?.isValid) return;
    if (!initialized) { prune([]); initialized = true; }
    let route = routes.get(cat.id);
    if (route && route.dimensionId !== cat.dimension.id) { release(cat.id); route = undefined; }
    if (!route) {
      const slot = Array.from({ length: ROUTE_SLOTS }, (_, i) => i).find((i) => !used.has(i));
      if (slot === undefined) return; // Capacity fallback is finite departure cleanup, never wrong-owner routing.
      let origin = cat.getDynamicProperty(ORIGIN);
      if (!validVector(origin) || cat.getDynamicProperty("kittie:scatter_dimension") !== cat.dimension.id) {
        origin = owner?.dimension.id === cat.dimension.id ? { ...owner.location } : { ...cat.location };
        cat.setDynamicProperty(ORIGIN, origin);
        cat.setDynamicProperty("kittie:scatter_dimension", cat.dimension.id);
        cat.setDynamicProperty(HEADING, undefined);
      }
      let heading = cat.getDynamicProperty(HEADING);
      if (!Number.isFinite(heading)) {
        heading = horizontal2(cat.location, origin) > .25
          ? Math.atan2(cat.location.z - origin.z, cat.location.x - origin.x) + (Math.random() - .5) * .6
          : Math.random() * Math.PI * 2;
        cat.setDynamicProperty(HEADING, heading);
      }
      route = { slot, origin, heading, dimensionId: cat.dimension.id, lastPlan: -100, retry: -1 };
      used.add(slot);
      routes.set(cat.id, route);
      force = true;
    }
    if (cat.isOnGround === false) return; // Preserve the destination through a native jump.
    const retry = cat.getDynamicProperty("kittie:depart_retry_count") ?? 0;
    if (retry !== route.retry) force = true;
    const location = cat.location;
    const reached = route.target && horizontal2(location, route.target) < 4;
    let blocked = false;
    if (route.target && !reached) {
      // Look ahead for changed terrain before reaching a shoreline/block.
      const length = Math.sqrt(horizontal2(location, route.target));
      const fraction = Math.min(1, 5 / length);
      const ahead = { x: location.x + (route.target.x - location.x) * fraction, z: location.z + (route.target.z - location.z) * fraction };
      blocked = horizontal2(traceDryRoute(cat.dimension, location, ahead, route.origin), ahead) > .25;
    }
    if (!force && !reached && !blocked && route.marker?.isValid) return;
    if (!force && tick - route.lastPlan < 10) return;
    route.lastPlan = tick;
    route.retry = retry;
    const target = chooseOutwardWaypoint(cat.dimension, location, route.origin, route.heading);
    removeMarker(route);
    route.target = target;
    if (!target) return;
    try {
      const marker = cat.dimension.spawnEntity(MARKER_ID, target);
      route.marker = marker;
      marker.addTag(`kittie_route_${route.slot}`);
      marker.setDynamicProperty("kittie:route_cat", cat.id);
      cat.triggerEvent(`kittie:route_${route.slot}`);
    } catch (error) {
      removeMarker(route);
      console.warn(`[Kitty Army] Could not create departure route: ${error}`);
    }
  }
  function prune(cats) {
    const active = new Set(cats.filter((c) => c.isValid && c.getDynamicProperty("kittie:state") === "departing").map((c) => c.id));
    for (const id of routes.keys()) if (!active.has(id)) release(id);
    // Reclaims saved/reloaded or unloaded-owner markers before assigning/reusing channels.
    const owned = new Set([...routes.values()].map((r) => r.marker?.id));
    for (const name of ["overworld", "nether", "the_end"]) {
      try {
        for (const marker of world.getDimension(name).getEntities({ type: MARKER_ID })) {
          if (!owned.has(marker.id)) marker.remove();
        }
      } catch {}
    }
  }
  return { update, release, prune };
}
