// MCP Streamable HTTP forwarding for the AWS Agent-API tier.
//
// Spec: knowgrph-acos-mcp-connector, task 5.3 (R12.2; design Agent_Api
// `POST /run`; Correctness Property 6).
//
// SCOPE OF THIS TASK (5.3): when a `POST /run` request passes schema validation
// (task 5.2), forward a `knowgrph.video_remix.run` MCP call to the McpAgent over
// MCP Streamable HTTP transport WITHIN A 2,000 ms DEADLINE of validation
// completion (R12.2). The forwarding goes THROUGH AN INJECTABLE TRANSPORT SEAM
// so the local runtime/tests make ZERO live network calls; the live wiring
// (a real `fetch` to airvio.co/knowgrph/mcp) is integration task 9.2 and is a
// drop-in swap for the default seam.
//
// The 2,000 ms forwarding deadline is recorded as STRUCTURAL METADATA and
// asserted structurally — there is NO real timer here. An injectable elapsed
// signal (`forwardElapsedMs`) models a slow live forward, mirroring the
// render-harness (`dispatchElapsedMs`) and commerce-harness (`checkoutElapsedMs`)
// deadline pattern (`RENDER_DISPATCH_DEADLINE_MS` / `COMMERCE_CHECKOUT_DEADLINE_MS`).
//
// The request envelope mirrors the McpAgent MCP Streamable HTTP transport shape
// in `cloudflare/workers/knowgrph-mcp/index.ts` (a JSON-RPC `tools/call` POST to
// the `/knowgrph/mcp` path with an `application/json, text/event-stream` Accept
// header), so task 9.2 can replace the default seam with a real `fetch` without
// touching this module's callers.

// --- Transport / contract constants (mirrors the control-plane worker) ------

// Structural forwarding deadline (R12.2): a schema-passing request must be
// forwarded within 2,000 ms of validation completion. Timer-free here — the
// deterministic seam forwards synchronously; an injectable elapsed signal models
// a slow live forward without a real timer.
export const MCP_FORWARD_DEADLINE_MS = 2000;

// Canonical Director tool name the Agent_Api forwards to. Mirrors
// `KNOWGRPH_MCP_DIRECTOR_TOOL_NAME` in the control-plane worker's tool-registry
// (kept as a local constant so the thin product tier imports nothing from the
// control plane — R11 stack boundary).
export const MCP_DIRECTOR_TOOL_NAME = "knowgrph.video_remix.run";

// Default control-plane MCP Streamable HTTP endpoint (airvio.co/knowgrph/mcp).
export const MCP_DEFAULT_ENDPOINT = "https://airvio.co/knowgrph/mcp";

// Transport label recorded on the forwarding result + advertised in the
// `mcp-session`-style Accept header negotiation. Matches the worker health body
// (`transport: "mcp/streamable-http"`).
export const MCP_TRANSPORT = "mcp/streamable-http";

// MCP Streamable HTTP clients send this Accept header so the server may answer
// with either a single JSON response or an SSE stream.
const MCP_ACCEPT = "application/json, text/event-stream";

/**
 * Typed forwarding error. `code: "not_implemented"` is mapped by the `POST /run`
 * handler to an HTTP 501 (the default seam throws it until task 9.2 wires a
 * live transport); other forwarding failures surface `code: "mcp_forward_failed"`.
 */
export class McpForwardError extends Error {
  constructor(message, code = "mcp_forward_failed") {
    super(message);
    this.name = "McpForwardError";
    this.code = code;
  }
}

/**
 * Default transport seam. Invoking the forwarder without an injected transport
 * (and without opting into the live `fetch` transport) surfaces a clearly-tagged
 * not-implemented signal rather than silently succeeding or making a live
 * network call. The live transport is `createFetchMcpTransport` below; the
 * default stays inert so an un-wired deployment fails closed (HTTP 501).
 */
async function defaultTransport() {
  throw new McpForwardError(
    "MCP Streamable HTTP transport is not wired (inject createFetchMcpTransport for live forwarding)",
    "not_implemented",
  );
}

/**
 * Parse a JSON-RPC payload out of an MCP Streamable HTTP `text/event-stream`
 * (SSE) body. The MCP Streamable HTTP transport may answer a `tools/call` POST
 * with an SSE stream whose `data:` lines carry JSON-RPC frames; the final
 * `data:` frame holds the `tools/call` result. We scan for the last parseable
 * `data:` JSON object so a single-frame or multi-frame stream both resolve.
 *
 * @param {string} text the raw SSE body
 * @returns {object|null} the last parseable JSON-RPC frame, or null
 */
export function parseSseJsonRpc(text) {
  if (typeof text !== "string" || text.length === 0) return null;
  let last = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimStart();
    if (!line.startsWith("data:")) continue;
    const payload = line.slice("data:".length).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      last = JSON.parse(payload);
    } catch {
      // Ignore non-JSON keep-alive / comment frames.
    }
  }
  return last;
}

/**
 * Live MCP Streamable HTTP transport seam. This is the drop-in that replaces the
 * not-implemented default: it performs a single real POST of the JSON-RPC
 * `tools/call` envelope to the control-plane MCP endpoint and returns the parsed
 * JSON-RPC response, tolerating either a JSON (`application/json`) or an SSE
 * (`text/event-stream`) reply per the MCP Streamable HTTP contract.
 *
 * Network-free testability: `fetchImpl` is injectable, so tests pass a fake
 * `fetch` and assert request shaping + response parsing without any live call.
 *
 * @param {object} [opts]
 * @param {typeof fetch} [opts.fetchImpl] fetch implementation (default global `fetch`)
 * @returns {(req: { url, method, headers, body }) => Promise<object|null>}
 */
export function createFetchMcpTransport(opts = {}) {
  const fetchImpl =
    typeof opts.fetchImpl === "function" ? opts.fetchImpl : globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new McpForwardError(
      "no fetch implementation available for the live MCP transport",
      "mcp_forward_failed",
    );
  }
  return async function fetchTransport(req) {
    let response;
    try {
      response = await fetchImpl(req.url, {
        method: req.method,
        headers: req.headers,
        body: JSON.stringify(req.body),
      });
    } catch (err) {
      throw new McpForwardError(
        `MCP Streamable HTTP forward failed: ${err instanceof Error ? err.message : String(err)}`,
        "mcp_forward_failed",
      );
    }
    const status = typeof response?.status === "number" ? response.status : 0;
    if (status && (status < 200 || status >= 300)) {
      throw new McpForwardError(
        `MCP Streamable HTTP forward returned HTTP ${status}`,
        "mcp_forward_failed",
      );
    }
    const contentType =
      (typeof response?.headers?.get === "function"
        ? response.headers.get("content-type")
        : "") || "";
    if (contentType.includes("text/event-stream")) {
      const text = await response.text();
      return parseSseJsonRpc(text);
    }
    // Default to JSON; fall back to SSE parsing if the body is a stream string.
    try {
      return await response.json();
    } catch {
      const text = typeof response.text === "function" ? await response.text() : "";
      return parseSseJsonRpc(text);
    }
  };
}

/**
 * Build the MCP Streamable HTTP `tools/call` JSON-RPC request envelope for a
 * `knowgrph.video_remix.run` forward, mirroring the shape the control-plane
 * `KnowgrphMcpAgent.serve(MCP_PATH)` handler accepts. The arguments are the
 * VALIDATED `POST /run` fields only (referenceUrl, brief, budgetUsd, approvals);
 * `mode` is intentionally left to the Director's default.
 *
 * @param {object} body the schema-validated `POST /run` body
 * @param {object} [opts]
 * @param {string|number} [opts.id] JSON-RPC request id (default `1`)
 * @returns {{ jsonrpc: "2.0", id: string|number, method: "tools/call", params: object }}
 */
export function buildVideoRemixRunRequest(body, opts = {}) {
  const src = body && typeof body === "object" ? body : {};
  const args = {
    referenceUrl: src.referenceUrl,
    brief: src.brief,
    budgetUsd: src.budgetUsd,
    // approvals is optional in the schema; forward an explicit empty array so
    // the Director sees a well-formed (if empty) approvals[] (R2.3 halt path).
    approvals: Array.isArray(src.approvals) ? src.approvals : [],
  };
  return {
    jsonrpc: "2.0",
    id: opts.id ?? 1,
    method: "tools/call",
    params: {
      name: MCP_DIRECTOR_TOOL_NAME,
      arguments: args,
    },
  };
}

/**
 * Build the HTTP request descriptor a Streamable HTTP transport sends. This is
 * the exact shape task 9.2 hands to `fetch` (a POST to the `/knowgrph/mcp` path
 * with the MCP Accept header and a JSON-RPC body).
 *
 * @param {object} body the schema-validated `POST /run` body
 * @param {object} [opts]
 * @param {string} [opts.endpoint] MCP endpoint URL (default airvio.co/knowgrph/mcp)
 * @param {string|number} [opts.id] JSON-RPC request id
 * @param {string} [opts.sessionId] optional Mcp-Session-Id to resume a session
 * @returns {{ url: string, method: "POST", headers: object, body: object }}
 */
export function buildForwardHttpRequest(body, opts = {}) {
  const endpoint = typeof opts.endpoint === "string" && opts.endpoint ? opts.endpoint : MCP_DEFAULT_ENDPOINT;
  const headers = {
    "content-type": "application/json",
    accept: MCP_ACCEPT,
  };
  if (typeof opts.sessionId === "string" && opts.sessionId) {
    headers["mcp-session-id"] = opts.sessionId;
  }
  return {
    url: endpoint,
    method: "POST",
    headers,
    body: buildVideoRemixRunRequest(body, opts),
  };
}

/**
 * Extract the `tools/call` result payload from a JSON-RPC response, tolerating
 * the several shapes a transport seam might return:
 *   - a full JSON-RPC envelope `{ jsonrpc, id, result | error }`
 *   - the bare `result` object `{ content, structuredContent, isError }`
 *   - `null`/`undefined` (no usable payload)
 *
 * @param {unknown} response
 * @returns {{ result: object|null, error: object|null }}
 */
function extractMcpResult(response) {
  if (!response || typeof response !== "object") return { result: null, error: null };
  if ("error" in response && response.error) return { result: null, error: response.error };
  if ("result" in response) return { result: response.result ?? null, error: null };
  // Already-unwrapped result envelope.
  return { result: response, error: null };
}

/**
 * Resolve the (timer-free) forwarding-elapsed signal. The real elapsed time is
 * measured by the live wiring (task 9.2); here a caller injects whether the
 * forward exceeded the 2,000 ms deadline so the metadata can be asserted
 * structurally. Defaults to 0 (synchronous deterministic seam).
 */
function resolveForwardElapsedMs(value) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Create the MCP forwarder used as the `POST /run` handler's `onValidRequest`
 * seam (task 5.2 integration point). When the schema passes, the handler calls
 * the returned function with `{ body }`; it forwards a single
 * `knowgrph.video_remix.run` MCP call through the injected transport seam and
 * returns the forwarding result (including the 2,000 ms deadline metadata).
 *
 * @param {object} [deps]
 * @param {(req: { url, method, headers, body }) => Promise<unknown>|unknown} [deps.transport]
 *   injectable MCP Streamable HTTP transport seam (default: not-implemented;
 *   pass `createFetchMcpTransport()` for live forwarding). Invoked EXACTLY ONCE
 *   per valid request.
 * @param {string} [deps.endpoint] MCP endpoint URL (default airvio.co/knowgrph/mcp)
 * @param {number} [deps.forwardElapsedMs] injected elapsed signal modelling live
 *   forward latency for the 2,000 ms deadline assertion (default 0 — synchronous).
 *   Takes precedence over `measureElapsed` when finite.
 * @param {boolean} [deps.measureElapsed] when true (and `forwardElapsedMs` is not
 *   injected), measure the REAL wall-clock elapsed of the transport call via
 *   `clock` so the 2,000 ms deadline (R12.2) is enforced against actual live
 *   latency. Defaults to false to keep the deterministic test path timer-free.
 * @param {() => number} [deps.clock] ms clock used when `measureElapsed` is true
 *   (default `Date.now`).
 * @param {string} [deps.sessionId] optional Mcp-Session-Id for session resume
 * @param {string|number} [deps.requestId] JSON-RPC request id (default 1)
 * @returns {(args: { body: object }) => Promise<object>} the `onValidRequest` seam
 */
export function createMcpForwarder(deps = {}) {
  const transport = typeof deps.transport === "function" ? deps.transport : defaultTransport;
  const endpoint = typeof deps.endpoint === "string" && deps.endpoint ? deps.endpoint : MCP_DEFAULT_ENDPOINT;
  const measureElapsed = deps.measureElapsed === true;
  const clock = typeof deps.clock === "function" ? deps.clock : () => Date.now();

  return async function forwardValidRequest({ body }) {
    const httpRequest = buildForwardHttpRequest(body, {
      endpoint,
      id: deps.requestId,
      sessionId: deps.sessionId,
    });

    // Forward EXACTLY ONCE through the injectable seam (R12.2 / Property 6).
    const startedAt = measureElapsed ? clock() : 0;
    const response = await transport(httpRequest);
    const { result, error } = extractMcpResult(response);

    // 2,000 ms forwarding-deadline (R12.2). An injected `forwardElapsedMs`
    // wins (deterministic tests); otherwise, when `measureElapsed` is set, the
    // REAL transport latency is measured for live enforcement; otherwise 0.
    let forwardElapsedMs;
    if (Number.isFinite(deps.forwardElapsedMs)) {
      forwardElapsedMs = resolveForwardElapsedMs(deps.forwardElapsedMs);
    } else if (measureElapsed) {
      forwardElapsedMs = Math.max(0, clock() - startedAt);
    } else {
      forwardElapsedMs = 0;
    }

    return {
      forwarded: true,
      tool: MCP_DIRECTOR_TOOL_NAME,
      transport: MCP_TRANSPORT,
      endpoint,
      forwardElapsedMs,
      forwardWithinDeadline: forwardElapsedMs <= MCP_FORWARD_DEADLINE_MS,
      forwardDeadlineMs: MCP_FORWARD_DEADLINE_MS,
      mcpError: error,
      result,
    };
  };
}
