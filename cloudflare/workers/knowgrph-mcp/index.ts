// Cloudflare Worker entry for the knowgrph control-plane McpAgent.
//
// Spec: knowgrph-acos-mcp-connector
//   - task 1.1 (R14.1; Properties 1, 26): Agents SDK `McpAgent` exposed
//     over MCP Streamable HTTP transport at airvio.co/knowgrph/control-plane/mcp.
//   - task 1.2 (R14.2; Property 25): durable Run_Manifest persistence so
//     a Director run state change is written within 2s and a subsequent
//     `GET /runs/{id}` returns the latest persisted state.
//
// This Worker reuses the existing `mcp/video-remix-runtime.js` Director and
// the canonical tool definitions in `./tool-registry.mjs` (which carries the
// Director + 5 stage tools, each with input + output schemas - Property 26).
// Approval-gate enforcement on stage tools is performed by
// `executeKnowgrphMcpTool` at the McpAgent boundary so a remote invocation
// before approval is withheld with no state mutation (Property 1 / R14.6).
//
// Run_Manifest persistence is implemented by the `RunManifestStore` Durable
// Object (one DO instance per `runId`) declared in `./run-manifest-store.mjs`
// and bound as `RUN_MANIFEST_STORE` in `wrangler.toml`.

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  buildKnowgrphMcpToolDefinitions,
  KNOWGRPH_MCP_CONTRACT_VERSION,
  KNOWGRPH_MCP_DIRECTOR_TOOL_NAME,
  KNOWGRPH_OS_STATUS_TOOL_NAME,
} from "./tool-registry.mjs";
import {
  defaultPersistenceDiagnosticEmitter,
  defaultStageTransitionDiagnosticEmitter,
  dispatchKnowgrphMcpToolCall,
  readRunManifestThroughNamespace,
  RUN_MANIFEST_PERSISTENCE_DEADLINE_MS,
  RunManifestStore,
} from "./run-manifest-store.mjs";
// Env-gated live/mock stage-client resolver (task 12.5). Builds live provider
// clients only when the Worker env opts in (`KNOWGRPH_LIVE_CLIENTS`) or carries
// a credential (`EXA_API_KEY`); otherwise the Director uses deterministic mocks.
import {
  resolveStageClients,
  createLiveArgsResolver,
} from "../../../mcp/video-remix/live-clients.js";

export interface KnowgrphMcpEnv {
  MCP_AGENT: DurableObjectNamespace;
  RUN_MANIFEST_STORE: DurableObjectNamespace;
  KNOWGRPH_MCP_PUBLIC_BASE_URL?: string;
  KNOWGRPH_MCP_TOOL_LIST_NAME?: string;
  // task 12.5 env gating: live stage clients are enabled when KNOWGRPH_LIVE_CLIENTS
  // is truthy or a provider credential (EXA_API_KEY) is present; otherwise the
  // Director runs against deterministic mocks (zero live/paid calls).
  KNOWGRPH_LIVE_CLIENTS?: string;
  EXA_API_KEY?: string;
  EXA_MCP_ENDPOINT?: string;
  // Injectable observability sinks (default to console-backed emitters).
  // `emitPersistenceDiagnostic` is consumed by the RunManifestStore DO
  // (R14.3); `emitStageTransitionDiagnostic` is consumed here on each Director
  // run to emit per-transition diagnostics (R14.5 / Property 27, task 1.5).
  emitPersistenceDiagnostic?: (diagnostic: object) => void;
  emitStageTransitionDiagnostic?: (diagnostic: object) => void;
}

export { RunManifestStore };

const MCP_PATH = "/knowgrph/control-plane/mcp";
const RUNS_PATH_PREFIX = `${MCP_PATH}/runs/`;

const APPROVAL_TOKEN_INPUT = z.union([
  z.string(),
  z
    .object({
      gateId: z.string(),
      token: z.string().optional(),
      approvalState: z.enum(["approved", "rejected", "pending"]).optional(),
    })
    .passthrough(),
]);

const APPROVALS_INPUT = z.array(APPROVAL_TOKEN_INPUT).optional();

const SOURCE_CARD_INPUT = z
  .object({
    sourceId: z.string(),
    url: z.string().url(),
    platform: z.string().optional(),
    title: z.string().optional(),
    evidenceLevel: z.enum(["A", "B", "C"]).optional(),
    captureTime: z.string().optional(),
    observedFields: z.array(z.string()).optional(),
  })
  .passthrough();

const VIDEO_REMIX_RUN_INPUT = {
  referenceUrl: z.string().url(),
  brief: z.string().min(1).max(5000),
  mode: z.enum(["live", "dry-run"]).default("dry-run"),
  budgetUsd: z.number().min(0.01).max(100000).optional(),
  approvals: APPROVALS_INPUT,
  shotCount: z.number().int().min(1).max(500).optional(),
  sourceCards: z.array(SOURCE_CARD_INPUT).optional(),
  runId: z.string().optional(),
  failOnceTool: z.string().optional(),
  maxIterations: z.number().int().min(1).max(100).optional(),
  frontendUrl: z.string().url().optional(),
  backendHealthUrl: z.string().url().optional(),
};

const RESEARCH_INPUT = {
  referenceUrl: z.string().url(),
  query: z.string().optional(),
  maxResults: z.number().int().min(1).max(10).optional(),
  approvals: APPROVALS_INPUT,
  runId: z.string().optional(),
};

const STORYBOARD_INPUT = {
  brief: z.string().min(1).max(5000),
  evidencePack: z.record(z.unknown()),
  shotCount: z.number().int().min(1).max(500).optional(),
  approvals: APPROVALS_INPUT,
  runId: z.string().optional(),
};

const RENDER_INPUT = {
  shots: z
    .array(
      z
        .object({
          shotId: z.string(),
          prompt: z.string().optional(),
          durationS: z.number().min(1).max(120).optional(),
        })
        .passthrough(),
    )
    .min(1)
    .max(500),
  renderGateToken: z.string().optional(),
  approvals: APPROVALS_INPUT,
  runId: z.string().optional(),
};

const PUBLISH_INPUT = {
  assets: z
    .array(
      z
        .object({
          shotId: z.string().optional(),
          assetUrl: z.string().url(),
        })
        .passthrough(),
    )
    .min(1),
  approvals: APPROVALS_INPUT,
  runId: z.string().optional(),
};

const CHECKOUT_INPUT = {
  assetUrl: z.string().url(),
  priceId: z.string().min(1),
  paymentGateToken: z.string().optional(),
  approvals: APPROVALS_INPUT,
  runId: z.string().optional(),
};

const OS_STATUS_INPUT = {
  view: z.enum(["process_list", "capabilities", "cost_summary", "gate_catalog", "circuit_breakers"]),
  cloudflareMcpUrl: z.string().optional(),
};

// ---------------------------------------------------------------------------
// Output schemas (R14.4 / Property 26).
//
// task 1.4: the tool surface must list `knowgrph.video_remix.run` plus each
// stage tool with BOTH an input schema and an output schema. The HTTP
// `GET /knowgrph/control-plane/mcp/tools` listing already returns both (it serializes the
// canonical `buildKnowgrphMcpToolDefinitions()` JSON Schemas). The MCP-native
// `tools/list` only carried input schemas because tools were registered with
// `server.tool(name, description, inputShape, handler)`. Registering each tool
// via `server.registerTool(name, { inputSchema, outputSchema, ... }, handler)`
// makes the native Streamable HTTP listing consistent with the HTTP route.
//
// These Zod output shapes mirror the JSON output schemas in
// `tool-registry.mjs` so the two listing surfaces describe the same contract.
// They are intentionally permissive (every field optional): the same tool can
// return a success payload, an `approval_required` envelope (Property 1 /
// R14.6), or a `deferred_to_director` envelope, and the MCP SDK validates a
// non-error result's `structuredContent` against the registered outputSchema.
// Keeping the shapes permissive lists a descriptive output contract without
// rejecting any of the legitimate envelopes the dispatcher returns.

// Shared envelope fields present on stage-tool responses (approval_required /
// deferred_to_director / error envelopes from `executeKnowgrphMcpTool`).
const STAGE_OUTPUT_ENVELOPE = {
  status: z.string().optional(),
  ok: z.boolean().optional(),
  gateId: z.string().optional(),
  paidProviderCalls: z.number().optional(),
  runManifestStateChanged: z.boolean().optional(),
  note: z.string().optional(),
  error: z.record(z.unknown()).optional(),
} as const;

const VIDEO_REMIX_RUN_OUTPUT = {
  contractVersion: z.string().optional(),
  runId: z.string().optional(),
  state: z.string().optional(),
  mode: z.string().optional(),
  approvalGates: z.array(z.record(z.unknown())).optional(),
  stages: z.array(z.record(z.unknown())).optional(),
  evidencePack: z.record(z.unknown()).optional(),
  storyboard: z.record(z.unknown()).optional(),
  render: z.record(z.unknown()).optional(),
  commerce: z.record(z.unknown()).optional(),
  failureHandling: z.record(z.unknown()).optional(),
  budgetMeters: z.record(z.unknown()).optional(),
  demoPack: z.record(z.unknown()).nullable().optional(),
  validation: z.record(z.unknown()).optional(),
  persistence: z.record(z.unknown()).optional(),
  // Stage-transition diagnostics emitted on this run (R14.5 / Property 27).
  stageTransitions: z.array(z.record(z.unknown())).optional(),
};

const RESEARCH_OUTPUT = {
  ...STAGE_OUTPUT_ENVELOPE,
  evidencePack: z
    .object({
      sources: z.array(z.record(z.unknown())).optional(),
      citations: z.array(z.record(z.unknown())).optional(),
      summary: z.string().optional(),
    })
    .passthrough()
    .optional(),
};

const STORYBOARD_OUTPUT = {
  ...STAGE_OUTPUT_ENVELOPE,
  canvasDocumentMarkdown: z.string().optional(),
  flow: z
    .object({
      nodes: z.array(z.record(z.unknown())).optional(),
      edges: z.array(z.record(z.unknown())).optional(),
    })
    .passthrough()
    .optional(),
};

const RENDER_OUTPUT = {
  ...STAGE_OUTPUT_ENVELOPE,
  assets: z.array(z.record(z.unknown())).optional(),
};

const PUBLISH_OUTPUT = {
  ...STAGE_OUTPUT_ENVELOPE,
  publishedUrls: z.array(z.string()).optional(),
};

const CHECKOUT_OUTPUT = {
  ...STAGE_OUTPUT_ENVELOPE,
  sessionId: z.string().optional(),
  payoutSettled: z.boolean().optional(),
};

const OS_STATUS_OUTPUT = {
  ok: z.boolean().optional(),
  view: z.string().optional(),
  entries: z.array(z.record(z.unknown())).optional(),
  truncated: z.boolean().optional(),
  unavailableSources: z.array(z.record(z.unknown())).optional(),
  unreachableCatalogs: z.array(z.string()).optional(),
  totalsByHarness: z.record(z.object({ estimated_cost_usd: z.number() }).passthrough()).optional(),
  validationFailures: z.array(z.record(z.unknown())).optional(),
  costEmissionGaps: z.array(z.record(z.unknown())).optional(),
  gates: z.array(z.record(z.unknown())).optional(),
  approvalTokenTtlMs: z.number().optional(),
  breakers: z.array(z.record(z.unknown())).optional(),
  cost_log: z.record(z.unknown()).optional(),
  errorCode: z.string().optional(),
  message: z.string().optional(),
};

type ToolHandlerArgs = Record<string, unknown>;

type ToolCallResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

async function dispatchToolCall(
  toolName: string,
  args: ToolHandlerArgs,
  env: KnowgrphMcpEnv,
): Promise<ToolCallResult> {
  // Single shared dispatch path (run-manifest-store.mjs) used by both the
  // Worker and the Node unit tests so the gate-enforcement + gated-persistence
  // invariants cannot drift between surfaces. Director runs emit stage
  // transition diagnostics (R14.5) and persist the Run_Manifest (R14.2/R14.3);
  // a withheld stage-tool invocation returns its `approval_required` envelope
  // WITHOUT ever reaching the RUN_MANIFEST_STORE namespace, so the persisted
  // Run_Manifest state is left unchanged (R14.6 / Property 1).
  const result = await dispatchKnowgrphMcpToolCall({
    toolName,
    args: args ?? {},
    namespace: env?.RUN_MANIFEST_STORE,
    emitStageTransitionDiagnostic:
      typeof env?.emitStageTransitionDiagnostic === "function"
        ? env.emitStageTransitionDiagnostic
        : defaultStageTransitionDiagnosticEmitter,
    emitPersistenceDiagnostic:
      typeof env?.emitPersistenceDiagnostic === "function"
        ? env.emitPersistenceDiagnostic
        : defaultPersistenceDiagnosticEmitter,
    readBackPathPrefix: RUNS_PATH_PREFIX,
    // task 12.5: env-gated live/mock pre-resolution. When the Worker env opts
    // into live clients, the Director's args gain `sourceCards` fetched from the
    // live Exa client before execution; otherwise this is a no-op identity and
    // the Director runs against deterministic mocks.
    resolveLiveArgs: createLiveArgsResolver(
      resolveStageClients({
        KNOWGRPH_LIVE_CLIENTS: env?.KNOWGRPH_LIVE_CLIENTS,
        EXA_API_KEY: env?.EXA_API_KEY,
        EXA_MCP_ENDPOINT: env?.EXA_MCP_ENDPOINT,
      }),
    ),
  });

  return {
    content: [{ type: "text", text: result.text }],
    structuredContent: result.structuredContent as Record<string, unknown>,
    isError: result.ok === false,
  };
}

export class KnowgrphMcpAgent extends McpAgent<KnowgrphMcpEnv> {
  server = new McpServer({
    name: "knowgrph-control-plane",
    version: "0.1.0",
  });

  async init(): Promise<void> {
    const definitions = buildKnowgrphMcpToolDefinitions();
    const env = this.env;

    // Register every tool with BOTH an input schema and an output schema so
    // the MCP-native `tools/list` exposes the same input+output contract per
    // tool as the HTTP `GET /knowgrph/control-plane/mcp/tools` listing (R14.4 / Property 26).
    // `registerTool` carries `outputSchema` into the Streamable HTTP tool
    // surface, which `server.tool(...)` cannot.
    const register = (
      name: string,
      inputSchema: Record<string, z.ZodTypeAny>,
      outputSchema: Record<string, z.ZodTypeAny>,
    ): void => {
      const def = definitions.find((entry) => entry.name === name);
      this.server.registerTool(
        name,
        {
          title: def?.title ?? name,
          description: def?.description ?? name,
          inputSchema,
          outputSchema,
          annotations: def?.annotations,
        },
        async (args: ToolHandlerArgs) => dispatchToolCall(name, args, env),
      );
    };

    register(
      KNOWGRPH_MCP_DIRECTOR_TOOL_NAME,
      VIDEO_REMIX_RUN_INPUT,
      VIDEO_REMIX_RUN_OUTPUT,
    );
    register("knowgrph.video_remix.research", RESEARCH_INPUT, RESEARCH_OUTPUT);
    register(
      "knowgrph.video_remix.storyboard",
      STORYBOARD_INPUT,
      STORYBOARD_OUTPUT,
    );
    register("knowgrph.video_remix.render", RENDER_INPUT, RENDER_OUTPUT);
    register("knowgrph.video_remix.publish", PUBLISH_INPUT, PUBLISH_OUTPUT);
    register("knowgrph.video_remix.checkout", CHECKOUT_INPUT, CHECKOUT_OUTPUT);
    register(KNOWGRPH_OS_STATUS_TOOL_NAME, OS_STATUS_INPUT, OS_STATUS_OUTPUT);
  }
}

function buildHealthBody(env: KnowgrphMcpEnv): Record<string, unknown> {
  return {
    status: "pass",
    service: "knowgrph-mcp-worker",
    contractVersion: KNOWGRPH_MCP_CONTRACT_VERSION,
    transport: "mcp/streamable-http",
    endpoint: `${(env.KNOWGRPH_MCP_PUBLIC_BASE_URL ?? "https://airvio.co").replace(/\/+$/, "")}${MCP_PATH}`,
    tools: buildKnowgrphMcpToolDefinitions().map((tool) => tool.name),
    runManifestPersistence: {
      bound: Boolean(env?.RUN_MANIFEST_STORE),
      readBackEndpoint: `${MCP_PATH}/runs/{id}`,
      deadlineMs: RUN_MANIFEST_PERSISTENCE_DEADLINE_MS,
    },
  };
}

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body, null, 2), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      ...(init?.headers ?? {}),
    },
  });

/**
 * GET /knowgrph/control-plane/mcp/runs/{id}
 *
 * Reads the latest persisted Run_Manifest record for `runId` from the
 * `RUN_MANIFEST_STORE` Durable Object and returns it as JSON. After a
 * Director state change the McpAgent persists within 2s, so this endpoint
 * is the read-back surface that satisfies R14.2 / Property 25.
 *
 * Caller authentication and authorization are handled by the Cloudflare MCP
 * gateway boundary before this read-back handler is exposed.
 */
async function handleRunsRead(
  env: KnowgrphMcpEnv,
  runId: string,
): Promise<Response> {
  if (!env?.RUN_MANIFEST_STORE) {
    return jsonResponse(
      {
        error: "run_manifest_store_unbound",
        message:
          "RUN_MANIFEST_STORE Durable Object binding is missing. Cannot read persisted Run_Manifest.",
      },
      { status: 500 },
    );
  }
  const trimmed = runId.trim();
  if (!trimmed) {
    return jsonResponse(
      { error: "missing_run_id", message: "runId path parameter is required." },
      { status: 400 },
    );
  }
  try {
    const record = await readRunManifestThroughNamespace(
      env.RUN_MANIFEST_STORE,
      trimmed,
    );
    if (!record) {
      return jsonResponse(
        {
          error: "run_not_found",
          runId: trimmed,
          message: "No Run_Manifest has been persisted for this runId yet.",
        },
        { status: 404 },
      );
    }
    return jsonResponse(record);
  } catch (err) {
    return jsonResponse(
      {
        error: "run_manifest_read_failed",
        runId: trimmed,
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export default {
  async fetch(
    request: Request,
    env: KnowgrphMcpEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    if (pathname === `${MCP_PATH}/health` || pathname === "/health") {
      return jsonResponse(buildHealthBody(env));
    }

    if (pathname === `${MCP_PATH}/tools` || pathname === "/tools") {
      return jsonResponse({
        contractVersion: KNOWGRPH_MCP_CONTRACT_VERSION,
        tools: buildKnowgrphMcpToolDefinitions(),
      });
    }

    if (
      request.method === "GET" &&
      (pathname === `${MCP_PATH}/runs` || pathname.startsWith(RUNS_PATH_PREFIX))
    ) {
      const tail = pathname.slice(RUNS_PATH_PREFIX.length);
      const runId = tail ? decodeURIComponent(tail.split("/")[0] ?? "") : "";
      return handleRunsRead(env, runId);
    }

    if (pathname === MCP_PATH || pathname.startsWith(`${MCP_PATH}/`)) {
      // Streamable HTTP transport handled by the Agents SDK McpAgent.
      // `serve` returns a Worker-compatible fetch handler bound to MCP_PATH.
      // The Agents SDK defaults its Durable Object lookup to a binding named
      // `MCP_OBJECT`; this Worker declares the McpAgent DO as `MCP_AGENT` in
      // wrangler.toml (matching `KnowgrphMcpEnv.MCP_AGENT`), so the binding
      // name must be passed explicitly or `serve` throws at request time.
      return KnowgrphMcpAgent.serve(MCP_PATH, { binding: "MCP_AGENT" }).fetch(
        request,
        env,
        ctx,
      );
    }

    return jsonResponse(
      {
        error: "not_found",
        endpoint: MCP_PATH,
        message: `Use POST/GET ${MCP_PATH} for MCP Streamable HTTP transport.`,
      },
      { status: 404 },
    );
  },
};
