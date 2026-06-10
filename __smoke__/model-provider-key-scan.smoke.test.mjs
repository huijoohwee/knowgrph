// STATIC-SCAN SMOKE — no model provider keys in the Agent_Api, McpAgent, or
// Frontend tiers (knowgrph-acos-mcp-connector spec, task 9.3 / R11.1, R11.3,
// R11.5 / design Tech Stack "Hard boundary rule (R11.1-11.5)": AWS/Vercel + the
// McpAgent tool surface never hold model keys; all model calls route through
// the Cloudflare AI Gateway control plane).
//
// WHAT THIS ASSERTS (pure logic + filesystem reads, ZERO live network):
//   1. For EACH tier root (Agent_Api = aws/agent-api/src, McpAgent = the
//      cloudflare worker + the mcp/ runtime it reuses, Frontend = web/src) the
//      composed scan finds ZERO model-provider keys — covering inlined key
//      SHAPES (sk-/sk_live_/AIza/ark/r8_/fal_/xi-...), direct paid-provider
//      host usages, AND model-provider-key ENV-NAME references (OPENAI_API_KEY,
//      ANTHROPIC_API_KEY, GEMINI/GOOGLE, REPLICATE, FAL, ELEVENLABS, ...).
//   2. The scan is MEANINGFUL — it is NOT vacuously passing: a PLANTED key of
//      every named provider is caught by the detectors, and at least one real
//      source file is scanned per present tier.
//
// REUSE-NOT-REBUILD: the detectors come from the existing Frontend scanner
// (`web/src/lib/ai-gateway.js`) composed by `lib/cross-tier-scan.mjs`; this
// suite only wires them across the three tiers.

import test from "node:test";
import assert from "node:assert/strict";

import {
  MODEL_KEY_SCAN_TIERS,
  scanTierForModelProviderKeys,
  findModelProviderKeyEnvNames,
  findExtraModelProviderKeyShapes,
  MODEL_PROVIDER_KEY_ENV_NAMES,
} from "./lib/cross-tier-scan.mjs";
import {
  findModelProviderKeyLiterals,
  findDirectProviderHostUsages,
} from "../web/src/lib/ai-gateway.js";

// --- 1. Each tier holds NO model provider keys ------------------------------

for (const tier of MODEL_KEY_SCAN_TIERS) {
  test(`no model provider keys in tier: ${tier.label} (R11.1/R11.3/R11.5)`, () => {
    const report = scanTierForModelProviderKeys(tier);
    assert.equal(report.scanned, true, `${tier.label} must be present and scanned`);
    assert.ok(report.fileCount > 0, `${tier.label} must scan at least one source file`);
    assert.deepEqual(
      report.findings,
      [],
      `${tier.label} must hold no model provider key; found: ${JSON.stringify(report.findings, null, 2)}`,
    );
  });
}

test("the scan covers all three boundary tiers (Agent_Api, McpAgent, Frontend)", () => {
  const labels = MODEL_KEY_SCAN_TIERS.map((t) => t.label).join(" | ");
  assert.ok(/Agent_Api/.test(labels), "Agent_Api tier is scanned");
  assert.ok(/McpAgent/.test(labels), "McpAgent tier(s) are scanned");
  assert.ok(/Frontend/.test(labels), "Frontend tier is scanned");
  // Every present tier scanned real files.
  for (const tier of MODEL_KEY_SCAN_TIERS) {
    const report = scanTierForModelProviderKeys(tier);
    assert.equal(report.scanned, true, `${tier.label} present`);
  }
});

// --- 2. The scan is MEANINGFUL (catches a planted key per named provider) ---

test("detector catches a PLANTED inlined key for every named provider shape", () => {
  // One planted secret per provider family the task enumerates.
  const plantedShapes = [
    'const a = "sk-ABCDEF0123456789ABCDEF0123456789";',          // OpenAI/Anthropic
    'const b = "sk-ant-api03-ABCDEF0123456789ABCDEF0123456789";', // Anthropic
    'const c = "AIzaABCDEF0123456789ABCDEF0123456789-xyz";',      // Gemini/Google
  ].join("\n");
  const shapeHits = findModelProviderKeyLiterals(plantedShapes);
  const kinds = new Set(shapeHits.map((h) => h.kind));
  assert.ok(kinds.has("openai/anthropic-sk"), "OpenAI/Anthropic key shape caught");
  assert.ok(kinds.has("google-aistudio"), "Gemini/Google key shape caught");

  // Extra shapes added for Replicate / ElevenLabs / fal.
  const planted = [
    'const r = "r8_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd";', // Replicate
    'const e = "xi-ABCDEF0123456789ABCDEF0123456789";',         // ElevenLabs
    'const f = "fal_ABCDEF0123456789ABCDEF0123456789";',        // fal.ai
  ].join("\n");
  const extra = new Set(findExtraModelProviderKeyShapes(planted).map((h) => h.kind));
  assert.ok(extra.has("replicate-r8"), "Replicate key shape caught");
  assert.ok(extra.has("elevenlabs-bearer"), "ElevenLabs key shape caught");
  assert.ok(extra.has("fal-key"), "fal.ai key shape caught");
});

test("detector catches a PLANTED model-provider-key ENV-NAME reference", () => {
  for (const name of MODEL_PROVIDER_KEY_ENV_NAMES) {
    const planted = `const v = process.env.${name};`;
    const hits = findModelProviderKeyEnvNames(planted).map((h) => h.name);
    assert.ok(hits.includes(name), `env name ${name} must be caught when present`);
  }
});

test("env-name detector does NOT flag unrelated identifiers (no false positives)", () => {
  const clean = [
    "const AI_GATEWAY_ID = process.env.AI_GATEWAY_ID;",
    "const MY_OPENAI_API_KEYRING = 1;", // longer identifier, not the exact token
    "const COgroq = 2;",
  ].join("\n");
  assert.deepEqual(findModelProviderKeyEnvNames(clean), []);
});

// --- 3. Product tiers also forbid DIRECT paid-provider host invocation -------

test("product tiers (Agent_Api, Frontend) run the direct-provider-host scan; control-plane tiers are exempt", () => {
  const product = MODEL_KEY_SCAN_TIERS.filter((t) => t.kind === "product");
  const controlPlane = MODEL_KEY_SCAN_TIERS.filter((t) => t.kind === "control-plane");
  assert.ok(product.length >= 2, "Agent_Api + Frontend are product tiers");
  assert.ok(controlPlane.length >= 1, "the McpAgent tier(s) are control-plane");

  // Forcing the host scan ON for a product tier still yields zero findings
  // (they forward/route rather than invoke a provider directly).
  for (const tier of product) {
    const report = scanTierForModelProviderKeys(tier, { checkProviderHosts: true });
    assert.deepEqual(
      report.findings,
      [],
      `${tier.label} must not invoke a paid provider directly; found: ${JSON.stringify(report.findings)}`,
    );
  }
});

test("host detector catches a PLANTED direct paid-provider invocation (meaningful)", () => {
  const planted = [
    'const r = await fetch("https://api.openai.com/v1/chat/completions");',
    "const s = fetch('//api.anthropic.com/v1/messages');",
  ].join("\n");
  const hosts = findDirectProviderHostUsages(planted).map((h) => h.host);
  assert.ok(hosts.includes("api.openai.com"), "planted OpenAI host caught");
  assert.ok(hosts.includes("api.anthropic.com"), "planted Anthropic host caught");
});
