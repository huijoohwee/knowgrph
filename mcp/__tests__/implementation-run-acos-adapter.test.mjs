import assert from "node:assert/strict";
import { test } from "node:test";

import { buildAgenticDeviceCommand, parseAgenticDeviceFailure, parseAgenticDeviceResult } from "../implementation-run-acos-adapter.js";

const sessionId = "knowgrph-ir_aaaaaaaaaaaaaaaaaaaaaaaa";
const worktreePath = "/workspace/.worktrees/project/implementation-item";
const branch = "agent/device/managed-item";
const pullRequestUrl = "https://github.com/example/project/pull/12";
const result = (action, status, leaseStatus = status) => ({
  schema: "agentic-device-command-result/v1",
  ok: true,
  action,
  status,
  repoRoot: worktreePath,
  worktreePath,
  branch,
  provisioned: action === "start",
  pullRequest: { url: pullRequestUrl, number: 12, isDraft: status !== "review_ready" },
  lease: {
    schema: "agentic-writer-lease/v2",
    status: leaseStatus,
    epoch: 4,
    sessionId,
    branch,
    worktreePath,
    baseSha: "a".repeat(40),
    fenceSha: "b".repeat(40),
    pullRequestUrl,
  },
});

test("ACOS adapter builds exact argv without shell or delivery actions", () => {
  assert.deepEqual(buildAgenticDeviceCommand({
    scriptPath: "/trusted/acos/scripts/device-branch.mjs",
    action: "start",
    positional: "managed-item",
    sessionId,
    repository: "/workspace/project",
    worktreePath,
    leaseTtlSeconds: 600,
  }), [
    "/trusted/acos/scripts/device-branch.mjs", "start", "managed-item", `--session=${sessionId}`,
    "--repository=/workspace/project", `--worktree=${worktreePath}`, "--provision", "--ttl-seconds=600", "--json",
  ]);
  assert.throws(() => buildAgenticDeviceCommand({ scriptPath: "/trusted/script", action: "publish", sessionId, repository: "/workspace/project" }), /invalid/);
  assert.deepEqual(buildAgenticDeviceCommand({ scriptPath: "/trusted/acos/scripts/device-branch.mjs", action: "start", positional: "managed-item", sessionId, repository: worktreePath, leaseTtlSeconds: 600, provision: false }), [
    "/trusted/acos/scripts/device-branch.mjs", "start", "managed-item", `--session=${sessionId}`, `--repository=${worktreePath}`, "--ttl-seconds=600", "--json",
  ]);
});

test("ACOS adapter accepts only internally consistent lease-fenced JSON", () => {
  const started = parseAgenticDeviceResult(JSON.stringify(result("start", "active")), { action: "start", expectedStatus: "active", sessionId });
  assert.equal(started.provisioned, true);
  const replay = { ...result("start", "active"), provisioned: false };
  assert.equal(parseAgenticDeviceResult(JSON.stringify(replay), { action: "start", expectedStatus: "active", sessionId, expectedProvisioned: false }).provisioned, false);
  const reviewed = parseAgenticDeviceResult(JSON.stringify(result("review", "review_ready")), { action: "review", expectedStatus: "review_ready", sessionId });
  assert.equal(reviewed.lease.status, "review_ready");
  assert.equal(reviewed.pullRequest.isDraft, false);
  assert.throws(() => parseAgenticDeviceResult(JSON.stringify({ ...result("start", "active"), provisioned: false }), { action: "start", expectedStatus: "active", sessionId }), /provisioning/);
  assert.throws(() => parseAgenticDeviceResult(JSON.stringify({ ...result("heartbeat", "active"), lease: { ...result("heartbeat", "active").lease, sessionId: "other" } }), { action: "heartbeat", expectedStatus: "active", sessionId }), /lease identity/);
  assert.throws(() => parseAgenticDeviceResult(JSON.stringify({ ...result("start", "active"), pullRequest: null, lease: { ...result("start", "active").lease, pullRequestUrl: undefined } }), { action: "start", expectedStatus: "active", sessionId }), /pull-request ownership/);
  assert.throws(() => parseAgenticDeviceResult(JSON.stringify({ ...result("resume", "active"), lease: { ...result("resume", "active").lease, baseSha: "short" } }), { action: "resume", expectedStatus: "active", sessionId }), /lease identity/);
  assert.throws(() => parseAgenticDeviceResult(`${JSON.stringify(result("start", "active"))}\n{}`, { action: "start", expectedStatus: "active", sessionId }), /exactly one/);
});

test("ACOS adapter preserves typed command failures without parsing prose", () => {
  const failure = { schema: "agentic-device-command-result/v1", ok: false, action: "start", status: "error", error: { code: "device_command_failed", message: "claim failed" } };
  assert.deepEqual(parseAgenticDeviceFailure(JSON.stringify(failure), "start"), failure);
  assert.equal(parseAgenticDeviceFailure("human output", "start"), null);
});

test("adapter accepts the merged ACOS bea4ce5f v2 start projection", () => {
  const fixture = {
    schema: "agentic-device-command-result/v1", ok: true, action: "start", status: "active",
    repoRoot: worktreePath, branch, worktreePath, provisioned: true,
    pullRequest: { url: pullRequestUrl, number: 12, isDraft: true },
    lease: {
      schema: "agentic-writer-lease/v2", status: "active", epoch: 4, sessionId, device: "fixture-device", scope: "managed-item", branch, worktreePath,
      baseSha: "a".repeat(40), fenceSha: "b".repeat(40), pullRequestUrl, reviewHeadSha: null, deliveryHeadSha: null, parkHeadSha: null, parkStashRef: null,
      acquiredAt: "2026-07-22T00:00:00.000Z", heartbeatAt: "2026-07-22T00:00:00.000Z", expiresAt: "2026-07-22T00:10:00.000Z",
    },
  };
  assert.equal(parseAgenticDeviceResult(JSON.stringify(fixture), { action: "start", expectedStatus: "active", sessionId }).lease.schema, "agentic-writer-lease/v2");
});
