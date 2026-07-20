import assert from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";

import { allocateEntity, createWorld, registerComponent, worldTick } from "../index.js";
import { snapshotWorld } from "../world.js";

const RUNS = 100;

function valueOf(world) {
  return snapshotWorld(world).entities[0].components.Counter.value;
}

function counterWorld(initialValue, systems) {
  const world = createWorld({ systems });
  registerComponent(world, "Counter", { value: "i32" });
  allocateEntity(world, {
    entityRef: "counter:property",
    components: { Counter: { value: initialValue } },
  });
  return world;
}

test("Property: failing-System writes roll back while earlier commits remain", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        initial: fc.integer({ min: -1_000_000, max: 1_000_000 }),
        committed: fc.integer({ min: -1_000_000, max: 1_000_000 }),
        partial: fc.integer({ min: -1_000_000, max: 1_000_000 }),
        skipped: fc.integer({ min: -1_000_000, max: 1_000_000 }),
      }),
      async ({ initial, committed, partial, skipped }) => {
        let laterRan = false;
        const world = counterWorld(initial, [
          (context) => context.write(0, "Counter", "value", committed),
          (context) => {
            context.write(0, "Counter", "value", partial);
            throw new Error("rollback");
          },
          (context) => {
            laterRan = true;
            context.write(0, "Counter", "value", skipped);
          },
        ]);

        const result = await worldTick(world, {});
        assert.equal(result.ok, false);
        assert.equal(valueOf(world), committed);
        assert.equal(laterRan, false);
      },
    ),
    { numRuns: RUNS },
  );
});

test("Property: identical state and input produce identical ordered writes", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        initial: fc.integer({ min: -100_000, max: 100_000 }),
        delta: fc.integer({ min: -100_000, max: 100_000 }),
        multiplier: fc.integer({ min: -10, max: 10 }),
      }),
      async ({ initial, delta, multiplier }) => {
        const systems = [
          (context, input) => {
            const current = context.read(0, "Counter", "value");
            context.write(0, "Counter", "value", current + input.delta);
          },
          (context, input) => {
            const current = context.read(0, "Counter", "value");
            context.write(0, "Counter", "value", current * input.multiplier);
          },
        ];
        const first = counterWorld(initial, systems);
        const second = counterWorld(initial, systems);
        const input = { delta, multiplier };

        const [firstResult, secondResult] = await Promise.all([
          worldTick(first, input),
          worldTick(second, input),
        ]);
        assert.deepEqual(firstResult, secondResult);
        assert.deepEqual(snapshotWorld(first), snapshotWorld(second));
      },
    ),
    { numRuns: RUNS },
  );
});
