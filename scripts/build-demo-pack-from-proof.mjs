#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildHostedDemoPackArtifact } from "./lib/runtime-proof-artifact.js";

function requireInputPath() {
  const argPath = process.argv[2];
  const envPath = process.env.PROOF_INPUT_PATH;
  const inputPath = typeof argPath === "string" && argPath.trim().length > 0
    ? argPath.trim()
    : typeof envPath === "string" && envPath.trim().length > 0
      ? envPath.trim()
      : "";
  if (!inputPath) {
    console.error("demo-pack:proof refused: provide a proof file path as argv[2] or PROOF_INPUT_PATH.");
    process.exit(1);
  }
  return resolve(inputPath);
}

async function main() {
  const inputPath = requireInputPath();
  const outputPath = process.env.DEMO_PACK_OUTPUT_PATH
    ? resolve(process.env.DEMO_PACK_OUTPUT_PATH)
    : null;
  const proof = JSON.parse(await readFile(inputPath, "utf8"));

  const artifact = buildHostedDemoPackArtifact(proof, {
    frontendUrl: process.env.FRONTEND_URL,
    workerUrl: process.env.MCP_ENDPOINT || process.env.WORKER_URL,
    workerHealthUrl: process.env.WORKER_HEALTH_URL,
  });

  if (!artifact.demoPackValidation.valid) {
    console.error("demo-pack:proof failed: generated Demo_Pack did not validate.");
    console.error(JSON.stringify(artifact.demoPackValidation, null, 2));
    process.exit(1);
  }

  if (outputPath) {
    await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  }

  console.log("\n  Demo_Pack Artifact");
  console.log("  " + "-".repeat(40));
  console.log(`  Input proof:    ${inputPath}`);
  console.log(`  Run id:         ${artifact.runId || "(missing)"}`);
  console.log(`  Manifest state: ${artifact.manifestState || "(missing)"}`);
  console.log(`  Sections:       ${artifact.demoPack.sections.length}`);
  console.log(`  URLs:           ${artifact.demoPack.urls.length}`);
  console.log(`  Valid:          ${artifact.demoPackValidation.valid}`);
  if (outputPath) {
    console.log(`  Output:         ${outputPath}`);
  }
  console.log("\n  Artifact JSON:");
  console.log(JSON.stringify(artifact, null, 2));
}

main().catch((err) => {
  console.error("demo-pack:proof unexpected error:", err?.message ?? err);
  process.exit(1);
});
