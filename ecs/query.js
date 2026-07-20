import { hasComponent } from "./componentStore.js";
import {
  assertWorldReadable,
  getWorldComponentStore,
  listWorldEntityIds,
} from "./world.js";

function ecsError(code, message, details = {}) {
  const error = new Error(message);
  error.name = "EcsError";
  error.code = code;
  Object.assign(error, details);
  return error;
}

function queryWorld(world, componentNames) {
  if (!Array.isArray(componentNames)) {
    throw ecsError("ECS_INVALID_QUERY", "query component names must be an array");
  }

  const seen = new Set();
  const stores = [];
  for (const componentName of componentNames) {
    if (typeof componentName !== "string" || componentName.length === 0) {
      throw ecsError("ECS_INVALID_QUERY", "query component names must be non-empty strings");
    }
    if (seen.has(componentName)) continue;
    seen.add(componentName);
    stores.push(getWorldComponentStore(world, componentName));
  }

  // Entity allocation is monotonic, so this fresh intersection is both live
  // and already in strict ascending identifier order.
  return listWorldEntityIds(world).filter((entityId) =>
    stores.every((store) => hasComponent(store, entityId))
  );
}

export function query(world, componentNames) {
  assertWorldReadable(world);
  return queryWorld(world, componentNames);
}

// Systems execute under the tick's transaction boundary and need the live
// membership view. This integration seam is intentionally absent from the
// five-name public package surface.
export function queryDuringWorldTick(world, componentNames) {
  return queryWorld(world, componentNames);
}
