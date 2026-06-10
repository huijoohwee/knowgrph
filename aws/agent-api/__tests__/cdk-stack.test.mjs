// Static assertions for the AWS CDK Agent-API stack (knowgrph-acos-mcp-connector
// spec, task 5.1 / R11.1 / R11.2 / design Agent_Api tier).
//
// CDK cannot be installed or synthesized in this offline environment, so these
// tests STATICALLY scan the CDK source + config (without importing aws-cdk-lib)
// to assert two invariants:
//   1. No model-provider key (BytePlus/ModelArk, Exa, OpenAI, Anthropic,
//      PixVerse, Stripe, or any *_API_KEY) appears as a literal in any env var
//      or config value (R11.1, R11.2).
//   2. The stack uses scoped, least-privilege IAM grants — no customer-authored
//      wildcard ("*") resource policies — and references the signing secret
//      from Secrets Manager rather than inlining a secret value (R15.7).
//
// Synth status: `cdk synth` is NOT run here because the CDK toolchain/deps are
// unavailable offline; deployment + synth verification happen in task 11.2.

import test from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CDK_DIR = join(HERE, "..", "cdk");

// Infrastructure source + config that must be free of provider secrets. The
// test file and any pattern-definition files are intentionally NOT scanned.
const INFRA_FILES = Object.freeze([
  join(CDK_DIR, "lib", "agent-api-stack.js"),
  join(CDK_DIR, "bin", "app.js"),
  join(CDK_DIR, "cdk.json"),
  join(CDK_DIR, "package.json"),
]);

function readInfra(path) {
  return readFileSync(path, "utf8");
}

const STACK_SRC = readInfra(join(CDK_DIR, "lib", "agent-api-stack.js"));

// --- (1) No model-provider keys anywhere in infra source/config (R11.1) -----

// Provider/vendor tokens that must never appear as a key or literal value.
const FORBIDDEN_PROVIDER_TOKENS = Object.freeze([
  /byteplus/i,
  /modelark/i,
  /openai/i,
  /anthropic/i,
  /pixverse/i,
  /\bexa[_-]?api[_-]?key\b/i,
]);

// Stripe / generic secret-key shapes that must never be inlined.
const FORBIDDEN_SECRET_SHAPES = Object.freeze([
  /sk_live_[0-9a-z]/i,
  /sk_test_[0-9a-z]/i,
  /rk_live_[0-9a-z]/i,
  // Any identifier ending in _API_KEY being assigned/declared a value.
  /[A-Z0-9_]*_API_KEY\s*[:=]/,
]);

test("no model-provider vendor tokens appear in any CDK infra file (R11.1)", () => {
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

test("no inlined provider/API secret shapes appear in any CDK infra file (R11.1, R11.2)", () => {
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

test("the only Lambda env values are non-secret references (secret ARN + bucket name)", () => {
  // The signing secret is passed by ARN reference, never by value.
  assert.match(STACK_SRC, /AUTH_JWT_SECRET_ARN:\s*signingSecret\.secretArn/);
  assert.match(STACK_SRC, /ARTIFACT_BUCKET:\s*artifactBucket\.bucketName/);
  // A raw secret value must never be assigned into the environment.
  assert.equal(
    /AUTH_JWT_SECRET\s*:\s*["'`]/.test(STACK_SRC),
    false,
    "the literal signing-secret value must not be placed in an env var",
  );
});

// --- (2) Least-privilege IAM: scoped grants, no wildcard resource policies ---

test("the stack references the signing secret from Secrets Manager (no inline value)", () => {
  assert.match(STACK_SRC, /secretsmanager\.Secret\.fromSecretNameV2/);
  // No inline/unsafe secret material.
  assert.equal(
    /unsafePlainText|generateSecretString|secretStringValue/.test(STACK_SRC),
    false,
    "the stack must reference an existing secret, not create/inline one",
  );
});

test("the stack uses scoped grant helpers, not broad PolicyStatements", () => {
  assert.match(STACK_SRC, /signingSecret\.grantRead\(/, "scoped secret read grant");
  assert.match(
    STACK_SRC,
    /artifactBucket\.grantReadWrite\([^)]*,\s*["']runs\/\*["']\)/,
    "bucket grant must be scoped to the runs/* prefix",
  );
  assert.match(STACK_SRC, /logGroup\.grantWrite\(/, "scoped log-group write grant");
});

test("no customer-authored wildcard resource policy is present (no resources:['*'])", () => {
  for (const file of INFRA_FILES) {
    const src = readInfra(file);
    assert.equal(
      /resources\s*:\s*\[\s*["']\*["']/.test(src),
      false,
      `wildcard resources:['*'] found in ${file}`,
    );
    assert.equal(
      /["']Resource["']\s*:\s*["']\*["']/.test(src),
      false,
      `wildcard "Resource":"*" found in ${file}`,
    );
  }
});

// --- (3) Structural scaffolding sanity ---------------------------------------

test("the stack defines API Gateway, Lambda, and a private S3 bucket", () => {
  assert.match(STACK_SRC, /new apigateway\.RestApi\(/);
  assert.match(STACK_SRC, /new lambda\.Function\(/);
  assert.match(STACK_SRC, /new s3\.Bucket\(/);
  assert.match(STACK_SRC, /BlockPublicAccess\.BLOCK_ALL/, "bucket must block public access");
  assert.match(STACK_SRC, /enforceSSL:\s*true/, "bucket must enforce SSL");
});

test("the POST /auth/session route is wired to the live auth-session handler", () => {
  assert.match(STACK_SRC, /addResource\(["']auth["']\)\.addResource\(["']session["']\)/);
  assert.match(STACK_SRC, /["']src\/handlers\/auth-session\.handler["']/);
});

test("all four routes are wired to live Lambda handlers (task 11.2)", () => {
  for (const name of ["auth-session", "run", "runs", "health"]) {
    assert.match(
      STACK_SRC,
      new RegExp(`["']src/handlers/${name}\\.handler["']`),
      `${name} handler must be wired as a live Lambda entry point`,
    );
  }
  // The open GET /health route returns HTTP 200 within 5s (R3.4); it must be a
  // live integration, not a mock placeholder.
  assert.match(STACK_SRC, /addResource\(["']health["']\)\.addMethod\(["']GET["']/);
});

test("GET /health is least-privilege: no secret env, no secret/bucket grant", () => {
  // The health function is created with only NODE_OPTIONS in its env (no
  // AUTH_JWT_SECRET_ARN, no ARTIFACT_BUCKET) and receives neither a
  // signingSecret.grantRead nor an artifactBucket.grantReadWrite (Property 31).
  assert.match(
    STACK_SRC,
    /makeFunction\(\s*["']Health["'],\s*["']src\/handlers\/health\.handler["'],\s*\{\s*NODE_OPTIONS/,
    "health function must hold no secret/bucket env value",
  );
  assert.equal(
    /grantRead\(healthFn\)|grantReadWrite\(healthFn/.test(STACK_SRC),
    false,
    "the health function must not be granted the signing secret or the bucket",
  );
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
