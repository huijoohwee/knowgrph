#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import { buildSmeCanvasEvidence } from "../mcp/sme-risk-coverage/canvas-evidence.js";
import { runSmeRiskCoverageMarkdown } from "../mcp/sme-risk-coverage/core.js";

const root = path.resolve(import.meta.dirname, "..");
const fixturePath = path.join(root, "sme-agent", "fixtures", "pre-seed.md");
const outputPath = path.join(root, "sme-agent", "demo", "sme-care-agent-canvas-evidence.md");
const checkOnly = process.argv.includes("--check");

const fixture = await fs.readFile(fixturePath, "utf8");
const result = runSmeRiskCoverageMarkdown(fixture);
if (!result.ok) throw new Error(`SME demo fixture failed: ${JSON.stringify(result.error)}`);
const expected = buildSmeCanvasEvidence(result.run).canvasDocumentMarkdown;

if (checkOnly) {
  const actual = await fs.readFile(outputPath, "utf8");
  if (actual !== expected) throw new Error(`SME Canvas evidence is stale: ${path.relative(root, outputPath)}`);
  console.log(JSON.stringify({ status: "verified", runId: result.run.runId, outputPath: path.relative(root, outputPath) }));
} else {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, expected, "utf8");
  console.log(JSON.stringify({ status: "written", runId: result.run.runId, outputPath: path.relative(root, outputPath) }));
}
