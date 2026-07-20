import assert from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";

import { allocateEntity, createWorld, query, registerComponent } from "../index.js";

const RUNS = 100;

test("Property: Query returns the live ascending component intersection", () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({ hasHealth: fc.boolean(), hasPosition: fc.boolean() }),
        { maxLength: 100 },
      ),
      (assignments) => {
        const world = createWorld();
        registerComponent(world, "Health", { value: "u16" });
        registerComponent(world, "Position", { x: "i32", y: "i32" });

        assignments.forEach((assignment, entityId) => {
          const components = {};
          if (assignment.hasHealth) components.Health = { value: entityId };
          if (assignment.hasPosition) components.Position = { x: entityId, y: -entityId };
          allocateEntity(world, { entityRef: `entity:${entityId}`, components });
        });

        const expected = assignments
          .map((assignment, entityId) => ({ assignment, entityId }))
          .filter(({ assignment }) => assignment.hasHealth && assignment.hasPosition)
          .map(({ entityId }) => entityId);
        assert.deepEqual(query(world, ["Health", "Position"]), expected);
        assert.deepEqual(
          query(world, ["Health", "Health", "Position", "Health", "Position"]),
          expected,
        );
        assert.deepEqual(query(world, []), assignments.map((_, entityId) => entityId));

        const appendedId = assignments.length;
        allocateEntity(world, {
          entityRef: `entity:${appendedId}`,
          components: {
            Health: { value: appendedId },
            Position: { x: appendedId, y: -appendedId },
          },
        });
        assert.deepEqual(query(world, ["Health", "Position"]), [...expected, appendedId]);
      },
    ),
    { numRuns: RUNS },
  );
});
