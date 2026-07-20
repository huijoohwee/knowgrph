import assert from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";

import {
  COMPONENT_ABSENT,
  createComponentStore,
  readField,
  setComponentValues,
} from "../componentStore.js";

const RUNS = 100;

const FIELD_CASES = Object.freeze({
  f32: { Constructor: Float32Array, arbitrary: fc.float({ noDefaultInfinity: false, noNaN: false }) },
  f64: { Constructor: Float64Array, arbitrary: fc.double({ noDefaultInfinity: false, noNaN: false }) },
  i8: { Constructor: Int8Array, arbitrary: fc.integer({ min: -128, max: 127 }) },
  i16: { Constructor: Int16Array, arbitrary: fc.integer({ min: -32768, max: 32767 }) },
  i32: { Constructor: Int32Array, arbitrary: fc.integer({ min: -2147483648, max: 2147483647 }) },
  u8: { Constructor: Uint8Array, arbitrary: fc.integer({ min: 0, max: 255 }) },
  u16: { Constructor: Uint16Array, arbitrary: fc.integer({ min: 0, max: 65535 }) },
  u32: { Constructor: Uint32Array, arbitrary: fc.integer({ min: 0, max: 4294967295 }) },
});

test("Property: all eight field types select their constructor and round-trip values", () => {
  const valueArbitrary = fc.record(
    Object.fromEntries(
      Object.entries(FIELD_CASES).map(([fieldType, fieldCase]) => [fieldType, fieldCase.arbitrary]),
    ),
  );

  fc.assert(
    fc.property(valueArbitrary, (values) => {
      const fieldSpec = Object.fromEntries(
        Object.keys(FIELD_CASES).map((fieldType) => [fieldType, fieldType]),
      );
      const store = createComponentStore(fieldSpec);
      setComponentValues(store, 0, values);

      for (const [fieldType, { Constructor }] of Object.entries(FIELD_CASES)) {
        assert.equal(store.fields[fieldType] instanceof Constructor, true, fieldType);
        assert.equal(Object.is(readField(store, 0, fieldType), values[fieldType]), true, fieldType);
      }
    }),
    { numRuns: RUNS },
  );
});

test("Property: geometric growth preserves every prior integer value", () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer({ min: -2147483648, max: 2147483647 }), {
        minLength: 1,
        maxLength: 80,
      }),
      (values) => {
        const store = createComponentStore({ value: "i32" });
        values.forEach((value, entityId) => {
          setComponentValues(store, entityId, { value });
        });

        values.forEach((value, entityId) => {
          assert.equal(readField(store, entityId, "value"), value);
        });
        assert.ok(store.fields.value.length >= values.length);
        assert.equal(store.fields.value.length, store.present.length);
      },
    ),
    { numRuns: RUNS },
  );
});

test("Property: absent reads never alias stored floating-point values", () => {
  fc.assert(
    fc.property(fc.double({ noDefaultInfinity: false, noNaN: false }), (value) => {
      const store = createComponentStore({ value: "f64" });
      assert.equal(readField(store, 1, "value"), COMPONENT_ABSENT);
      setComponentValues(store, 0, { value });
      const stored = readField(store, 0, "value");
      assert.notEqual(stored, COMPONENT_ABSENT);
      assert.equal(Object.is(stored, value), true);
      assert.equal(readField(store, 1, "value"), COMPONENT_ABSENT);
    }),
    { numRuns: RUNS },
  );
});

test("Property: out-of-range integer values are rejected without attaching", () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.integer({ max: -1 }),
        fc.integer({ min: 256, max: Number.MAX_SAFE_INTEGER }),
        fc.double().filter((value) => !Number.isInteger(value)),
      ),
      (value) => {
        const store = createComponentStore({ value: "u8" });
        assert.throws(
          () => setComponentValues(store, 0, { value }),
          (error) => error.code === "ECS_UNREPRESENTABLE_COMPONENT_VALUE",
        );
        assert.equal(readField(store, 0, "value"), COMPONENT_ABSENT);
      },
    ),
    { numRuns: RUNS },
  );
});
