import { MOTION_CONTROL_WEB_MCP_TOOL_IDS } from '../three/motionControlMcpContract.mjs'
import { XR_ANIMATION_WEB_MCP_TOOL_IDS } from '../three/xrAnimationMcpContract.mjs'
import { XR_SCENE_WEB_MCP_TOOL_IDS } from '../three/xrSceneMcpContract.mjs'

export const MOTION_CONTROL_AGENT_READY_TOOL_IDS = Object.freeze({
  inspectLocalMotionControl: MOTION_CONTROL_WEB_MCP_TOOL_IDS.inspect,
  controlLocalMotionControl: MOTION_CONTROL_WEB_MCP_TOOL_IDS.control,
})

const MOTION_CONTROL_INPUT_SCHEMA = Object.freeze({
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: ['invocation'],
      properties: {
        invocation: { type: 'string', minLength: 1, pattern: '\\S', description: 'Native invocation such as /motion.control @canvas #pose operation=open boundingBox=true.' },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['operation'],
      properties: {
        operation: { const: 'open' },
        boundingBox: { type: 'boolean', description: 'Enable or disable the existing tracked ROI in the local preview and catalog-authored XR subject outlines. Defaults to false for each page session; it does not enable camera object detection.' },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['operation'],
      properties: { operation: { const: 'stop' } },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['operation'],
      properties: {
        operation: { const: 'start' },
        backend: { type: 'string', enum: ['auto', 'webgpu', 'wasm'] },
      },
    },
  ],
})

function buildMotionControlObjectIdentificationOutputSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['records', 'counts'],
    properties: {
      records: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'label', 'category', 'assetLabel', 'catalogDimensionsMeters', 'selected', 'physicsBodyAttached', 'physicsBodyMode'],
          properties: {
            id: { type: 'string', minLength: 1 },
            label: { type: 'string' },
            category: { type: 'string', enum: ['people', 'animals', 'vehicles', 'furniture', 'props'] },
            assetLabel: { type: 'string', minLength: 1 },
            catalogDimensionsMeters: {
              type: 'array',
              minItems: 3,
              maxItems: 3,
              items: { type: 'number', exclusiveMinimum: 0 },
              description: 'Catalog-local width, height, and depth in meters before authored scale or rotation.',
            },
            selected: { type: 'boolean' },
            physicsBodyAttached: { type: 'boolean' },
            physicsBodyMode: { type: 'string', enum: ['none', 'static', 'dynamic', 'kinematic', 'trigger'] },
          },
        },
      },
      counts: {
        type: 'object',
        additionalProperties: false,
        required: ['total', 'selected', 'physicsAttached'],
        properties: {
          total: { type: 'integer', minimum: 0 },
          selected: { type: 'integer', minimum: 0, maximum: 1 },
          physicsAttached: { type: 'integer', minimum: 0 },
        },
      },
    },
  }
}

function buildMotionControlTargetsOutputSchema(buildWebName) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['selectedHumanoid', 'surfaces'],
    properties: {
      selectedHumanoid: {
        type: 'object',
        additionalProperties: false,
        required: ['actorId', 'label', 'compatible', 'assignedPresetId'],
        properties: {
          actorId: { type: 'string' },
          label: { type: 'string' },
          compatible: { type: 'boolean' },
          assignedPresetId: { type: 'string' },
        },
      },
      surfaces: {
        type: 'object',
        additionalProperties: false,
        required: ['xr3d', 'animation', 'gameMode'],
        properties: {
          xr3d: {
            type: 'object',
            additionalProperties: false,
            required: ['label', 'view', 'sceneReady', 'subjectCount', 'objectIdentification', 'controllerMode', 'controllerPhase', 'invocation', 'webMcpTool'],
            properties: {
              label: { const: '3D for XR' },
              view: { const: 'media' },
              sceneReady: { type: 'boolean' },
              subjectCount: { type: 'integer', minimum: 0 },
              objectIdentification: buildMotionControlObjectIdentificationOutputSchema(),
              controllerMode: { type: 'string', enum: ['ball', 'rocket'] },
              controllerPhase: { type: 'string', enum: ['off', 'ready', 'running', 'paused'] },
              invocation: { type: 'string', minLength: 1 },
              webMcpTool: { const: buildWebName(XR_SCENE_WEB_MCP_TOOL_IDS.control) },
            },
          },
          animation: {
            type: 'object',
            additionalProperties: false,
            required: ['label', 'view', 'sceneReady', 'selectedTarget', 'invocation', 'webMcpTool'],
            properties: {
              label: { const: 'Animation' },
              view: { const: 'animation' },
              sceneReady: { type: 'boolean' },
              selectedTarget: {
                type: 'object',
                additionalProperties: false,
                required: ['actorId', 'label', 'livePoseCompatible', 'assignedPresetId', 'recommendedPresetId', 'compatible'],
                properties: {
                  actorId: { type: 'string' },
                  label: { type: 'string' },
                  livePoseCompatible: { type: 'boolean' },
                  assignedPresetId: { type: 'string' },
                  recommendedPresetId: { type: 'string' },
                  compatible: { type: 'boolean' },
                },
              },
              invocation: { type: 'string', minLength: 1 },
              webMcpTool: { const: buildWebName(XR_ANIMATION_WEB_MCP_TOOL_IDS.control) },
            },
          },
          gameMode: {
            type: 'object',
            additionalProperties: false,
            required: ['label', 'view', 'active', 'surfaceMode', 'simulationStatus', 'phase', 'enemiesAlive', 'invocation', 'webMcpTool'],
            properties: {
              label: { const: 'Game Mode' },
              view: { const: 'gameMode' },
              active: { type: 'boolean' },
              surfaceMode: { type: 'string', enum: ['3d', 'xr'] },
              simulationStatus: { type: 'string', enum: ['idle', 'ready', 'running', 'paused'] },
              phase: { type: 'string', enum: ['stopped', 'playing', 'won', 'lost'] },
              enemiesAlive: { type: 'integer', minimum: 0, maximum: 4 },
              invocation: { type: 'string', pattern: '^/game\\.mode\\s+@canvas\\s+#gameplay' },
              webMcpTool: { const: buildWebName('control_local_game_mode') },
            },
          },
        },
      },
    },
  }
}

export function buildMotionControlAgentReadyToolContracts({ buildWebName, readOnlyAnnotations, mutationAnnotations }) {
  return [{
    name: MOTION_CONTROL_AGENT_READY_TOOL_IDS.inspectLocalMotionControl,
    webName: buildWebName(MOTION_CONTROL_AGENT_READY_TOOL_IDS.inspectLocalMotionControl),
    title: 'Inspect Local Motion Control',
    description: 'Inspect browser-local camera, official LiteRT pose model, accelerator, confidence, latency, bounding-box availability, selected XR humanoid, authored XR subject identification and physics attachment status from the existing scene owner, existing scene/animation target owners, privacy, and native /motion.control @canvas #pose grammar without exposing frames, camera geometry, or camera-derived identities.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    outputSchema: {
      type: 'object',
      additionalProperties: true,
      required: ['schema', 'webMcpTools', 'invocationGrammar', 'model', 'runtime', 'preview', 'privacy', 'targets'],
      properties: {
        preview: {
          type: 'object',
          additionalProperties: false,
          required: ['boundingBoxEnabled', 'boundingBoxAvailable'],
          properties: {
            boundingBoxEnabled: { type: 'boolean', description: 'Whether the shared local-pose ROI and authored-XR-outline preference is enabled.' },
            boundingBoxAvailable: { type: 'boolean', description: 'Whether current single-person pose tracking has a transient camera ROI; unrelated to authored XR subject records.' },
          },
        },
        targets: buildMotionControlTargetsOutputSchema(buildWebName),
      },
    },
    annotations: readOnlyAnnotations,
  }, {
    name: MOTION_CONTROL_AGENT_READY_TOOL_IDS.controlLocalMotionControl,
    webName: buildWebName(MOTION_CONTROL_AGENT_READY_TOOL_IDS.controlLocalMotionControl),
    title: 'Control Local Motion Control',
    description: 'Open, start, or stop browser-local LiteRT human-pose capture in XR Mode; operation=open may also set the default-off tracked-pose ROI and catalog-authored XR subject outlines through structured fields or the native /motion.control, @canvas, and #pose grammar. This does not enable camera object detection.',
    inputSchema: MOTION_CONTROL_INPUT_SCHEMA,
    outputSchema: { type: 'object', additionalProperties: true, required: ['ok', 'message'] },
    annotations: mutationAnnotations,
  }]
}
