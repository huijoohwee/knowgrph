import test from "node:test";
import assert from "node:assert/strict";

import {
  MULTI_AGENT_VIDEO_PIPELINE_SCHEMA,
  MULTI_AGENT_VIDEO_PIPELINE_STAGES,
  buildMultiAgentVideoPipeline,
  prepareVideoWorkflow,
  runVideoRemix,
} from "../video-remix-runtime.js";

const sourceCards = [
  { sourceId: "source-a", url: "https://a.example" },
  { sourceId: "source-b", url: "https://b.example" },
  { sourceId: "source-c", url: "https://c.example" },
];

function plannedShots() {
  return [
    { shotId: "shot-1", sceneId: "scene-1", prompt: "Lead enters the observatory", sourceCardIds: ["source-a"] },
    { shotId: "shot-2", sceneId: "scene-1", prompt: "Lead studies the star map", sourceCardIds: ["source-b"] },
  ];
}

function workflow(extra = {}) {
  return prepareVideoWorkflow({
    runId: "pipeline-run",
    brief: "A lead follows evidence through an observatory.",
    plannedShots: plannedShots(),
    sourceCards,
    workflow: { action: "plan", sessionId: "pipeline-session", ...extra },
  });
}

test("pipeline catalog is a forward-only nine-stage DAG", () => {
  assert.deepEqual(MULTI_AGENT_VIDEO_PIPELINE_STAGES.map((stage) => stage.stageId), [
    "input",
    "central_orchestration",
    "script_understanding",
    "scene_shot_planning",
    "visual_asset_planning",
    "asset_indexing",
    "consistency_continuity",
    "visual_synthesis_assembly",
    "output",
  ]);
  const order = new Map(MULTI_AGENT_VIDEO_PIPELINE_STAGES.map((stage, index) => [stage.stageId, index]));
  assert.ok(MULTI_AGENT_VIDEO_PIPELINE_STAGES.every((stage) =>
    stage.dependsOn.every((dependency) => order.get(dependency) < order.get(stage.stageId)),
  ));
});

test("planning manifest exposes agent assignments, typed handoffs, and semantic reuse", () => {
  const first = buildMultiAgentVideoPipeline({ workflow: workflow() });
  const reused = buildMultiAgentVideoPipeline({ workflow: workflow(), priorPipeline: first });

  assert.equal(first.schema, MULTI_AGENT_VIDEO_PIPELINE_SCHEMA);
  assert.equal(first.state, "awaiting_execution");
  assert.equal(first.validation.ok, true);
  assert.equal(first.handoffs.length, 8);
  assert.deepEqual(first.agentAssignments.production_director, ["input", "central_orchestration", "visual_synthesis_assembly", "output"]);
  assert.equal(reused.reusedPlan, true);
  assert.equal(reused.inputKey, first.inputKey);

  const { payload } = runVideoRemix({
    referenceUrl: "https://example.com/reference",
    brief: "Plan an evidence-backed observatory sequence",
    sourceCards,
    shotCount: 2,
    workflow: { action: "plan" },
  });
  assert.equal(payload.workflow.multiAgentPipeline.schema, MULTI_AGENT_VIDEO_PIPELINE_SCHEMA);
  assert.equal(payload.videoAgent.multiAgentPipeline.inputKey, payload.workflow.multiAgentPipeline.inputKey);
});

test("completed execution indexes selected frames, clips, output, and provider economics", () => {
  const currentWorkflow = workflow();
  const pipeline = buildMultiAgentVideoPipeline({
    workflow: currentWorkflow,
    execution: {
      imageConsistency: {
        status: "complete",
        ok: true,
        candidateProviderCalls: 4,
        reviewProviderCalls: 2,
        selections: [{
          shotId: "shot-1",
          candidates: [{ candidateId: "candidate-1", assetUrl: "https://assets.example/frame-1.webp" }],
          selectedCandidate: { candidateId: "candidate-1" },
        }],
      },
      qualityReview: { status: "complete", findings: [] },
      renderResult: { status: "complete", paidProviderCalls: 99, providerSpendCents: 99 },
      renderProviderCalls: 2,
      providerSpendCents: 18,
      editResult: { status: "complete", editedVideoReference: { durableR2Url: "https://assets.example/final.mp4" } },
      assets: plannedShots().map((shot) => ({ shotId: shot.shotId, durableR2Url: `https://assets.example/${shot.shotId}.mp4` })),
      videoAccounting: { costLogs: [{ stageId: "render" }] },
      retryTrace: [{ status: "retry" }, { status: "complete" }],
    },
  });

  assert.equal(pipeline.state, "complete");
  assert.equal(pipeline.artifactIndex.find((artifact) => artifact.artifactId === "candidate-1").selected, true);
  assert.ok(pipeline.artifactIndex.some((artifact) => artifact.kind === "assembled_video"));
  assert.deepEqual(pipeline.resourceLedger, {
    contextCharacters: currentWorkflow.context.retainedCharacters,
    scriptUnitCount: currentWorkflow.longScript.corpus.unitCount,
    plannedShotCount: 2,
    reusedShotCount: 0,
    imagePromptCount: currentWorkflow.imageGeneration.prompts.length,
    imageCandidateCalls: 4,
    imageReviewCalls: 2,
    renderProviderCalls: 2,
    providerSpendCents: 18,
    retryCount: 1,
    costLogCount: 1,
  });
});

test("optional unavailable visual review is represented as complete_unverified", () => {
  const pipeline = buildMultiAgentVideoPipeline({
    workflow: workflow(),
    execution: {
      imageConsistency: { status: "unverified", policy: { required: false } },
      qualityReview: { status: "unverified" },
      renderResult: { status: "complete" },
      editResult: { status: "complete" },
      assets: plannedShots().map((shot) => ({ shotId: shot.shotId, assetUrl: `https://assets.example/${shot.shotId}.mp4` })),
    },
  });

  assert.equal(pipeline.state, "complete_unverified");
  assert.equal(pipeline.stages.find((stage) => stage.stageId === "consistency_continuity").status, "unverified");
  assert.equal(pipeline.handoffs.find((handoff) => handoff.fromStageId === "consistency_continuity").status, "ready");
});

test("a blocked specialist decision propagates through every downstream handoff", () => {
  const currentWorkflow = workflow();
  currentWorkflow.negotiation = { ...currentWorkflow.negotiation, decision: "block" };
  const pipeline = buildMultiAgentVideoPipeline({ workflow: currentWorkflow });

  assert.equal(pipeline.state, "blocked");
  assert.equal(pipeline.ok, false);
  assert.ok(pipeline.stages.slice(1).every((stage) => stage.status === "blocked"));
  assert.ok(pipeline.handoffs.slice(1).every((handoff) => handoff.status === "blocked"));
});
