// Server-side-only secret hygiene scanner for the agentic-canvas-os tiers.
//
// Spec: knowgrph-acos-mcp-connector, task 6.6 (R15.7; design Agent_Api
// "Secret handling (R15.7)" + Authentication & Authorization layer).
//
// PURPOSE (R15.7): the HS256 Auth_Token signing secret and any authentication
// secret material are SERVER-SIDE ONLY — they must never appear in the Frontend
// client bundle, in logs, or in ANY Agent_Api response. The signing secret is
// read server-side only via `createEnvSecretProvider` / AWS Secrets Manager
// (`auth-token.js`) and is referenced only by its env KEY NAME, never echoed.
//
// This module is the REUSABLE, deterministic check the build/CI assertion is
// built from. It is PURE logic + filesystem reads with ZERO live network/AWS
// calls. It provides three families of checks:
//
//   (a) RESPONSE scan — given a handler response (or any object/string), assert
//       a known auth secret value never appears in the body or headers, across
//       success AND error paths (`responseContainsSecret`).
//   (b) KEY-NAME-ONLY scan — assert the signing secret is referenced only by
//       its env key NAME (e.g. `AUTH_JWT_SECRET`) and never has a value inlined
//       (`findHardcodedSecretLiterals`).
//   (c) SOURCE-TREE scan — assert no hard-coded auth secret literal exists in
//       the scanned tiers, including the exact known test secret value
//       (`scanSourceTreeForInlinedSecret`, `scanSourceTreeForHardcodedLiterals`).
//
// FRONTEND BUNDLE (Section 7, not built yet): `scanBundleForSecret` is a
// reusable check that NO-OP PASSES when no bundle is present, and TIGHTENS to a
// real assertion (scanning the built JS/CSS/HTML/map artifacts) the moment a
// frontend bundle lands — so the same check guards the Agent_Api + worker tiers
// today and the client bundle when it exists.

import fs from "node:fs";
import path from "node:path";

// --- Source-tree walking ----------------------------------------------------

/** File extensions scanned by default (source + built client artifacts). */
export const DEFAULT_SOURCE_EXTENSIONS = Object.freeze([
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
]);

/** Built-client artifact extensions scanned in a frontend bundle. */
export const DEFAULT_BUNDLE_EXTENSIONS = Object.freeze([
  ".js", ".mjs", ".cjs", ".css", ".html", ".map", ".json",
]);

/** Directory names never walked (deps, VCS, build caches, AND tests). */
export const DEFAULT_EXCLUDED_DIRS = Object.freeze([
  "node_modules", ".git", ".wrangler", "dist", "build", "coverage",
  ".next", "out", ".turbo", ".cache", "__tests__",
]);

/**
 * Recursively list files under `rootDir`, filtered by extension and excluding
 * the configured directory names. Returns absolute paths. A non-existent root
 * yields an empty list (so the caller can treat "tier absent" as a no-op).
 *
 * @param {string} rootDir
 * @param {object} [opts]
 * @param {readonly string[]} [opts.extensions]
 * @param {readonly string[]} [opts.excludeDirs]
 * @returns {string[]}
 */
export function listSourceFiles(rootDir, opts = {}) {
  const extensions = opts.extensions ?? DEFAULT_SOURCE_EXTENSIONS;
  const excludeDirs = new Set(opts.excludeDirs ?? DEFAULT_EXCLUDED_DIRS);
  const out = [];
  if (!rootDir || !fs.existsSync(rootDir)) return out;

  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue; // unreadable dir -> skip rather than throw
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!excludeDirs.has(entry.name)) stack.push(full);
      } else if (entry.isFile()) {
        if (extensions.some((ext) => entry.name.endsWith(ext))) out.push(full);
      }
    }
  }
  return out.sort();
}

// --- (a) Response-body / header secret scan ---------------------------------

/**
 * Flatten an arbitrary value (handler response, string, object) into the text
 * that could carry a secret: the serialized body PLUS the serialized headers.
 * For a handler response `{ statusCode, headers, body }`, the `body` is already
 * a JSON string; headers are serialized too so a leak via a header is caught.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function collectResponseText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  const parts = [];
  if (typeof value === "object") {
    if (typeof value.body === "string") parts.push(value.body);
    else if (value.body !== undefined) parts.push(safeStringify(value.body));
    if (value.headers !== undefined) parts.push(safeStringify(value.headers));
    // Anything else on the object (defensive: catch stray fields).
    const { body, headers, ...rest } = value;
    if (Object.keys(rest).length > 0) parts.push(safeStringify(rest));
    return parts.join("\n");
  }
  return String(value);
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Does the given response/value contain the secret material anywhere in its
 * body or headers? Used to assert across success AND error paths that an auth
 * secret never surfaces in an Agent_Api response (R15.7).
 *
 * @param {unknown} response
 * @param {string} secret the known (test) secret value that must never appear
 * @returns {boolean}
 */
export function responseContainsSecret(response, secret) {
  if (typeof secret !== "string" || secret.length === 0) return false;
  return collectResponseText(response).includes(secret);
}

// --- (b) / (c) Source literal detection -------------------------------------

/**
 * Identifier-name pattern that denotes auth-secret material. Used to flag a
 * hard-coded secret VALUE assigned to a secret-named binding.
 */
const SECRET_IDENTIFIER = /(secret|passwd|password|apikey|api_key|credential|signingkey|signing_key)/i;

/**
 * An env KEY-NAME convention value (e.g. `AUTH_JWT_SECRET`): all-caps with
 * digits/underscores. Referencing the secret by KEY NAME is exactly what R15.7
 * requires, so such values are NOT treated as an inlined secret.
 */
const ENV_KEY_NAME_VALUE = /^[A-Z][A-Z0-9_]*$/;

/** Minimum value length for a string literal to be considered a secret value. */
export const SUSPICIOUS_VALUE_MIN_LENGTH = 8;

/**
 * Scan source text for a HARD-CODED auth secret literal: a string assigned to a
 * secret-named identifier whose value looks like an actual secret (not an env
 * reference, not an env KEY NAME, not a trivial placeholder). Each finding is
 * `{ identifier, value, index }`.
 *
 * The key-name-only guarantee (R15.7) is the inverse of this: a clean tier
 * yields ZERO findings because the secret is only ever referenced by its env
 * key name and read through `process.env` / Secrets Manager.
 *
 * @param {string} sourceText
 * @returns {{ identifier: string, value: string, index: number }[]}
 */
export function findHardcodedSecretLiterals(sourceText) {
  if (typeof sourceText !== "string" || sourceText.length === 0) return [];
  const findings = [];
  // identifier  =|:  "value" | 'value' | `value`
  const assignment = /([A-Za-z_$][\w$]*)\s*[:=]\s*(["'`])((?:\\.|(?!\2).)*)\2/g;
  let match;
  while ((match = assignment.exec(sourceText)) !== null) {
    const identifier = match[1];
    const value = match[3];
    if (!SECRET_IDENTIFIER.test(identifier)) continue;
    if (isAllowedSecretValue(value)) continue;
    findings.push({ identifier, value, index: match.index });
  }
  return findings;
}

/**
 * Is a string value an ALLOWED (non-leaking) value for a secret-named binding?
 * Allowed: empty, an env reference, an env KEY NAME, or a short placeholder.
 */
function isAllowedSecretValue(value) {
  if (value.length === 0) return true;
  if (value.includes("process.env")) return true;        // read from env
  if (value.startsWith("${") || value.includes("env[")) return true; // interpolation / lookup
  if (ENV_KEY_NAME_VALUE.test(value)) return true;        // referenced by KEY NAME
  if (value.length < SUSPICIOUS_VALUE_MIN_LENGTH) return true; // placeholder-ish
  return false;
}

// --- (c) Source-tree scans ---------------------------------------------------

/**
 * Scan a tier's source tree for the EXACT known (test) secret value inlined in
 * any production source file. The known test secret lives only in the test
 * suite (which is excluded from the walk), so a clean tier yields zero hits.
 *
 * @param {string} rootDir
 * @param {string} secret the known secret value that must never be inlined
 * @param {object} [opts] forwarded to {@link listSourceFiles}
 * @returns {{ scanned: boolean, files: string[], hits: { file: string }[] }}
 */
export function scanSourceTreeForInlinedSecret(rootDir, secret, opts = {}) {
  const files = listSourceFiles(rootDir, opts);
  if (files.length === 0) return { scanned: false, files: [], hits: [] };
  const hits = [];
  if (typeof secret === "string" && secret.length > 0) {
    for (const file of files) {
      let text;
      try {
        text = fs.readFileSync(file, "utf8");
      } catch {
        continue;
      }
      if (text.includes(secret)) hits.push({ file });
    }
  }
  return { scanned: true, files, hits };
}

/**
 * Scan a tier's source tree for hard-coded secret literals
 * ({@link findHardcodedSecretLiterals}) across every scanned file.
 *
 * @param {string} rootDir
 * @param {object} [opts] forwarded to {@link listSourceFiles}
 * @returns {{ scanned: boolean, files: string[], findings: { file: string, identifier: string, value: string }[] }}
 */
export function scanSourceTreeForHardcodedLiterals(rootDir, opts = {}) {
  const files = listSourceFiles(rootDir, opts);
  if (files.length === 0) return { scanned: false, files: [], findings: [] };
  const findings = [];
  for (const file of files) {
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const f of findHardcodedSecretLiterals(text)) {
      findings.push({ file, identifier: f.identifier, value: f.value });
    }
  }
  return { scanned: true, files, findings };
}

// --- Frontend bundle scan (reusable; no-op pass when absent) ----------------

/**
 * Scan a built FRONTEND bundle for an auth secret. The Vercel frontend
 * (Section 7) may not exist yet, so this is structured to:
 *   - NO-OP PASS when no candidate bundle directory exists (`present: false`),
 *     and
 *   - TIGHTEN to a real assertion the moment a bundle lands: every built
 *     artifact is scanned for the secret value, and any hit is reported.
 *
 * The caller asserts `result.leaked === false` either way: today that holds
 * vacuously (no bundle), and once the frontend ships it holds only if the
 * secret is genuinely absent from the client bundle (R15.7).
 *
 * @param {object} params
 * @param {string[]} params.bundleDirs candidate built-bundle directories (first
 *   existing one is scanned)
 * @param {string} params.secret the known secret value that must never appear
 * @param {readonly string[]} [params.extensions] artifact extensions to scan
 * @returns {{ present: boolean, scannedDir: string|null, files: string[], hits: { file: string }[], leaked: boolean }}
 */
export function scanBundleForSecret({ bundleDirs = [], secret, extensions } = {}) {
  const dirs = Array.isArray(bundleDirs) ? bundleDirs : [bundleDirs];
  const scannedDir = dirs.find((d) => typeof d === "string" && d && fs.existsSync(d)) ?? null;

  if (scannedDir === null) {
    // No bundle yet -> vacuous pass; the check is ready to tighten when one lands.
    return { present: false, scannedDir: null, files: [], hits: [], leaked: false };
  }

  const files = listSourceFiles(scannedDir, {
    extensions: extensions ?? DEFAULT_BUNDLE_EXTENSIONS,
  });
  const hits = [];
  if (typeof secret === "string" && secret.length > 0) {
    for (const file of files) {
      let text;
      try {
        text = fs.readFileSync(file, "utf8");
      } catch {
        continue;
      }
      if (text.includes(secret)) hits.push({ file });
    }
  }
  return { present: true, scannedDir, files, hits, leaked: hits.length > 0 };
}
