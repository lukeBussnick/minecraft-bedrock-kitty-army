import { system, world } from "@minecraft/server";
import "./kitty_transformation.js";
import { createOutwardRoutes } from "./outward_routes.js";

const outwardRoutes = createOutwardRoutes(world);

const CAT_ID = "kittie:army_cat";
const OWNER_PROPERTY = "kittie:owner_name";
const STATE_PROPERTY = "kittie:state";
const DEPART_REMAINING_PROPERTY = "kittie:depart_remaining";
const DEPART_RETRY_COUNT_PROPERTY = "kittie:depart_retry_count";
const OWNER_MISSING_REMAINING_PROPERTY = "kittie:owner_missing_remaining";
const LEGACY_TRANSIENT_PROPERTIES = [
  "kittie:depart_tick",
  "kittie:depart_dir_x",
  "kittie:depart_dir_z",
  "kittie:owner_missing_tick",
];
const DIMENSIONS = ["overworld", "nether", "the_end"];
const ARMY_SIZE = 20;
const CATS_PER_WAVE = 5;
const WAVE_DELAY_TICKS = 10;
const USE_GUARD_TICKS = 20;
const DEPART_DISTANCE = 30;
const DEPART_TIMEOUT_TICKS = 240;
const OWNER_GRACE_TICKS = 600;
const LIFECYCLE_INTERVAL_TICKS = 10;
const STALL_WINDOW_TICKS = 40;
const STALL_DISTANCE_SQUARED = 0.5 * 0.5;
const MAX_DEPART_RETRIES = 2;
const RETRY_COOLDOWN_TICKS = 40;
const lastUseTick = new Map();
const pendingSummons = new Set();
const departureSamples = new Map();
const missingOwnerSamples = new Map();
const pendingFleeRestarts = new Set();

function safeSend(player, translationKey) {
  try {
    player.sendMessage({ translate: translationKey });
  } catch {}
}

function safeParticle(dimension, location) {
  try {
    dimension.spawnParticle("kittie:whistle_sparkle", location);
  } catch {}
}

function allArmyCats() {
  const cats = [];
  for (const id of DIMENSIONS) {
    try {
      cats.push(...world.getDimension(id).getEntities({ type: CAT_ID }));
    } catch {}
  }
  return cats;
}

function ownerOf(cat) {
  try {
    const value = cat.getDynamicProperty(OWNER_PROPERTY);
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

function stateOf(cat) {
  try {
    return cat.getDynamicProperty(STATE_PROPERTY) === "departing" ? "departing" : "active";
  } catch {
    return "active";
  }
}

function catsFor(ownerName) {
  return allArmyCats().filter((cat) => ownerOf(cat) === ownerName);
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function findArrivalLocation(player, ordinal) {
  const dimension = player.dimension;
  const origin = player.location;
  const angle = ((ordinal / ARMY_SIZE) * Math.PI * 2) + ((ordinal % 3) - 1) * 0.12;
  const radius = 17 + ((ordinal * 7) % 9);
  const x = Math.floor(origin.x + Math.cos(angle) * radius);
  const z = Math.floor(origin.z + Math.sin(angle) * radius);

  try {
    if (!dimension.isChunkLoaded({ x, y: origin.y, z })) return undefined;
  } catch {
    return undefined;
  }

  const maxY = Math.floor(origin.y) + 10;
  const minY = Math.floor(origin.y) - 14;
  for (let y = maxY; y >= minY; y--) {
    try {
      const ground = dimension.getBlock({ x, y, z });
      const feet = dimension.getBlock({ x, y: y + 1, z });
      const head = dimension.getBlock({ x, y: y + 2, z });
      if (!ground || !feet || !head) continue;
      if (!ground.isAir && !ground.isLiquid && feet.isAir && head.isAir) {
        return { x: x + 0.5, y: y + 1.05, z: z + 0.5 };
      }
    } catch {}
  }
  return undefined;
}

function spawnCat(player, ordinal) {
  if (!player?.isValid || pendingSummons.has(player.name) === false) return false;
  const location = findArrivalLocation(player, ordinal);
  if (!location) return false;

  try {
    const cat = player.dimension.spawnEntity(CAT_ID, location);
    cat.setDynamicProperty(OWNER_PROPERTY, player.name);
    cat.setDynamicProperty(STATE_PROPERTY, "active");
    cat.nameTag = "Kitty Army";
    const tameable = cat.getComponent("minecraft:tameable");
    if (!tameable || !tameable.tame(player)) {
      cat.remove();
      return false;
    }
    cat.triggerEvent("kittie:activate");
    safeParticle(cat.dimension, { x: location.x, y: location.y + 0.45, z: location.z });
    return true;
  } catch (error) {
    console.warn(`[Kitty Army] Could not spawn cat ${ordinal}: ${error}`);
    return false;
  }
}

function summonArmy(player) {
  const ownerName = player.name;
  pendingSummons.add(ownerName);
  try {
    player.playSound("kittie.whistle_tone", { volume: 1.0, pitch: 1.0 });
  } catch {}
  safeParticle(player.dimension, { x: player.location.x, y: player.location.y + 1.1, z: player.location.z });
  safeSend(player, "message.kittie.army_called");

  let spawned = 0;
  for (let wave = 0; wave < ARMY_SIZE / CATS_PER_WAVE; wave++) {
    system.runTimeout(() => {
      if (!pendingSummons.has(ownerName) || !player.isValid) return;
      for (let index = 0; index < CATS_PER_WAVE; index++) {
        const ordinal = wave * CATS_PER_WAVE + index;
        if (spawnCat(player, ordinal)) spawned++;
      }
      if (wave === (ARMY_SIZE / CATS_PER_WAVE) - 1) {
        pendingSummons.delete(ownerName);
        if (spawned < ARMY_SIZE) {
          console.warn(`[Kitty Army] ${ownerName}: spawned ${spawned}/${ARMY_SIZE}; distant loaded terrain was limited.`);
        }
      }
    }, wave * WAVE_DELAY_TICKS);
  }
}

function numericProperty(entity, key, fallback) {
  try {
    const value = entity.getDynamicProperty(key);
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function retryStagger(entityId) {
  let hash = 0;
  for (let index = 0; index < entityId.length; index++) hash = (hash * 31 + entityId.charCodeAt(index)) >>> 0;
  return hash % 10;
}

function clearLegacyTransientProperties(cat) {
  for (const key of LEGACY_TRANSIENT_PROPERTIES) {
    try { cat.setDynamicProperty(key, undefined); } catch {}
  }
}

function beginDeparture(cat) {
  if (!cat?.isValid || stateOf(cat) === "departing") return;
  try {
    clearLegacyTransientProperties(cat);
    cat.setDynamicProperty(STATE_PROPERTY, "departing");
    cat.setDynamicProperty(DEPART_REMAINING_PROPERTY, DEPART_TIMEOUT_TICKS);
    cat.setDynamicProperty(DEPART_RETRY_COUNT_PROPERTY, 0);
    cat.triggerEvent("kittie:depart");
    outwardRoutes.update(cat, world.getPlayers().find((player) => player.name === ownerOf(cat)), system.currentTick, true);
    departureSamples.delete(cat.id);
    missingOwnerSamples.delete(cat.id);
  } catch {}
}

function restartFleeGoal(cat, sample) {
  // Legacy event/group names are retained for saved cats. The goal now chooses
  // independent running destinations; it does not require a player flee target.
  const retryCount = numericProperty(cat, DEPART_RETRY_COUNT_PROPERTY, 0);
  if (retryCount >= MAX_DEPART_RETRIES || pendingFleeRestarts.has(cat.id)) return false;

  let dimensionId;
  try {
    dimensionId = cat.dimension.id;
    cat.setDynamicProperty(DEPART_RETRY_COUNT_PROPERTY, retryCount + 1);
    cat.triggerEvent("kittie:restart_flee_off");
  } catch {
    return false;
  }
  sample.lastRetryTick = system.currentTick;
  pendingFleeRestarts.add(cat.id);
  system.runTimeout(() => {
    pendingFleeRestarts.delete(cat.id);
    try {
      if (!cat.isValid || stateOf(cat) !== "departing" || cat.dimension.id !== dimensionId) return;
      cat.triggerEvent("kittie:restart_flee_on");
    } catch {}
  }, 1);
  return true;
}

function observeDeparture(cat) {
  const id = cat.id;
  const dimensionId = cat.dimension.id;
  const location = cat.location;
  let sample = departureSamples.get(id);
  const isNewObservation = !sample || sample.dimensionId !== dimensionId || system.currentTick < sample.lastSeenTick;
  const elapsed = isNewObservation ? 0 : Math.max(0, system.currentTick - sample.lastSeenTick);
  let remaining = numericProperty(cat, DEPART_REMAINING_PROPERTY, DEPART_TIMEOUT_TICKS);
  remaining = Math.max(0, remaining - elapsed);
  try {
    cat.setDynamicProperty(DEPART_REMAINING_PROPERTY, remaining);
    if (numericProperty(cat, DEPART_RETRY_COUNT_PROPERTY, -1) < 0) {
      cat.setDynamicProperty(DEPART_RETRY_COUNT_PROPERTY, 0);
    }
  } catch {}

  if (isNewObservation) {
    sample = {
      dimensionId,
      lastSeenTick: system.currentTick,
      sampleTick: system.currentTick,
      location: { ...location },
      lastRetryTick: -1000000,
    };
    departureSamples.set(id, sample);
    try { cat.triggerEvent("kittie:restart_flee_on"); } catch {}
    return remaining;
  }

  sample.lastSeenTick = system.currentTick;
  const stagger = retryStagger(id);
  const sampleAge = system.currentTick - sample.sampleTick;
  const retryAge = system.currentTick - sample.lastRetryTick;
  if (sampleAge >= STALL_WINDOW_TICKS + stagger) {
    const moved = distanceSquared(location, sample.location);
    let eligible = false;
    try {
      eligible = cat.isOnGround && !cat.isInWater && !cat.isSwimming;
    } catch {}
    if (eligible && moved < STALL_DISTANCE_SQUARED && retryAge >= RETRY_COOLDOWN_TICKS + stagger) {
      restartFleeGoal(cat, sample);
    }
    sample.sampleTick = system.currentTick;
    sample.location = { ...location };
  }
  return remaining;
}

function observeMissingOwner(cat) {
  const id = cat.id;
  const dimensionId = cat.dimension.id;
  const sample = missingOwnerSamples.get(id);
  const isNewObservation = !sample || sample.dimensionId !== dimensionId || system.currentTick < sample.lastSeenTick;
  const elapsed = isNewObservation ? 0 : Math.max(0, system.currentTick - sample.lastSeenTick);
  let remaining = numericProperty(cat, OWNER_MISSING_REMAINING_PROPERTY, OWNER_GRACE_TICKS);
  remaining = Math.max(0, remaining - elapsed);
  try { cat.setDynamicProperty(OWNER_MISSING_REMAINING_PROPERTY, remaining); } catch {}
  missingOwnerSamples.set(id, { dimensionId, lastSeenTick: system.currentTick });
  return remaining;
}

function clearMissingOwnerGrace(cat) {
  missingOwnerSamples.delete(cat.id);
  try { cat.setDynamicProperty(OWNER_MISSING_REMAINING_PROPERTY, undefined); } catch {}
}

function pruneTransientTracking(seenIds) {
  for (const id of departureSamples.keys()) if (!seenIds.has(id)) departureSamples.delete(id);
  for (const id of missingOwnerSamples.keys()) if (!seenIds.has(id)) missingOwnerSamples.delete(id);
  for (const id of pendingFleeRestarts) if (!seenIds.has(id)) pendingFleeRestarts.delete(id);
}

function dismissArmy(player, cats) {
  pendingSummons.delete(player.name);
  try {
    player.playSound("kittie.whistle_tone", { volume: 1.0, pitch: 0.86 });
  } catch {}
  safeParticle(player.dimension, { x: player.location.x, y: player.location.y + 1.1, z: player.location.z });
  cats.forEach((cat) => beginDeparture(cat));
  safeSend(player, "message.kittie.army_dismissed");
}

function toggleArmy(player) {
  const previous = lastUseTick.get(player.name) ?? -1000;
  if (system.currentTick - previous < USE_GUARD_TICKS) return;
  lastUseTick.set(player.name, system.currentTick);

  const owned = catsFor(player.name);
  const active = owned.filter((cat) => stateOf(cat) === "active");
  if (active.length > 0 || pendingSummons.has(player.name)) {
    dismissArmy(player, active);
    return;
  }
  if (owned.length > 0) {
    safeSend(player, "message.kittie.army_departing");
    return;
  }
  summonArmy(player);
}

system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
  itemComponentRegistry.registerCustomComponent("kittie:toggle_army", {
    onUse({ source }) {
      if (source?.typeId !== "minecraft:player") return;
      system.run(() => toggleArmy(source));
    },
  });
});

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (initialSpawn) return;
  system.run(() => {
    const owned = catsFor(player.name);
    owned.forEach((cat) => beginDeparture(cat));
    pendingSummons.delete(player.name);
  });
});

system.runInterval(() => {
  const players = new Map(world.getPlayers().map((player) => [player.name, player]));
  const cats = allArmyCats();
  outwardRoutes.prune(cats);
  const seenIds = new Set(cats.map((cat) => cat.id));
  for (const cat of cats) {
    const ownerName = ownerOf(cat);
    const owner = ownerName ? players.get(ownerName) : undefined;
    if (stateOf(cat) !== "departing" && !ownerName) {
      beginDeparture(cat);
    }
    if (stateOf(cat) !== "departing" && ownerName && !owner) {
      if (observeMissingOwner(cat) <= 0) {
        beginDeparture(cat);
      }
    } else if (owner) {
      clearMissingOwnerGrace(cat);
      if (stateOf(cat) !== "departing" && cat.dimension.id !== owner.dimension.id) beginDeparture(cat);
    }

    if (stateOf(cat) !== "departing") continue;
    const remaining = observeDeparture(cat);
    outwardRoutes.update(cat, owner, system.currentTick);
    const farEnough = owner && cat.dimension.id === owner.dimension.id
      ? distanceSquared(cat.location, owner.location) >= DEPART_DISTANCE * DEPART_DISTANCE
      : false;
    if (farEnough || remaining <= 0) {
      const retryCount = numericProperty(cat, DEPART_RETRY_COUNT_PROPERTY, 0);
      const achievedDistance = owner && cat.dimension.id === owner.dimension.id
        ? Math.sqrt(distanceSquared(cat.location, owner.location)).toFixed(1)
        : "n/a";
      const context = !ownerName || !owner ? "owner_lost" : cat.dimension.id !== owner.dimension.id ? "dimension" : "timeout";
      const reason = farEnough ? "distance" : context;
      console.info(`[Kitty Army] departure cleanup reason=${reason} retries=${retryCount} distance=${achievedDistance}`);
      safeParticle(cat.dimension, { x: cat.location.x, y: cat.location.y + 0.4, z: cat.location.z });
      outwardRoutes.release(cat.id);
      departureSamples.delete(cat.id);
      missingOwnerSamples.delete(cat.id);
      pendingFleeRestarts.delete(cat.id);
      try { cat.remove(); } catch {}
    }
  }
  pruneTransientTracking(seenIds);
}, LIFECYCLE_INTERVAL_TICKS);
