// AWS CDK stack for the AWS Bedrock AgentCore Runtime *execution role* used by
// the agentic-canvas-os AgentCore-hosted MCP-forwarding adapter.
//
// Spec: knowgrph-acos-mcp-connector, task 13.3 (R11.1, R11.2, R11.5; Correctness
// Property 1). Cross-ref: topology decision doc
// `knowgrph/docs/knowgrph-acos-topology-decision.md` › "AgentCore Runtime
// artifact shape (PRD R11 audit, task 13.0)".
//
// ── Decision 13.0 context (why this role is intentionally tiny) ─────────────
//   The AgentCore Runtime artifact is a *thin MCP-forwarding adapter*, NOT a
//   Bedrock-model-invoking reasoning agent. It forwards `knowgrph.video_remix.run`
//   plus the stage tools to the Cloudflare `McpAgent` over MCP Streamable HTTP
//   and performs NO paid model invocation of its own. The Cloudflare control
//   plane remains the only tier that holds model keys and calls paid models.
//   Consequently this execution role grants ONLY what an ARM64 container task
//   needs to start, log, and read/write run artifacts:
//
//     1. ECR image pull            — start the container image (scoped to repo)
//     2. CloudWatch Logs write     — runtime/observability logs (scoped to LG)
//     3. S3 artifact bucket access — read/write run artifacts under `runs/*`
//
// ── Hard exclusions (R11.1, R11.2, R11.5; Property 1) ───────────────────────
//   * NO `bedrock:InvokeModel`, `bedrock:InvokeModelWithResponseStream`, or any
//     other paid-model-invoke permission is granted. The role CANNOT call a
//     paid model — this enforces R11 ("AWS invokes no paid model") at the IAM
//     boundary by construction.
//   * NO model provider keys of any vendor (or any *_API_KEY) appear in the
//     role, the task env, or any Secrets Manager entry reachable by this role
//     (R11.1, R11.5).
//   * NO Secrets Manager access is attached here. The HS256 Auth_Token signing
//     secret is referenced ONLY if inbound auth (R15) is performed in this tier;
//     that reconciliation is task 13.4. Until 13.4 resolves where AgentCore
//     inbound JWT verification runs, this role intentionally grants ZERO
//     `secretsmanager:*` so it cannot reach any secret (fail-closed).
//   * NO customer-authored wildcard ("*") resource policies are written here.
//     The only `*`-scoped action is `ecr:GetAuthorizationToken`, which AWS
//     itself requires to be account-wide and is added internally by the CDK
//     `repository.grantPull()` helper — not authored by hand below.
//
// Because this role performs no paid action and holds no secret, Property 1
// (the approval-gate invariant) continues to hold at the Cloudflare `McpAgent`
// boundary regardless of whether a forwarded call originates from API
// Gateway/Lambda or from this AgentCore Runtime. The role adds no new spend
// boundary on AWS, so it introduces no new place for Property 1 to be violated.

import { Stack, RemovalPolicy, CfnOutput } from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";

export class AgentcoreRuntimeRoleStack extends Stack {
  /**
   * @param {import("constructs").Construct} scope
   * @param {string} id
   * @param {import("aws-cdk-lib").StackProps & {
   *   ecrRepositoryName: string,
   *   artifactBucketName: string,
   * }} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const ecrRepositoryName = props?.ecrRepositoryName;
    if (typeof ecrRepositoryName !== "string" || ecrRepositoryName.length === 0) {
      throw new Error(
        "AgentcoreRuntimeRoleStack requires a non-empty `ecrRepositoryName`.",
      );
    }
    const artifactBucketName = props?.artifactBucketName;
    if (typeof artifactBucketName !== "string" || artifactBucketName.length === 0) {
      throw new Error(
        "AgentcoreRuntimeRoleStack requires a non-empty `artifactBucketName`.",
      );
    }

    // ── Trust policy: the Bedrock AgentCore Runtime service assumes this role ─
    // Scoped with a confused-deputy guard (`aws:SourceAccount`) so only this
    // account's AgentCore Runtime can assume it.
    const executionRole = new iam.Role(this, "AgentcoreRuntimeExecutionRole", {
      roleName: "knowgrph-agentcore-runtime-exec",
      assumedBy: new iam.ServicePrincipal("bedrock-agentcore.amazonaws.com", {
        conditions: {
          StringEquals: { "aws:SourceAccount": Stack.of(this).account },
        },
      }),
      description:
        "Least-privilege execution role for the knowgrph AgentCore Runtime " +
        "MCP-forwarding adapter. ECR pull + CloudWatch Logs + S3 artifacts only; " +
        "NO bedrock:InvokeModel* and NO model provider keys (R11.1/R11.2/R11.5, " +
        "decision 13.0).",
    });

    // ── (1) ECR image pull — scoped to the single AgentCore image repository ─
    // `grantPull` grants the scoped pull actions (BatchGetImage,
    // GetDownloadUrlForLayer, BatchCheckLayerAvailability) on THIS repo ARN and
    // adds the AWS-required account-wide `ecr:GetAuthorizationToken`. No paid
    // model permission is implied by image pull.
    const imageRepository = ecr.Repository.fromRepositoryName(
      this,
      "AgentcoreImageRepository",
      ecrRepositoryName,
    );
    imageRepository.grantPull(executionRole);

    // ── (2) CloudWatch Logs — write to this runtime's OWN log group only ─────
    const runtimeLogGroup = new logs.LogGroup(this, "AgentcoreRuntimeLogGroup", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    runtimeLogGroup.grantWrite(executionRole); // its own log group only

    // ── (3) S3 artifact bucket — read/write under the `runs/*` prefix only ───
    // Reuses the same artifact bucket the Agent_Api tier uses for run artifacts.
    const artifactBucket = s3.Bucket.fromBucketName(
      this,
      "RunArtifactBucket",
      artifactBucketName,
    );
    artifactBucket.grantReadWrite(executionRole, "runs/*");

    // ── Explicit DENY on every paid-model-invoke action (defense in depth) ───
    // The role has no Allow for these actions, so it already cannot invoke a
    // paid model. This explicit Deny makes the R11 boundary auditable and
    // ensures no later attached policy can ever re-grant model invocation.
    executionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "DenyAllPaidModelInvocation",
        effect: iam.Effect.DENY,
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:Converse",
          "bedrock:ConverseStream",
        ],
        resources: ["*"],
      }),
    );

    // ── Outputs (non-secret) ─────────────────────────────────────────────────
    new CfnOutput(this, "ExecutionRoleArn", {
      value: executionRole.roleArn,
      description:
        "AgentCore Runtime execution role ARN — ECR pull + Logs + S3 only; " +
        "no model-invoke permission and no provider keys (decision 13.0).",
    });
    new CfnOutput(this, "RuntimeLogGroupName", {
      value: runtimeLogGroup.logGroupName,
    });
  }
}
