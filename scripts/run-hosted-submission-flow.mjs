#!/usr/bin/env node

import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";

import {
  buildHostedSubmissionFlowSteps,
  resolveHostedSubmissionFlowConfig,
} from "./lib/hosted-submission-flow.js";

function printPlan(config, steps) {
  console.log("\n  Hosted Submission Flow");
  console.log("  " + "-".repeat(48));
  console.log(`  AGENT_API_URL: ${config.agentApiUrl}`);
  console.log(`  FRONTEND_URL:  ${config.frontendUrl}`);
  console.log(`  MCP_ENDPOINT:  ${config.mcpEndpoint}`);
  console.log(`  ARTIFACTS_DIR: ${config.outputDir}`);
  console.log("\n  Steps:");
  for (const [index, step] of steps.entries()) {
    console.log(`  ${index + 1}. ${step.label}`);
  }
}

function runNodeScript(step, inheritedEnv) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      process.execPath,
      [step.script, ...(Array.isArray(step.args) ? step.args : [])],
      {
        cwd: process.cwd(),
        stdio: "inherit",
        env: { ...inheritedEnv, ...(step.env ?? {}) },
      },
    );
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`${step.id} exited with code ${code}`));
    });
    child.on("error", rejectPromise);
  });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const config = resolveHostedSubmissionFlowConfig(process.env);
  const steps = buildHostedSubmissionFlowSteps(config);
  await mkdir(config.outputDir, { recursive: true });

  printPlan(config, steps);
  if (dryRun) {
    console.log("\n  Dry run only. No network or child commands were executed.\n");
    return;
  }

  for (const step of steps) {
    console.log(`\n  Running: ${step.label}`);
    await runNodeScript(step, process.env);
  }

  console.log("\n  Hosted submission flow complete.");
  console.log(`  Proof:   ${config.proofOutputPath}`);
  console.log(`  Demo:    ${config.demoPackOutputPath}`);
  console.log(`  Brief:   ${config.submissionBriefOutputPath}`);
  console.log(`  Bundle:  ${config.submissionBundleDir}`);
}

main().catch((err) => {
  console.error("hosted-submission-flow failed:", err?.message ?? err);
  process.exit(1);
});
