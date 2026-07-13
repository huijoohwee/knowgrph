#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { parseFrontmatter, repoRoot } from "./collaboration-contract.mjs";
import { runAgenticCanvasOsDocsInvokeTool } from "../mcp/agentic-canvas-os-docs-runtime.js";
import { runVideoRemix } from "../mcp/video-remix-runtime.js";
import { VIDEO_REMIX_STAGE_ORDER } from "../mcp/video-remix/stage-contract.js";

const execFileAsync = promisify(execFile);
const contractPath = path.resolve(repoRoot, "docs", "runtime-readiness-contract.md");

const fail = (message) => {
  throw new Error(`runtime-ready check failed: ${message}`);
};

const equalJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

async function readContract() {
  const source = await fs.readFile(contractPath, "utf8");
  const contract = parseFrontmatter(source, path.relative(repoRoot, contractPath));
  if (contract.status !== "active" || contract.contract_version !== 1) fail("contract is not active v1");
  if (!equalJson(contract.stage_contract?.order, VIDEO_REMIX_STAGE_ORDER)) {
    fail("frontmatter stage order does not match the executable stage contract");
  }
  return contract;
}

async function verifyDocs(contract) {
  const dependency = contract.docs_dependency;
  const explicitRoot = String(process.env[dependency.root_env] || "").trim();
  const docsRoot = explicitRoot
    ? path.resolve(explicitRoot)
    : path.resolve(repoRoot, dependency.default_relative_root);

  for (const fileName of dependency.required_files) {
    await fs.access(path.join(docsRoot, fileName)).catch(() => fail(`missing docs dependency: ${path.join(docsRoot, fileName)}`));
  }
  const { stdout: docsCommit } = await execFileAsync("git", ["-C", docsRoot, "rev-parse", "HEAD"])
    .catch(() => fail(`docs dependency is not a Git checkout: ${docsRoot}`));
  if (docsCommit.trim() !== dependency.ref) {
    fail(`docs dependency ref mismatch: expected ${dependency.ref}, received ${docsCommit.trim()}`);
  }

  const env = { [dependency.root_env]: docsRoot };
  for (const token of dependency.proof_tokens) {
    const result = await runAgenticCanvasOsDocsInvokeTool({ token, includeContent: true }, { rootDir: repoRoot, env });
    if (!result.ok || result.invocation?.token !== token || !result.invocation?.content?.includes(token)) {
      fail(`docs SSOT did not resolve ${token}`);
    }
  }
  return { root: docsRoot, ref: docsCommit.trim(), tokens: dependency.proof_tokens };
}

const mockArgs = Object.freeze({
  referenceUrl: "https://example.com/runtime-ready-reference.mp4",
  brief: "Deterministic zero-spend runtime readiness proof.",
  mode: "dry-run",
  runId: "runtime-ready-local-proof",
  shotCount: 2,
  sourceCards: [
    { sourceId: "proof-a", url: "https://example.com/a", evidenceLevel: "A" },
    { sourceId: "proof-b", url: "https://example.com/b", evidenceLevel: "B" },
    { sourceId: "proof-c", url: "https://example.com/c", evidenceLevel: "B" },
  ],
});

const proofProjection = (payload) => ({
  state: payload.state,
  mode: payload.mode,
  stages: payload.stages.map(({ id, status, executed }) => ({ id, status, executed: executed === true })),
  paidProviderCalls: payload.budgetMeters.paidProviderCalls,
  actualCostUsd: payload.budgetMeters.actualCostUsd,
  providerSpendCents: payload.budgetMeters.providerSpendCents,
  artifactCount: payload.render.assets.length,
});

function verifyMockRuntime(contract) {
  const replayCount = contract.local_proof.deterministic_replays;
  const projections = Array.from({ length: replayCount }, () => proofProjection(runVideoRemix(mockArgs).payload));
  const first = projections[0];
  if (!projections.every((projection) => equalJson(projection, first))) fail("mock replays are not deterministic");
  if (!equalJson(first.stages.map(({ id }) => id), VIDEO_REMIX_STAGE_ORDER)) fail("manifest stage order drifted");
  if (first.paidProviderCalls !== contract.local_proof.paid_call_count) fail("paid call count is not zero");
  if (first.actualCostUsd !== contract.local_proof.actual_cost_usd || first.providerSpendCents !== 0) {
    fail("actual provider cost is not zero");
  }
  return first;
}

async function gitSourceState() {
  const [{ stdout: sha }, { stdout: status }] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repoRoot }),
    execFileAsync("git", ["status", "--porcelain=v1"], { cwd: repoRoot }),
  ]);
  const normalizedStatus = status.trim().split("\n").filter(Boolean).sort();
  return {
    commitSha: sha.trim(),
    clean: normalizedStatus.length === 0,
    stateHash: crypto.createHash("sha256").update(normalizedStatus.join("\n")).digest("hex"),
    changedPathCount: normalizedStatus.length,
  };
}

async function main() {
  const contract = await readContract();
  const [docs, source] = await Promise.all([verifyDocs(contract), gitSourceState()]);
  const runtime = verifyMockRuntime(contract);
  const proof = {
    status: "runtime-ready",
    contractVersion: contract.contract_version,
    invocation: contract.invocation,
    source,
    docs,
    runtime,
  };
  console.log(JSON.stringify(proof, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
