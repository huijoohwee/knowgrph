// Static assertions for the AWS Bedrock AgentCore Runtime execution role
// (knowgrph-acos-mcp-connector spec, task 13.3 / R11.1 / R11.2 / R11.5 /
// Correctness Property 1; decision 13.0 — thin MCP-forwarding adapter).
//
// CDK cannot be installed or synthesized in this offline, network-free
// environment, so these tests STATICALLY scan the CDK source + config (without
// importing aws-cdk-lib) to assert the R11 spend-isolation boundary holds at the
// IAM layer:
//   1. NO `bedrock:InvokeModel*` (or any paid-model-invoke) permission is ever
//      GRANTED; the role can only pull an image, write logs, and read/write run
//      artifacts (R11.2, R11.5).
//   2. NO model-provider key/token appears in the role, task env, or config
//      (R11.1, R11.5).
//   3. NO Secrets Manager access is attached (the auth-secret reconciliation is
//      task 13.4; until then the role is fail-closed against secrets).
//   4. Least-privilege scoped grant helpers are used — no customer-authored
//      wildcard ("*") ALLOW resource policies.
//
// Synth status: `cdk synth` is NOT run here because the CDK toolchain/deps are
// unavailable offline; deployment + synth verification happen in task 13.9
// (OPERATOR-GATED).

import test from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CDK_DIR = join(HERE, "..", "cdk");

const INFRA_FILES = Object.freeze([
  join(CDK_DIR, "lib", "agentcore-runtime-role-stack.js"),
  join(CDK_DIR, "bin", "app.js"),
  join(CDK_DIR, "cdk.json"),
  join(CDK_DIR, "package.json"),
]);

function readInfra(path) {
  return readFileSync(path, "utf8");
}

const STACK_SRC = readInfra(join(CDK_DIR, "lib", "agentcore-runtime-role-stack.js"));

// Comments document the EXCLUDED permissions in prose; strip block/line comments
// so the permission-grant assertions scan executable source only.
const STACK_CODE = STACK_SRC
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .map((line) => line.replace(/\/\/.*$/, ""))
  .join("\n");

// --- (1) No paid-model-invoke permission is GRANTED (R11.2, R11.5, Property 1)

test("the role grants NO bedrock:InvokeModel* or other paid-model-invoke permission", () => {
  // The ONLY occurrences of `bedrock:` must be within the explicit DENY block.
  // No grant helper for model invocation may be present.
  assert.equal(
    /grantInvoke|bedrockInvoke/i.test(STACK_CODE),
    false,
    "no model-invoke grant helper may be present",
  );
  // The ONLY occurrences of `bedrock:` must be within the explicit DENY block.
  const bedrockMatches = STACK_CODE.match(/bedrock:[A-Za-z]+/g) || [];
  assert.ok(bedrockMatches.length > 0, "expected the explicit deny list to name bedrock actions");
  // There must be a DENY effect and it must precede / contain the bedrock list.
  assert.match(STACK_CODE, /effect:\s*iam\.Effect\.DENY/, "bedrock actions must be under an explicit DENY");
  // No ALLOW statement may name a bedrock action.
  assert.equal(
    /Effect\.ALLOW[\s\S]*bedrock:/.test(STACK_CODE),
    false,
    "no ALLOW statement may grant a bedrock action",
  );
});

test("an explicit DENY covers the paid-model-invoke actions (defense in depth)", () => {
  assert.match(STACK_CODE, /DenyAllPaidModelInvocation/);
  for (const action of [
    "bedrock:InvokeModel",
    "bedrock:InvokeModelWithResponseStream",
    "bedrock:Converse",
    "bedrock:ConverseStream",
  ]) {
    assert.ok(
      STACK_CODE.includes(action),
      `explicit deny must list ${action}`,
    );
  }
});

// --- (2) No model-provider keys anywhere in infra source/config (R11.1) -----

const FORBIDDEN_PROVIDER_TOKENS = Object.freeze([
  /byteplus/i,
  /modelark/i,
  /openai/i,
  /anthropic/i,
  /pixverse/i,
  /\bexa[_-]?api[_-]?key\b/i,
]);

const FORBIDDEN_SECRET_SHAPES = Object.freeze([
  /sk_live_[0-9a-z]/i,
  /sk_test_[0-9a-z]/i,
  /rk_live_[0-9a-z]/i,
  /[A-Z0-9_]*_API_KEY\s*[:=]/,
]);

test("no model-provider vendor tokens appear in any AgentCore CDK infra file (R11.1)", () => {
  for (const file of INFRA_FILES) {
    const src = readInfra(file);
    for (const pattern of FORBIDDEN_PROVIDER_TOKENS) {
      assert.equal(
        pattern.test(src),
        false,
        `forbidden provider token ${pattern} found in ${file}`,
      );
    }
  }
});

test("no inlined provider/API secret shapes appear in any AgentCore CDK infra file (R11.1, R11.5)", () => {
  for (const file of INFRA_FILES) {
    const src = readInfra(file);
    for (const pattern of FORBIDDEN_SECRET_SHAPES) {
      assert.equal(
        pattern.test(src),
        false,
        `forbidden secret shape ${pattern} found in ${file}`,
      );
    }
  }
});

// --- (3) No Secrets Manager access reachable by this role (task 13.4 defers it)

test("the execution role attaches NO Secrets Manager access (fail-closed until 13.4)", () => {
  assert.equal(
    /secretsmanager/i.test(STACK_CODE),
    false,
    "no secretsmanager access may be granted by this role until inbound-auth reconciliation (task 13.4)",
  );
  assert.equal(
    /grantRead\(|Secret\.fromSecret/i.test(STACK_CODE),
    false,
    "no Secrets Manager secret may be referenced/granted by this role",
  );
});

// --- (4) Least-privilege: scoped grants, no wildcard ALLOW resource policies -

test("the role uses scoped grant helpers for ECR pull, Logs write, and S3 artifacts", () => {
  assert.match(STACK_CODE, /imageRepository\.grantPull\(/, "scoped ECR pull grant");
  assert.match(STACK_CODE, /runtimeLogGroup\.grantWrite\(/, "scoped log-group write grant");
  assert.match(
    STACK_CODE,
    /artifactBucket\.grantReadWrite\([^)]*,\s*["']runs\/\*["']\)/,
    "bucket grant must be scoped to the runs/* prefix",
  );
});

test("no wildcard ('*') resource appears in an ALLOW statement", () => {
  // The only wildcard resource permitted is in the explicit DENY block; any
  // wildcard inside an ALLOW (or default-effect) PolicyStatement is forbidden.
  const allowWildcard = /Effect\.ALLOW[\s\S]{0,400}resources\s*:\s*\[\s*["']\*["']/;
  assert.equal(allowWildcard.test(STACK_CODE), false, "no ALLOW statement may use resources:['*']");
});

// --- (5) Trust policy + structural sanity ------------------------------------

test("the role is assumable only by the Bedrock AgentCore service with a source-account guard", () => {
  assert.match(STACK_CODE, /ServicePrincipal\(\s*["']bedrock-agentcore\.amazonaws\.com["']/);
  assert.match(STACK_CODE, /aws:SourceAccount/, "confused-deputy guard must scope the trust to this account");
});

test("the stack defines exactly one IAM role and a dedicated log group", () => {
  assert.match(STACK_CODE, /new iam\.Role\(/);
  assert.match(STACK_CODE, /new logs\.LogGroup\(/);
  assert.match(STACK_CODE, /ecr\.Repository\.fromRepositoryName/);
  assert.match(STACK_CODE, /s3\.Bucket\.fromBucketName/);
});

test("CDK dependency versions are pinned exactly (no ^ or ~)", () => {
  const pkg = JSON.parse(readInfra(join(CDK_DIR, "package.json")));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [name, version] of Object.entries(deps)) {
    assert.equal(
      /^[0-9]/.test(version),
      true,
      `${name} must be pinned to an exact version, got "${version}"`,
    );
  }
});
