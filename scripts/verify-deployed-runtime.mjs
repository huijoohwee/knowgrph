#!/usr/bin/env node
// Explicit post-deploy reachability verification. This script never supplies
// production defaults and must be invoked only after the operator opens the
// deployed verification lane.

const TIMEOUT_MS = 5000;

const requiredEnv = (name) => {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required; deployed verification has no default endpoints`);
  return value;
};

const optionalEnv = (name) => String(process.env[name] || "").trim() || null;
const joinUrl = (base, suffix) => `${base.replace(/\/+$/, "")}${suffix}`;

async function probe(label, url, { expectJsonStatus = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { method: "GET", signal: controller.signal });
    const elapsedMs = Date.now() - startedAt;
    let passed = response.ok && elapsedMs <= TIMEOUT_MS;
    let detail = `HTTP ${response.status} in ${elapsedMs}ms`;
    if (passed && expectJsonStatus) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await response.json();
        passed = body?.status === "pass" || body?.status === "ok";
        if (!passed) detail += ` (unexpected status: ${JSON.stringify(body?.status)})`;
      }
    }
    return { label, url, status: passed ? "PASS" : "FAIL", detail };
  } catch (error) {
    const reason = error?.name === "AbortError" ? `timed out after ${TIMEOUT_MS}ms` : error?.message;
    return { label, url, status: "FAIL", detail: reason };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const frontendUrl = requiredEnv("FRONTEND_URL");
  const mcpEndpoint = requiredEnv("MCP_ENDPOINT");
  const storageWorkerUrl = optionalEnv("STORAGE_WORKER_URL");
  const targets = [
    ["Frontend", frontendUrl, false],
    ["MCP health", joinUrl(mcpEndpoint, "/health"), true],
    ...(storageWorkerUrl ? [["Storage health", joinUrl(storageWorkerUrl, "/health"), true]] : []),
  ];
  const results = await Promise.all(targets.map(([label, url, expectJsonStatus]) =>
    probe(label, url, { expectJsonStatus })));
  console.log(JSON.stringify({ verification: "deployed-reachability", timeoutMs: TIMEOUT_MS, results }, null, 2));
  if (results.some(({ status }) => status !== "PASS")) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`deployed runtime verification refused: ${error?.message || error}`);
  process.exitCode = 1;
});
