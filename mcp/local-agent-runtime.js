import fs from "node:fs/promises";
import path from "node:path";

import {
  AGENT_RUN_OUTPUT_SCHEMA_ID,
  resolveAgentDefinition,
} from "../contracts/agent-runtime.schema.js";

const approvedGateIds = (approvals) =>
  new Set(
    (Array.isArray(approvals) ? approvals : []).flatMap((approval) => {
      if (typeof approval === "string") {
        return approval.trim() ? [approval.trim()] : [];
      }
      if (
        !approval ||
        typeof approval !== "object" ||
        typeof approval.gateId !== "string" ||
        ["rejected", "pending"].includes(approval.approvalState)
      ) {
        return [];
      }
      return [approval.gateId.trim()];
    }),
  );

export async function runLocalAgentRuntime(args, deps) {
  const {
    rootDir,
    pythonBin,
    resolvePath,
    runCommand,
    summarizeArtifacts,
    formatCommand,
    truncate,
    jsonToolResult,
  } = deps;
  const timeoutMs =
    typeof args.timeoutMs === "number" ? args.timeoutMs : undefined;
  const resume = typeof args.resume === "boolean" ? args.resume : false;
  const outputDir =
    typeof args.outputDir === "string" && args.outputDir.trim()
      ? resolvePath(args.outputDir, { allowOutsideRoot: false })
      : path.join(rootDir, "data", "outputs", `superagent-mcp-run-${Date.now()}`);

  const definition = resume
    ? null
    : resolveAgentDefinition(args.agentDefinitionId || args.invocation);
  if (!resume && !definition) {
    throw new Error(
      "A known agentDefinitionId or invocation is required unless resume=true.",
    );
  }
  const mode = typeof args.mode === "string" ? args.mode : "dry-run";
  if (mode === "live" && !approvedGateIds(args.approvals).has("paid-model-call")) {
    return jsonToolResult(
      {
        contractVersion: AGENT_RUN_OUTPUT_SCHEMA_ID,
        runId:
          typeof args.runId === "string" && args.runId.trim()
            ? args.runId.trim()
            : "approval-required",
        agentDefinitionId: definition?.id || "resume",
        invocation: definition?.invocation || "",
        mode,
        status: "approval_required",
        plan: {},
        budgetMeters: {
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          paidProviderCalls: 0,
        },
        error: { code: "approval_required", gateId: "paid-model-call" },
      },
      true,
    );
  }

  const cmdArgs = ["-m", "knowgrph_parser", "superagent", "--output-dir", outputDir];
  if (resume) {
    cmdArgs.push("--resume");
  } else {
    if (typeof args.inputPath !== "string" || !args.inputPath.trim()) {
      throw new Error("Missing required argument: inputPath (unless resume=true).");
    }
    cmdArgs.push(
      "--input",
      resolvePath(args.inputPath, {
        allowOutsideRoot: Boolean(args.allowExternalInput),
      }),
    );
  }
  if (typeof args.goalPath === "string" && args.goalPath.trim()) {
    cmdArgs.push(
      "--goal-file",
      resolvePath(args.goalPath, { allowOutsideRoot: false }),
    );
  }
  if (typeof args.runId === "string" && args.runId.trim()) {
    cmdArgs.push("--run-id", args.runId.trim());
  }
  if (definition) cmdArgs.push("--agent-definition", definition.id);
  if (typeof args.providerMode === "string" && args.providerMode.trim()) {
    const providerMode = args.providerMode.trim();
    if (!["byteplus-modelark", "mock"].includes(providerMode)) {
      throw new Error("providerMode must be byteplus-modelark or mock.");
    }
    cmdArgs.push("--provider-mode", providerMode);
  }
  if (typeof args.stopAfterStep === "number" && Number.isFinite(args.stopAfterStep)) {
    cmdArgs.push(
      "--stop-after-step",
      String(Math.max(0, Math.floor(args.stopAfterStep))),
    );
  }
  if (typeof args.failOnceTool === "string" && args.failOnceTool.trim()) {
    cmdArgs.push("--fail-once", args.failOnceTool.trim());
  }

  const result = await runCommand(pythonBin, cmdArgs, {
    cwd: rootDir,
    timeoutMs,
  });
  const artifacts = await summarizeArtifacts({ outputDir });
  const outputText = [
    `KNOWGRPH_ROOT: ${rootDir}`,
    `Command: ${formatCommand(pythonBin, cmdArgs, rootDir)}`,
    `Exit: ${String(result.code)}${result.signal ? ` (signal: ${result.signal})` : ""}`,
    artifacts.length
      ? `Artifacts:\n- ${artifacts.join("\n- ")}`
      : "Artifacts: (none detected)",
    result.stdout.trim() ? `\nSTDOUT:\n${truncate(result.stdout)}` : "",
    result.stderr.trim() ? `\nSTDERR:\n${truncate(result.stderr)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let state = null;
  try {
    state = JSON.parse(await fs.readFile(path.join(outputDir, "state.json"), "utf8"));
  } catch {
    state = null;
  }
  const run = state?.run || {};
  const activeDefinition = state?.agent_definition || definition || {};
  const status =
    run.status === "completed"
      ? "completed"
      : run.status === "interrupted"
        ? "planned"
        : "blocked";
  return {
    content: [{ type: "text", text: outputText }],
    structuredContent: {
      contractVersion: AGENT_RUN_OUTPUT_SCHEMA_ID,
      runId: run.run_id || args.runId || "unknown",
      agentDefinitionId:
        activeDefinition.id || run.agent_definition_id || "unknown",
      invocation:
        activeDefinition.invocation || run.agent_invocation || "",
      mode,
      status,
      plan: {
        profileId: activeDefinition.planProfile || "unknown",
        tasks: state?.plan || [],
        roles: state?.agents || [],
        capabilities: activeDefinition.capabilities || [],
      },
      budgetMeters: {
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        paidProviderCalls: 0,
      },
      result: {
        outputDir,
        verification: state?.verification || {},
        artifactCount: state?.artifacts?.length || 0,
      },
      ...(result.code === 0
        ? {}
        : { error: { code: "local_harness_failed", exitCode: result.code } }),
    },
    isError: result.code !== 0,
  };
}
