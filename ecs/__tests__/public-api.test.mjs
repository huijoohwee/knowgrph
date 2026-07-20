import assert from "node:assert/strict";
import { test } from "node:test";

import * as ecs from "../index.js";
import {
  COMPONENT_ABSENT,
  createComponentStore,
  readField,
  setComponentValues,
} from "../componentStore.js";
import { disposeWorld, snapshotWorld } from "../world.js";

test("the ECS barrel exports exactly the five bounded verbs", () => {
  assert.deepEqual(Object.keys(ecs).sort(), [
    "allocateEntity",
    "createWorld",
    "query",
    "registerComponent",
    "worldTick",
  ]);
});

test("World state is opaque and entity allocation is monotonic", () => {
  const world = ecs.createWorld();
  assert.equal(Object.isFrozen(world), true);
  assert.deepEqual(Object.keys(world), []);

  ecs.registerComponent(world, "Position", { x: "f32", y: "f32" });
  assert.equal(
    ecs.allocateEntity(world, {
      entityRef: "npc:first",
      components: { Position: { x: 1.25, y: -2.5 } },
    }),
    0,
  );
  assert.equal(
    ecs.allocateEntity(world, {
      entityRef: "npc:second",
      components: { Position: { x: 8, y: 13 } },
    }),
    1,
  );
  assert.deepEqual(ecs.query(world, ["Position"]), [0, 1]);
});

test("invalid allocation attaches nothing and consumes no entity id", () => {
  const world = ecs.createWorld();
  ecs.registerComponent(world, "Position", { x: "i32", y: "i32" });

  assert.throws(
    () => ecs.allocateEntity(world, {
      entityRef: "npc:invalid",
      components: { Position: { x: 7 } },
    }),
    (error) => error.code === "ECS_COMPONENT_FIELD_MISMATCH",
  );
  assert.deepEqual(ecs.query(world, ["Position"]), []);

  const id = ecs.allocateEntity(world, {
    entityRef: "npc:valid",
    components: { Position: { x: 7, y: 9 } },
  });
  assert.equal(id, 0);
  assert.deepEqual(snapshotWorld(world).entities, [
    {
      entityId: 0,
      entityRef: "npc:valid",
      components: { Position: { x: 7, y: 9 } },
    },
  ]);
});

test("component registration rejects unsupported schemas without partial registration", () => {
  const world = ecs.createWorld();
  assert.throws(
    () => ecs.registerComponent(world, "Velocity", { x: "decimal128" }),
    (error) => error.code === "ECS_UNSUPPORTED_COMPONENT_FIELD_TYPE",
  );

  // The same name remains available because the failed registration was atomic.
  ecs.registerComponent(world, "Velocity", { x: "f64" });
  assert.equal(
    ecs.allocateEntity(world, {
      entityRef: "projectile:one",
      components: { Velocity: { x: 0.5 } },
    }),
    0,
  );
});

test("all supported field types map to one matching typed array per field", () => {
  const typeCases = {
    f32: Float32Array,
    f64: Float64Array,
    i8: Int8Array,
    i16: Int16Array,
    i32: Int32Array,
    u8: Uint8Array,
    u16: Uint16Array,
    u32: Uint32Array,
  };
  const store = createComponentStore(
    Object.fromEntries(Object.keys(typeCases).map((type) => [`field_${type}`, type])),
  );

  for (const [type, Constructor] of Object.entries(typeCases)) {
    assert.equal(store.fields[`field_${type}`] instanceof Constructor, true);
  }
  assert.equal(Object.keys(store.fields).length, Object.keys(typeCases).length);
});

test("COMPONENT_ABSENT is unique and distinct from zero and NaN", () => {
  const store = createComponentStore({ value: "f64" });
  assert.equal(readField(store, 4, "value"), COMPONENT_ABSENT);

  setComponentValues(store, 4, { value: Number.NaN });
  assert.equal(Number.isNaN(readField(store, 4, "value")), true);
  assert.notEqual(readField(store, 4, "value"), COMPONENT_ABSENT);

  setComponentValues(store, 5, { value: 0 });
  assert.equal(readField(store, 5, "value"), 0);
  assert.notEqual(readField(store, 5, "value"), COMPONENT_ABSENT);
});

test("f32 values cannot silently overflow their typed-array representation", () => {
  const store = createComponentStore({ value: "f32" });
  assert.throws(
    () => setComponentValues(store, 0, { value: Number.MAX_VALUE }),
    (error) => error.code === "ECS_UNREPRESENTABLE_COMPONENT_VALUE",
  );
  assert.equal(readField(store, 0, "value"), COMPONENT_ABSENT);
});

test("disposing a World releases its private state and fails closed", () => {
  const world = ecs.createWorld();
  assert.equal(disposeWorld(world), true);
  assert.equal(disposeWorld(world), false);
  assert.throws(
    () => ecs.query(world, []),
    (error) => error.code === "ECS_INVALID_WORLD",
  );
});
