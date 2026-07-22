import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { compileAgentRun } from "../contracts/agent-runtime.schema.js";
import {
  APPLICATION_ADAPTER_INTERFACE_ID,
  APPLICATION_ADAPTER_INTERFACE_REVISION,
  deepFreezeApplicationValue,
  digestApplicationValue,
  stableApplicationJson,
} from "../contracts/agent-application.schema.js";
import { computeExternalToolActionDigest } from "./external-tool-approval.js";

export const APPLICATION_ADAPTER_POLICY_SCHEMA_ID = "knowgrph.application-adapter-policy/v1";
const ADAPTER_REVISION = "1.0.0";
const MODULE_SOURCE_DIGEST = digestApplicationValue(readFileSync(fileURLToPath(import.meta.url), "utf8"));
const ADAPTER_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const EXACT_REVISION = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const compareCodeUnits = (left, right) => left < right ? -1 : left > right ? 1 : 0;

export const buildIntegrationProfileId = (profile) => `kgip_${digestApplicationValue({ id: profile.id }).slice(0, 32)}`;
export const buildIntegrationProfileRevision = (profile) => digestApplicationValue(profile);
export const projectApplicationIntegrations = (registry) => deepFreezeApplicationValue(registry.capabilities.map((capability) => ({
  integrationProfileId: buildIntegrationProfileId(capability.profile),
  integrationProfileRevision: buildIntegrationProfileRevision(capability.profile),
  capabilityId: capability.capabilityId,
  capabilityRevision: capability.capabilityRevision,
  artifactKind: capability.artifactKind,
  approvalRequired: true,
  replay: capability.tool.idempotencyArgumentName ? "idempotency-key" : "unsupported",
})).sort((left, right) => compareCodeUnits(left.capabilityId, right.capabilityId)));

const normalizeCapabilityList = (capabilities, adapterId) => {
  if (!Array.isArray(capabilities) || !capabilities.length) throw new TypeError(`Adapter ${adapterId} requires capabilities.`);
  const normalized = capabilities.map((capability) => {
    if (!capability || typeof capability !== "object" || !ADAPTER_ID.test(capability.id) || !ADAPTER_ID.test(capability.revision)) throw new TypeError(`Adapter ${adapterId} has an invalid capability.`);
    return { id: capability.id, revision: capability.revision };
  }).sort((left, right) => compareCodeUnits(left.id, right.id) || compareCodeUnits(left.revision, right.revision));
  if (new Set(normalized.map((capability) => `${capability.id}@${capability.revision}`)).size !== normalized.length) throw new TypeError(`Adapter ${adapterId} has duplicate capabilities.`);
  return normalized;
};
const normalizeAdapter = (adapter) => {
  const keys = ["id", "revision", "adapterKind", "interfaceId", "interfaceRevision", "implementationRevision", "implementationDigest", "ownerId", "capabilities", "sideEffect", "replay", "execute"];
  if (!adapter || typeof adapter !== "object" || Object.keys(adapter).some((key) => !keys.includes(key)) || keys.some((key) => !(key in adapter))) throw new TypeError("Application adapters must use the exact descriptor contract.");
  if (!ADAPTER_ID.test(adapter.id) || !EXACT_REVISION.test(adapter.revision) || !ADAPTER_ID.test(adapter.adapterKind) || !ADAPTER_ID.test(adapter.ownerId)) throw new TypeError("Application adapter identity is invalid.");
  if (adapter.interfaceId !== APPLICATION_ADAPTER_INTERFACE_ID || adapter.interfaceRevision !== APPLICATION_ADAPTER_INTERFACE_REVISION) throw new TypeError(`Adapter ${adapter.id} uses an unsupported interface.`);
  if (!EXACT_REVISION.test(adapter.implementationRevision) || !/^[0-9a-f]{64}$/.test(adapter.implementationDigest)) throw new TypeError(`Adapter ${adapter.id} requires exact source-backed implementation evidence.`);
  if (!["none", "external-write"].includes(adapter.sideEffect) || !["safe", "idempotency-key"].includes(adapter.replay) || typeof adapter.execute !== "function") throw new TypeError(`Adapter ${adapter.id} has invalid execution metadata.`);
  const capabilities = normalizeCapabilityList(adapter.capabilities, adapter.id);
  const publicDescriptor = { id: adapter.id, revision: adapter.revision, adapterKind: adapter.adapterKind, interfaceId: adapter.interfaceId, interfaceRevision: adapter.interfaceRevision, implementationRevision: adapter.implementationRevision, implementationDigest: adapter.implementationDigest, ownerId: adapter.ownerId, capabilities, sideEffect: adapter.sideEffect, replay: adapter.replay };
  return deepFreezeApplicationValue({ ...publicDescriptor, execute: adapter.execute });
};
const capabilityKey = (capability) => `${capability.id}@${capability.revision}`;
const supportsComponent = (adapter, component) => {
  const available = new Set(adapter.capabilities.map(capabilityKey));
  return adapter.adapterKind === component.runtime.adapterKind
    && adapter.interfaceId === component.runtime.interfaceId
    && adapter.interfaceRevision === component.runtime.interfaceRevision
    && adapter.ownerId === component.runtime.ownerId
    && adapter.sideEffect === component.runtime.sideEffect
    && adapter.replay === component.runtime.replay
    && component.runtime.requiredCapabilities.every((capability) => available.has(capabilityKey(capability)));
};

export function createApplicationAdapterRegistry(adapters, { preference = [] } = {}) {
  if (!Array.isArray(adapters) || !adapters.length) throw new TypeError("Application adapter registry requires adapters.");
  const normalized = adapters.map(normalizeAdapter).sort((left, right) => compareCodeUnits(left.id, right.id));
  if (new Set(normalized.map((adapter) => adapter.id)).size !== normalized.length) throw new TypeError("Application adapter ids must be globally unique; register a new id for another revision.");
  if (!Array.isArray(preference) || new Set(preference).size !== preference.length || preference.some((id) => !normalized.some((adapter) => adapter.id === id))) throw new TypeError("Adapter preference must name unique registered adapter ids.");
  const policy = deepFreezeApplicationValue({ schemaVersion: APPLICATION_ADAPTER_POLICY_SCHEMA_ID, preference: [...preference], adapters: normalized.map(({ execute: ignored, ...descriptor }) => descriptor) });
  const resolve = (component) => {
    const candidates = normalized.filter((adapter) => supportsComponent(adapter, component));
    if (!candidates.length) return { ok: false, error: { code: "component_adapter_unavailable", message: `No exact host adapter owns ${component.id}@${component.revision}.` } };
    if (candidates.length === 1) return { ok: true, adapter: candidates[0] };
    const preferred = preference.map((id) => candidates.find((adapter) => adapter.id === id)).filter(Boolean);
    if (preferred.length !== 1) return { ok: false, error: { code: "component_adapter_ambiguous", message: `Host policy does not select exactly one adapter for ${component.id}@${component.revision}.` } };
    return { ok: true, adapter: preferred[0] };
  };
  return Object.freeze({ adapters: Object.freeze(normalized), policy, policyDigest: digestApplicationValue(policy), resolve });
}

const createDescriptor = (id, ownerId, capabilities, execute, { sideEffect = "none", replay = "safe" } = {}) => ({
  id: `knowgrph.${id}`, revision: ADAPTER_REVISION, adapterKind: id, interfaceId: APPLICATION_ADAPTER_INTERFACE_ID,
  interfaceRevision: APPLICATION_ADAPTER_INTERFACE_REVISION, implementationRevision: ADAPTER_REVISION,
  implementationDigest: digestApplicationValue({ moduleSourceDigest: MODULE_SOURCE_DIGEST, adapterKind: id, implementationRevision: ADAPTER_REVISION }),
  ownerId, capabilities, sideEffect, replay, execute,
});
const success = (outputs, evidence = {}) => ({ ok: true, status: "completed", outputs, evidence });
const failure = (code, message, status = "blocked", evidence = {}) => ({ ok: false, status, error: { code, message }, evidence });
const stringifyPromptValue = (input) => input.kind === "text" && typeof input.value === "string" ? input.value : stableApplicationJson(input.value);

export function createDefaultApplicationAdapterRegistry(options = {}) {
  const externalRegistry = options.externalRegistry;
  const externalGateway = options.externalGateway;
  if (!externalRegistry || !Array.isArray(externalRegistry.capabilities) || typeof externalRegistry.getCapability !== "function" || !externalGateway || typeof externalGateway.call !== "function") throw new TypeError("Application adapters require the existing host-owned external registry and gateway instance.");
  const integrations = projectApplicationIntegrations(externalRegistry);
  const resolveIntegration = (config) => {
    const capability = externalRegistry.getCapability(config.capabilityId);
    if (!capability || capability.capabilityRevision !== config.capabilityRevision) return { ok: false, error: failure("integration_capability_drift", "The exact integration capability is unavailable or changed.") };
    if (buildIntegrationProfileId(capability.profile) !== config.integrationProfileId || buildIntegrationProfileRevision(capability.profile) !== config.integrationProfileRevision) return { ok: false, error: failure("integration_profile_drift", "The opaque integration profile changed; replan explicitly.") };
    if (!capability.tool.idempotencyArgumentName) return { ok: false, error: failure("integration_not_replay_safe", "External application execution requires an upstream idempotency binding.") };
    return { ok: true, capability };
  };
  const adapters = [
    createDescriptor("core.input", "knowgrph.application-runtime", [{ id: "application.core.input", revision: "v1" }], async ({ node }) => success({ value: structuredClone(node.config.value) })),
    createDescriptor("prompt.template", "knowgrph.application-runtime", [{ id: "application.prompt.template", revision: "v1" }], async ({ node, inputs }) => {
      const rendered = node.config.template.split("{{input}}").join(stringifyPromptValue(inputs.input));
      return success({ prompt: { kind: "text", value: rendered } }, { renderer: "literal-token/v1" });
    }),
    createDescriptor("agent.registered", "knowgrph.agent-runtime", [{ id: "application.agent.plan", revision: "v1" }], async ({ node, inputs, planDigest }) => {
      const runId = `application-${digestApplicationValue({ planDigest, nodeId: node.id }).slice(0, 32)}`;
      const compiled = compileAgentRun({ agentDefinitionId: node.config.agentDefinitionId, brief: inputs.prompt.value, mode: "dry-run", runId }, { createRunId: () => runId });
      if (!compiled.ok || compiled.payload?.status !== "planned" || compiled.payload?.budgetMeters?.paidProviderCalls !== 0) return failure("agent_plan_blocked", "The registered agent owner could not produce a zero-call plan.");
      return success({ plan: { kind: "agent-plan", value: compiled.payload } }, { ownerContract: compiled.payload.contractVersion, paidProviderCalls: 0 });
    }),
    createDescriptor("integration.external-artifact", "knowgrph.external-tool-gateway", [{ id: "application.external-artifact", revision: "v1" }], async ({ node, inputs, mode, planDigest, idempotencyKey }) => {
      const resolved = resolveIntegration(node.config);
      if (!resolved.ok) return resolved.error;
      const nodeIdempotencyKey = `kgapp_${digestApplicationValue({ idempotencyKey, planDigest, nodeId: node.id })}`;
      if (mode !== "live") return success({ receipt: { kind: "external-receipt", value: { status: "planned", capabilityId: node.config.capabilityId, capabilityRevision: node.config.capabilityRevision, idempotencyKey: nodeIdempotencyKey } } }, { paidProviderCalls: 0, externalCalls: 0 });
      if (typeof options.resolveExternalApproval !== "function") return failure("approval_required", "Host authorization is required before external execution.", "approval_required");
      const callArgs = { capabilityId: node.config.capabilityId, capabilityRevision: node.config.capabilityRevision, artifact: inputs.artifact.value, idempotencyKey: nodeIdempotencyKey };
      const actionDigest = computeExternalToolActionDigest(callArgs);
      const approvalToken = await options.resolveExternalApproval({ actionDigest, planDigest, nodeId: node.id, integrationProfileId: node.config.integrationProfileId, capabilityId: node.config.capabilityId, capabilityRevision: node.config.capabilityRevision });
      if (!approvalToken) return failure("approval_required", "Host authorization is required before external execution.", "approval_required", { actionDigest });
      const result = await externalGateway.call({ ...callArgs, approvalToken });
      if (!result.ok) return failure(result.error?.code || "external_execution_failed", result.error?.message || "External owner blocked execution.", result.error?.code === "approval_required" ? "approval_required" : "blocked", result.actionDigest ? { actionDigest: result.actionDigest } : {});
      return success({ receipt: { kind: "external-receipt", value: result.receipt } }, { actionDigest: result.actionDigest, cached: result.cached === true });
    }, { sideEffect: "external-write", replay: "idempotency-key" }),
    createDescriptor("core.output", "knowgrph.application-runtime", [{ id: "application.core.output", revision: "v1" }], async ({ inputs }) => success({ result: structuredClone(inputs.value) })),
  ];
  const registry = createApplicationAdapterRegistry(adapters, { preference: adapters.map((adapter) => adapter.id) });
  return Object.freeze({ ...registry, integrations, externalRegistry, resolveIntegration });
}
