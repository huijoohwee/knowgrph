import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { compileAgentRun, resolveAgentDefinition } from "../contracts/agent-runtime.schema.js";
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
const ADAPTER_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const EXACT_REVISION = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const SHA256 = /^[0-9a-f]{64}$/;
const compareCodeUnits = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const sourceDigest = (relativePaths) => digestApplicationValue(relativePaths.map((relativePath) => ({ relativePath, source: readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8") })));
const MODULE_SOURCE_DIGEST = sourceDigest(["./agent-application-adapter-registry.js"]);
const APPLICATION_OWNER_EVIDENCE = deepFreezeApplicationValue({ ownerId: "knowgrph.application-runtime", implementationRevision: ADAPTER_REVISION, implementationDigest: MODULE_SOURCE_DIGEST });
const AGENT_OWNER_EVIDENCE = deepFreezeApplicationValue({ ownerId: "knowgrph.agent-runtime", implementationRevision: ADAPTER_REVISION, implementationDigest: sourceDigest(["../contracts/agent-runtime.schema.js", "../data/config/agents/agent-definitions.json"]) });

const normalizeRefs = (entries, label, { revisions = false } = {}) => {
  if (!Array.isArray(entries) || !entries.length) throw new TypeError(`${label} must be a non-empty array.`);
  const normalized = entries.map((entry) => {
    if (!entry || typeof entry !== "object" || !ADAPTER_ID.test(entry.id) || !(revisions ? EXACT_REVISION : ADAPTER_ID).test(entry.revision)) throw new TypeError(`${label} contains an invalid exact reference.`);
    return { id: entry.id, revision: entry.revision };
  }).sort((left, right) => compareCodeUnits(left.id, right.id) || compareCodeUnits(left.revision, right.revision));
  if (new Set(normalized.map((entry) => `${entry.id}@${entry.revision}`)).size !== normalized.length) throw new TypeError(`${label} contains duplicate references.`);
  return normalized;
};
const normalizeAdapter = (adapter) => {
  const keys = ["id", "revision", "adapterKind", "interfaceId", "interfaceRevision", "implementationRevision", "implementationDigest", "ownerId", "ownerImplementationRevision", "ownerImplementationDigest", "supportedComponents", "supportedModes", "capabilities", "sideEffect", "replay", "execute"];
  if (!adapter || typeof adapter !== "object" || Object.keys(adapter).some((key) => !keys.includes(key)) || keys.some((key) => !(key in adapter))) throw new TypeError("Application adapters must use the exact descriptor contract.");
  if (!ADAPTER_ID.test(adapter.id) || !EXACT_REVISION.test(adapter.revision) || !ADAPTER_ID.test(adapter.adapterKind) || !ADAPTER_ID.test(adapter.ownerId)) throw new TypeError("Application adapter identity is invalid.");
  if (adapter.interfaceId !== APPLICATION_ADAPTER_INTERFACE_ID || adapter.interfaceRevision !== APPLICATION_ADAPTER_INTERFACE_REVISION) throw new TypeError(`Adapter ${adapter.id} uses an unsupported interface.`);
  for (const field of ["implementationRevision", "ownerImplementationRevision"]) if (!EXACT_REVISION.test(adapter[field])) throw new TypeError(`Adapter ${adapter.id}.${field} must be exact.`);
  for (const field of ["implementationDigest", "ownerImplementationDigest"]) if (!SHA256.test(adapter[field])) throw new TypeError(`Adapter ${adapter.id}.${field} must be SHA-256.`);
  if (!Array.isArray(adapter.supportedModes) || !adapter.supportedModes.length) throw new TypeError(`Adapter ${adapter.id} has invalid supported modes.`);
  const supportedModes = [...adapter.supportedModes].sort(compareCodeUnits);
  if (new Set(supportedModes).size !== supportedModes.length || supportedModes.some((mode) => !["dry-run", "live"].includes(mode))) throw new TypeError(`Adapter ${adapter.id} has invalid supported modes.`);
  if (!["none", "external-write"].includes(adapter.sideEffect) || !["safe", "idempotency-key"].includes(adapter.replay) || typeof adapter.execute !== "function") throw new TypeError(`Adapter ${adapter.id} has invalid execution metadata.`);
  const publicDescriptor = { ...adapter, capabilities: normalizeRefs(adapter.capabilities, `Adapter ${adapter.id} capabilities`), supportedComponents: normalizeRefs(adapter.supportedComponents, `Adapter ${adapter.id} supportedComponents`, { revisions: true }), supportedModes };
  delete publicDescriptor.execute;
  return deepFreezeApplicationValue({ ...publicDescriptor, execute: adapter.execute });
};
const refKey = (entry) => `${entry.id}@${entry.revision}`;
const supportsComponent = (adapter, component, mode) => {
  const available = new Set(adapter.capabilities.map(refKey));
  return adapter.supportedComponents.some((entry) => entry.id === component.id && entry.revision === component.revision)
    && (!mode || adapter.supportedModes.includes(mode)) && adapter.adapterKind === component.runtime.adapterKind
    && adapter.interfaceId === component.runtime.interfaceId && adapter.interfaceRevision === component.runtime.interfaceRevision
    && adapter.ownerId === component.runtime.ownerId && adapter.sideEffect === component.runtime.sideEffect && adapter.replay === component.runtime.replay
    && component.runtime.requiredCapabilities.every((capability) => available.has(refKey(capability)));
};

export function createApplicationAdapterRegistry(adapters, { preference = [] } = {}) {
  if (!Array.isArray(adapters) || !adapters.length) throw new TypeError("Application adapter registry requires adapters.");
  const normalized = adapters.map(normalizeAdapter).sort((left, right) => compareCodeUnits(left.id, right.id));
  if (new Set(normalized.map((adapter) => adapter.id)).size !== normalized.length) throw new TypeError("Application adapter ids must be globally unique; register a new id for another revision.");
  if (!Array.isArray(preference) || new Set(preference).size !== preference.length || preference.some((id) => !normalized.some((adapter) => adapter.id === id))) throw new TypeError("Adapter preference must name unique registered adapter ids.");
  const policy = deepFreezeApplicationValue({ schemaVersion: APPLICATION_ADAPTER_POLICY_SCHEMA_ID, preference: [...preference], adapters: normalized.map(({ execute: ignored, ...descriptor }) => descriptor) });
  const resolve = (component, mode) => {
    const candidates = normalized.filter((adapter) => supportsComponent(adapter, component, mode));
    if (!candidates.length) return { ok: false, error: { code: "component_adapter_unavailable", message: `No exact host adapter owns ${component.id}@${component.revision}${mode ? ` in ${mode} mode` : ""}.` } };
    if (candidates.length === 1) return { ok: true, adapter: candidates[0] };
    const preferred = preference.map((id) => candidates.find((adapter) => adapter.id === id)).filter(Boolean);
    if (preferred.length !== 1) return { ok: false, error: { code: "component_adapter_ambiguous", message: `Host policy does not select exactly one adapter for ${component.id}@${component.revision}.` } };
    return { ok: true, adapter: preferred[0] };
  };
  return Object.freeze({ adapters: Object.freeze(normalized), policy, policyDigest: digestApplicationValue(policy), resolve });
}

const createDescriptor = (id, ownerEvidence, capabilities, execute, { sideEffect = "none", replay = "safe" } = {}) => ({
  id: `knowgrph.${id}`, revision: ADAPTER_REVISION, adapterKind: id, interfaceId: APPLICATION_ADAPTER_INTERFACE_ID, interfaceRevision: APPLICATION_ADAPTER_INTERFACE_REVISION,
  implementationRevision: ADAPTER_REVISION, implementationDigest: digestApplicationValue({ moduleSourceDigest: MODULE_SOURCE_DIGEST, ownerEvidence, adapterKind: id, implementationRevision: ADAPTER_REVISION }),
  ownerId: ownerEvidence.ownerId, ownerImplementationRevision: ownerEvidence.implementationRevision, ownerImplementationDigest: ownerEvidence.implementationDigest,
  supportedComponents: [{ id, revision: "1.0.0" }], supportedModes: ["dry-run", "live"], capabilities, sideEffect, replay, execute,
});
const success = (outputs, evidence = {}) => ({ ok: true, status: "completed", outputs, evidence });
const failure = (code, message, status = "blocked", evidence = {}) => ({ ok: false, status, error: { code, message }, evidence });
const stringifyPromptValue = (input) => input.kind === "text" && typeof input.value === "string" ? input.value : stableApplicationJson(input.value);

export function createDefaultApplicationAdapterRegistry(options = {}) {
  const externalGateway = options.externalGateway;
  const gatewayEvidence = externalGateway?.ownerEvidence;
  if (!externalGateway || typeof externalGateway.call !== "function" || typeof externalGateway.listApplicationIntegrations !== "function" || typeof externalGateway.resolveApplicationIntegration !== "function") throw new TypeError("Application adapters require the existing host-owned external gateway instance.");
  if (!gatewayEvidence || gatewayEvidence.ownerId !== "knowgrph.external-tool-gateway" || !EXACT_REVISION.test(gatewayEvidence.implementationRevision) || !SHA256.test(gatewayEvidence.implementationDigest)) throw new TypeError("External gateway must expose exact owner implementation evidence.");
  const integrations = deepFreezeApplicationValue(structuredClone(externalGateway.listApplicationIntegrations()));
  const resolveIntegration = (config) => externalGateway.resolveApplicationIntegration(config);
  const adapters = [
    createDescriptor("core.input", APPLICATION_OWNER_EVIDENCE, [{ id: "application.core.input", revision: "v1" }], async ({ node }) => success({ value: structuredClone(node.config.value) })),
    createDescriptor("prompt.template", APPLICATION_OWNER_EVIDENCE, [{ id: "application.prompt.template", revision: "v1" }], async ({ node, inputs }) => success({ prompt: { kind: "text", value: node.config.template.split("{{input}}").join(stringifyPromptValue(inputs.input)) } }, { renderer: "literal-token/v1" })),
    createDescriptor("agent.registered", AGENT_OWNER_EVIDENCE, [{ id: "application.agent.plan", revision: "v1" }], async ({ node, inputs, planDigest }) => {
      const runId = `application-${digestApplicationValue({ planDigest, nodeId: node.id }).slice(0, 32)}`;
      const compiled = compileAgentRun({ agentDefinitionId: node.config.agentDefinitionId, brief: inputs.prompt.value, mode: "dry-run", runId }, { createRunId: () => runId });
      if (!compiled.ok || compiled.payload?.status !== "planned" || compiled.payload?.budgetMeters?.paidProviderCalls !== 0) return failure("agent_plan_blocked", "The registered agent owner could not produce a zero-call plan.");
      return success({ plan: { kind: "agent-plan", value: compiled.payload } }, { ownerContract: compiled.payload.contractVersion, paidProviderCalls: 0 });
    }),
    createDescriptor("integration.external-artifact", gatewayEvidence, [{ id: "application.external-artifact", revision: "v1" }], async ({ node, inputs, mode, planDigest, idempotencyKey }) => {
      const resolved = resolveIntegration(node.config);
      if (!resolved.ok) return failure(resolved.error?.code || "integration_capability_drift", resolved.error?.message || "The exact integration binding is unavailable.");
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
    createDescriptor("core.output", APPLICATION_OWNER_EVIDENCE, [{ id: "application.core.output", revision: "v1" }], async ({ inputs }) => success({ result: structuredClone(inputs.value) })),
  ];
  const registry = createApplicationAdapterRegistry(adapters, { preference: adapters.map((adapter) => adapter.id) });
  const resolveNodeOwnerEvidence = (node, component, adapter) => {
    if (component.id === "agent.registered") {
      const definition = resolveAgentDefinition(node.config.agentDefinitionId);
      return definition ? { ok: true, evidence: deepFreezeApplicationValue({ contractId: "knowgrph.agent-definition", ownerId: adapter.ownerId, revision: definition.version, digest: digestApplicationValue(definition) }) } : { ok: false, error: { code: "agent_definition_unavailable", message: "The exact registered agent definition is unavailable." } };
    }
    if (component.id === "integration.external-artifact") {
      const resolved = resolveIntegration(node.config);
      return resolved.ok ? { ok: true, evidence: deepFreezeApplicationValue({ contractId: "knowgrph.integration-profile", ownerId: adapter.ownerId, revision: resolved.evidence.integrationProfileRevision, digest: digestApplicationValue(resolved.evidence), integration: resolved.evidence }) } : resolved;
    }
    return { ok: true, evidence: deepFreezeApplicationValue({ contractId: "knowgrph.application-runtime", ownerId: adapter.ownerId, revision: adapter.ownerImplementationRevision, digest: adapter.ownerImplementationDigest }) };
  };
  return Object.freeze({ ...registry, integrations, resolveNodeOwnerEvidence });
}
