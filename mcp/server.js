import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const MAX_OUTPUT_CHARS = Number(process.env.KNOWGRPH_MCP_MAX_OUTPUT_CHARS ?? "20000");
const DEFAULT_TIMEOUT_MS = Number(process.env.KNOWGRPH_MCP_TIMEOUT_MS ?? "600000");

const KNOWGRPH_ROOT = resolveRootDir();
const PYTHON_BIN = process.env.KNOWGRPH_PYTHON?.trim() || "python3";
const ALLOW_EXTERNAL_PATHS =
  (process.env.KNOWGRPH_ALLOW_EXTERNAL_PATHS || "").trim().toLowerCase() === "1";

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
    outputDir ? path.join(outputDir, "a0.ttl") : null,
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
    tools: [
      {
        name: "knowgrph.pipeline",
        description:
          "Run the Knowgrph pipeline (GraphData -> A0 CSV/JSON-LD + codebase index artifacts) or run a preset DuckDB example query.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            mode: {
              type: "string",
              enum: ["pipeline", "example-query"],
              default: "pipeline",
              description: "Which pipeline mode to run.",
            },
            inputPath: {
              type: "string",
              description: "Path to an input GraphData JSON file (required when mode=pipeline).",
            },
            outputDir: {
              type: "string",
              description:
                "Directory for outputs. If omitted, defaults to knowgrph_parser's configured output directory.",
            },
            presetId: {
              type: "string",
              description: "DuckDB query preset id (required when mode=example-query).",
            },
            configPath: {
              type: "string",
              description: "Optional DuckDB query config path (mode=example-query).",
            },
            dbPath: {
              type: "string",
              description: "Optional DuckDB database path (mode=example-query).",
            },
            timeoutMs: {
              type: "number",
              description: "Optional timeout in milliseconds.",
            },
          },
        },
      },
      {
        name: "knowgrph.graphrag_pipeline",
        description:
          "Run the GraphRAG pipeline wrapper (attempts `graphrag index`, then emits GraphData + A0 exports).",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            configPath: { type: "string", description: "GraphRAG config YAML path." },
            inputDir: { type: "string", description: "Input directory containing raw docs." },
            outDir: { type: "string", description: "Output directory." },
            graphId: { type: "string", description: "Graph identifier used in emitted workflow doc." },
            timeoutMs: { type: "number", description: "Optional timeout in milliseconds." },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params?.name;
  const args = request.params?.arguments ?? {};

  try {
    if (toolName === "knowgrph.pipeline") {
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

      if (mode === "example-query") {
        if (typeof args.presetId !== "string" || !args.presetId.trim()) {
          throw new Error("Missing required argument: presetId (mode=example-query).");
        }
        const cmdArgs = ["-m", "knowgrph_parser", "pipeline", "--mode", "example-query", "--preset-id", args.presetId];
        if (typeof args.configPath === "string" && args.configPath.trim()) {
          cmdArgs.push("--config", resolvePathMaybeWithinRoot(args.configPath, { allowOutsideRoot: false }));
        }
        if (typeof args.dbPath === "string" && args.dbPath.trim()) {
          cmdArgs.push("--db", resolvePathMaybeWithinRoot(args.dbPath, { allowOutsideRoot: false }));
        }

        const result = await runCommand(PYTHON_BIN, cmdArgs, { cwd: KNOWGRPH_ROOT, timeoutMs });
        const outputText = [
          `KNOWGRPH_ROOT: ${KNOWGRPH_ROOT}`,
          `Command: ${formatCommand(PYTHON_BIN, cmdArgs, KNOWGRPH_ROOT)}`,
          `Exit: ${String(result.code)}${result.signal ? ` (signal: ${result.signal})` : ""}`,
          result.stdout.trim() ? `\nSTDOUT:\n${truncate(result.stdout)}` : "",
          result.stderr.trim() ? `\nSTDERR:\n${truncate(result.stderr)}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        return { content: [{ type: "text", text: outputText }], isError: result.code !== 0 };
      }

      throw new Error(`Unknown mode: ${mode}`);
    }

    if (toolName === "knowgrph.graphrag_pipeline") {
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

