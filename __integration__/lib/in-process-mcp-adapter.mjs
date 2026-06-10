// In-process cross-tier MCP Streamable HTTP adapter
// (knowgrph-acos-mcp-connector spec, integration task 9.2 — R12.2).
//
// PURPOSE: this is the REAL wiring of two production modules to each other
// across the AWS<->Cloudflare tier boundary, exercised entirely in-process with
// ZERO live network calls:
//
//   Agent_Api forwarder  ─────────────►  McpAgent worker dispatch
//   (aws/agent-api/src/lib/mcp-forwarder.js)   (cloudflare/workers/knowgrph-mcp/
//    createMcpForwarder → transport seam)       run-manifest/dispatch.mjs →
//                                               dispatchKnowgrphMcpToolCall →
//                                               tool-registry → video-remix runtime)
//
// The Agent_Api forwarder builds the exact MCP Streamable HTTP `tools/call`
// JSON-RPC envelope it would hand to a live `fetch` against
// airvio.co/knowgrph/mcp (`buildForwardHttpRequest`). Instead of opening a
// socket, this adapter hands that envelope DIRECTLY to the control-plane
// worker's tool-call dispatcher (the same code path the deployed Worker entry
// `index.ts` runs for `tools/call`), then wraps the dispatcher's result back
// into the JSON-RPC response shape the forwarder's `extractMcpResult` parses.
//
// This is NOT a spy: the request really flows through the Director runtime
// (`runVideoRemix`) and the REAL durable Run_Manifest persistence DO
// (`RunManifestStore` backed by an in-memory storage shim), so the
// forwarding contract (R12.2) is genuinely exercised across the tier seam.
//
// In task 11.4 the SAME forwarder is pointed at the live endpoint by swapping
// this in-process transport for a real `fetch` — no caller changes required.

import { dispatchKnowgrphMcpToolCall } from "../../cloudflare/workers/knowgrph-mcp/run-manifest/dispatch.mjs";
import { RunManifestStore } from "../../cloudflare/workers/knowgrph-mcp/run-manifest/persistence.mjs";

/**
 * Minimal in-memory `DurableObjectStorage` shim: async `get(key)` /
 * `put(key|batch, value)` compatible with `RunManifestPersistence`.
 */
function createInMemoryStorage() {
  const map = new Map();
  return {
    async get(key) {
      return map.get(key);
    },
    async put(keyOrBatch, value) {
      if (keyOrBatch && typeof keyOrBatch === "object") {
        for (const [k, v] of Object.entries(keyOrBatch)) map.set(k, v);
        return;
      }
      map.set(keyOrBatch, value);
    },
  };
}

/**
 * Build an in-memory `RUN_MANIFEST_STORE` DurableObjectNamespace that reuses
 * the REAL `RunManifestStore` DO class (reuse-not-rebuild). Each runId gets its
 * own store instance, exactly like the deployed namespace. No network, no
 * Cloudflare runtime required.
 */
export function createInMemoryRunManifestNamespace() {
  const stores = new Map();
  return {
    idFromName(name) {
      return { name: String(name) };
    },
    get(id) {
      const key = id && typeof id === "object" ? String(id.name) : String(id);
      if (!stores.has(key)) {
        stores.set(key, new RunManifestStore({ storage: createInMemoryStorage() }, {}));
      }
      const store = stores.get(key);
      return { fetch: (request) => store.fetch(request) };
    },
  };
}

/**
 * Create the in-process MCP Streamable HTTP transport seam to inject into the
 * Agent_Api forwarder (`createMcpForwarder({ transport })`) or the forwarding
 * run handler (`createForwardingRunHandler({ transport })`).
 *
 * It accepts the forwarder's HTTP request descriptor `{ url, method, headers,
 * body }` (where `body` is the JSON-RPC `tools/call` envelope), dispatches it
 * in-process to the control-plane worker, and returns a JSON-RPC response
 * envelope `{ jsonrpc, id, result }` the forwarder can unwrap.
 *
 * @param {object} [opts]
 * @param {object} [opts.namespace] RUN_MANIFEST_STORE namespace (defaults to a
 *   fresh in-memory namespace using the real DO class)
 * @returns {{ transport: (req: object) => Promise<object>, calls: object[], namespace: object }}
 */
export function createInProcessMcpTransport(opts = {}) {
  const namespace = opts.namespace ?? createInMemoryRunManifestNamespace();
  const calls = [];

  const transport = async (httpRequest) => {
    calls.push(httpRequest);

    // The forwarder always sends a JSON-RPC `tools/call` envelope over the MCP
    // Streamable HTTP transport. Mirror the control-plane worker's parsing.
    const rpc = httpRequest && httpRequest.body;
    if (!rpc || rpc.method !== "tools/call" || !rpc.params || typeof rpc.params.name !== "string") {
      return {
        jsonrpc: "2.0",
        id: rpc && rpc.id != null ? rpc.id : null,
        error: { code: -32600, message: "Invalid MCP tools/call request" },
      };
    }

    // REAL cross-tier dispatch: drive the Director runtime + durable
    // Run_Manifest persistence through the worker's shared tool-call path.
    const dispatched = await dispatchKnowgrphMcpToolCall({
      toolName: rpc.params.name,
      args: rpc.params.arguments ?? {},
      namespace,
    });

    return {
      jsonrpc: "2.0",
      id: rpc.id,
      result: {
        content: [{ type: "text", text: dispatched.text }],
        structuredContent: dispatched.structuredContent,
        isError: dispatched.ok === false,
      },
    };
  };

  return { transport, calls, namespace };
}
