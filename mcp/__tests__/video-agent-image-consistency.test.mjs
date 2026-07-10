import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVideoAgentNegotiation,
  runImageConsistencyCheck,
} from "../video-remix-runtime.js";
import { runVideoRemixAsync } from "../video-remix/director-live-run.js";

function plannedShot() {
  return {
    shotId: "shot-1",
    imagePrompt: "Compose a spatially consistent first frame",
    renderPrompt: "Compose a spatially consistent first frame",
    imageGeneration: { inputKey: "image-prompt-key", spatialPlan: { placement: ["lead at origin"] } },
    primaryReference: { referenceId: "lead-ref", assetUrl: "https://assets.example/lead.png", kind: "character" },
    firstFrameReferences: [{ referenceId: "lead-ref", assetUrl: "https://assets.example/lead.png", kind: "character" }],
    spatialBlocking: { characters: { lead: { x: 0, y: 0, z: 0 } }, background: { room: "archive" } },
  };
}

test("candidate images generate concurrently and the highest-consistency frame wins", async () => {
  let active = 0;
  let maxActive = 0;
  const result = await runImageConsistencyCheck({
    plannedShots: [plannedShot()],
    policy: { candidateCount: 4, maxConcurrency: 4, consistencyThreshold: 0.7 },
    imageClient: {
      async generate({ variantIndex }) {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await Promise.resolve();
        active -= 1;
        return { assetUrl: `https://assets.example/candidate-${variantIndex}.png` };
      },
    },
    reviewClient: {
      async reviewCandidate({ candidateId }) {
        const variant = Number(candidateId.split(":").at(-1));
        return { identityScore: variant / 4, environmentScore: 0.9, spatialScore: variant / 4, temporalScore: 0.8, technicalScore: 0.9 };
      },
    },
  });

  assert.equal(maxActive, 4);
  assert.equal(result.status, "complete");
  assert.equal(result.selections[0].selectedCandidate.candidateId, "shot-1:candidate:4");
  assert.equal(result.shots[0].primaryReference.assetUrl, "https://assets.example/candidate-3.png");
  assert.equal(result.candidateProviderCalls, 4);
  assert.equal(result.reviewProviderCalls, 4);
});

test("stable candidate id breaks equal-score ties deterministically", async () => {
  const result = await runImageConsistencyCheck({
    plannedShots: [plannedShot()],
    policy: { candidateCount: 3, consistencyThreshold: 0.5 },
    imageClient: { async generate({ variantIndex }) { return { assetUrl: `https://assets.example/tie-${variantIndex}.png` }; } },
    reviewClient: { async reviewCandidate() { return { consistencyScore: 0.8 }; } },
  });

  assert.equal(result.selections[0].selectedCandidate.candidateId, "shot-1:candidate:1");
  assert.deepEqual(result.selections[0].reviews.map((review) => review.candidateId), [
    "shot-1:candidate:1",
    "shot-1:candidate:2",
    "shot-1:candidate:3",
  ]);
});

test("low-consistency candidates block first-frame specialist approval", async () => {
  const imageConsistency = await runImageConsistencyCheck({
    plannedShots: [plannedShot()],
    policy: { candidateCount: 2, required: true, consistencyThreshold: 0.9 },
    imageClient: { async generate({ variantIndex }) { return { assetUrl: `https://assets.example/low-${variantIndex}.png` }; } },
    reviewClient: { async reviewCandidate() { return { consistencyScore: 0.4 }; } },
  });
  const negotiation = buildVideoAgentNegotiation({ imageConsistency });

  assert.equal(imageConsistency.ok, false);
  assert.equal(imageConsistency.issues[0].code, "no_consistent_first_frame_candidate");
  assert.equal(negotiation.proposals.find((entry) => entry.agentId === "first_frame_reviewer").status, "block");
  assert.equal(negotiation.decision, "block");

  const unavailable = await runImageConsistencyCheck({
    plannedShots: [plannedShot()],
    policy: { required: true },
  });
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.issues[0].code, "image_generation_client_unavailable");
  assert.equal(unavailable.candidateProviderCalls, 0);
});

test("checkpoint selection is reused and the accepted frame reaches video render", async () => {
  let generationCalls = 0;
  const imageClient = {
    async generate({ variantIndex }) {
      generationCalls += 1;
      return { assetUrl: `https://assets.example/selected-${variantIndex}.png` };
    },
  };
  const reviewClient = {
    async reviewCandidate({ candidateId }) { return { consistencyScore: candidateId.endsWith(":2") ? 0.95 : 0.8 }; },
    async review() { return { narrativeScore: 1, visualScore: 1, findings: [] }; },
  };
  const first = await runImageConsistencyCheck({
    plannedShots: [plannedShot()],
    imageClient,
    reviewClient,
    policy: { candidateCount: 2, required: true },
  });
  const resumed = await runImageConsistencyCheck({
    plannedShots: [plannedShot()],
    imageClient,
    reviewClient,
    priorResult: first,
    policy: { candidateCount: 2, required: true },
  });
  assert.equal(generationCalls, 2);
  assert.equal(resumed.coverage.reusedCount, 1);

  let renderedFirstFrame;
  const { payload } = await runVideoRemixAsync({
    referenceUrl: "https://example.com/reference",
    brief: "Consistency checked live scene",
    mode: "live",
    budgetUsd: 10,
    approvals: ["paid-model-call", "render-action", "cloud-deploy", "payment-action"],
    sourceCards: [
      { sourceId: "source-1", url: "https://a.example" },
      { sourceId: "source-2", url: "https://b.example" },
      { sourceId: "source-3", url: "https://c.example" },
    ],
    shotCount: 1,
    workflow: { imageConsistencyPolicy: { candidateCount: 2, required: true } },
  }, {
    clients: {
      live: true,
      imageGenerationClient: imageClient,
      visualReviewClient: reviewClient,
      renderClient: {
        isDeterministicMock: false,
        requiresAsyncHarness: true,
        provider: "test-video",
        async dispatch({ shot }) {
          renderedFirstFrame = shot.primaryReference.assetUrl;
          return { assetUrl: "https://assets.example/video.mp4", provider: "test-video", costCents: 0 };
        },
      },
      commerceClient: null,
    },
    mediaPersister: {
      async persist({ stageId, shotId }) {
        return { durableR2Url: `https://assets.example/${stageId}/${shotId}`, objectKey: `${stageId}/${shotId}` };
      },
    },
  });

  assert.equal(payload.videoAgent.imageConsistency.status, "complete");
  assert.equal(payload.workflow.checkpoint.imageConsistency.selections[0].accepted, true);
  assert.equal(payload.storyboard.flow.nodes[0].imageConsistency.selectedCandidate.assetUrl, renderedFirstFrame);
  assert.equal(payload.storyboard.plannedShots[0].primaryReference.assetUrl, renderedFirstFrame);
});
