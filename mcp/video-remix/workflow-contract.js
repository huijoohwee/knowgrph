import { VIDEO_WORKFLOW_ACTIONS } from "./workflow-control.js";
import { CINEMATOGRAPHY_GRAMMAR } from "./expressive-storyboard.js";
import { REFERENCE_IMAGE_KINDS } from "./reference-image-selection.js";

export const VIDEO_WORKFLOW_INPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  properties: {
    sessionId: { type: "string", minLength: 1 },
    action: { type: "string", enum: [...VIDEO_WORKFLOW_ACTIONS], default: "run" },
    script: { type: "string", maxLength: 500000 },
    characters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          referenceImageId: { type: "string" },
        },
      },
    },
    referenceImages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "width", "height"],
        properties: {
          id: { type: "string", minLength: 1 },
          width: { type: "number", exclusiveMinimum: 0 },
          height: { type: "number", exclusiveMinimum: 0 },
          assetUrl: { type: "string" },
          kind: { type: "string", enum: [...REFERENCE_IMAGE_KINDS] },
          entityIds: { type: "array", items: { type: "string", minLength: 1 } },
          sceneId: { type: "string" },
          actionBeatId: { type: "string" },
          sourceShotId: { type: "string" },
          environmentState: { type: "object", additionalProperties: true },
        },
      },
    },
    revision: {
      type: "object",
      additionalProperties: false,
      properties: {
        note: { type: "string" },
        shotPrompts: { type: "object", additionalProperties: { type: "string", minLength: 1 } },
      },
    },
    context: {
      type: "object",
      additionalProperties: false,
      properties: {
        characterBudget: { type: "integer", minimum: 1 },
        entries: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["content"],
            properties: { role: { type: "string" }, content: { type: "string" } },
          },
        },
      },
    },
    referencePolicy: {
      type: "object",
      additionalProperties: false,
      properties: {
        maxReferencesPerShot: { type: "integer", minimum: 1, maximum: 8 },
        includePreviousTimeline: { type: "boolean" },
        requireCharacterCoverage: { type: "boolean" },
        requireEnvironmentCoverage: { type: "boolean" },
      },
    },
    imagePromptPolicy: {
      type: "object",
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean" },
        includePreviousTimeline: { type: "boolean" },
        includeReferenceDirectives: { type: "boolean" },
        requireSpatialBlocking: { type: "boolean" },
        coordinatePrecision: { type: "integer", minimum: 0, maximum: 4 },
        nearDistance: { type: "number", minimum: 0.1, maximum: 100 },
      },
    },
    imageConsistencyPolicy: {
      type: "object",
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean" },
        required: { type: "boolean" },
        candidateCount: { type: "integer", minimum: 2, maximum: 8 },
        minimumSuccessfulCandidates: { type: "integer", minimum: 1, maximum: 8 },
        maxConcurrency: { type: "integer", minimum: 1, maximum: 8 },
        consistencyThreshold: { type: "number", minimum: 0, maximum: 1 },
        metricWeights: {
          type: "object",
          additionalProperties: false,
          properties: {
            identity: { type: "number", minimum: 0, maximum: 1 },
            environment: { type: "number", minimum: 0, maximum: 1 },
            spatial: { type: "number", minimum: 0, maximum: 1 },
            temporal: { type: "number", minimum: 0, maximum: 1 },
            technical: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
    },
    parallelShotPolicy: {
      type: "object",
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean" },
        maxConcurrency: { type: "integer", minimum: 1, maximum: 8 },
        maxBatchSize: { type: "integer", minimum: 1, maximum: 16 },
        requireSameScene: { type: "boolean" },
        maxCostCentsPerShot: { type: "integer", minimum: 0, maximum: 1000000 },
      },
    },
    storyboardProfile: {
      type: "object",
      additionalProperties: false,
      properties: {
        userRequirements: { type: "string", maxLength: 5000 },
        tone: { type: "string", maxLength: 500 },
        visualStyle: { type: "string", maxLength: 500 },
        aspectRatio: { type: "string", maxLength: 32 },
        pace: { type: "string", enum: [...CINEMATOGRAPHY_GRAMMAR.paces] },
        motionIntensity: { type: "number", minimum: 0, maximum: 1 },
        shotDuration: {
          type: "object",
          additionalProperties: false,
          properties: {
            minSeconds: { type: "number", minimum: 0.5, maximum: 120 },
            maxSeconds: { type: "number", minimum: 0.5, maximum: 120 },
          },
        },
        multiCamera: {
          type: "object",
          additionalProperties: false,
          properties: {
            enabled: { type: "boolean" },
            cameraCount: { type: "integer", minimum: 1, maximum: 8 },
            actionAxisDegrees: { type: "number", minimum: 0, exclusiveMaximum: 360 },
            minimumCutAngleDegrees: { type: "number", minimum: 0, maximum: 90 },
            allowAxisCrossing: { type: "boolean" },
          },
        },
        targetAudience: {
          type: "object",
          additionalProperties: false,
          properties: {
            description: { type: "string", maxLength: 2000 },
            viewingContext: { type: "string", maxLength: 500 },
            accessibilityNeeds: { type: "array", items: { type: "string", minLength: 1, maxLength: 500 } },
            contentSensitivities: { type: "array", items: { type: "string", minLength: 1, maxLength: 500 } },
          },
        },
      },
    },
    narrativePolicy: {
      type: "object",
      additionalProperties: false,
      properties: {
        shotsPerAct: { type: "integer", minimum: 1, maximum: 20 },
        retrievalTopK: { type: "integer", minimum: 1, maximum: 20 },
        scriptRetrievalTopK: { type: "integer", minimum: 1, maximum: 20 },
        segmentCharacters: { type: "integer", minimum: 400, maximum: 12000 },
        storyboardContextCharacters: { type: "integer", minimum: 1000, maximum: 100000 },
      },
    },
    qualityPolicy: {
      type: "object",
      additionalProperties: false,
      properties: {
        narrativeThreshold: { type: "number", minimum: 0, maximum: 1 },
        visualThreshold: { type: "number", minimum: 0, maximum: 1 },
        maxNegotiationRounds: { type: "integer", minimum: 1, maximum: 4 },
      },
    },
    checkpoint: {
      type: "object",
      additionalProperties: true,
      properties: {
        sessionId: { type: "string" },
        revisionNumber: { type: "integer", minimum: 0 },
        renderAssets: { type: "array", items: { type: "object", additionalProperties: true } },
      },
    },
  },
});
