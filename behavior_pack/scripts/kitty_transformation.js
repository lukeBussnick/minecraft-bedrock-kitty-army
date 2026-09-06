import { EquipmentSlot, system, world } from "@minecraft/server";

const COLLAR_ID = "kittie:kittie_collar";
const DARK_PUFF_ID = "kittie:kitty_transform_dark";
const SPARKLE_ID = "kittie:whistle_sparkle";
const observedForm = new Map();

function isCollarEquipped(player) {
  try {
    const equippable = player.getComponent("minecraft:equippable");
    return equippable?.getEquipment(EquipmentSlot.Head)?.typeId === COLLAR_ID;
  } catch {
    return false;
  }
}

function safeParticle(player, particleId, yOffset) {
  try {
    if (!player?.isValid) return;
    const { x, y, z } = player.location;
    player.dimension.spawnParticle(particleId, { x, y: y + yOffset, z });
  } catch {}
}

function emitDarkColumn(player) {
  safeParticle(player, DARK_PUFF_ID, 0.15);
  safeParticle(player, DARK_PUFF_ID, 0.75);
  safeParticle(player, DARK_PUFF_ID, 1.35);
}

function scheduleIfStill(player, expectedForm, delay, callback) {
  const playerId = player.id;
  const dimensionId = player.dimension.id;
  system.runTimeout(() => {
    if (!player?.isValid || player.id !== playerId || player.dimension.id !== dimensionId) return;
    if (isCollarEquipped(player) !== expectedForm) return;
    callback(player);
  }, delay);
}

function transformationEffects(player, becomingKitty) {
  emitDarkColumn(player);
  scheduleIfStill(player, becomingKitty, becomingKitty ? 7 : 2, emitDarkColumn);
  if (becomingKitty) {
    scheduleIfStill(player, true, 12, (current) => safeParticle(current, SPARKLE_ID, 0.5));
  }
}

export function pollKittyTransformations() {
  const present = new Set();
  for (const player of world.getPlayers()) {
    if (!player?.isValid) continue;
    present.add(player.id);
    const equipped = isCollarEquipped(player);
    if (!observedForm.has(player.id)) {
      observedForm.set(player.id, equipped);
      continue;
    }
    if (observedForm.get(player.id) === equipped) continue;
    observedForm.set(player.id, equipped);
    transformationEffects(player, equipped);
  }

  for (const id of observedForm.keys()) {
    if (!present.has(id)) observedForm.delete(id);
  }
}

system.runInterval(pollKittyTransformations, 2);
