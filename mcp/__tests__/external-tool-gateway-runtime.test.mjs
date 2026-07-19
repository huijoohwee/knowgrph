import assert from "node:assert/strict";
import test from "node:test";

import { EXTERNAL_TOOL_GATEWAY_TOOL_NAMES } from "../external-tool-gateway-contract.js";
import { createExternalToolGatewayRuntime } from "../external-tool-gateway-runtime.js";
import {
  EXTERNAL_MCP_PROFILES_ENV,
  computeExternalToolSchemaDigest,
  loadExternalToolProfileRegistry,
} from "../external-tool-profile-registry.js";

const SECRET = "test-only-external-mcp-approval-secret-32chars";
const NOW = 1_800_000_000_000;
const UPSTREAM_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["deck_title", "markdown", "content_type", "folder_id", "request_id"],
  properties: {
    deck_title: { type: "string", minLength: 1 },
    markdown: { type: "string", minLength: 1 },
    content_type: { type: "string", const: "text/markdown" },
    folder_id: { type: "string", const: "approved-folder" },
    request_id: { type: "string", minLength: 8 },
  },
});

const PROFILE = Object.freeze({
  id: "slides-host",
  label: "Slides Host",
  transport: {
    type: "streamable-http",
    url: "https://mcp.example.com/mcp",
    timeoutMs: 12_000,
  },
  tools: [{
    name: "create_presentation",
    label: "Create presentation",
    description: "Create one external slide deck.",
    artifactKind: "slides",
    upstreamInputSchemaDigest: computeExternalToolSchemaDigest(UPSTREAM_SCHEMA),
    argumentMapping: {
      title: "deck_title",
      content: "markdown",
      contentType: "content_type",
    },
    constantArguments: { folder_id: "approved-folder" },
    idempotencyArgumentName: "request_id",
    result: {
      idPointer: "/structuredContent/id",
      urlPointer: "/structuredContent/url",
      titlePointer: "/structuredContent/title",
      mimeType: "application/vnd.example.presentation",
      allowedOrigins: ["https://docs.example.com"],
    },
  }],
});

const ARTIFACT = Object.freeze({
  title: "Quarterly plan",
  content: "# Slide 1\n\n---\n\n# Slide 2",
  contentType: "text/markdown",
  fileName: "quarterly-plan.md",
  workspacePath: "workspace:/knowgrph/quarterly-plan.md",
  sourceUrl: "https://sources.example.com/plan",
});

const makeRegistry = (profiles = [PROFILE]) => loadExternalToolProfileRegistry({
  env: {
    NODE_ENV: "test",
    [EXTERNAL_MCP_PROFILES_ENV]: JSON.stringify({ profiles }),
  },
});

const makeCallArgs = (capability, overrides = {}) => ({
  capabilityId: capability.capabilityId,
  capabilityRevision: capability.capabilityRevision,
  artifact: ARTIFACT,
  idempotencyKey: "deck-run-0001",
  ...overrides,
});

test("catalog and describe expose only opaque capability and canonical artifact metadata", async () => {
  const registry = makeRegistry();
  const runtime = createExternalToolGatewayRuntime({ registry, approvalSecret: SECRET, now: NOW });
  const catalog = runtime.catalog({ artifactKinds: ["slides"] });
  assert.equal(catalog.ok, true);
  assert.equal(catalog.count, 1);
  const serializedCatalog = JSON.stringify(catalog);
  for (const forbidden of ["mcp.example.com", "create_presentation", "approved-folder", "deck_title", "markdown"]) {
    assert.equal(serializedCatalog.includes(forbidden), false, `catalog leaked ${forbidden}`);
  }

  const described = await runtime.describe({ capabilityId: catalog.capabilities[0].capabilityId });
  assert.equal(described.ok, true);
  assert.equal(described.artifactSchema.properties.content.type, "string");
  assert.equal(JSON.stringify(described).includes("create_presentation"), false);
  assert.equal(JSON.stringify(described).includes("deck_title"), false);
  assert.equal((await runtime.run(EXTERNAL_TOOL_GATEWAY_TOOL_NAMES.search, { query: "presentation" })).count, 1);
});

test("approved call maps canonical artifact deterministically and returns a sanitized receipt", async () => {
  const registry = makeRegistry();
  const capability = registry.capabilities[0];
  const events = [];
  let closeCount = 0;
  const runtime = createExternalToolGatewayRuntime({
    registry,
    approvalSecret: SECRET,
    now: NOW,
    createSession: async (profile, options) => {
      events.push({ type: "connect", profileId: profile.id, hasSignal: options.signal instanceof AbortSignal });
      return {
        listTools: async () => ({ tools: [{ name: "create_presentation", inputSchema: UPSTREAM_SCHEMA }] }),
        callTool: async (name, argumentsValue) => {
          events.push({ type: "call", name, argumentsValue });
          return {
            content: [{ type: "text", text: "raw provider text must not escape" }],
            structuredContent: {
              id: "deck-123",
              url: "https://docs.example.com/decks/deck-123?access_token=must-strip#fragment",
              title: "Quarterly plan",
              secret: "must-not-escape",
            },
          };
        },
        close: async () => { closeCount += 1; },
      };
    },
  });
  const callArgs = makeCallArgs(capability);
  const approvalToken = runtime.createApprovalToken(callArgs, { tokenId: "approval-token-runtime-0001" });
  const result = await runtime.call({ ...callArgs, approvalToken });
  assert.equal(result.ok, true);
  assert.equal(result.cached, false);
  assert.equal(closeCount, 1);
  assert.deepEqual(events[0], { type: "connect", profileId: "slides-host", hasSignal: true });
  assert.deepEqual(events[1], {
    type: "call",
    name: "create_presentation",
    argumentsValue: {
      folder_id: "approved-folder",
      deck_title: ARTIFACT.title,
      markdown: ARTIFACT.content,
      content_type: ARTIFACT.contentType,
      request_id: callArgs.idempotencyKey,
    },
  });
  assert.deepEqual(result.receipt, {
    externalId: "deck-123",
    webUrl: "https://docs.example.com/decks/deck-123",
    title: "Quarterly plan",
    mimeType: "application/vnd.example.presentation",
    artifactKind: "slides",
    capabilityId: capability.capabilityId,
    capabilityRevision: capability.capabilityRevision,
    idempotencyKey: "deck-run-0001",
    digest: result.receipt.digest,
  });
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("must-not-escape"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.match(result.receipt.digest, /^[0-9a-f]{64}$/);

  const cached = await runtime.call({ ...callArgs, approvalToken });
  assert.equal(cached.ok, true);
  assert.equal(cached.cached, true);
  assert.equal(events.filter((event) => event.type === "call").length, 1);
  assert.equal(closeCount, 1);
});

test("schema drift blocks before approval consumption and closes the upstream session", async () => {
  const registry = makeRegistry();
  const capability = registry.capabilities[0];
  let liveSchema = { ...UPSTREAM_SCHEMA, required: [...UPSTREAM_SCHEMA.required, "new_required_field"] };
  let calls = 0;
  let closes = 0;
  const runtime = createExternalToolGatewayRuntime({
    registry,
    approvalSecret: SECRET,
    now: NOW,
    createSession: async () => ({
      listTools: async () => ({ tools: [{ name: "create_presentation", inputSchema: liveSchema }] }),
      callTool: async () => { calls += 1; return {}; },
      close: async () => { closes += 1; },
    }),
  });
  const callArgs = makeCallArgs(capability, { idempotencyKey: "deck-run-schema" });
  const approvalToken = runtime.createApprovalToken(callArgs, { tokenId: "approval-token-runtime-0002" });
  const drifted = await runtime.call({ ...callArgs, approvalToken });
  assert.equal(drifted.ok, false);
  assert.equal(drifted.error.code, "upstream_schema_changed");
  assert.equal(calls, 0);
  assert.equal(closes, 1);

  liveSchema = UPSTREAM_SCHEMA;
  const retried = await runtime.call({ ...callArgs, approvalToken });
  assert.equal(retried.ok, false, "the fake success lacks a receipt, proving approval passed after drift was fixed");
  assert.equal(retried.error.code, "invalid_upstream_receipt");
  assert.equal(calls, 1);
  assert.equal(closes, 2);
});

test("missing or mismatched approval never invokes the external mutation", async () => {
  const registry = makeRegistry();
  const capability = registry.capabilities[0];
  let calls = 0;
  let closes = 0;
  const runtime = createExternalToolGatewayRuntime({
    registry,
    approvalSecret: SECRET,
    now: NOW,
    createSession: async () => ({
      listTools: async () => ({ tools: [{ name: "create_presentation", inputSchema: UPSTREAM_SCHEMA }] }),
      callTool: async () => { calls += 1; return {}; },
      close: async () => { closes += 1; },
    }),
  });
  const callArgs = makeCallArgs(capability, { idempotencyKey: "deck-run-approval" });
  const absent = await runtime.call(callArgs);
  assert.equal(absent.ok, false);
  assert.equal(absent.error.code, "approval_required");
  assert.match(absent.actionDigest, /^[0-9a-f]{64}$/);
  assert.equal(calls, 0);

  const token = runtime.createApprovalToken(callArgs, { tokenId: "approval-token-runtime-0003" });
  const mismatch = await runtime.call({
    ...callArgs,
    artifact: { ...ARTIFACT, title: "Changed after approval" },
    approvalToken: token,
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.error.code, "approval_digest_mismatch");
  assert.equal(calls, 0);
  assert.equal(closes, 2);
});

test("idempotency conflict and invalid workspace paths fail before external connection", async () => {
  const registry = makeRegistry();
  const capability = registry.capabilities[0];
  let connections = 0;
  const receiptCache = new Map([[
    `${capability.capabilityId}\u0000deck-run-conflict`,
    { actionDigest: "0".repeat(64), receipt: { existing: true } },
  ]]);
  const runtime = createExternalToolGatewayRuntime({
    registry,
    approvalSecret: SECRET,
    now: NOW,
    receiptCache,
    createSession: async () => { connections += 1; throw new Error("must not connect"); },
  });
  const conflictArgs = makeCallArgs(capability, { idempotencyKey: "deck-run-conflict" });
  const conflict = await runtime.call(conflictArgs);
  assert.equal(conflict.error.code, "idempotency_conflict");
  const invalidPath = await runtime.call(makeCallArgs(capability, {
    idempotencyKey: "deck-run-invalid-path",
    artifact: { ...ARTIFACT, workspacePath: "workspace:/knowgrph/../secret.md" },
  }));
  assert.equal(invalidPath.error.code, "invalid_workspace_path");
  assert.equal(connections, 0);
});

test("receipt origin allowlist rejects an otherwise successful external mutation without leaking URL details", async () => {
  const registry = makeRegistry();
  const capability = registry.capabilities[0];
  const runtime = createExternalToolGatewayRuntime({
    registry,
    approvalSecret: SECRET,
    now: NOW,
    createSession: async () => ({
      listTools: async () => ({ tools: [{ name: "create_presentation", inputSchema: UPSTREAM_SCHEMA }] }),
      callTool: async () => ({ structuredContent: { id: "deck-evil", url: "https://evil.example/deck?secret=1" } }),
      close: async () => undefined,
    }),
  });
  const callArgs = makeCallArgs(capability, { idempotencyKey: "deck-run-origin" });
  const approvalToken = runtime.createApprovalToken(callArgs, { tokenId: "approval-token-runtime-0004" });
  const result = await runtime.call({ ...callArgs, approvalToken });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "invalid_upstream_receipt");
  assert.equal(JSON.stringify(result).includes("evil.example"), false);
});
