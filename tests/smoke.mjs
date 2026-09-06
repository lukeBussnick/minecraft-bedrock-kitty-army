import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createOutwardRoutes } from "../behavior_pack/scripts/outward_routes.js";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "behavior_pack", "scripts", "main.js"), "utf8")
  .replace('import { system, world } from "@minecraft/server";\n', "")
  .replace('import "./kitty_transformation.js";\n', "")
  .replace('import { createOutwardRoutes } from "./outward_routes.js";\n', "");

assert.doesNotMatch(source, /applyImpulse|applyKnockback|clearVelocity|lookAt|\.teleport\s*\(/, "departure script must not control locomotion");

let nextEntityId = 1;
const catDefinition = JSON.parse(fs.readFileSync(path.join(root, "behavior_pack/entities/army_cat.json"), "utf8"))["minecraft:entity"];
class MockCat {
  constructor(dimension, location) {
    this.id = `cat-${nextEntityId++}`;
    this.dimension = dimension;
    this.location = { ...location };
    this.typeId = "kittie:army_cat";
    this.isValid = true;
    this.isOnGround = true;
    this.isInWater = false;
    this.isSwimming = false;
    this.properties = new Map();
    this.events = [];
    this.groups = new Set();
    this.tags = new Set();
  }
  setDynamicProperty(key, value) {
    if (value === undefined) this.properties.delete(key);
    else this.properties.set(key, value);
  }
  getDynamicProperty(key) { return this.properties.get(key); }
  addTag(tag) { this.tags.add(tag); }
  getComponent(id) {
    if (id !== "minecraft:tameable") return undefined;
    return { tame: (player) => { this.owner = player; return true; } };
  }
  triggerEvent(id) {
    this.events.push(id);
    const event = catDefinition.events[id];
    assert.ok(event, `unknown cat event: ${id}`);
    for (const group of event.remove?.component_groups ?? []) this.groups.delete(group);
    for (const group of event.add?.component_groups ?? []) this.groups.add(group);
  }
  effectiveComponents() {
    return Object.assign({}, catDefinition.components, ...[...this.groups].map((name) => catDefinition.component_groups[name]));
  }
  remove() { this.isValid = false; }
}

class MockDimension {
  constructor(id) {
    this.id = id;
    this.entities = [];
    this.particles = [];
  }
  isChunkLoaded() { return true; }
  getBlock({ y }) { return { isAir: y > 64, isSolid: y <= 64, isLiquid: false, typeId: y > 64 ? "minecraft:air" : "minecraft:stone" }; }
  spawnEntity(id, location) {
    assert.ok(["kittie:army_cat", "kittie:departure_waypoint"].includes(id));
    const cat = new MockCat(this, location);
    cat.typeId = id;
    this.entities.push(cat);
    return cat;
  }
  getEntities({ type }) {
    return this.entities.filter((entity) => entity.isValid && entity.typeId === type);
  }
  spawnParticle(id, location) { this.particles.push({ id, location }); }
}

class MockPlayer {
  constructor(name, dimension, x = 0) {
    this.name = name;
    this.typeId = "minecraft:player";
    this.dimension = dimension;
    this.location = { x, y: 65, z: 0 };
    this.isValid = true;
    this.messages = [];
    this.sounds = [];
  }
  sendMessage(message) { this.messages.push(message); }
  playSound(id, options) { this.sounds.push({ id, options }); }
}

const dimensions = new Map([
  ["overworld", new MockDimension("minecraft:overworld")],
  ["nether", new MockDimension("minecraft:nether")],
  ["the_end", new MockDimension("minecraft:the_end")],
]);
const players = [];
const logs = [];
let startup;
let playerSpawn;
let interval;
const scheduled = [];
const system = {
  currentTick: 0,
  beforeEvents: { startup: { subscribe: (callback) => { startup = callback; } } },
  run: (callback) => callback(),
  runTimeout: (callback, delay) => scheduled.push({ callback, at: system.currentTick + delay }),
  runInterval: (callback, ticks) => {
    assert.equal(ticks, 10, "lifecycle sweep should run every 10 ticks");
    interval = callback;
  },
};
const world = {
  getDimension: (id) => dimensions.get(id),
  getPlayers: () => players.filter((player) => player.isValid),
  afterEvents: { playerSpawn: { subscribe: (callback) => { playerSpawn = callback; } } },
};
const testConsole = {
  info: (message) => logs.push(message),
  warn: (message) => logs.push(message),
};

new Function("system", "world", "console", "createOutwardRoutes", source)(system, world, testConsole, createOutwardRoutes);
let whistleComponent;
startup({
  itemComponentRegistry: {
    registerCustomComponent(id, component) {
      assert.equal(id, "kittie:toggle_army");
      whistleComponent = component;
    },
  },
});

function runThrough(tick) {
  while (true) {
    scheduled.sort((a, b) => a.at - b.at);
    if (!scheduled.length || scheduled[0].at > tick) break;
    const task = scheduled.shift();
    system.currentTick = task.at;
    task.callback();
  }
  system.currentTick = tick;
}

function sweepAt(tick) {
  runThrough(tick);
  interval();
}

function sweepRange(first, last) {
  for (let tick = first; tick <= last; tick += 10) sweepAt(tick);
}

const overworld = dimensions.get("overworld");
const isabelle = new MockPlayer("Isabelle", overworld);
players.push(isabelle);

whistleComponent.onUse({ source: isabelle });
runThrough(40);
let cats = overworld.getEntities({ type: "kittie:army_cat" });
assert.equal(cats.length, 20, "first use should summon 20 cats");
assert.ok(cats.every((cat) => cat.owner === isabelle), "all cats should be tamed to the summoner");
assert.ok(cats.every((cat) => cat.getDynamicProperty("kittie:owner_name") === "Isabelle"));

system.currentTick = 60;
whistleComponent.onUse({ source: isabelle });
assert.ok(cats.every((cat) => cat.getDynamicProperty("kittie:state") === "departing"));
assert.ok(cats.every((cat) => cat.events.includes("kittie:depart")), "departure goal should activate immediately");
for (const cat of cats) {
  const effective = cat.effectiveComponents();
  const goal = effective["minecraft:behavior.follow_mob"];
  assert.ok(goal, "departure must supply a movement goal without a player threat target");
  assert.equal(effective["minecraft:behavior.random_stroll"], undefined, "departure cannot wander back toward the owner");
  assert.equal(goal.priority, 1);
  assert.equal(goal.speed_multiplier, 1.35, "scatter retains the existing bounded run speed");
  assert.equal(goal.search_range, 16);
  assert.equal(effective["minecraft:behavior.follow_owner"], undefined);
  assert.equal(effective["minecraft:behavior.ocelotattack"], undefined);
  assert.equal(effective["minecraft:behavior.avoid_mob_type"], undefined);
}
assert.ok(cats.every((cat) => cat.getDynamicProperty("kittie:depart_remaining") === 240));
assert.ok(cats.every((cat) => cat.getDynamicProperty("kittie:depart_retry_count") === 0));

sweepAt(70);
assert.ok(cats.every((cat) => cat.events.includes("kittie:restart_flee_on")), "first observation should reconcile an interrupted flee restart");
sweepRange(80, 120);
assert.ok(cats.every((cat) => cat.getDynamicProperty("kittie:depart_retry_count") === 1), "a grounded 50-tick stall should restart flee once");
assert.ok(cats.every((cat) => cat.getDynamicProperty("kittie:depart_remaining") === 190), "retry must not reset departure age");
runThrough(121);
assert.ok(cats.every((cat) => cat.effectiveComponents()["minecraft:behavior.follow_mob"]), "retry must restore the outward waypoint goal");
assert.ok(cats.every((cat) => cat.events.includes("kittie:restart_flee_off") && cat.events.filter((event) => event === "kittie:restart_flee_on").length >= 2));

sweepRange(130, 170);
runThrough(171);
assert.ok(cats.every((cat) => cat.getDynamicProperty("kittie:depart_retry_count") === 2), "a second stall may restart flee once more");
sweepRange(180, 230);
assert.ok(cats.every((cat) => cat.getDynamicProperty("kittie:depart_retry_count") === 2), "departure retries must remain capped at two");

for (const cat of cats) cat.location.x = isabelle.location.x + 31;
const particlesBeforeDistance = overworld.particles.length;
sweepAt(240);
assert.equal(overworld.getEntities({ type: "kittie:army_cat" }).length, 0, "cats should disappear after reaching departure distance");
assert.equal(overworld.particles.length - particlesBeforeDistance, 20, "distance cleanup should emit exactly one particle per cat");
assert.equal(logs.filter((line) => line.includes("reason=distance")).length, 20);

const orphan = overworld.spawnEntity("kittie:army_cat", { x: 0, y: 65, z: 0 });
sweepAt(250);
assert.equal(orphan.getDynamicProperty("kittie:state"), "departing", "ownerless cats should enter departure instead of being skipped");
sweepRange(260, 490);
assert.equal(orphan.isValid, false, "ownerless cats should receive finite loaded-time cleanup");
assert.ok(logs.some((line) => line.includes("reason=owner_lost")), "ownerless timeout should log its context");

system.currentTick = 510;
whistleComponent.onUse({ source: isabelle });
runThrough(550);
cats = overworld.getEntities({ type: "kittie:army_cat" });
system.currentTick = 570;
whistleComponent.onUse({ source: isabelle });
sweepAt(580);
sweepRange(590, 820);
assert.equal(overworld.getEntities({ type: "kittie:army_cat" }).length, 0, "same-dimension stalls must time out after 240 loaded ticks");
assert.equal(logs.filter((line) => line.includes("reason=timeout")).length, 20, "same-dimension recovery cleanup must be distinguishable from escape");

const interrupted = overworld.spawnEntity("kittie:army_cat", { x: 4, y: 65, z: 0 });
interrupted.setDynamicProperty("kittie:owner_name", "Isabelle");
interrupted.setDynamicProperty("kittie:state", "departing");
interrupted.setDynamicProperty("kittie:depart_remaining", 137);
interrupted.setDynamicProperty("kittie:depart_retry_count", 1);
interrupted.triggerEvent("kittie:restart_flee_off");
sweepAt(830);
assert.equal(interrupted.getDynamicProperty("kittie:depart_remaining"), 137, "first re-observation must not charge unloaded time");
assert.equal(interrupted.getDynamicProperty("kittie:depart_retry_count"), 1, "re-observation must preserve retry count");
assert.ok(interrupted.effectiveComponents()["minecraft:behavior.follow_mob"], "re-observation must restore an outward route");
interrupted.remove();
sweepAt(840);

const absentOwner = new MockPlayer("Absent", overworld, 10);
players.push(absentOwner);
system.currentTick = 850;
whistleComponent.onUse({ source: absentOwner });
runThrough(890);
const absentCats = overworld.getEntities({ type: "kittie:army_cat" });
absentOwner.isValid = false;
sweepAt(900);
sweepRange(910, 1490);
assert.ok(absentCats.every((cat) => cat.getDynamicProperty("kittie:state") === "active"), "missing-owner grace should retain active cats before 600 loaded ticks");
sweepAt(1500);
assert.ok(absentCats.every((cat) => cat.getDynamicProperty("kittie:state") === "departing"), "missing-owner grace should eventually begin departure");
assert.ok(absentCats.every((cat) => cat.getDynamicProperty("kittie:depart_remaining") === 240), "owner-loss departure should receive one finite budget");

isabelle.isValid = true;
const friend = new MockPlayer("Friend", overworld, 5);
players.push(friend);
system.currentTick = 1520;
whistleComponent.onUse({ source: isabelle });
whistleComponent.onUse({ source: friend });
runThrough(1560);
const independent = overworld.getEntities({ type: "kittie:army_cat" });
assert.equal(independent.filter((cat) => cat.getDynamicProperty("kittie:owner_name") === "Isabelle").length, 20);
assert.equal(independent.filter((cat) => cat.getDynamicProperty("kittie:owner_name") === "Friend").length, 20);
system.currentTick = 1580;
playerSpawn({ player: isabelle, initialSpawn: false });
assert.ok(independent.filter((cat) => cat.getDynamicProperty("kittie:owner_name") === "Isabelle").every((cat) => cat.getDynamicProperty("kittie:state") === "departing"));
assert.ok(independent.filter((cat) => cat.getDynamicProperty("kittie:owner_name") === "Friend").every((cat) => cat.getDynamicProperty("kittie:state") === "active"));

console.log("Smoke passed: 20-cat summon/ownership, native-only departure, bounded flee restarts, persisted loaded-time budgets, distance/timeout/ownerless cleanup, reload reconciliation, missing-owner grace, and independent armies.");
