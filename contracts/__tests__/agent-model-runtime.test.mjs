import assert from "node:assert/strict";
import test from "node:test";

import {
  AGENT_MODEL_RUNTIME_SCHEMA,
  createRunningAgentAdapterRegistry,
  prepareAgentDefinition,
} from "../agent-model-runtime.js";
import { resolveAgentDefinition } from "../agent-runtime.schema.js";

const readyPacket = () => ({
  schemaVersion: AGENT_MODEL_RUNTIME_SCHEMA,
  provider: {
    id: "cloudflare-workers-ai",
    revision: "test/v1",
    adapterId: "cloudflare-workers-ai",
  },
  model: { id: "operator-selected-model", features: ["text"] },
  transport: { id: "test-binding", delivery: "complete", connection: "per-run" },
});

test("the SME Care definition prepares through an injected model resolver without executing a provider", async () => {
  let resolverCalls = 0;
  const result = await prepareAgentDefinition(resolveAgentDefinition("agent.sme-care"), {
    resolveModel: async ({ agent, requirements }) => {
      resolverCalls += 1;
      assert.deepEqual(agent, { id: "agent.sme-care", version: "1.1.0" });
      assert.deepEqual(requirements, {
        providerId: "cloudflare-workers-ai",
        features: ["text"],
        transport: { delivery: "complete", connection: "per-run" },
      });
      return { status: "ready", packet: readyPacket() };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(resolverCalls, 1);
  assert.equal(result.preparedAgent.modelRuntime.model.id, "operator-selected-model");
  assert.equal(Object.isFrozen(result.preparedAgent.modelRuntime.model), true);
  assert.match(result.preparedAgent.instructions.join("\n"), /licensed adviser handoff/);
});

test("an unprepared Agent Definition fails closed before model resolution", async () => {
  let resolverCalls = 0;
  const result = await prepareAgentDefinition(resolveAgentDefinition("agent.video"), {
    resolveModel: async () => {
      resolverCalls += 1;
      return { status: "ready", packet: readyPacket() };
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "agent_model_not_prepared");
  assert.equal(resolverCalls, 0);
});

test("model resolution must satisfy the prepared definition exactly", async () => {
  const definition = resolveAgentDefinition("agent.sme-care");
  const blocked = await prepareAgentDefinition(definition, {
    resolveModel: async () => ({ status: "blocked", reason: "operator_configuration_missing" }),
  });
  assert.equal(blocked.error.code, "model_resolution_blocked");
  assert.equal(blocked.error.reason, "operator_configuration_missing");

  const incompatible = await prepareAgentDefinition(definition, {
    resolveModel: async () => ({
      status: "ready",
      packet: {
        ...readyPacket(),
        transport: { id: "stream", delivery: "stream", connection: "session" },
      },
    }),
  });
  assert.equal(incompatible.error.code, "invalid_model_resolution");
});

test("running agent adapters resolve only by their registered exact identifier", () => {
  const adapter = { id: "cloudflare-workers-ai", execute: async () => ({ text: "ok" }) };
  const registry = createRunningAgentAdapterRegistry([adapter]);
  assert.deepEqual(registry.ids, ["cloudflare-workers-ai"]);
  assert.equal(registry.resolve("cloudflare-workers-ai"), adapter);
  assert.equal(registry.resolve("workers-ai"), null);
  assert.throws(
    () => createRunningAgentAdapterRegistry([adapter, adapter]),
    /duplicate running agent adapter/,
  );
});
