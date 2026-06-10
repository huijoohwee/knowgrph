// Cross-tier static-scan helpers — knowgrph-acos-mcp-connector spec, task 9.3
// (R11.1, R11.3, R11.5, R15.7).
//
// PURPOSE: the spend-isolation boundary (design Tech Stack "Hard boundary rule
// R11.1-11.5") requires that the product + control-plane-adjacent tiers hold
// NO model provider keys, and (R15.7) that NO auth secret ships in the Frontend
// client bundle / logs / responses. This module is the SINGLE place the
// cross-tier smoke suite composes the EXISTING, reusable scanners — it does NOT
// fork or re-implement them:
//
//   * model-provider-key + direct-provider-host scanning is REUSED verbatim
//     from the Frontend tier scanner `web/src/lib/ai-gateway.js`
//     (`scanSourceTreeForModelKeys`, `scanSourceTreeForProviderHosts`,
//     `findModelProviderKeyLiterals`, `listSourceFiles`);
//   * auth-secret scanning is REUSED verbatim from the Agent_Api scanner
//     `aws/agent-api/src/lib/secret-hygiene.js`
//     (`scanSourceTreeForHardcodedLiterals`, `scanBundleForSecret`,
//     `findHardcodedSecretLiterals`).
//
// This file ADDS only the cross-tier glue the spec newly requires for 9.3:
//   (1) the canonical tier ROOTS (Agent_Api, McpAgent = worker + mcp runtime,
//       Frontend) so one scan covers all three boundaries at once;
//   (2) explicit MODEL-PROVIDER-KEY ENV-NAME + extra key-SHAPE coverage for the
//       providers the task enumerates that the shape-only patterns do not yet
//       name (Replicate, fal, ElevenLabs, Gemini/Google, DeepSeek, ...), so the
//       scan is MEANINGFUL for every named provider and would fail if a real
//       key were planted.
//
// Pure logic + filesystem reads. ZERO live network/AWS/Cloudflare calls.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  listSourceFiles,
  scanSourceTreeForModelKeys,
  scanSourceTreeForProviderHosts,
} from "../../web/src/lib/ai-gateway.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Repo root: `knowgrph/` (this file lives at `knowgrph/__smoke__/lib`). */
export const REPO_ROOT = path.resolve(HERE, "../..");

/**
 * Canonical tier roots for the three tiers that MUST hold no model provider
 * keys (design: Agent_Api = aws/agent-api/, McpAgent = cloudflare worker + the
 * mcp/ runtime it reuses, Frontend = web/). Each entry is `{ label, root, kind }`.
 *
 * `kind` distinguishes:
 *   * "product"       — Agent_Api + Frontend: never hold model keys AND never
 *     invoke a paid provider directly (R11.3/R11.5) — so the direct-provider-
 *     HOST scan applies here too.
 *   * "control-plane" — the McpAgent tool surface + the mcp/ runtime it reuses:
 *     must hold no model provider KEY (keys live in the AI Gateway / payment
 *     worker config, reached via bindings — R11.5), but the control plane DOES
 *     legitimately integrate commerce/providers (e.g. the Commerce_Harness
 *     Stripe seam), so the direct-provider-host scan is NOT applied here.
 */
export const MODEL_KEY_SCAN_TIERS = Object.freeze([
  { label: "Agent_Api (aws/agent-api/src)", root: path.join(REPO_ROOT, "aws", "agent-api", "src"), kind: "product" },
  {
    label: "McpAgent worker (cloudflare/workers/knowgrph-mcp)",
    root: path.join(REPO_ROOT, "cloudflare", "workers", "knowgrph-mcp"),
    kind: "control-plane",
  },
  { label: "McpAgent runtime (mcp/)", root: path.join(REPO_ROOT, "mcp"), kind: "control-plane" },
  { label: "Frontend (web/src)", root: path.join(REPO_ROOT, "web", "src"), kind: "product" },
]);

/** Frontend tier root used by the auth-secret-in-frontend scan (R15.7). */
export const FRONTEND_SRC_ROOT = path.join(REPO_ROOT, "web", "src");

/**
 * Candidate built Frontend bundle directories (Section 7 / 11.3). None exist
 * yet, so `scanBundleForSecret` no-op passes today and tightens when one lands.
 */
export const FRONTEND_BUNDLE_DIRS = Object.freeze([
  path.join(REPO_ROOT, "web", ".next"),
  path.join(REPO_ROOT, "web", "dist"),
  path.join(REPO_ROOT, "web", "out"),
  path.resolve(REPO_ROOT, "..", "agentic-canvas-os", "apps", "web", ".next"),
  path.resolve(REPO_ROOT, "..", "agentic-canvas-os", "apps", "web", "dist"),
]);

/**
 * Directories never walked by a cross-tier scan: the reusable defaults PLUS the
 * test/harness dirs (which legitimately PLANT fake keys/secrets as fixtures and
 * positive controls, so scanning them would self-trip).
 */
export const CROSS_TIER_EXCLUDED_DIRS = Object.freeze([
  "node_modules", ".git", ".wrangler", "dist", "build", "coverage",
  ".next", "out", ".turbo", ".cache",
  "__tests__", "__pbt__", "__smoke__", "__integration__",
]);

/**
 * Scanner source files that are the deny-list / pattern SOURCE OF TRUTH. They
 * name providers and hold detector regexes by design, so they are excluded from
 * the cross-tier scans to avoid self-tripping (they never invoke a provider).
 */
export const SCANNER_SOURCE_FILES = Object.freeze([
  path.join(REPO_ROOT, "web", "src", "lib", "ai-gateway.js"),
  path.join(REPO_ROOT, "aws", "agent-api", "src", "lib", "secret-hygiene.js"),
]);

// --- Model-provider-key ENV-NAME coverage (task 9.3 enumerated providers) ---

/**
 * Model-provider-key ENV-NAME tokens. R11.1 forbids the product/McpAgent tiers
 * from storing OR REFERENCING model provider keys: these tiers route every
 * model call through the Cloudflare AI Gateway, so a provider key env name has
 * no business appearing in their source at all. Matching is on the raw token so
 * a reference in any position (config, assignment, comment) is caught.
 */
export const MODEL_PROVIDER_KEY_ENV_NAMES = Object.freeze([
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_GENAI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "REPLICATE_API_TOKEN",
  "REPLICATE_API_KEY",
  "FAL_KEY",
  "FAL_API_KEY",
  "ELEVENLABS_API_KEY",
  "ELEVEN_API_KEY",
  "XI_API_KEY",
  "DEEPSEEK_API_KEY",
  "MISTRAL_API_KEY",
  "COHERE_API_KEY",
  "GROQ_API_KEY",
  "TOGETHER_API_KEY",
  "PERPLEXITY_API_KEY",
  "ARK_API_KEY",
  "BYTEPLUS_API_KEY",
  "MODELARK_API_KEY",
  "VOLC_API_KEY",
]);

/**
 * Extra model-provider key VALUE shapes for the providers the reusable
 * `MODEL_PROVIDER_KEY_PATTERNS` (in ai-gateway.js) does not already name —
 * Replicate and ElevenLabs/fal style bearer tokens — so a planted real key is
 * caught regardless of how it is assigned. Each `{ name, re }`.
 */
export const EXTRA_MODEL_PROVIDER_KEY_SHAPES = Object.freeze([
  // Replicate API tokens: r8_ followed by 37+ base62 chars.
  { name: "replicate-r8", re: /\br8_[A-Za-z0-9]{37,}\b/g },
  // ElevenLabs keys: 32-hex bearer often prefixed by an `xi-` / `eleven` label.
  { name: "elevenlabs-bearer", re: /\b(?:xi|eleven(?:labs)?)[-_][A-Za-z0-9]{24,}\b/gi },
  // fal.ai keys: `<key_id>:<key_secret>` hex pair or `fal_` prefixed bearer.
  { name: "fal-key", re: /\bfal_[A-Za-z0-9]{24,}\b/g },
]);

/**
 * Find model-provider-key ENV-NAME tokens in source text. Returns
 * `{ name, index }[]` (no surrounding value is returned).
 *
 * @param {string} sourceText
 * @returns {{ name: string, index: number }[]}
 */
export function findModelProviderKeyEnvNames(sourceText) {
  if (typeof sourceText !== "string" || sourceText.length === 0) return [];
  const findings = [];
  for (const name of MODEL_PROVIDER_KEY_ENV_NAMES) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Word-ish boundaries so `OPENAI_API_KEY` is not matched inside a longer
    // unrelated identifier.
    const re = new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`, "g");
    let m;
    while ((m = re.exec(sourceText)) !== null) {
      findings.push({ name, index: m.index });
    }
  }
  return findings;
}

/**
 * Find extra model-provider key VALUE shapes (Replicate / ElevenLabs / fal) in
 * source text. Returns `{ kind, index }[]` (the raw value is never returned).
 *
 * @param {string} sourceText
 * @returns {{ kind: string, index: number }[]}
 */
export function findExtraModelProviderKeyShapes(sourceText) {
  if (typeof sourceText !== "string" || sourceText.length === 0) return [];
  const findings = [];
  for (const { name, re } of EXTRA_MODEL_PROVIDER_KEY_SHAPES) {
    const scanner = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    let m;
    while ((m = scanner.exec(sourceText)) !== null) {
      findings.push({ kind: name, index: m.index });
      if (m.index === scanner.lastIndex) scanner.lastIndex++;
    }
  }
  return findings;
}

// --- Tree scans built on the REUSED `listSourceFiles` walker ----------------

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function defaultScanOpts(opts = {}) {
  return {
    excludeDirs: opts.excludeDirs ?? CROSS_TIER_EXCLUDED_DIRS,
    excludeFiles: [...SCANNER_SOURCE_FILES, ...(opts.excludeFiles ?? [])],
  };
}

/**
 * Scan a tier root for model-provider-key ENV-NAME tokens (reusing the
 * `listSourceFiles` walker from the Frontend scanner).
 *
 * @param {string} rootDir
 * @param {object} [opts]
 * @returns {{ scanned: boolean, files: string[], findings: { file: string, name: string }[] }}
 */
export function scanTreeForModelKeyEnvNames(rootDir, opts = {}) {
  const files = listSourceFiles(rootDir, defaultScanOpts(opts));
  if (files.length === 0) return { scanned: false, files: [], findings: [] };
  const findings = [];
  for (const file of files) {
    const text = readText(file);
    if (text === null) continue;
    for (const f of findModelProviderKeyEnvNames(text)) findings.push({ file, name: f.name });
  }
  return { scanned: true, files, findings };
}

/**
 * Scan a tier root for extra model-provider key VALUE shapes (Replicate /
 * ElevenLabs / fal).
 *
 * @param {string} rootDir
 * @param {object} [opts]
 * @returns {{ scanned: boolean, files: string[], findings: { file: string, kind: string }[] }}
 */
export function scanTreeForExtraModelKeyShapes(rootDir, opts = {}) {
  const files = listSourceFiles(rootDir, defaultScanOpts(opts));
  if (files.length === 0) return { scanned: false, files: [], findings: [] };
  const findings = [];
  for (const file of files) {
    const text = readText(file);
    if (text === null) continue;
    for (const f of findExtraModelProviderKeyShapes(text)) findings.push({ file, kind: f.kind });
  }
  return { scanned: true, files, findings };
}

/**
 * Run the full model-provider-key scan over a single tier root: REUSED key
 * SHAPE scan (ai-gateway.js) plus the cross-tier ENV-NAME + extra-shape scans
 * added here, applied to EVERY tier. The direct-provider-HOST scan is applied
 * only to "product" tiers (Agent_Api, Frontend) which must never invoke a paid
 * provider directly; the control-plane McpAgent tiers legitimately integrate
 * commerce/providers and are exempt from the host scan (they are still held to
 * the no-model-KEY guarantee). Aggregates all findings into one report.
 *
 * @param {{ label: string, root: string, kind?: string }} tier
 * @param {object} [opts]
 * @param {boolean} [opts.checkProviderHosts] override the kind-based default
 * @returns {{
 *   label: string, root: string, scanned: boolean, fileCount: number,
 *   findings: { file: string, detail: string }[]
 * }}
 */
export function scanTierForModelProviderKeys(tier, opts = {}) {
  const scanOpts = defaultScanOpts(opts);
  const keyShapes = scanSourceTreeForModelKeys(tier.root, scanOpts);
  const envNames = scanTreeForModelKeyEnvNames(tier.root, opts);
  const extraShapes = scanTreeForExtraModelKeyShapes(tier.root, opts);

  const findings = [
    ...keyShapes.findings.map((f) => ({ file: f.file, detail: `model-key-shape:${f.kind}` })),
    ...envNames.findings.map((f) => ({ file: f.file, detail: `model-key-env-name:${f.name}` })),
    ...extraShapes.findings.map((f) => ({ file: f.file, detail: `model-key-shape:${f.kind}` })),
  ];

  const checkProviderHosts =
    typeof opts.checkProviderHosts === "boolean"
      ? opts.checkProviderHosts
      : tier.kind === "product";
  if (checkProviderHosts) {
    const hosts = scanSourceTreeForProviderHosts(tier.root, scanOpts);
    for (const f of hosts.findings) {
      findings.push({ file: f.file, detail: `direct-provider-host:${f.host}` });
    }
  }

  return {
    label: tier.label,
    root: tier.root,
    scanned: keyShapes.scanned || envNames.scanned,
    fileCount: keyShapes.files.length || envNames.files.length,
    findings,
  };
}
