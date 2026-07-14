import assert from "node:assert/strict";
import test from "node:test";

import {
  AGENT_DEFINITION_REGISTRY,
  compileAgentRun,
  executeAgentRun,
  listAgentDefinitions,
  resolveAgentDefinition,
  validateAgentDefinitionRegistry,
} from "../agent-runtime.schema.js";

test("registry exposes the four exact agent invocations without broad aliases", () => {
  assert.deepEqual(
    listAgentDefinitions().map((definition) => definition.invocation),
    ["/investment-research-agent", "/pmf-agent", "/sme-care-agent", "/video-agent"],
  );
  assert.equal(resolveAgentDefinition("/research-agent"), null);
  assert.equal(resolveAgentDefinition("/care-agent"), null);
  assert.equal(resolveAgentDefinition("/sme-agent"), null);
  assert.equal(resolveAgentDefinition("/product-market-fit-agent"), null);
});

test("PMF Agent compiles as an evidence-led bounded agent", () => {
  const result = compileAgentRun({ invocation: "/pmf-agent", brief: "Evaluate the active product evidence.", mode: "dry-run", runId: "pmf-contract" });
  assert.equal(result.ok, true);
  assert.equal(result.payload.agentDefinitionId, "agent.pmf");
  assert.equal(result.payload.status, "planned");
  assert.ok(result.payload.promptContract.some(line => line.includes("problem-to-solution gaps")));
  assert.equal(result.payload.budgetMeters.paidProviderCalls, 0);
});

test("SME Care compiles the internal SME risk skill through the shared public invocation", () => {
  const result = compileAgentRun({ invocation: "/sme-care-agent", brief: "Assess a typed SME profile.", mode: "dry-run", runId: "sme-contract" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.payload.plan.skill, {
    variant: "agent.sme",
    id: "sme.risk.profile",
    inputSchemaRef: "knowgrph-sme-profile/v1",
    outputSchemaRef: "knowgrph-sme-risk-run/v1",
    runtimeKernel: "sme.risk.profile",
  });
  assert.equal(result.payload.plan.topology.pattern, "fan-out/fan-in");
  assert.equal(result.payload.plan.topology.maxIterations, 1);
  assert.equal(result.payload.plan.bounds.maxWallSeconds, 300);
  assert.equal(result.payload.plan.bounds.tokenBudget, 100000);
});

test("every registered agent compiles through the same deterministic zero-spend kernel", () => {
  for (const definition of listAgentDefinitions()) {
    const result = compileAgentRun({
      agentDefinitionId: definition.id,
      brief: `Exercise ${definition.id}`,
      mode: "dry-run",
      runId: `proof-${definition.id}`,
    });
    assert.equal(result.ok, true);
    assert.equal(result.payload.status, "planned");
    assert.equal(result.payload.plan.profileId, definition.planProfile);
    assert.equal(result.payload.budgetMeters.paidProviderCalls, 0);
    assert.ok(result.payload.plan.tasks.length > 0);
  }
});

test("a future agent is added by one definition that reuses an existing profile", () => {
  const fixture = structuredClone(AGENT_DEFINITION_REGISTRY);
  fixture.agents.push({
    ...structuredClone(fixture.agents[0]),
    id: "agent.future-domain",
    title: "Future Domain Agent",
  });
  assert.deepEqual(validateAgentDefinitionRegistry(fixture), { valid: true, errors: [] });
});

test("unknown agents fail with a typed validation error", () => {
  const result = compileAgentRun({ agentDefinitionId: "agent.unknown", brief: "test" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "invalid_agent_run_input");
});

test("live execution requires approval and an adapter", async () => {
  const input = {
    invocation: "/sme-care-agent",
    brief: "Assess the protection gap.",
    mode: "live",
    runId: "live-proof",
  };
  const withheld = await executeAgentRun(input);
  assert.equal(withheld.payload.status, "approval_required");
  assert.equal(withheld.payload.budgetMeters.paidProviderCalls, 0);

  const blocked = await executeAgentRun({ ...input, approvals: ["paid-model-call"] });
  assert.equal(blocked.payload.status, "blocked");
  assert.equal(blocked.payload.error.code, "execution_adapter_unavailable");

  const completed = await executeAgentRun(
    { ...input, approvals: ["paid-model-call"] },
    { adapter: { execute: async () => ({ text: "review-ready result" }) } },
  );
  assert.equal(completed.ok, true);
  assert.equal(completed.payload.status, "completed");
  assert.equal(completed.payload.result.text, "review-ready result");
});
