#!/usr/bin/env node
// CDK app entry for the agentic-canvas-os Agent-API tier.
//
// Spec: knowgrph-acos-mcp-connector, task 5.1 (R11.1, R11.2; design Agent_Api
// tier). Scaffolds API Gateway + Lambda + S3 with least-privilege IAM and NO
// model provider keys in any config or environment value. The HS256 signing
// secret is referenced from AWS Secrets Manager (by name → ARN), never inlined.
//
// Task 11.2 deploys this stack (API Gateway + Lambda + S3, least-privilege IAM)
// and verifies `GET /health` returns HTTP 200 within 5s. Operators must run
// `npm install` in the tier (so node_modules ships in the Lambda asset) before
// `cdk bootstrap` / `cdk deploy`.

import { App } from "aws-cdk-lib";

import { AgentApiStack } from "../lib/agent-api-stack.js";

const app = new App();

// The signing-secret NAME is non-secret configuration; the secret VALUE lives
// only in AWS Secrets Manager and is read at runtime via a scoped grant.
const signingSecretName =
  app.node.tryGetContext("signingSecretName") ||
  "knowgrph/agent-api/auth-jwt-secret";

new AgentApiStack(app, "KnowgrphAgentApiStack", {
  signingSecretName,
  // Account/region come from the deploy environment (non-secret). Left unset
  // here so synth stays environment-agnostic until task 11.2 wires the target.
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description:
    "agentic-canvas-os Agent-API: API Gateway + Lambda + S3, least-privilege IAM, no model provider keys (knowgrph-acos-mcp-connector task 5.1).",
});

app.synth();
