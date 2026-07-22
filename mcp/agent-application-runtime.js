import Ajv2020 from "ajv/dist/2020.js";

import {
  APPLICATION_COMPONENT_CATALOG,
  APPLICATION_COMPONENT_CATALOG_DIGEST,
  APPLICATION_PLAN_SCHEMA_ID,
  APPLICATION_RESULT_SCHEMA_ID,
  APPLICATION_VALUE_SCHEMA,
  compileApplicationManifest,
  deepFreezeApplicationValue,
  digestApplicationValue,
  stableApplicationJson,
} from "../contracts/agent-application.schema.js";

export const AGENT_APPLICATION_TOOL_NAMES = Object.freeze({
  catalog: "knowgrph.application.catalog",
  plan: "knowgrph.application.plan",
  execute: "knowgrph.application.execute",
});
const CATALOG_RESULT_SCHEMA_ID = "knowgrph.application-catalog-result/v1";
const SHA256 = /^[0-9a-f]{64}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,128}$/;
const compareCodeUnits = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const valueValidator = new Ajv2020({ strict: false }).compile(APPLICATION_VALUE_SCHEMA);
const endpointKey = (endpoint) => `${endpoint.node}.${endpoint.port}`;
const publicPort = (port, kinds = port.kinds) => ({ name: port.name, schemaRef: port.schemaRef, schemaDigest: port.schemaDigest, kinds: [...kinds], ...(typeof port.required === "boolean" ? { required: port.required } : {}) });
const publicAdapter = (adapter) => ({
  id: adapter.id, revision: adapter.revision, interfaceId: adapter.interfaceId, interfaceRevision: adapter.interfaceRevision,
  implementationRevision: adapter.implementationRevision, implementationDigest: adapter.implementationDigest,
  ownerImplementationRevision: adapter.ownerImplementationRevision, ownerImplementationDigest: adapter.ownerImplementationDigest,
  supportedComponents: structuredClone(adapter.supportedComponents), supportedModes: [...adapter.supportedModes],
});
const fail = (code, message, extra = {}) => deepFreezeApplicationValue({ ok: false, error: { code, message }, ...extra });
const exactArgumentKeys = (args, keys) => args && typeof args === "object" && !Array.isArray(args) && Object.keys(args).length === keys.length && keys.every((key) => key in args);
const jsonBytes = (value) => Buffer.byteLength(stableApplicationJson(value));
const validateValue = (value, kinds) => {
  try { stableApplicationJson(value); } catch (error) { return error instanceof Error ? error.message : String(error); }
  if (!valueValidator(value)) return "Value does not satisfy knowgrph.application-value/v1.";
  if (!kinds.includes(value.kind)) return `Value kind ${value.kind} is outside the locked port kinds.`;
  if (value.kind === "text" && typeof value.value !== "string") return "Text values require a string payload.";
  if (["agent-plan", "artifact", "external-receipt"].includes(value.kind) && (!value.value || typeof value.value !== "object" || Array.isArray(value.value))) return `${value.kind} values require an object payload.`;
  return "";
};
const withDeadline = async (promise, deadlineAt) => {
  const remaining = deadlineAt - Date.now();
  if (remaining <= 0) throw Object.assign(new Error("Application runtime deadline was reached."), { code: "application_deadline_exceeded" });
  let timer;
  try {
    return await Promise.race([promise, new Promise((resolve, reject) => { timer = setTimeout(() => reject(Object.assign(new Error("Application runtime deadline was reached."), { code: "application_deadline_exceeded" })), remaining); timer.unref?.(); })]);
  } finally { clearTimeout(timer); }
};

export function createAgentApplicationRuntime({ adapterRegistry, executionLedger = new Map() } = {}) {
  if (!adapterRegistry || typeof adapterRegistry.resolve !== "function" || !SHA256.test(adapterRegistry.policyDigest) || typeof adapterRegistry.resolveNodeOwnerEvidence !== "function") throw new TypeError("Application runtime requires an exact host adapter registry.");
  if (!(executionLedger instanceof Map)) throw new TypeError("Application execution ledger must be Map-backed.");

  const catalog = () => {
    const components = [];
    for (const component of APPLICATION_COMPONENT_CATALOG.components) {
      const resolution = adapterRegistry.resolve(component);
      if (!resolution.ok) return fail(resolution.error.code, resolution.error.message);
      components.push({
        id: component.id, revision: component.revision, sourceDigest: component.source.sourceDigest, definitionDigest: component.definitionDigest,
        interfaceId: component.runtime.interfaceId, interfaceRevision: component.runtime.interfaceRevision,
        inputs: component.inputs.map((port) => publicPort(port)), outputs: component.outputs.map((port) => publicPort(port)),
        providedCapabilities: structuredClone(component.runtime.providedCapabilities), requiredCapabilities: structuredClone(component.runtime.requiredCapabilities),
        ownerId: component.runtime.ownerId, riskClass: component.runtime.riskClass, readiness: component.runtime.readiness,
        sideEffect: component.runtime.sideEffect, replay: component.runtime.replay, adapter: publicAdapter(resolution.adapter),
      });
    }
    return deepFreezeApplicationValue({ ok: true, schemaVersion: CATALOG_RESULT_SCHEMA_ID, catalogRevision: APPLICATION_COMPONENT_CATALOG.catalogRevision, catalogDigest: APPLICATION_COMPONENT_CATALOG_DIGEST, adapterPolicyDigest: adapterRegistry.policyDigest, components, integrations: structuredClone(adapterRegistry.integrations || []) });
  };

  const plan = (args = {}) => {
    if (!exactArgumentKeys(args, ["manifest"])) return fail("invalid_plan_input", "Plan accepts exactly one manifest object.");
    const compiled = compileApplicationManifest(args.manifest);
    if (!compiled.ok) return fail("application_manifest_invalid", "Application planning failed closed.", { diagnostics: compiled.diagnostics });
    if (compiled.manifest.runtimeProof.adapterPolicyDigest !== adapterRegistry.policyDigest) return fail("adapter_policy_drift", "runtimeProof.adapterPolicyDigest does not match the exact active adapter policy.");
    const nodes = [];
    for (const node of compiled.manifest.nodes) {
      const component = compiled.resolvedComponents[node.id];
      const resolution = adapterRegistry.resolve(component);
      if (!resolution.ok) return fail(resolution.error.code, resolution.error.message, { nodeId: node.id });
      const owner = adapterRegistry.resolveNodeOwnerEvidence(node, component, resolution.adapter);
      if (!owner.ok) return fail(owner.error?.code || "owner_evidence_unavailable", owner.error?.message || "Exact runtime owner evidence is unavailable.", { nodeId: node.id });
      nodes.push({
        id: node.id,
        component: { id: component.id, revision: component.revision, sourceDigest: component.source.sourceDigest, definitionDigest: component.definitionDigest, configSchemaDigest: component.configSchemaDigest },
        interfaceId: component.runtime.interfaceId, interfaceRevision: component.runtime.interfaceRevision,
        inputs: component.inputs.map((port) => publicPort(port)), outputs: component.outputs.map((port) => publicPort(port, compiled.effectiveOutputKinds[node.id][port.name])),
        providedCapabilities: structuredClone(component.runtime.providedCapabilities), requiredCapabilities: structuredClone(component.runtime.requiredCapabilities),
        ownerId: component.runtime.ownerId, riskClass: component.runtime.riskClass, readiness: component.runtime.readiness, sideEffect: component.runtime.sideEffect, replay: component.runtime.replay,
        ownerEvidence: structuredClone(owner.evidence), adapter: publicAdapter(resolution.adapter),
      });
    }
    const base = {
      schemaVersion: APPLICATION_PLAN_SCHEMA_ID, invocation: structuredClone(compiled.manifest.invocation), application: structuredClone(compiled.manifest.application), source: structuredClone(compiled.manifest.source),
      manifestDigest: compiled.manifestDigest, catalogDigest: compiled.catalogDigest, adapterPolicyDigest: adapterRegistry.policyDigest,
      nodes, edges: structuredClone(compiled.manifest.edges), entrypoints: structuredClone(compiled.manifest.entrypoints), outputs: structuredClone(compiled.manifest.outputs),
      executionOrder: [...compiled.executionOrder], bounds: structuredClone(compiled.manifest.bounds),
    };
    return deepFreezeApplicationValue({ ok: true, plan: { ...base, planDigest: digestApplicationValue(base) } });
  };

  const execute = async (args = {}) => {
    if (!exactArgumentKeys(args, ["manifest", "expectedPlanDigest", "idempotencyKey", "mode"])) return fail("invalid_execute_input", "Execute accepts exactly manifest, expectedPlanDigest, idempotencyKey, and mode.");
    if (!SHA256.test(args.expectedPlanDigest) || !IDEMPOTENCY_KEY.test(args.idempotencyKey) || !["dry-run", "live"].includes(args.mode)) return fail("invalid_execute_input", "Execute digest, idempotency key, or mode is invalid.");
    const planned = plan({ manifest: args.manifest });
    if (!planned.ok) return planned;
    if (planned.plan.planDigest !== args.expectedPlanDigest) return fail("application_plan_drift", "Expected plan digest does not match the exact current plan.", { actualPlanDigest: planned.plan.planDigest });
    const executionDigest = digestApplicationValue({ planDigest: planned.plan.planDigest, idempotencyKey: args.idempotencyKey, mode: args.mode });
    const prior = executionLedger.get(args.idempotencyKey);
    if (prior) {
      if (prior.executionDigest !== executionDigest) return fail("application_idempotency_conflict", "Idempotency key is already bound to another exact application execution.");
      if (prior.state === "completed") return deepFreezeApplicationValue({ ...structuredClone(prior.result), cached: true });
      return fail("application_execution_in_progress", "This exact application execution is already in progress.", { executionDigest });
    }
    executionLedger.set(args.idempotencyKey, deepFreezeApplicationValue({ executionDigest, state: "running" }));
    const compiled = compileApplicationManifest(args.manifest);
    const values = new Map();
    const steps = [];
    const startedAt = Date.now();
    const deadlineAt = startedAt + compiled.manifest.bounds.maxRuntimeMs;
    let outputBytes = 0;
    const finish = (result) => {
      const frozen = deepFreezeApplicationValue(result);
      executionLedger.set(args.idempotencyKey, deepFreezeApplicationValue({ executionDigest, state: "completed", result: frozen }));
      return frozen;
    };
    try {
      for (const [stepIndex, nodeId] of compiled.executionOrder.entries()) {
        if (stepIndex >= compiled.manifest.bounds.maxSteps) return finish(fail("application_step_bound_exceeded", "Application step bound was reached.", { executionDigest, steps }));
        const node = compiled.manifest.nodes.find((entry) => entry.id === nodeId);
        const component = compiled.resolvedComponents[nodeId];
        const resolution = adapterRegistry.resolve(component, args.mode);
        if (!resolution.ok) return finish(fail(resolution.error.code, resolution.error.message, { executionDigest, nodeId, steps }));
        const inputs = {};
        for (const port of component.inputs) {
          const edge = compiled.manifest.edges.find((entry) => entry.to.node === nodeId && entry.to.port === port.name);
          if (!edge) continue;
          const value = values.get(endpointKey(edge.from));
          const invalid = validateValue(value, port.kinds);
          if (invalid) return finish(fail("application_input_invalid", invalid, { executionDigest, nodeId, port: port.name, steps }));
          inputs[port.name] = structuredClone(value);
        }
        const adapterResult = await withDeadline(Promise.resolve(resolution.adapter.execute(deepFreezeApplicationValue({ node: structuredClone(node), inputs, mode: args.mode, planDigest: planned.plan.planDigest, idempotencyKey: args.idempotencyKey, deadlineAt }))), deadlineAt);
        try { outputBytes += jsonBytes(adapterResult); } catch { return finish(fail("adapter_result_not_json", "Runtime owner returned a non-JSON result.", { executionDigest, nodeId, steps })); }
        if (outputBytes > compiled.manifest.bounds.maxOutputBytes) return finish(fail("application_output_bound_exceeded", "Application output byte bound was reached.", { executionDigest, nodeId, steps }));
        if (!adapterResult || typeof adapterResult !== "object" || adapterResult.ok !== true || adapterResult.status !== "completed") {
          const code = typeof adapterResult?.error?.code === "string" ? adapterResult.error.code : "component_execution_blocked";
          const message = typeof adapterResult?.error?.message === "string" ? adapterResult.error.message.slice(0, 640) : "Runtime owner blocked component execution.";
          const status = adapterResult?.status === "approval_required" ? "approval_required" : "blocked";
          return finish(fail(code, message, { schemaVersion: APPLICATION_RESULT_SCHEMA_ID, status, planDigest: planned.plan.planDigest, executionDigest, idempotencyKey: args.idempotencyKey, mode: args.mode, failedNodeId: nodeId, steps, evidence: adapterResult?.evidence && typeof adapterResult.evidence === "object" ? structuredClone(adapterResult.evidence) : {} }));
        }
        const outputNames = Object.keys(adapterResult.outputs || {}).sort(compareCodeUnits);
        const expectedNames = component.outputs.map((port) => port.name).sort(compareCodeUnits);
        if (stableApplicationJson(outputNames) !== stableApplicationJson(expectedNames)) return finish(fail("component_outputs_invalid", "Runtime owner output ports differ from the exact component contract.", { executionDigest, nodeId, steps }));
        for (const port of component.outputs) {
          const value = adapterResult.outputs[port.name];
          const invalid = validateValue(value, compiled.effectiveOutputKinds[nodeId][port.name]);
          if (invalid) return finish(fail("component_output_invalid", invalid, { executionDigest, nodeId, port: port.name, steps }));
          values.set(`${nodeId}.${port.name}`, deepFreezeApplicationValue(structuredClone(value)));
        }
        steps.push(deepFreezeApplicationValue({ nodeId, status: "completed", ownerId: component.runtime.ownerId, adapterId: resolution.adapter.id, outputDigests: Object.fromEntries(component.outputs.map((port) => [port.name, digestApplicationValue(values.get(`${nodeId}.${port.name}`))])), evidence: adapterResult.evidence && typeof adapterResult.evidence === "object" ? structuredClone(adapterResult.evidence) : {} }));
      }
      const outputs = Object.fromEntries(compiled.manifest.outputs.map((output) => [output.name, structuredClone(values.get(`${output.node}.${output.port}`))]));
      const result = { ok: true, schemaVersion: APPLICATION_RESULT_SCHEMA_ID, status: "completed", planDigest: planned.plan.planDigest, executionDigest, idempotencyKey: args.idempotencyKey, mode: args.mode, steps, outputs, boundsEvidence: { steps: steps.length, runtimeMs: Date.now() - startedAt, outputBytes } };
      if (jsonBytes(result) > compiled.manifest.bounds.maxOutputBytes) return finish(fail("application_output_bound_exceeded", "Final application result exceeds its output byte bound.", { executionDigest, steps }));
      return finish(deepFreezeApplicationValue(result));
    } catch (error) {
      const code = error?.code === "application_deadline_exceeded" ? error.code : "component_execution_failed";
      const message = code === "application_deadline_exceeded" ? "Application runtime deadline was reached; no automatic retry was attempted." : "Runtime owner failed without exposing private details; no automatic retry was attempted.";
      return finish(fail(code, message, { schemaVersion: APPLICATION_RESULT_SCHEMA_ID, status: "blocked", planDigest: planned.plan.planDigest, executionDigest, idempotencyKey: args.idempotencyKey, mode: args.mode, steps }));
    }
  };

  const run = (toolName, args = {}) => {
    if (toolName === AGENT_APPLICATION_TOOL_NAMES.catalog) return catalog();
    if (toolName === AGENT_APPLICATION_TOOL_NAMES.plan) return plan(args);
    if (toolName === AGENT_APPLICATION_TOOL_NAMES.execute) return execute(args);
    throw new TypeError("Unknown application composition tool.");
  };
  return Object.freeze({ catalog, plan, execute, run });
}

export const isAgentApplicationToolName = (toolName) => Object.values(AGENT_APPLICATION_TOOL_NAMES).includes(toolName);
