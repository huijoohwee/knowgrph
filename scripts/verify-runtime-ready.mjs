#!/usr/bin/env node
// Post-deploy runtime-readiness verifier (knowgrph-acos-mcp-connector
// runtime-readiness path, step 4 — AC-7 live proof helper / tasks 11.2, 11.4).
//
// Probes the deployed surfaces of the live product path and prints a
// PASS/FAIL readiness report plus a sample Demo_Pack `urls[]` block:
//   1. AWS Agent-API   GET {AGENT_API_URL}/health   -> HTTP 200 within 5s (R3.4)
//   2. Cloudflare MCP  GET {MCP_ENDPOINT}/health     -> HTTP 200 within 5s (R14.1)
//   3. Vercel Frontend GET {FRONTEND_URL}            -> reachable HTTP 200 (R3.2)
//   4. AgentCore MCP   GET {AGENTCORE_URL}/ping       -> HTTP 200 within 5s (R3.4)
//
// This script makes REAL outbound GETs to URLs YOU supply (no code/secrets are
// transmitted). It runs nothing automatically — invoke it after a gated deploy:
//
//   AGENT_API_URL=https://xxxx.execute-api.us-east-1.amazonaws.com/v1 \
//   MCP_ENDPOINT=https://airvio.co/knowgrph/mcp \
//   FRONTEND_URL=https://agentic-canvas-os.vercel.app \
//   node scripts/verify-runtime-ready.mjs
//
// Exit code 0 when every supplied URL passes; 1 otherwise. Unset URLs are
// reported as SKIPPED (not failed) so partial deploys can be checked.

const TIMEOUT_MS = 5000;

/** Probe a URL with a hard 5s timeout; returns a structured result. */
async function probe(label, url, { expectJsonStatusPass = false } = {}) {
  if (!url) return { label, url: null, status: "SKIP", detail: "env not set" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    const elapsedMs = Date.now() - startedAt;
    const within = elapsedMs <= TIMEOUT_MS;
    let ok = res.status >= 200 && res.status < 300 && within;
    let detail = `HTTP ${res.status} in ${elapsedMs}ms`;
    if (ok && expectJsonStatusPass) {
      try {
        const body = await res.json();
        const liveness = body && (body.status === "pass" || body.status === "ok");
        if (!liveness) {
          ok = false;
          detail += ` (unexpected status field: ${JSON.stringify(body?.status)})`;
        }
      } catch {
        /* non-JSON health body is tolerated as long as it is 200 */
      }
    }
    return { label, url, status: ok ? "PASS" : "FAIL", detail };
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    const reason = err?.name === "AbortError" ? `timed out after ${TIMEOUT_MS}ms` : err?.message;
    return { label, url, status: "FAIL", detail: `${reason} (${elapsedMs}ms)` };
  } finally {
    clearTimeout(timer);
  }
}

function joinUrl(base, path) {
  if (!base) return null;
  return `${String(base).replace(/\/+$/, "")}${path}`;
}

async function main() {
  const agentApi = process.env.AGENT_API_URL;
  const mcpEndpoint = process.env.MCP_ENDPOINT || "https://airvio.co/knowgrph/mcp";
  const frontend = process.env.FRONTEND_URL;
  const agentcore = process.env.AGENTCORE_MCP_URL || process.env.AGENTCORE_URL;
  const agentcorePing = process.env.AGENTCORE_PING_URL || joinUrl(agentcore, "/ping");
  const agentcoreMcp = process.env.AGENTCORE_MCP_PATH_URL || joinUrl(agentcore, "/mcp");

  const results = await Promise.all([
    probe("AWS Agent-API /health", joinUrl(agentApi, "/health"), { expectJsonStatusPass: true }),
    probe("Cloudflare MCP /health", joinUrl(mcpEndpoint, "/health"), { expectJsonStatusPass: true }),
    probe("Vercel Frontend", frontend),
    probe("AWS AgentCore /ping", agentcorePing, { expectJsonStatusPass: true }),
  ]);

  console.log("\n  Runtime-Readiness Verification (AC-7)\n  " + "-".repeat(48));
  for (const r of results) {
    const mark = r.status === "PASS" ? "✓" : r.status === "SKIP" ? "–" : "✗";
    console.log(`  ${mark} ${r.status.padEnd(4)} ${r.label}`);
    console.log(`        ${r.url ?? "(no URL provided)"} — ${r.detail}`);
  }

  // Sample Demo_Pack urls[] block (R3.2): >=1 Frontend URL + >=1 Agent_Api endpoint.
  const demoUrls = [];
  if (frontend) demoUrls.push({ url: frontend, kind: "frontend" });
  if (agentApi) demoUrls.push({ url: joinUrl(agentApi, "/health"), kind: "agent_api" });
  if (mcpEndpoint) demoUrls.push({ url: joinUrl(mcpEndpoint, "/health"), kind: "control_plane" });
  if (agentcorePing) demoUrls.push({ url: agentcorePing, kind: "agentcore_ping" });
  if (agentcoreMcp) demoUrls.push({ url: agentcoreMcp, kind: "agentcore_mcp" });
  console.log("\n  Sample Demo_Pack urls[]:");
  console.log("  " + JSON.stringify(demoUrls));

  const probed = results.filter((r) => r.status !== "SKIP");
  const failed = probed.filter((r) => r.status === "FAIL");
  if (probed.length === 0) {
    console.log("\n  No URLs supplied. Set AGENT_API_URL / MCP_ENDPOINT / FRONTEND_URL.\n");
    process.exit(1);
  }
  if (failed.length > 0) {
    console.log(`\n  RESULT: NOT runtime-ready — ${failed.length}/${probed.length} probe(s) failed.\n`);
    process.exit(1);
  }
  console.log(`\n  RESULT: runtime-ready — ${probed.length}/${probed.length} probe(s) passed.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("verify-runtime-ready: unexpected error:", err?.message ?? err);
  process.exit(1);
});
