#!/usr/bin/env node
// CDK app entry for the AWS Bedrock AgentCore Runtime execution role.
//
// Spec: knowgrph-acos-mcp-connector, task 13.3 (R11.1, R11.2, R11.5; Property 1).
// Synthesizes the least-privilege AgentCore Runtime execution role: ECR pull +
// CloudWatch Logs + S3 artifact access ONLY, with NO `bedrock:InvokeModel*` and
// NO model provider keys (decision 13.0 — thin MCP-forwarding adapter).
//
// The `agentcore launch` deploy that uses this role is OPERATOR-GATED behind a
// `cloud-deploy` Approval_Token (tasks 13.9/13.10), exactly like Section 11.

import { App } from "aws-cdk-lib";

import { AgentcoreRuntimeRoleStack } from "../lib/agentcore-runtime-role-stack.js";

const app = new App();

// Both inputs are non-secret configuration. The ECR repository holds the ARM64
// AgentCore MCP-forwarder image (task 13.1); the artifact bucket is the shared
// run-artifact store (reused from the Agent_Api tier).
const ecrRepositoryName =
  app.node.tryGetContext("ecrRepositoryName") ||
  "knowgrph/agentcore-mcp-forwarder";
const artifactBucketName =
  app.node.tryGetContext("artifactBucketName") ||
  process.env.ARTIFACT_BUCKET ||
  "knowgrph-agent-api-run-artifacts";

new AgentcoreRuntimeRoleStack(app, "KnowgrphAgentcoreRuntimeRoleStack", {
  ecrRepositoryName,
  artifactBucketName,
  // Account/region come from the deploy environment (non-secret).
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description:
    "AgentCore Runtime least-privilege execution role: ECR pull + Logs + S3 " +
    "only, no model-invoke permission, no provider keys " +
    "(knowgrph-acos-mcp-connector task 13.3).",
});

app.synth();
