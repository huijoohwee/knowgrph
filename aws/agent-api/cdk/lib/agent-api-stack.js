// AWS CDK stack for the agentic-canvas-os Agent-API tier.
//
// Spec: knowgrph-acos-mcp-connector, tasks 5.1 (R11.1, R11.2; scaffold) and
// 11.2 (R3.4, R11.1, R11.2, R15.7; live deploy of API Gateway + Lambda + S3;
// Correctness Property 31). Defines:
//   - Lambda functions wiring the handlers from `../../src/handlers`
//     (`auth-session`, `run`, `runs`, `health`) — all four routes are LIVE.
//   - An API Gateway (REST) exposing those routes.
//   - An S3 bucket for run artifacts (private, encrypted, SSL-enforced).
//   - A Secrets Manager *reference* to the HS256 signing secret (by name).
//
// ── Lambda source packaging (task 11.2) ─────────────────────────────────────
//   The Lambda code asset is the TIER ROOT (`aws/agent-api`) minus the CDK app,
//   tests, and docs (see `LAMBDA_ASSET_EXCLUDES`). This packages `src/handlers`
//   + `src/lib` + the tier's `node_modules` (the FOSS `jsonwebtoken` runtime
//   dep) so each handler can resolve its relative `../lib/*` imports and its one
//   third-party dependency at runtime. Handlers are addressed as
//   `src/handlers/<name>.handler`. Operators MUST run `npm install` in the tier
//   before `cdk deploy` so `node_modules` is present in the asset.
//
// ── Least-privilege IAM summary (R11.1, R11.2, Property 31) ──────────────────
//   * The auth-session / run / runs Lambda roles grant ONLY:
//       - read on the single signing-secret ARN          (secret.grantRead)
//       - read/write on the artifact bucket `runs/*` prefix only
//                                                         (bucket.grantReadWrite)
//       - write to their OWN dedicated CloudWatch log group (logGroup.grantWrite)
//   * The `GET /health` Lambda is an OPEN liveness probe: it holds NO secret env
//     value and is granted NEITHER the signing secret NOR the bucket — only
//     write to its own log group. This is the tightest grant of the four
//     (R15.6, Property 31).
//   * NO customer-authored wildcard ("*") resource policies are defined here.
//   * NO model provider keys of any vendor appear in any env var or config —
//     the only env values are the signing-secret ARN reference and the artifact
//     bucket NAME, both non-secret. All paid model spend stays on the
//     Cloudflare control plane; this tier never holds a provider key
//     (Property 31).

import {
  Stack,
  Duration,
  RemovalPolicy,
  CfnOutput,
} from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secrets-manager";

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
// The Lambda source asset is the tier root (`aws/agent-api`). It bundles
// `src/handlers` + `src/lib` + `node_modules` so each handler resolves its
// `../lib/*` imports and the `jsonwebtoken` runtime dep. Handlers are addressed
// relative to this root as `src/handlers/<name>.handler`.
const TIER_ROOT = join(HERE, "..", "..");

// Paths NOT shipped to Lambda: the CDK app itself, the test suites, and docs.
// Keeping these out yields a smaller, cleaner deployment artifact.
const LAMBDA_ASSET_EXCLUDES = Object.freeze([
  "cdk",
  "__tests__",
  "__pbt__",
  "*.md",
  ".git",
  ".gitignore",
]);

export class AgentApiStack extends Stack {
  /**
   * @param {import("constructs").Construct} scope
   * @param {string} id
   * @param {import("aws-cdk-lib").StackProps & { signingSecretName: string }} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const signingSecretName = props?.signingSecretName;
    if (typeof signingSecretName !== "string" || signingSecretName.length === 0) {
      throw new Error("AgentApiStack requires a non-empty `signingSecretName`.");
    }

    // ── Secrets Manager: REFERENCE the HS256 signing secret by name ──────────
    // The secret VALUE is never created or inlined here (R15.7, Property 31). We
    // import the existing secret so we can grant scoped read access and pass
    // only its ARN to the functions that verify/mint Auth_Tokens.
    const signingSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "AuthJwtSigningSecret",
      signingSecretName,
    );

    // ── S3: private artifact/run storage ─────────────────────────────────────
    const artifactBucket = new s3.Bucket(this, "RunArtifactBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Shared Lambda code asset (see header). Each function selects its own
    // `src/handlers/<name>.handler` entry point from this single asset.
    const lambdaCode = lambda.Code.fromAsset(TIER_ROOT, {
      exclude: [...LAMBDA_ASSET_EXCLUDES],
    });

    // Non-secret environment shared by the auth-bearing functions: the signing
    // secret ARN REFERENCE (never the value, R15.7) and the artifact bucket
    // NAME. No model provider keys appear here (Property 31).
    const authEnvironment = {
      AUTH_JWT_SECRET_ARN: signingSecret.secretArn,
      ARTIFACT_BUCKET: artifactBucket.bucketName,
      NODE_OPTIONS: "--enable-source-maps",
    };

    /**
     * Create a dedicated, scoped CloudWatch log group + Lambda function for a
     * handler. The function is granted write to ONLY its own log group; callers
     * apply any additional scoped grants (secret/bucket) explicitly.
     *
     * @param {string} idBase construct id base (e.g. "AuthSession")
     * @param {string} handler entry point relative to the asset root
     * @param {Record<string,string>} [environment] non-secret env values only
     */
    const makeFunction = (idBase, handler, environment) => {
      const logGroup = new logs.LogGroup(this, `${idBase}LogGroup`, {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      });
      const fn = new lambda.Function(this, `${idBase}Function`, {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler,
        code: lambdaCode,
        memorySize: 256,
        timeout: Duration.seconds(10),
        logGroup,
        environment: environment ?? {},
      });
      logGroup.grantWrite(fn); // its own log group only — least privilege
      return fn;
    };

    // ── Lambda: POST /auth/session (task 5.0 handler) ────────────────────────
    const authSessionFn = makeFunction(
      "AuthSession",
      "src/handlers/auth-session.handler",
      authEnvironment,
    );
    signingSecret.grantRead(authSessionFn); // read the one secret ARN only
    artifactBucket.grantReadWrite(authSessionFn, "runs/*"); // bucket runs/* only

    // ── Lambda: POST /run (tasks 5.2–5.5, 6.1 handler) ───────────────────────
    const runFn = makeFunction("Run", "src/handlers/run.handler", authEnvironment);
    signingSecret.grantRead(runFn);
    artifactBucket.grantReadWrite(runFn, "runs/*");

    // ── Lambda: GET /runs/{id} (tasks 5.6, 5.7, 6.1, 6.4 handler) ────────────
    const runsFn = makeFunction("Runs", "src/handlers/runs.handler", authEnvironment);
    signingSecret.grantRead(runsFn);
    artifactBucket.grantReadWrite(runsFn, "runs/*");

    // ── Lambda: GET /health (task 5.8 handler) ───────────────────────────────
    // OPEN liveness probe (R15.6, R3.4). Holds NO secret env and is granted
    // NEITHER the signing secret NOR the bucket — only its own log group write.
    // This is the tightest grant of the four functions (Property 31).
    const healthFn = makeFunction("Health", "src/handlers/health.handler", {
      NODE_OPTIONS: "--enable-source-maps",
    });

    // ── API Gateway (REST) ───────────────────────────────────────────────────
    const api = new apigateway.RestApi(this, "AgentApi", {
      restApiName: "knowgrph-agent-api",
      description:
        "Thin Agent-API adapter: authenticates callers and forwards MCP calls to the knowgrph control plane. Holds no model keys.",
      deployOptions: { stageName: "v1" },
    });

    const proxy = (fn) => new apigateway.LambdaIntegration(fn, { proxy: true });

    // POST /auth/session → live auth-session Lambda.
    api.root.addResource("auth").addResource("session").addMethod("POST", proxy(authSessionFn));

    // POST /run → live run Lambda (Auth_Token-gated; forwards MCP).
    api.root.addResource("run").addMethod("POST", proxy(runFn));

    // GET /runs/{id} → live runs Lambda (Auth_Token-gated; entitlement-checked).
    api.root.addResource("runs").addResource("{id}").addMethod("GET", proxy(runsFn));

    // GET /health → live OPEN liveness probe (HTTP 200 within 5s when healthy).
    api.root.addResource("health").addMethod("GET", proxy(healthFn));

    // ── Outputs (non-secret) ─────────────────────────────────────────────────
    new CfnOutput(this, "ApiUrl", { value: api.url });
    new CfnOutput(this, "HealthUrl", {
      value: `${api.url}health`,
      description: "Open GET /health liveness probe — expected HTTP 200 within 5s.",
    });
    new CfnOutput(this, "ArtifactBucketName", { value: artifactBucket.bucketName });
    new CfnOutput(this, "SigningSecretArn", {
      value: signingSecret.secretArn,
      description: "ARN reference only — the secret value is never exported.",
    });
  }
}
