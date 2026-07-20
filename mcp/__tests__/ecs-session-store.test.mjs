import assert from "node:assert/strict";
import { test } from "node:test";

import { createEcsSessionStore } from "../ecs-session-store.js";

test("the bounded store lazily expires and abandons sessions without persistence", () => {
  let currentTime = 1_000;
  let allocatedId = 0;
  const disposed = [];
  const store = createEcsSessionStore({
    ttlMs: 10,
    maxSessions: 1,
    now: () => currentTime,
    idFactory: () => `session-${allocatedId += 1}`,
    onDispose: (session, reason) => disposed.push({ session, reason }),
  });
  const firstSession = { world: "first" };
  const first = store.create(firstSession);
  assert.equal(first.ok, true);
  assert.equal(store.size(), 1);

  const capacity = store.create({ world: "second" });
  assert.equal(capacity.errorCode, "ECS_SESSION_CAPACITY_REACHED");

  currentTime += 11;
  const expired = store.get(first.sessionId);
  assert.equal(expired.errorCode, "ECS_SESSION_EXPIRED");
  assert.equal(store.size(), 0);
  assert.deepEqual(disposed, [{ session: firstSession, reason: "expired" }]);

  const second = store.create({ world: "second" });
  assert.equal(second.ok, true);
  assert.equal(store.close(second.sessionId).ok, true);
  assert.equal(store.size(), 0);
});

test("the default session id factory returns opaque UUIDv4 identifiers", () => {
  const store = createEcsSessionStore();
  const created = store.create({ world: "uuid-proof" });
  assert.equal(created.ok, true);
  assert.match(
    created.sessionId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.equal(store.close(created.sessionId).ok, true);
});
