// In-process MCP Streamable HTTP tool-surface seam — knowgrph-acos-mcp-connector
// spec, task 9.3 (R14.1; design Mcp_Agent "Tool surface (R14.1, R14.4)" +
// "expose ... tools to remote clients over MCP Streamable HTTP transport").
//
// PURPOSE: prove the MCP tool surface is REACHABLE and ENUMERABLE through the
// Streamable HTTP transport WITHOUT any live network/socket. The deployed
// Worker entry (`cloudflare/workers/knowgrph-mcp/index.ts`) speaks MCP
// Streamable HTTP: a client POSTs JSON-RPC envelopes (`tools/list`,
// `tools/call`) to `airvio.co/knowgrph/mcp`. This seam hands those SAME
// JSON-RPC envelopes DIRECTLY to the Worker's real code paths in-process:
//
//   tools/list -> buildKnowgrphMcpToolDefinitions()      (the canonical surface
//                                                          the Worker lists)
//   tools/call -> dispatchKnowgrphMcpToolCall(...)        (the shared dispatch
//                                                          path index.ts runs)
//
// It REUSES the in-memory `RUN_MANIFEST_STORE` namespace built from the real
// `RunManifestStore` DO class (`__integration__/lib/in-process-mcp-adapter.mjs`)
// — no fork. The transport is injectable so task 11.4 can swap it for a real
// `fetch` against the live endpoint with no caller changes.

import { createInMemoryRunManifestNamespace } from "../../__integration__/lib/in-process-mcp-adapter.mjs";
import { dispatchKnowgrphMcpToolCall } from "../../cloudflare/workers/knowgrph-mcp/run-manifest/dispatch.mjs";
import {
  buildKnowgrphMcpToolDefinitions,
  KNOWGRPH_MCP_CONTRACT_VERSION,
} from "../../cloudflare/workers/knowgrph-mcp/tool-registry.mjs";

/** The MCP Streamable HTTP endpoint the deployed Worker serves (R14.1). */
export const MCP_STREAMABLE_HTTP_URL = "https://airvio.co/knowgrph/mcp";

const JSON_RPC_INVALID_REQUEST = -32600;
const JSON_RPC_METHOD_NOT_FOUND = -32601;

/**
 * Create an injectable in-process MCP Streamable HTTP transport. The returned
 * `transport(httpRequest)` accepts the `{ url, method, headers, body }` request
 * descriptor an MCP Streamable HTTP client builds (where `body` is a JSON-RPC
 * envelope) and returns a JSON-RPC response envelope `{ jsonrpc, id, result }`
 * the client unwraps — mirroring the deployed Worker's transport.
 *
 * @param {object} [opts]
 * @param {object} [opts.namespace] RUN_MANIFEST_STORE namespace (defaults to a
 *   fresh in-memory namespace built from the real DO class)
 * @returns {{ transport: (req: object) => Promise<object>, calls: object[], namespace: object }}
 */
export function createInProcessStreamableHttpTransport(opts = {}) {
  const namespace = opts.namespace ?? createInMemoryRunManifestNamespace();
  const calls = [];

  const transport = async (httpRequest) => {
    calls.push(httpRequest);
    const rpc = httpRequest && httpRequest.body;
    const id = rpc && rpc.id != null ? rpc.id : null;

    if (!rpc || typeof rpc.method !== "string") {
      return jsonRpcError(id, JSON_RPC_INVALID_REQUEST, "Invalid JSON-RPC request");
    }

    if (rpc.method === "tools/list") {
      // Enumerate the tool surface exactly as the Worker lists it (R14.1/R14.4).
      return {
        jsonrpc: "2.0",
        id,
        result: {
          contractVersion: KNOWGRPH_MCP_CONTRACT_VERSION,
          tools: buildKnowgrphMcpToolDefinitions(),
        },
      };
    }

    if (rpc.method === "tools/call") {
      if (!rpc.params || typeof rpc.params.name !== "string") {
        return jsonRpcError(id, JSON_RPC_INVALID_REQUEST, "Invalid MCP tools/call request");
      }
      const dispatched = await dispatchKnowgrphMcpToolCall({
        toolName: rpc.params.name,
        args: rpc.params.arguments ?? {},
        namespace,
      });
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: dispatched.text }],
          structuredContent: dispatched.structuredContent,
          isError: dispatched.ok === false,
        },
      };
    }

    return jsonRpcError(id, JSON_RPC_METHOD_NOT_FOUND, `Unknown method: ${rpc.method}`);
  };

  return { transport, calls, namespace };
}

function jsonRpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/**
 * Minimal MCP Streamable HTTP client bound to a transport seam. Builds the
 * JSON-RPC envelopes a real remote client would POST to the endpoint and
 * unwraps the responses. Used by the connectivity smoke test so the assertion
 * exercises the same request/response shape the deployed transport uses.
 *
 * @param {(req: object) => Promise<object>} transport
 * @param {string} [endpointUrl]
 */
export function createStreamableHttpClient(transport, endpointUrl = MCP_STREAMABLE_HTTP_URL) {
  let nextId = 1;

  async function send(method, params) {
    const id = nextId++;
    const response = await transport({
      url: endpointUrl,
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: { jsonrpc: "2.0", id, method, params },
    });
    if (response && response.error) {
      const err = new Error(response.error.message || "MCP transport error");
      err.code = response.error.code;
      throw err;
    }
    return response ? response.result : undefined;
  }

  return {
    /** Enumerate the reachable tool surface (R14.1). */
    listTools: () => send("tools/list", {}),
    /** Invoke a tool by name over the transport. */
    callTool: (name, args = {}) => send("tools/call", { name, arguments: args }),
  };
}
