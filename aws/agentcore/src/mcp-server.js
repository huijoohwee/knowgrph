// AgentCore-compatible MCP server for the agentic-canvas-os AWS tier.
//
// Spec: knowgrph-acos-mcp-connector, task 13.1 (R11.1, R11.2, R12.2, R14.1;
// design "Tech Stack — per-repo boundaries", Agent_Api `POST /run` forwarding;
// Correctness Properties 1, 6). Audit decision 13.0: the AgentCore Runtime
// artifact is a THIN MCP-FORWARDING ADAPTER — it forwards to the Cloudflare
// `McpAgent` and holds NO model keys / invokes NO paid model directly.
//
// SCOPE OF THIS TASK (13.1): expose a STATELESS streamable-HTTP MCP server at
// `0.0.0.0:8000/mcp` (the AgentCore Runtime MCP contract) that forwards
// `knowgrph.video_remix.run` + the stage tools to the Cloudflare `McpAgent`
// over MCP Streamable HTTP, REUSING the Section 5 / task 12.1 forwarder
// (`../../agent-api/src/lib/mcp-forwarder.js`) rather than duplicating transport
// logic. The R11 stack boundary is preserved by construction:
//
//   * NO model provider keys are read, referenced, or required here. The only
//     env value consumed is the control-plane endpoint (`MCP_ENDPOINT`).
//   * NO paid model is invoked directly — every `tools/call` is forwarded to
//     the Cloudflare control plane, the only tier that holds keys / calls
//     paid models (R11.2, R11.5).
//   * FAIL-CLOSED (HTTP 501): when the control-plane endpoint is unset, a
//     `tools/call` returns a not-implemented signal rather than making an
//     accidental live call or silently succeeding (mirrors the run handler's
//     `createDefaultRunHandler` env gating).
//   * Property 1 holds by construction: this tier performs NO paid action and
//     duplicates NO gate logic — a control-plane "approval required" response
//     is relayed UNCHANGED to the caller, so no Approval_Gate can be bypassed
//     here (gate enforcement stays on the Cloudflare Hitl_Gate_Service).
//
// This handler is a PURE `(req) => Promise<{ statusCode, headers, body }>`
// function with an injectable transport seam, so the local runtime/tests make
// ZERO live network calls. The socket-binding entrypoint is `server.js`.
//
// LANGUAGE CHOICE (audit finding 13.12): this is the Node-based path (option a)
// — the existing forwarder is Node/TS, so the AgentCore MCP server reuses it
// directly. A clear seam is left for the Python FastMCP alternative (13.12),
// but no model-key boundary changes either way.

import {
  createMcpForwarder,
  createFetchMcpTransport,
  parseSseJsonRpc,
  McpForwardError,
  MCP_TRANSPORT,
  MCP_FORWARD_DEADLINE_MS,
  MCP_DIRECTOR_TOOL_NAME,
} from "../../agent-api/src/lib/mcp-forwarder.js";
import {
  createStageTransitionEmitter,
  extractStageTransitions,
} from "./observability.js";

// --- AgentCore Runtime MCP contract constants -------------------------------

// Re-export the canonical Director tool name so consumers of the AgentCore MCP
// server can reference it without reaching into the agent-api forwarder module.
export { MCP_DIRECTOR_TOOL_NAME } from "../../agent-api/src/lib/mcp-forwarder.js";

/** The AgentCore Runtime streamable-HTTP MCP path (served at `0.0.0.0:8000`). */
export const MCP_PATH = "/mcp";

/**
 * The AgentCore container liveness path (task 13.7 / R3.4, R15.6). OPEN — no
 * Auth_Token required — and reconciled with the agent-api `GET /health`
 * discipline: it returns HTTP 200 within a structural 5,000 ms deadline when
 * healthy and discloses LIVENESS STATUS ONLY (no Run_Manifest data, no
 * credentials, no internal config) — Correctness Property 31.
 */
export const PING_PATH = "/ping";

/** The structural liveness deadline for `GET /ping` (R3.4), mirroring `/health`. */
export const PING_DEADLINE_MS = 5000;

/** Default bind host/port for the AgentCore Runtime MCP contract. */
export const MCP_BIND_HOST = "0.0.0.0";
export const MCP_BIND_PORT = 8000;

/** MCP protocol version advertised on `initialize`. */
export const MCP_PROTOCOL_VERSION = "2024-11-05";

/**
 * MCP Streamable HTTP Accept header (JSON or SSE reply). Re-declared locally so
 * the thin AWS tier imports nothing beyond the forwarder transport seam.
 */
const MCP_STREAMABLE_ACCEPT = "application/json, text/event-stream";

/**
 * Canonical stage tool names forwarded to the control plane. Kept as local
 * constants (NOT imported from the control plane) so the thin product tier
 * holds no control-plane coupling — R11 stack boundary.
 */
export const MCP_STAGE_TOOL_NAMES = Object.freeze([
  "knowgrph.video_remix.research",
  "knowgrph.video_remix.storyboard",
  "knowgrph.video_remix.render",
  "knowgrph.video_remix.publish",
  "knowgrph.video_remix.checkout",
]);

const JSON_HEADERS = Object.freeze({
  "content-type": "application/json",
  "cache-control": "no-store",
});

// --- Tool catalog (R14.1: each tool advertises input AND output schema) -----

/**
 * The tool surface advertised by `tools/list` (R14.1): the Director tool plus
 * each stage tool, each with BOTH an input and an output schema. The schemas
 * mirror the design contracts; they describe the FORWARDED shape only — this
 * tier validates nothing here (the Cloudflare Director is the schema SSOT) and
 * holds no model keys.
 */
export const TOOL_CATALOG = Object.freeze([
  {
    name: MCP_DIRECTOR_TOOL_NAME,
    description:
      "Run the full approval-gated research → storyboard → render → publish → checkout pipeline; forwarded to the Cloudflare control plane.",
    inputSchema: {
      type: "object",
      required: ["referenceUrl", "brief", "budgetUsd"],
      properties: {
        referenceUrl: { type: "string", description: "Absolute HTTP(S) reference video URL" },
        brief: { type: "string", description: "Creative brief (1–10000 chars)" },
        budgetUsd: { type: "number", description: "Budget cap in USD" },
        mode: { type: "string", enum: ["live", "dry-run"] },
        approvals: { type: "array", items: { type: "object" } },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        state: { type: "string" },
        stages: { type: "array" },
        approvalGates: { type: "array" },
        budgetMeters: { type: "object" },
        demoPack: { type: ["object", "null"] },
      },
    },
  },
  {
    name: "knowgrph.video_remix.research",
    description: "Research stage: cite live web context via Exa (forwarded).",
    inputSchema: {
      type: "object",
      required: ["referenceUrl"],
      properties: {
        referenceUrl: { type: "string" },
        query: { type: "string" },
        maxResults: { type: "number" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        sources: { type: "array" },
        citations: { type: "array" },
        summary: { type: "string" },
      },
    },
  },
  {
    name: "knowgrph.video_remix.storyboard",
    description: "Storyboard stage: emit a kgc-computing-flow/v1 shot-plan (forwarded).",
    inputSchema: {
      type: "object",
      required: ["brief", "evidencePack"],
      properties: {
        brief: { type: "string" },
        evidencePack: { type: "object" },
        shotCount: { type: "number" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        canvasDocumentMarkdown: { type: "string" },
        flow: { type: "object" },
      },
    },
  },
  {
    name: "knowgrph.video_remix.render",
    description: "Render stage: dispatch per-shot generation behind the render Approval_Gate (forwarded).",
    inputSchema: {
      type: "object",
      required: ["shots", "renderGateToken"],
      properties: {
        shots: { type: "array" },
        renderGateToken: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: { assets: { type: "array" } },
    },
  },
  {
    name: "knowgrph.video_remix.publish",
    description: "Publish stage: publish rendered assets (forwarded).",
    inputSchema: {
      type: "object",
      required: ["assets"],
      properties: { assets: { type: "array" } },
    },
    outputSchema: {
      type: "object",
      properties: { publishedUrls: { type: "array" } },
    },
  },
  {
    name: "knowgrph.video_remix.checkout",
    description: "Checkout stage: create a gated Stripe checkout behind the payment-action Approval_Gate (forwarded).",
    inputSchema: {
      type: "object",
      required: ["assetUrl", "priceId", "paymentGateToken"],
      properties: {
        assetUrl: { type: "string" },
        priceId: { type: "string" },
        paymentGateToken: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: { sessionId: { type: "string" } },
    },
  },
]);

/** Every advertised tool name (Director + stage tools). */
const KNOWN_TOOL_NAMES = new Set(TOOL_CATALOG.map((t) => t.name));

// --- Response helpers --------------------------------------------------------

/** Build a JSON HTTP response descriptor (mirrors the agent-api handler style). */
function jsonResponse(statusCode, payload, extraHeaders) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, ...(extraHeaders ?? {}) },
    body: JSON.stringify(payload),
  };
}

/** A JSON-RPC success envelope (HTTP 200). */
function rpcResult(id, result) {
  return jsonResponse(200, { jsonrpc: "2.0", id: id ?? null, result });
}

/** A JSON-RPC error envelope (HTTP 200; MCP carries errors in the body). */
function rpcError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return jsonResponse(200, { jsonrpc: "2.0", id: id ?? null, error });
}

/** Extract a `tools/call` result/error from a JSON-RPC transport response. */
function extractMcpResult(response) {
  if (!response || typeof response !== "object") return { result: null, error: null };
  if ("error" in response && response.error) return { result: null, error: response.error };
  if ("result" in response) return { result: response.result ?? null, error: null };
  return { result: response, error: null };
}

// --- Endpoint / transport resolution (fail-closed) --------------------------

/** Resolve the control-plane MCP endpoint from deps/env (empty string if unset). */
function resolveEndpoint(deps) {
  if (typeof deps.endpoint === "string" && deps.endpoint.length > 0) return deps.endpoint;
  const env = deps.env ?? (typeof process !== "undefined" ? process.env : {}) ?? {};
  if (typeof env.MCP_ENDPOINT === "string" && env.MCP_ENDPOINT.length > 0) return env.MCP_ENDPOINT;
  return "";
}

// --- The AgentCore MCP request handler --------------------------------------

/**
 * Create the AgentCore-compatible MCP request handler with injectable seams.
 *
 * The returned function is a PURE `(req) => Promise<response>` over a normalized
 * request descriptor `{ method, path, body }` (the `server.js` entrypoint adapts
 * a Node `http` request into this shape). It is STATELESS: every call is handled
 * independently with no session storage — honoring the AgentCore stateless
 * streamable-HTTP MCP contract.
 *
 * @param {object} [deps]
 * @param {string} [deps.endpoint] control-plane MCP endpoint (default `env.MCP_ENDPOINT`)
 * @param {Record<string,string|undefined>} [deps.env] environment (default `process.env`)
 * @param {(req: { url, method, headers, body }) => Promise<unknown>|unknown} [deps.transport]
 *   injectable MCP Streamable HTTP transport seam. Tests inject a fake; live use
 *   defaults to `createFetchMcpTransport` ONLY when an endpoint is configured
 *   (otherwise the handler fails closed with HTTP 501 — no transport is built).
 * @param {typeof fetch} [deps.fetchImpl] fetch implementation for the live transport
 * @param {() => number} [deps.clock] ms clock for the 2,000 ms deadline (default `Date.now`)
 * @param {{ emit: (rawDiagnostics: unknown) => unknown }} [deps.diagnosticEmitter]
 *   injectable R14.5 stage-transition diagnostic emitter (task 13.6). Defaults
 *   to a redaction-safe structured-stdout/OTEL emitter; tests inject a spy so
 *   no real log line is written and no secret can leak (R15.7 / Property 27).
 * @returns {(req: { method?: string, path?: string, body?: unknown }) => Promise<{ statusCode: number, headers: object, body: string }>}
 */
export function createAgentCoreMcpHandler(deps = {}) {
  const endpoint = resolveEndpoint(deps);
  const hasEndpoint = endpoint.length > 0;
  const clock = typeof deps.clock === "function" ? deps.clock : () => Date.now();

  // R14.5 observability (task 13.6): relay any forwarded stage-transition
  // diagnostics through AgentCore's built-in observability path. The emitter is
  // redaction-safe and fail-closed — no Auth_Token / Approval_Token / secret
  // material can reach a trace/log (R15.7 / Property 27).
  const diagnosticEmitter =
    deps.diagnosticEmitter && typeof deps.diagnosticEmitter.emit === "function"
      ? deps.diagnosticEmitter
      : createStageTransitionEmitter({ clock });

  // Structural liveness signal for `GET /ping` (R3.4). Timer-free: the elapsed
  // ms is injectable so the local runtime/tests stay deterministic and make
  // ZERO live calls (mirrors the agent-api `/health` deadline pattern).
  const pingCheckElapsedMs = Number.isFinite(deps.pingCheckElapsedMs)
    ? Math.max(0, deps.pingCheckElapsedMs)
    : 0;

  // Build the transport ONCE. When the endpoint is unset we build NOTHING and
  // fail closed (HTTP 501) on any forward — never an accidental live call.
  let transport = null;
  if (typeof deps.transport === "function") {
    transport = deps.transport;
  } else if (hasEndpoint) {
    transport = createFetchMcpTransport({ fetchImpl: deps.fetchImpl });
  }

  // The Director-tool forward reuses the Section 5 / 12.1 forwarder verbatim
  // (real 2,000 ms deadline measured against live latency — R12.2 / Property 6).
  const directorForward =
    transport !== null
      ? createMcpForwarder({ transport, endpoint, measureElapsed: true, clock })
      : null;

  /**
   * Forward a generic stage `tools/call` through the SAME transport seam,
   * attaching the shared 2,000 ms deadline metadata (R12.2). Reuses the
   * forwarder module's transport + SSE parsing; no gate logic is duplicated.
   */
  async function forwardStageCall(name, args, id) {
    const httpRequest = {
      url: endpoint,
      method: "POST",
      headers: { "content-type": "application/json", accept: MCP_STREAMABLE_ACCEPT },
      body: {
        jsonrpc: "2.0",
        id: id ?? 1,
        method: "tools/call",
        params: { name, arguments: args && typeof args === "object" ? args : {} },
      },
    };
    const startedAt = clock();
    const response = await transport(httpRequest);
    const elapsed = Math.max(0, clock() - startedAt);
    const { result, error } = extractMcpResult(response);
    return {
      forwarded: true,
      tool: name,
      transport: MCP_TRANSPORT,
      endpoint,
      forwardElapsedMs: elapsed,
      forwardWithinDeadline: elapsed <= MCP_FORWARD_DEADLINE_MS,
      forwardDeadlineMs: MCP_FORWARD_DEADLINE_MS,
      mcpError: error,
      result,
    };
  }

  /** Dispatch a `tools/call`: forward to the control plane (fail-closed if unset). */
  async function handleToolsCall(rpc) {
    const id = rpc.id ?? null;
    const params = rpc.params && typeof rpc.params === "object" ? rpc.params : {};
    const name = params.name;
    if (typeof name !== "string" || name.length === 0) {
      return rpcError(id, -32602, "tools/call requires a string params.name");
    }
    if (!KNOWN_TOOL_NAMES.has(name)) {
      return rpcError(id, -32601, `unknown tool: ${name}`);
    }

    // FAIL-CLOSED (R11 / R12.2): with no control-plane endpoint configured we
    // surface a not-implemented signal as HTTP 501 — no forward, no paid action.
    if (transport === null) {
      return jsonResponse(501, {
        jsonrpc: "2.0",
        id,
        error: {
          code: "not_implemented",
          message:
            "control-plane MCP endpoint is unset (MCP_ENDPOINT); the AgentCore forwarder fails closed",
        },
      });
    }

    let forwardResult;
    try {
      if (name === MCP_DIRECTOR_TOOL_NAME) {
        // Reuse the Director forwarder verbatim (R12.2 / Property 6).
        forwardResult = await directorForward({ body: params.arguments ?? {} });
      } else {
        forwardResult = await forwardStageCall(name, params.arguments, id);
      }
    } catch (err) {
      if (err instanceof McpForwardError && err.code === "not_implemented") {
        return jsonResponse(501, {
          jsonrpc: "2.0",
          id,
          error: { code: "not_implemented", message: err.message },
        });
      }
      // Any other forwarding failure is relayed as a JSON-RPC error (HTTP 200).
      const message = err instanceof Error ? err.message : String(err);
      return rpcError(id, -32000, `MCP forward failed: ${message}`);
    }

    // Property 1 holds by construction: a control-plane "approval required" /
    // gate error is RELAYED UNCHANGED — this tier performs no paid action and
    // duplicates no gate logic.
    if (forwardResult.mcpError) {
      return rpcError(id, -32000, "control-plane MCP error", forwardResult.mcpError);
    }

    // Relay the control-plane tools/call result, preserving the deadline
    // metadata under `_forward` for observability (non-sensitive).
    const result =
      forwardResult.result && typeof forwardResult.result === "object"
        ? forwardResult.result
        : { content: [], structuredContent: forwardResult.result ?? null };

    // R14.5 observability (task 13.6): relay any stage-transition diagnostics
    // carried on the forwarded control-plane result through AgentCore's built-in
    // observability path. The control plane is the SOURCE OF TRUTH (task 1.5);
    // this tier only forwards what it carries, in the canonical five-field shape
    // `{ runId, fromStage, toStage, utcTimestamp, outcomeStatus }`, and the
    // emitter is fail-closed against leaking any secret/token material (R15.7 /
    // Property 27). Emission never alters the relayed response or blocks it.
    try {
      diagnosticEmitter.emit(extractStageTransitions(result));
    } catch {
      // Observability is best-effort and must never break forwarding.
    }

    return rpcResult(id, {
      ...result,
      _forward: {
        tool: forwardResult.tool,
        transport: forwardResult.transport,
        forwardElapsedMs: forwardResult.forwardElapsedMs,
        forwardWithinDeadline: forwardResult.forwardWithinDeadline,
        forwardDeadlineMs: forwardResult.forwardDeadlineMs,
      },
    });
  }

  return async function handle(req = {}) {
    const method = (req.method || "POST").toUpperCase();
    const path = typeof req.path === "string" ? req.path : "/";

    // OPEN liveness probe (task 13.7 / R3.4, R15.6 / Property 31). Served here
    // (not auth-gated) so the AgentCore container `/ping` returns HTTP 200 fast
    // when healthy and discloses LIVENESS STATUS ONLY — no Run_Manifest data,
    // no credentials, no internal config (no env/endpoint/secret read on this
    // path). Reconciled with the agent-api `GET /health` response discipline.
    if (path === PING_PATH) {
      if (method !== "GET") {
        return jsonResponse(405, {
          error: "method_not_allowed",
          message: `${PING_PATH} only supports GET (liveness)`,
        });
      }
      const withinDeadline = pingCheckElapsedMs <= PING_DEADLINE_MS;
      return jsonResponse(200, {
        status: withinDeadline ? "ok" : "degraded",
        checkElapsedMs: pingCheckElapsedMs,
        checkWithinDeadline: withinDeadline,
        checkDeadlineMs: PING_DEADLINE_MS,
      });
    }

    // Only the AgentCore MCP path is served beyond liveness.
    if (path !== MCP_PATH) {
      return jsonResponse(404, { error: "not_found", message: `no route for ${path}` });
    }
    if (method !== "POST") {
      return jsonResponse(405, {
        error: "method_not_allowed",
        message: `${MCP_PATH} only supports POST (MCP Streamable HTTP)`,
      });
    }

    // Parse the JSON-RPC body (object passthrough, JSON string, or SSE frame).
    let rpc;
    try {
      rpc = parseRpcBody(req.body);
    } catch {
      return rpcError(null, -32700, "parse error: request body is not valid JSON-RPC");
    }
    if (!rpc || typeof rpc !== "object" || rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string") {
      return rpcError(rpc?.id ?? null, -32600, "invalid JSON-RPC request");
    }

    switch (rpc.method) {
      case "initialize":
        return rpcResult(rpc.id ?? null, {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: "knowgrph-agentcore-mcp-forwarder",
            version: "0.1.0",
            transport: MCP_TRANSPORT,
          },
        });
      case "tools/list":
        return rpcResult(rpc.id ?? null, { tools: TOOL_CATALOG });
      case "ping":
        return rpcResult(rpc.id ?? null, {});
      case "tools/call":
        return handleToolsCall(rpc);
      default:
        // Notifications (no id) are acknowledged without a body.
        if (rpc.id === undefined || rpc.id === null) {
          return jsonResponse(202, { accepted: true });
        }
        return rpcError(rpc.id, -32601, `method not found: ${rpc.method}`);
    }
  };
}

/** Parse a JSON-RPC body from an object, a JSON string, or an SSE frame. */
function parseRpcBody(body) {
  if (body === undefined || body === null || body === "") return null;
  if (typeof body === "object") return body;
  if (typeof body !== "string") return null;
  const trimmed = body.trimStart();
  if (trimmed.startsWith("data:")) {
    return parseSseJsonRpc(body);
  }
  return JSON.parse(body);
}
