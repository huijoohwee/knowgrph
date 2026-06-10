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
 * Default transport seam. Until MCP Streamable HTTP forwarding is wired to a
 * live `fetch` (task 9.2), invoking the forwarder without an injected transport
 * surfaces a clearly-tagged not-implemented signal rather than silently
 * succeeding or making a live network call.
 */
async function defaultTransport() {
  throw new McpForwardError(
    "MCP Streamable HTTP transport is not wired yet (task 9.2)",
    "not_implemented",
  );
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
 *   live `fetch` wiring is task 9.2). Invoked EXACTLY ONCE per valid request.
 * @param {string} [deps.endpoint] MCP endpoint URL (default airvio.co/knowgrph/mcp)
 * @param {number} [deps.forwardElapsedMs] injected elapsed signal modelling live
 *   forward latency for the 2,000 ms deadline assertion (default 0 — synchronous)
 * @param {string} [deps.sessionId] optional Mcp-Session-Id for session resume
 * @param {string|number} [deps.requestId] JSON-RPC request id (default 1)
 * @returns {(args: { body: object }) => Promise<object>} the `onValidRequest` seam
 */
export function createMcpForwarder(deps = {}) {
  const transport = typeof deps.transport === "function" ? deps.transport : defaultTransport;
  const endpoint = typeof deps.endpoint === "string" && deps.endpoint ? deps.endpoint : MCP_DEFAULT_ENDPOINT;

  return async function forwardValidRequest({ body }) {
    const httpRequest = buildForwardHttpRequest(body, {
      endpoint,
      id: deps.requestId,
      sessionId: deps.sessionId,
    });

    // Forward EXACTLY ONCE through the injectable seam (R12.2 / Property 6).
    const response = await transport(httpRequest);
    const { result, error } = extractMcpResult(response);

    // 2,000 ms forwarding-deadline metadata (R12.2) — asserted structurally.
    const forwardElapsedMs = resolveForwardElapsedMs(deps.forwardElapsedMs);

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
