#!/usr/bin/env node
// Operator post-deploy verifier for the additive AWS Bedrock AgentCore Runtime
// MCP tier (knowgrph-acos-mcp-connector tasks 13.9/13.10).
//
// This script performs bounded read-only probes against URLs supplied by the
// operator after a cloud-deploy-gated AgentCore launch. It never creates,
// updates, or deletes cloud resources.

const TIMEOUT_MS = 5000;
const MCP_ACCEPT = "application/json, text/event-stream";

function trimSlash(value) {
  return String(value ?? "").replace(/\/+$/, "");
}

function joinUrl(base, path) {
  if (!base) return null;
  return `${trimSlash(base)}${path}`;
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return { res, elapsedMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

async function probePing(url) {
  if (!url) return { label: "AgentCore /ping", url: null, status: "SKIP", detail: "env not set" };
  try {
    const { res, elapsedMs } = await fetchWithTimeout(url, { method: "GET" });
    let ok = res.status >= 200 && res.status < 300 && elapsedMs <= TIMEOUT_MS;
    let detail = `HTTP ${res.status} in ${elapsedMs}ms`;
    try {
      const body = await res.json();
      const status = body?.status;
      if (ok && status !== "ok" && status !== "pass") {
        ok = false;
        detail += ` (unexpected status field: ${JSON.stringify(status)})`;
      }
    } catch {
      // A 2xx non-JSON ping still proves liveness for externally hosted URLs.
    }
    return { label: "AgentCore /ping", url, status: ok ? "PASS" : "FAIL", detail };
  } catch (err) {
    const reason = err?.name === "AbortError" ? `timed out after ${TIMEOUT_MS}ms` : err?.message;
    return { label: "AgentCore /ping", url, status: "FAIL", detail: reason };
  }
}

async function probeToolsList(url, token) {
  if (!url) return { label: "AgentCore tools/list", url: null, status: "SKIP", detail: "env not set" };
  if (!token) {
    return {
      label: "AgentCore tools/list",
      url,
      status: "SKIP",
      detail: "AGENTCORE_AUTH_TOKEN not set; /mcp is intentionally auth-gated",
    };
  }
  const payload = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  });
  try {
    const { res, elapsedMs } = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        accept: MCP_ACCEPT,
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: payload,
    });
    const text = await res.text();
    let ok = res.status >= 200 && res.status < 300 && elapsedMs <= TIMEOUT_MS;
    let detail = `HTTP ${res.status} in ${elapsedMs}ms`;
    try {
      const body = JSON.parse(text);
      const tools = body?.result?.tools;
      const names = Array.isArray(tools) ? tools.map((tool) => tool?.name).filter(Boolean) : [];
      if (!names.includes("knowgrph.video_remix.run")) {
        ok = false;
        detail += " (missing knowgrph.video_remix.run)";
      } else {
        detail += ` (${names.length} tools)`;
      }
    } catch {
      ok = false;
      detail += " (non-JSON JSON-RPC response)";
    }
    return { label: "AgentCore tools/list", url, status: ok ? "PASS" : "FAIL", detail };
  } catch (err) {
    const reason = err?.name === "AbortError" ? `timed out after ${TIMEOUT_MS}ms` : err?.message;
    return { label: "AgentCore tools/list", url, status: "FAIL", detail: reason };
  }
}

async function main() {
  const base = process.env.AGENTCORE_MCP_URL || process.env.AGENTCORE_URL;
  const pingUrl = process.env.AGENTCORE_PING_URL || joinUrl(base, "/ping");
  const mcpUrl = process.env.AGENTCORE_MCP_PATH_URL || joinUrl(base, "/mcp");
  const token = process.env.AGENTCORE_AUTH_TOKEN;

  const results = await Promise.all([probePing(pingUrl), probeToolsList(mcpUrl, token)]);

  console.log("\n  AgentCore Runtime Verification (tasks 13.9/13.10)\n  " + "-".repeat(56));
  for (const result of results) {
    const mark = result.status === "PASS" ? "[OK]" : result.status === "SKIP" ? "[--]" : "[FAIL]";
    console.log(`  ${mark} ${result.status.padEnd(4)} ${result.label}`);
    console.log(`        ${result.url ?? "(no URL provided)"} - ${result.detail}`);
  }

  const demoUrls = [];
  if (pingUrl) demoUrls.push({ url: pingUrl, kind: "agentcore_ping" });
  if (mcpUrl) demoUrls.push({ url: mcpUrl, kind: "agentcore_mcp" });
  console.log("\n  AgentCore Demo_Pack urls[]:");
  console.log("  " + JSON.stringify(demoUrls));

  const failed = results.filter((result) => result.status === "FAIL");
  const passed = results.filter((result) => result.status === "PASS");
  if (failed.length > 0 || passed.length === 0) {
    console.log(`\n  RESULT: AgentCore not verified - ${failed.length} failed, ${passed.length} passed.\n`);
    process.exit(1);
  }
  console.log(`\n  RESULT: AgentCore verified - ${passed.length} probe(s) passed.\n`);
}

main().catch((err) => {
  console.error("verify-agentcore-runtime: unexpected error:", err?.message ?? err);
  process.exit(1);
});
