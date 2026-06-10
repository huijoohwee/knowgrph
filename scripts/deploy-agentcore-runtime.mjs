#!/usr/bin/env node
// Operator-gated launcher for the additive AWS Bedrock AgentCore Runtime MCP
// tier (knowgrph-acos-mcp-connector task 13.9).
//
// This wrapper intentionally refuses to run unless the operator provides an
// explicit cloud-deploy Approval_Token in the environment. The token is never
// printed. The command still relies on the operator's configured AWS/ECR/
// AgentCore credentials and the AgentCore CLI.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const agentcoreDir = join(repoRoot, "aws", "agentcore");

function requireEnv(name) {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    console.error(`agentcore:deploy refused: ${name} is required.`);
    process.exit(1);
  }
  return value;
}

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: opts.cwd ?? repoRoot,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) {
    console.error(`agentcore:deploy failed to start ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`agentcore:deploy failed: ${command} ${args.join(" ")} exited ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

function main() {
  requireEnv("CLOUD_DEPLOY_APPROVAL_TOKEN");
  requireEnv("MCP_ENDPOINT");
  requireEnv("AUTH_JWT_SECRET");

  if (!existsSync(join(agentcoreDir, "agentcore.config.json"))) {
    console.error("agentcore:deploy refused: aws/agentcore/agentcore.config.json is missing.");
    process.exit(1);
  }

  console.log("agentcore:deploy gate present; running deterministic AgentCore tests first.");
  run("npm", ["run", "agentcore:test", "--prefix", "aws/agentcore"]);

  const deployCommand = process.env.AGENTCORE_DEPLOY_COMMAND || "launch";
  if (deployCommand !== "launch" && deployCommand !== "deploy") {
    console.error("agentcore:deploy refused: AGENTCORE_DEPLOY_COMMAND must be launch or deploy.");
    process.exit(1);
  }

  console.log(`agentcore:deploy invoking agentcore ${deployCommand} from aws/agentcore.`);
  run("agentcore", [deployCommand], { cwd: agentcoreDir });

  console.log("agentcore:deploy completed. Run npm run agentcore:verify with AGENTCORE_* URLs next.");
}

main();
