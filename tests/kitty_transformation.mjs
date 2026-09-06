import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "behavior_pack", "scripts", "kitty_transformation.js"), "utf8")
  .replace('import { EquipmentSlot, system, world } from "@minecraft/server";\n', "")
  .replace("export function pollKittyTransformations", "function pollKittyTransformations");

const scheduled = [];
let interval;
const system = {
  currentTick: 0,
  runTimeout(callback, delay) {
    scheduled.push({ callback, at: system.currentTick + delay });
  },
  runInterval(callback, delay) {
    assert.equal(delay, 2, "equipment polling must run every two ticks");
    interval = callback;
  },
};

class MockDimension {
  constructor(id) {
    this.id = id;
    this.particles = [];
  }
  spawnParticle(id, location) {
    this.particles.push({ id, location });
  }
}

class MockPlayer {
  constructor(id, dimension) {
    this.id = id;
    this.name = id;
    this.typeId = "minecraft:player";
    this.dimension = dimension;
    this.location = { x: 4, y: 70, z: -2 };
    this.isValid = true;
    this.head = undefined;
  }
  getComponent(id) {
    assert.equal(id, "minecraft:equippable");
    return { getEquipment: (slot) => {
      assert.equal(slot, EquipmentSlot.Head);
      return this.head;
    } };
  }
}

const EquipmentSlot = { Head: "Head" };
const players = [];
const world = { getPlayers: () => players.filter((player) => player.isValid) };
new Function("EquipmentSlot", "system", "world", source)(EquipmentSlot, system, world);

function runThrough(tick) {
  scheduled.sort((a, b) => a.at - b.at);
  while (scheduled.length && scheduled[0].at <= tick) {
    const task = scheduled.shift();
    system.currentTick = task.at;
    task.callback();
    scheduled.sort((a, b) => a.at - b.at);
  }
  system.currentTick = tick;
}

const overworld = new MockDimension("minecraft:overworld");
const isabelle = new MockPlayer("isabelle", overworld);
players.push(isabelle);

interval();
assert.equal(overworld.particles.length, 0, "first observation must seed state without effects");

isabelle.head = { typeId: "minecraft:diamond_helmet" };
interval();
assert.equal(overworld.particles.length, 0, "a non-collar helmet must not transform");

isabelle.head = { typeId: "kittie:kittie_collar" };
interval();
assert.equal(overworld.particles.filter((entry) => entry.id === "kittie:kitty_transform_dark").length, 3);

isabelle.head = undefined;
runThrough(5);
interval();
assert.equal(overworld.particles.filter((entry) => entry.id === "kittie:kitty_transform_dark").length, 6, "unequip must immediately emit a reverse puff");
runThrough(20);
assert.equal(overworld.particles.filter((entry) => entry.id === "kittie:whistle_sparkle").length, 0, "interrupted forward effects must not sparkle");

isabelle.head = { typeId: "kittie:kittie_collar" };
interval();
runThrough(32);
assert.equal(overworld.particles.filter((entry) => entry.id === "kittie:whistle_sparkle").length, 1, "settled equip must finish with one sparkle");

const friend = new MockPlayer("friend", overworld);
friend.head = { typeId: "kittie:kittie_collar" };
players.push(friend);
interval();
assert.equal(overworld.particles.filter((entry) => entry.id === "kittie:whistle_sparkle").length, 1, "late observed equipped players must not replay effects");

isabelle.isValid = false;
friend.head = undefined;
interval();
assert.equal(overworld.particles.filter((entry) => entry.id === "kittie:kitty_transform_dark").length, 18, "each player must keep independent equipment state");

console.log("Kitty transformation smoke passed: exact head-slot state, seed-without-replay, interruption cancellation, delayed sparkle, pruning, and independent players.");
