import test from "node:test";
import assert from "node:assert/strict";

import {
  buildHostedSubmissionFlowSteps,
  resolveHostedSubmissionFlowConfig,
} from "../lib/hosted-submission-flow.js";

test("resolveHostedSubmissionFlowConfig derives deterministic output paths", () => {
  const config = resolveHostedSubmissionFlowConfig({
    AGENT_API_URL: "https://api.example.aws",
    FRONTEND_URL: "https://app.example.vercel.app",
    MCP_ENDPOINT: "https://airvio.co/knowgrph/mcp",
    ARTIFACTS_DIR: "./tmp-artifacts",
  });

  assert.equal(config.agentApiUrl, "https://api.example.aws");
  assert.equal(config.frontendUrl, "https://app.example.vercel.app");
  assert.match(config.proofOutputPath, /tmp-artifacts\/runtime-proof\.json$/);
  assert.match(config.demoPackOutputPath, /tmp-artifacts\/runtime-demo-pack\.json$/);
  assert.match(config.submissionBriefOutputPath, /tmp-artifacts\/runtime-submission-brief\.md$/);
  assert.match(config.submissionBundleDir, /tmp-artifacts\/submission-bundle$/);
});

test("buildHostedSubmissionFlowSteps returns the full ordered deployed flow", () => {
  const config = resolveHostedSubmissionFlowConfig({
    AGENT_API_URL: "https://api.example.aws",
    FRONTEND_URL: "https://app.example.vercel.app",
  });
  const steps = buildHostedSubmissionFlowSteps(config);

  assert.deepEqual(
    steps.map((step) => step.id),
    ["verify", "proof", "demo-pack", "submission-brief", "bundle"],
  );
  assert.equal(steps[0].script, "./scripts/verify-runtime-ready.mjs");
  assert.equal(steps[1].env.PROOF_OUTPUT_PATH, config.proofOutputPath);
  assert.deepEqual(steps[4].args, [
    config.proofOutputPath,
    config.demoPackOutputPath,
    config.submissionBriefOutputPath,
  ]);
});

test("resolveHostedSubmissionFlowConfig requires live deployment urls", () => {
  assert.throws(
    () => resolveHostedSubmissionFlowConfig({ FRONTEND_URL: "https://app.example.vercel.app" }),
    /AGENT_API_URL/,
  );
  assert.throws(
    () => resolveHostedSubmissionFlowConfig({ AGENT_API_URL: "https://api.example.aws" }),
    /FRONTEND_URL/,
  );
});
