// AgentCore Runtime container entrypoint for the knowgrph MCP-forwarding adapter.
//
// Spec: knowgrph-acos-mcp-connector, task 13.1 (R11.1, R11.2, R12.2, R14.1).
//
// Binds the STATELESS streamable-HTTP MCP server at `0.0.0.0:8000/mcp` per the
// AgentCore Runtime MCP contract and delegates every request to the PURE
// handler in `mcp-server.js` (which reuses the Section 5 / 12.1 forwarder to
// reach the Cloudflare control plane). This file is the THIN socket adapter
// only — all behavior, the R11 no-keys boundary, and the fail-closed (HTTP 501)
// path live in `createAgentCoreMcpHandler`.
//
// No model provider keys are read here. The only env consumed is the
// control-plane endpoint (`MCP_ENDPOINT`); when unset, `tools/call` fails closed
// with HTTP 501 (see `mcp-server.js`). `PORT`/`HOST` override the bind address.

import http from "node:http";

import {
  createAgentCoreMcpHandler,
  MCP_BIND_HOST,
  MCP_BIND_PORT,
  MCP_PATH,
} from "./mcp-server.js";
import { withInboundAuth } from "./inbound-auth.js";
import { createEnvSecretProvider } from "../../agent-api/src/lib/auth-token.js";

/** Read the whole request body (bounded) as a UTF-8 string. */
function readBody(req, limitBytes = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * Compose the R15 inbound auth verifying layer (task 13.4) IN FRONT of the
 * `/mcp` MCP-forwarding handler so NO MCP forwarding occurs without a valid
 * Auth_Token (R15.1) and the Caller_Identity is established before forwarding
 * (R15.2). A missing/malformed/invalid/expired token yields a non-disclosing
 * 401 with no forward and no Run_Manifest disclosure (R15.3 / Property 28).
 *
 * Routing: ONLY the `/mcp` path is auth-gated. The open `/ping` liveness probe
 * (task 13.7 / R15.6) and any other path bypass auth and reach the bare handler
 * (which 404s unknown routes) — mirroring the agent-api split where `/health`
 * stays open while the spend/state endpoints are gated.
 *
 * Auth is FAIL-CLOSED: the HS256 secret is read from the container env
 * (`AUTH_JWT_SECRET`, sourced from Secrets Manager at deploy — R15.7). When it
 * is unset, the verifying layer returns a non-disclosing 500 and never forwards.
 *
 * @param {object} [opts]
 * @param {(req: object) => Promise<{ statusCode, headers, body }>} [opts.handler]
 *   the inner MCP handler (default `createAgentCoreMcpHandler()`)
 * @param {{ getSecret: () => Promise<string>|string }} [opts.secretProvider]
 *   HS256 secret provider (default container-env provider)
 * @param {() => number} [opts.clock] ms clock seam (auth expiry)
 * @param {unknown} [opts.expiryWindowSeconds] Auth_Token expiry window (R15.8)
 * @returns {(req: { method?, path?, headers?, body? }) => Promise<{ statusCode, headers, body }>}
 */
export function createRoutedHandler(opts = {}) {
  const mcpHandler = opts.handler ?? createAgentCoreMcpHandler();
  const authedMcp = withInboundAuth(mcpHandler, {
    secretProvider: opts.secretProvider ?? createEnvSecretProvider(),
    clock: opts.clock,
    expiryWindowSeconds: opts.expiryWindowSeconds,
  });
  return async function routed(req = {}) {
    const path = typeof req.path === "string" ? req.path : "/";
    // Auth-gate only the MCP forwarding surface; `/ping` (13.7) + others open.
    if (path === MCP_PATH) {
      return authedMcp(req);
    }
    return mcpHandler(req);
  };
}

/**
 * Build the Node `http` server bound to the AgentCore MCP contract. The handler
 * is injectable so this factory stays unit-testable without binding a socket.
 * By default the `/mcp` path is gated by the R15 inbound auth verifying layer
 * (task 13.4); pass `opts.handler` to inject a pre-composed handler in tests.
 *
 * @param {object} [opts]
 * @param {(req: object) => Promise<{ statusCode, headers, body }>} [opts.handler]
 *   a fully-composed handler to use verbatim (skips the default auth routing)
 * @param {{ getSecret: () => Promise<string>|string }} [opts.secretProvider]
 * @param {() => number} [opts.clock]
 * @param {unknown} [opts.expiryWindowSeconds]
 * @returns {import("node:http").Server}
 */
export function createServer(opts = {}) {
  const handler = createRoutedHandler(opts);
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const body = req.method === "GET" || req.method === "HEAD" ? "" : await readBody(req);
      // Pass request headers through so the inbound auth layer can read the
      // `Authorization: Bearer <Auth_Token>` header (task 13.4).
      const result = await handler({
        method: req.method,
        path: url.pathname,
        headers: req.headers,
        body,
      });
      res.writeHead(result.statusCode, result.headers);
      res.end(result.body);
    } catch (err) {
      // Non-disclosing 500: never leak a stack/config/credential to the wire.
      res.writeHead(500, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ error: "internal_error", message: "request handling failed" }));
    }
  });
}

/** Start the server (used when run as the container entrypoint). */
export function startServer(opts = {}) {
  const host = opts.host ?? process.env.HOST ?? MCP_BIND_HOST;
  const port = Number(opts.port ?? process.env.PORT ?? MCP_BIND_PORT);
  const server = createServer(opts);
  server.listen(port, host, () => {
    // Liveness log only — no secrets, no endpoint internals beyond presence.
    const endpointConfigured = Boolean(process.env.MCP_ENDPOINT);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        status: "listening",
        host,
        port,
        path: "/mcp",
        transport: "mcp/streamable-http",
        controlPlaneEndpointConfigured: endpointConfigured,
      }),
    );
  });
  return server;
}

// Run as the container entrypoint when invoked directly.
const invokedDirectly =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  import.meta.url === `file://${process.argv[1]}`;

if (invokedDirectly) {
  startServer();
}
