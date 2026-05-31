import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import net from "node:net";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { callBrowserApiRuntime } from "./browser-api-runtime.js";
import { buildKnowgrphLocalMcpToolDefinitions, KNOWGRPH_LOCAL_MCP_TOOL_NAMES } from "./local-tool-contract.js";
import {
  buildKnowgrphVdeoxplnMarkdown,
  buildKnowgrphVdeoxplnRegistry,
  buildKnowgrphVdeoxplnRoutingPlan,
  validateKnowgrphVdeoxplnRegistry,
} from "../canvas/src/features/agent-ready/knowgrphVdeoxplnContract.mjs";

const MAX_OUTPUT_CHARS = Number(process.env.KNOWGRPH_MCP_MAX_OUTPUT_CHARS ?? "20000");
const DEFAULT_TIMEOUT_MS = Number(process.env.KNOWGRPH_MCP_TIMEOUT_MS ?? "600000");

const KNOWGRPH_ROOT = resolveRootDir();
const PYTHON_BIN = process.env.KNOWGRPH_PYTHON?.trim() || "python3";
const ALLOW_EXTERNAL_PATHS =
  (process.env.KNOWGRPH_ALLOW_EXTERNAL_PATHS || "").trim().toLowerCase() === "1";
const DEFAULT_UI_HOST = process.env.KNOWGRPH_UI_HOST?.trim() || "127.0.0.1";
const DEFAULT_UI_PORT = Number(process.env.KNOWGRPH_UI_PORT?.trim() || "5173");
const LOCAL_MCP_TOOLS = buildKnowgrphLocalMcpToolDefinitions({
  defaultUiHost: DEFAULT_UI_HOST,
  defaultUiPort: DEFAULT_UI_PORT,
});

/** @type {null | { pid: number, host: string, port: number, startedAtMs: number }} */
let canvasDevServer = null;

const UI_TARGETS = /** @type {const} */ ({
  canvas: { label: "Canvas", query: "" },
  workspaceEditor: { label: "Workspace Editor", query: "openEditorWorkspace=1" },
  geospatial: { label: "Geospatial", query: "kgGeo=1" },
});

function resolveRootDir() {
  const envRoot = process.env.KNOWGRPH_ROOT?.trim();
  if (envRoot) return path.resolve(envRoot);
  return process.cwd();
}

function isWithinRoot(absolutePath) {
  const rel = path.relative(KNOWGRPH_ROOT, absolutePath);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function resolvePathMaybeWithinRoot(maybePath, { allowOutsideRoot = false } = {}) {
  if (typeof maybePath !== "string" || !maybePath.trim()) {
    throw new Error("Path must be a non-empty string.");
  }
  const resolved = path.resolve(KNOWGRPH_ROOT, maybePath);
  if (allowOutsideRoot || ALLOW_EXTERNAL_PATHS) return resolved;
  if (!isWithinRoot(resolved)) {
    throw new Error(
      `Path must be inside KNOWGRPH_ROOT (${KNOWGRPH_ROOT}). Set KNOWGRPH_ALLOW_EXTERNAL_PATHS=1 to override.`
    );
  }
  return resolved;
}

async function exists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function truncate(text) {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  const head = text.slice(0, Math.floor(MAX_OUTPUT_CHARS * 0.7));
  const tail = text.slice(text.length - Math.floor(MAX_OUTPUT_CHARS * 0.3));
  return `${head}\n\n…(truncated ${text.length - MAX_OUTPUT_CHARS} chars)…\n\n${tail}`;
}

function buildCanvasUrl({ host, port, target }) {
  const base = `http://${host}:${port}/`;
  const t = UI_TARGETS[target] || UI_TARGETS.canvas;
  if (!t.query) return base;
  return `${base}?${t.query}`;
}

function waitForTcpPort({ host, port, timeoutMs = 8000 }) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const attempt = () => {
      const socket = net.connect({ host, port });
      socket.once("connect", () => {
        socket.end();
        resolve(true);
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt >= timeoutMs) return resolve(false);
        setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}

function startCanvasDevServer({ host, port }) {
  if (canvasDevServer?.pid) {
    return { ok: true, reused: true, pid: canvasDevServer.pid };
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const args = ["--prefix", "canvas", "run", "dev", "--", "--host", host, "--port", String(port), "--strictPort"];

  const child = spawn(npmCommand, args, {
    cwd: KNOWGRPH_ROOT,
    env: process.env,
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
  });

  // Detach so MCP call can return immediately.
  child.unref();
  canvasDevServer = { pid: child.pid, host, port, startedAtMs: Date.now() };
  return { ok: true, reused: false, pid: child.pid };
}

function stopProcessGroup(pid) {
  try {
    // On POSIX, negative PID kills the entire process group.
    process.kill(-pid, "SIGTERM");
    return true;
  } catch {
    try {
      process.kill(pid, "SIGTERM");
      return true;
    } catch {
      return false;
    }
  }
}

function runCommand(command, args, { cwd, timeoutMs }) {
  const effectiveTimeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      if (stdout.length > MAX_OUTPUT_CHARS * 3) {
        stdout = stdout.slice(stdout.length - MAX_OUTPUT_CHARS * 3);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > MAX_OUTPUT_CHARS * 3) {
        stderr = stderr.slice(stderr.length - MAX_OUTPUT_CHARS * 3);
      }
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, effectiveTimeoutMs);

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        code: typeof code === "number" ? code : null,
        signal: signal || null,
        stdout,
        stderr,
      });
    });
  });
}

async function summarizeArtifacts({ outputDir, extraPaths = [] }) {
  const artifacts = [];
  const candidates = [
    outputDir ? path.join(outputDir, "runtime-events.jsonl") : null,
    outputDir ? path.join(outputDir, "a0.csv") : null,
    outputDir ? path.join(outputDir, "a0.jsonld") : null,
    outputDir ? path.join(outputDir, "state.json") : null,
    outputDir ? path.join(outputDir, "trace.jsonl") : null,
    outputDir ? path.join(outputDir, "final-report.md") : null,
    outputDir ? path.join(outputDir, "artifacts", "canvas", "canvas.graph.json") : null,
    outputDir ? path.join(outputDir, "artifacts", "canvas", "canvas-preview.html") : null,
    outputDir ? path.join(outputDir, "artifacts", "workspace", "rich-media-flow.md") : null,
    ...extraPaths,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await exists(candidate)) {
      artifacts.push(path.relative(KNOWGRPH_ROOT, candidate));
    }
  }
  return artifacts;
}

function formatCommand(command, args, cwd) {
  const quoted = args.map((arg) => (arg.includes(" ") ? JSON.stringify(arg) : arg));
  return `${command} ${quoted.join(" ")}${cwd ? `  (cwd: ${cwd})` : ""}`;
}

const server = new Server(
  {
    name: "knowgrph-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: LOCAL_MCP_TOOLS,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params?.name;
  const args = request.params?.arguments ?? {};

  try {
    if (toolName === KNOWGRPH_LOCAL_MCP_TOOL_NAMES.uiLaunch) {
      const target = typeof args.target === "string" ? args.target : "canvas";
      const host = typeof args.host === "string" && args.host.trim() ? args.host.trim() : DEFAULT_UI_HOST;
      const port = typeof args.port === "number" && Number.isFinite(args.port) ? Number(args.port) : DEFAULT_UI_PORT;
      const waitForReady = typeof args.waitForReady === "boolean" ? args.waitForReady : true;

      const startResult = startCanvasDevServer({ host, port });
      const ready = waitForReady ? await waitForTcpPort({ host, port, timeoutMs: 8000 }) : true;
      const url = buildCanvasUrl({ host, port, target });

      const outputText = [
        `Target: ${String(target)}`,
        `URL: ${url}`,
        `Dev server: ${startResult.reused ? "already running (reused)" : "started"}`,
        `PID: ${String(startResult.pid)}`,
        ready ? "Status: ready" : "Status: starting (port not ready yet; retry in a few seconds)",
        "",
        "Notes:",
        "- Workspace Editor uses query param ?openEditorWorkspace=1",
        "- Geospatial uses query param ?kgGeo=1 (DEV behavior)",
      ].join("\n");

      return { content: [{ type: "text", text: outputText }], isError: false };
    }

    if (toolName === KNOWGRPH_LOCAL_MCP_TOOL_NAMES.uiStop) {
      if (!canvasDevServer?.pid) {
        return { content: [{ type: "text", text: "No Canvas dev server is currently tracked as running." }], isError: false };
      }
      const pid = canvasDevServer.pid;
      const ok = stopProcessGroup(pid);
      canvasDevServer = null;
      return {
        content: [{ type: "text", text: ok ? `Stopped Canvas dev server (PID ${pid}).` : `Failed to stop PID ${pid}.` }],
        isError: !ok,
      };
    }

    if (toolName === KNOWGRPH_LOCAL_MCP_TOOL_NAMES.pipeline) {
      const mode = typeof args.mode === "string" ? args.mode : "pipeline";
      const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : undefined;

      if (mode === "pipeline") {
        if (typeof args.inputPath !== "string" || !args.inputPath.trim()) {
          throw new Error("Missing required argument: inputPath (mode=pipeline).");
        }
        const inputPath = resolvePathMaybeWithinRoot(args.inputPath, { allowOutsideRoot: false });
        const outputDir =
          typeof args.outputDir === "string" && args.outputDir.trim()
            ? resolvePathMaybeWithinRoot(args.outputDir, { allowOutsideRoot: false })
            : null;

        const cmdArgs = ["-m", "knowgrph_parser", "pipeline", "--mode", "pipeline", "--input", inputPath];
        if (outputDir) cmdArgs.push("--output-dir", outputDir);

        const result = await runCommand(PYTHON_BIN, cmdArgs, { cwd: KNOWGRPH_ROOT, timeoutMs });
        const artifacts = await summarizeArtifacts({ outputDir: outputDir || null });

        const outputText = [
          `KNOWGRPH_ROOT: ${KNOWGRPH_ROOT}`,
          `Command: ${formatCommand(PYTHON_BIN, cmdArgs, KNOWGRPH_ROOT)}`,
          `Exit: ${String(result.code)}${result.signal ? ` (signal: ${result.signal})` : ""}`,
          artifacts.length ? `Artifacts:\n- ${artifacts.join("\n- ")}` : "Artifacts: (none detected)",
          result.stdout.trim() ? `\nSTDOUT:\n${truncate(result.stdout)}` : "",
          result.stderr.trim() ? `\nSTDERR:\n${truncate(result.stderr)}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        return { content: [{ type: "text", text: outputText }], isError: result.code !== 0 };
      }

      throw new Error(`Unknown mode: ${mode}`);
    }

    if (toolName === KNOWGRPH_LOCAL_MCP_TOOL_NAMES.graphragPipeline) {
      const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : undefined;
      const cmdArgs = ["-m", "knowgrph_parser", "graphrag-pipeline"];

      const outDir =
        typeof args.outDir === "string" && args.outDir.trim()
          ? resolvePathMaybeWithinRoot(args.outDir, { allowOutsideRoot: false })
          : null;

      if (typeof args.configPath === "string" && args.configPath.trim()) {
        cmdArgs.push("--config", resolvePathMaybeWithinRoot(args.configPath, { allowOutsideRoot: false }));
      }
      if (typeof args.inputDir === "string" && args.inputDir.trim()) {
        cmdArgs.push("--input", resolvePathMaybeWithinRoot(args.inputDir, { allowOutsideRoot: false }));
      }
      if (outDir) {
        cmdArgs.push("--out", outDir);
      }
      if (typeof args.graphId === "string" && args.graphId.trim()) {
        cmdArgs.push("--graph-id", args.graphId.trim());
      }

      const result = await runCommand(PYTHON_BIN, cmdArgs, { cwd: KNOWGRPH_ROOT, timeoutMs });

      const extra = [];
      if (outDir) {
        extra.push(path.join(outDir, "graph.json"));
        extra.push(path.join(outDir, "graphrag-workflow.jsonld"));
      }
      const artifacts = await summarizeArtifacts({ outputDir: outDir || null, extraPaths: extra });

      const outputText = [
        `KNOWGRPH_ROOT: ${KNOWGRPH_ROOT}`,
        `Command: ${formatCommand(PYTHON_BIN, cmdArgs, KNOWGRPH_ROOT)}`,
        `Exit: ${String(result.code)}${result.signal ? ` (signal: ${result.signal})` : ""}`,
        artifacts.length ? `Artifacts:\n- ${artifacts.join("\n- ")}` : "Artifacts: (none detected)",
        result.stdout.trim() ? `\nSTDOUT:\n${truncate(result.stdout)}` : "",
        result.stderr.trim() ? `\nSTDERR:\n${truncate(result.stderr)}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      return { content: [{ type: "text", text: outputText }], isError: result.code !== 0 };
    }

    if (toolName === KNOWGRPH_LOCAL_MCP_TOOL_NAMES.superagentRun) {
      const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : undefined;
      const resume = typeof args.resume === "boolean" ? args.resume : false;
      const outputDir =
        typeof args.outputDir === "string" && args.outputDir.trim()
          ? resolvePathMaybeWithinRoot(args.outputDir, { allowOutsideRoot: false })
          : path.join(KNOWGRPH_ROOT, "data", "outputs", `superagent-mcp-run-${Date.now()}`);

      const cmdArgs = ["-m", "knowgrph_parser", "superagent", "--output-dir", outputDir];
      if (resume) {
        cmdArgs.push("--resume");
      } else {
        if (typeof args.inputPath !== "string" || !args.inputPath.trim()) {
          throw new Error("Missing required argument: inputPath (unless resume=true).");
        }
        cmdArgs.push(
          "--input",
          resolvePathMaybeWithinRoot(args.inputPath, { allowOutsideRoot: Boolean(args.allowExternalInput) })
        );
      }
      if (typeof args.goalPath === "string" && args.goalPath.trim()) {
        cmdArgs.push("--goal-file", resolvePathMaybeWithinRoot(args.goalPath, { allowOutsideRoot: false }));
      }
      if (typeof args.runId === "string" && args.runId.trim()) {
        cmdArgs.push("--run-id", args.runId.trim());
      }
      if (typeof args.stopAfterStep === "number" && Number.isFinite(args.stopAfterStep)) {
        cmdArgs.push("--stop-after-step", String(Math.max(0, Math.floor(args.stopAfterStep))));
      }
      if (typeof args.failOnceTool === "string" && args.failOnceTool.trim()) {
        cmdArgs.push("--fail-once", args.failOnceTool.trim());
      }

      const result = await runCommand(PYTHON_BIN, cmdArgs, { cwd: KNOWGRPH_ROOT, timeoutMs });
      const artifacts = await summarizeArtifacts({ outputDir });

      const outputText = [
        `KNOWGRPH_ROOT: ${KNOWGRPH_ROOT}`,
        `Command: ${formatCommand(PYTHON_BIN, cmdArgs, KNOWGRPH_ROOT)}`,
        `Exit: ${String(result.code)}${result.signal ? ` (signal: ${result.signal})` : ""}`,
        artifacts.length ? `Artifacts:\n- ${artifacts.join("\n- ")}` : "Artifacts: (none detected)",
        result.stdout.trim() ? `\nSTDOUT:\n${truncate(result.stdout)}` : "",
        result.stderr.trim() ? `\nSTDERR:\n${truncate(result.stderr)}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      return { content: [{ type: "text", text: outputText }], isError: result.code !== 0 };
    }

    if (toolName === KNOWGRPH_LOCAL_MCP_TOOL_NAMES.browserApiRun) {
      return await callBrowserApiRuntime(args, { maxOutputChars: MAX_OUTPUT_CHARS });
    }

    if (toolName === KNOWGRPH_LOCAL_MCP_TOOL_NAMES.vdeoxplnList) {
      const includeMarkdown = args.includeMarkdown === true;
      const vdeoxplnId = typeof args.vdeoxplnId === "string" ? args.vdeoxplnId.trim() : "";
      const registry = buildKnowgrphVdeoxplnRegistry();
      const validation = validateKnowgrphVdeoxplnRegistry(registry);
      const vdeoxplnEntries = vdeoxplnId ? registry.filter((vdeoxpln) => vdeoxpln.id === vdeoxplnId) : registry;
      if (vdeoxplnId && vdeoxplnEntries.length === 0) {
        throw new Error(`Unknown Knowgrph vdeoxpln id: ${vdeoxplnId}`);
      }
      const payload = {
        contractVersion: vdeoxplnEntries[0]?.version || "knowgrph-vdeoxpln/v0.1",
        validation,
        vdeoxplnEntries: vdeoxplnEntries.map((vdeoxpln) => ({
          id: vdeoxpln.id,
          title: vdeoxpln.title,
          purpose: vdeoxpln.purpose,
          scope: vdeoxpln.scope,
          mutation: vdeoxpln.mutation,
          semanticKey: vdeoxpln.semanticKey,
          triggers: vdeoxpln.triggers,
          owners: vdeoxpln.owners,
          tools: vdeoxpln.tools,
          inputs: vdeoxpln.inputs,
          outputs: vdeoxpln.outputs,
          workflow: vdeoxpln.workflow,
          artifactPolicy: vdeoxpln.artifactPolicy,
          aiPolicy: vdeoxpln.aiPolicy,
          publish: vdeoxpln.publish,
          validation: vdeoxpln.validation,
          markdown: includeMarkdown ? buildKnowgrphVdeoxplnMarkdown(vdeoxpln) : undefined,
        })),
        routingPlan: buildKnowgrphVdeoxplnRoutingPlan({
          intentText: typeof args.intentText === "string" ? args.intentText : "",
          contentTypes: Array.isArray(args.contentTypes) ? args.contentTypes : [],
          requestedOutputs: Array.isArray(args.requestedOutputs) ? args.requestedOutputs : [],
          stateSignals: Array.isArray(args.stateSignals) ? args.stateSignals : [],
          chatStorageTarget: typeof args.chatStorageTarget === "string" ? args.chatStorageTarget : "",
          sourceFileCount: Number(args.sourceFileCount || 0),
          hasSourceFiles: Number(args.sourceFileCount || 0) > 0,
          hasGraphData: args.hasGraphData === true,
          hasSelection: args.hasSelection === true,
          hasWorkspaceDocument: args.hasWorkspaceDocument === true,
          registry: vdeoxplnEntries,
        }),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
        isError: !validation.ok,
      };
    }

    throw new Error(`Unknown tool: ${toolName}`);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  // MCP requires that we don't write arbitrary logs to stdout (it breaks JSON-RPC).
  // stderr is fine.
  process.stderr.write(`knowgrph-mcp: fatal error: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
