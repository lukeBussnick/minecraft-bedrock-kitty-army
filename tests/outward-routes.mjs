import assert from "node:assert/strict";
import fs from "node:fs";
import { chooseOutwardWaypoint, traceDryRoute, createOutwardRoutes, ROUTE_SLOTS, MARKER_ID } from "../behavior_pack/scripts/outward_routes.js";

const air = { isAir: true, isSolid: false, isLiquid: false, typeId: "minecraft:air" };
const stone = { isAir: false, isSolid: true, isLiquid: false, typeId: "minecraft:stone" };
const water = { isAir: false, isSolid: false, isLiquid: true, typeId: "minecraft:water" };
const terrain = (height = () => 64, liquid = () => false) => ({ getBlock(p) {
  if (liquid(p) && p.y <= 64) return water;
  return p.y <= height(p) ? stone : air;
} });
const origin = { x: 0, y: 65, z: 0 };
const start = { x: 4.5, y: 65.05, z: .5 };
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const flat = terrain();
for (let i = 0; i < 20; i++) {
  const angle = i * Math.PI / 10;
  const pos = { x: Math.cos(angle) * 5, y: 65.05, z: Math.sin(angle) * 5 };
  const target = chooseOutwardWaypoint(flat, pos, origin, angle);
  assert.ok(target && distance(target, origin) > distance(pos, origin) + 7);
  assert.ok((target.x - pos.x) * pos.x + (target.z - pos.z) * pos.z > 0);
}
const lake = terrain(() => 64, (p) => p.x >= 8);
const shore = chooseOutwardWaypoint(lake, start, origin, 0);
assert.ok(shore && shore.x < 7.7 && Math.abs(shore.z - start.z) > 3, "shoreline should select an outward side route before water");
assert.ok(distance(shore, origin) > distance(start, origin));
assert.ok(distance(traceDryRoute(lake, start, shore, origin), shore) < .01);
const stairs = terrain((p) => 64 + Math.min(3, Math.max(0, Math.floor((p.x - 5) / 2))));
const up = chooseOutwardWaypoint(stairs, start, origin, 0);
assert.ok(up && up.y > start.y + 2, "successive one-block steps remain traversable");
const wall = terrain((p) => p.x >= 8 ? 67 : 64);
const around = chooseOutwardWaypoint(wall, start, origin, 0);
assert.ok(around && around.x < 7.7 && Math.abs(around.z - start.z) > 3, "high wall should produce a side route, not a jump over it");
const enclosed = terrain((p) => Math.abs(p.x - 4) <= 1 && Math.abs(p.z) <= 1 ? 64 : 68);
assert.equal(chooseOutwardWaypoint(enclosed, start, origin, 0), undefined);
assert.equal(chooseOutwardWaypoint({ getBlock() { throw Error("unloaded"); } }, start, origin, 0), undefined);
const lava = { getBlock(p) { return p.y <= 64 ? { ...water, typeId: "minecraft:lava" } : air; } };
assert.equal(chooseOutwardWaypoint(lava, start, origin, 0), undefined);

const definition = JSON.parse(fs.readFileSync(new URL("../behavior_pack/entities/army_cat.json", import.meta.url)))["minecraft:entity"];
for (let i = 0; i < ROUTE_SLOTS; i++) {
  const name = `kittie:route_${i}`;
  const goal = definition.component_groups[name]["minecraft:behavior.follow_mob"];
  assert.equal(goal.filters.all_of[1].value, `kittie_route_${i}`);
  assert.equal(goal.speed_multiplier, 1.35);
  assert.deepEqual(definition.events[name].add.component_groups, [name]);
  assert.equal(definition.events[name].remove.component_groups.length, ROUTE_SLOTS);
  assert.ok(definition.events["kittie:activate"].remove.component_groups.includes(name));
}

// Actual route service, with native movement intentionally not simulated.
let nextId = 0;
const markers = [];
const dimension = { ...flat, id: "minecraft:overworld", getEntities: () => markers.filter((m) => m.isValid), spawnEntity(type, location) {
  assert.equal(type, MARKER_ID);
  const marker = { id: `marker-${nextId++}`, isValid: true, location, tags: [], addTag(t) { this.tags.push(t); }, setDynamicProperty() {}, remove() { this.isValid = false; } };
  markers.push(marker);
  return marker;
} };
const routes = createOutwardRoutes({ getDimension: (name) => name === "overworld" ? dimension : { getEntities: () => [] } });
const cats = Array.from({ length: 4 }, (_, i) => {
  const props = new Map([["kittie:state", "departing"]]);
  return { id: `cat-${i}`, isValid: true, dimension, location: { ...start, z: i + .5 }, events: [],
    getDynamicProperty: (key) => props.get(key), setDynamicProperty: (key, value) => props.set(key, value), triggerEvent(name) { this.events.push(name); } };
});
const owner = { dimension, location: origin };
for (const cat of cats) routes.update(cat, owner, 0);
assert.equal(markers.filter((m) => m.isValid).length, 4);
assert.equal(new Set(markers.flatMap((m) => m.tags)).size, 4, "cats must not share waypoint channels");
const first = markers[0];
routes.update(cats[0], owner, 10);
assert.equal(first.isValid, true, "do not reroll a clear route every sweep");
cats[0].location = { ...first.location };
routes.update(cats[0], owner, 20);
assert.equal(first.isValid, false, "replace reached waypoint with a farther destination");
assert.equal(markers.filter((m) => m.isValid).length, 4);
routes.release(cats[0].id);
assert.equal(markers.filter((m) => m.isValid).length, 3);
routes.prune([]);
assert.equal(markers.filter((m) => m.isValid).length, 0, "no orphan markers after cats disappear");
assert.doesNotMatch(fs.readFileSync(new URL("../behavior_pack/scripts/main.js", import.meta.url), "utf8"), /safeSend\(player, "message\.kittie\.army_partial"\)/);
console.log("Outward routes passed: radial progress, dry shoreline detours, steps/walls, blocked/unloaded/hazard rejection, isolated channels, stable destinations and marker cleanup. Native movement remains a runtime test.");
