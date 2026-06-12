#!/usr/bin/env node
// Post-deploy runtime-readiness verifier (Cloudflare-only topology).
//
// Probes the deployed Cloudflare surfaces and prints a PASS/FAIL readiness
// report plus a sample Demo_Pack `urls[]` block:
//   1. Cloudflare Pages  GET {FRONTEND_URL}               -> HTTP 200 within 5s
//   2. Cloudflare MCP    GET {MCP_ENDPOINT}/health        -> HTTP 200 within 5s
//   3. Storage Worker    GET {STORAGE_WORKER_URL}/health  -> HTTP 200 within 5s (optional)
//
// This script makes REAL outbound GETs to URLs YOU supply (no code/secrets are
// transmitted). It runs nothing automatically — invoke it after a gated deploy:
//
//   MCP_ENDPOINT=https://airvio.co/knowgrph/mcp \
//   FRONTEND_URL=https://airvio.co/knowgrph \
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

function joinUrl(base, suffix) {
  if (!base) return null;
  return `${String(base).replace(/\/+$/, "")}${suffix}`;
}

async function main() {
  const frontend     = process.env.FRONTEND_URL      || "https://airvio.co/knowgrph";
  const mcpEndpoint  = process.env.MCP_ENDPOINT      || "https://airvio.co/knowgrph/mcp";
  const storageUrl   = process.env.STORAGE_WORKER_URL || null;

  const results = await Promise.all([
    probe("Cloudflare Pages (frontend)", frontend),
    probe("Cloudflare MCP /health", joinUrl(mcpEndpoint, "/health"), { expectJsonStatusPass: true }),
    probe("Cloudflare Storage Worker /health", joinUrl(storageUrl, "/health"), { expectJsonStatusPass: true }),
  ]);

  console.log("\n  Runtime-Readiness Verification (Cloudflare)\n  " + "-".repeat(48));
  for (const r of results) {
    const mark = r.status === "PASS" ? "✓" : r.status === "SKIP" ? "–" : "✗";
    console.log(`  ${mark} ${r.status.padEnd(4)} ${r.label}`);
    console.log(`        ${r.url ?? "(no URL provided)"} — ${r.detail}`);
  }

  // Sample Demo_Pack urls[] block: >=1 frontend + >=1 worker endpoint.
  const demoUrls = [];
  if (frontend)    demoUrls.push({ url: frontend, kind: "frontend" });
  if (mcpEndpoint) demoUrls.push({ url: mcpEndpoint, kind: "worker" });
  if (mcpEndpoint) demoUrls.push({ url: joinUrl(mcpEndpoint, "/health"), kind: "worker-health" });
  console.log("\n  Sample Demo_Pack urls[]:");
  console.log("  " + JSON.stringify(demoUrls));

  const probed = results.filter((r) => r.status !== "SKIP");
  const failed  = probed.filter((r) => r.status === "FAIL");
  if (probed.length === 0) {
    console.log("\n  No URLs supplied. Set MCP_ENDPOINT / FRONTEND_URL.\n");
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
