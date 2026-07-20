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
        boundingBox: { type: 'boolean', description: 'Enable or disable the existing tracked ROI in the local preview. Defaults to false for each page session.' },
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
        required: ['xr3d', 'animation'],
        properties: {
          xr3d: {
            type: 'object',
            additionalProperties: false,
            required: ['label', 'view', 'sceneReady', 'subjectCount', 'controllerMode', 'controllerPhase', 'invocation', 'webMcpTool'],
            properties: {
              label: { const: '3D for XR' },
              view: { const: 'media' },
              sceneReady: { type: 'boolean' },
              subjectCount: { type: 'integer', minimum: 0 },
              controllerMode: { type: 'string', enum: ['ball', 'rocket'] },
              controllerPhase: { type: 'string', enum: ['off', 'ready', 'running', 'paused'] },
              invocation: { type: 'string', minLength: 1 },
              webMcpTool: { const: buildWebName(XR_SCENE_WEB_MCP_TOOL_IDS.control) },
            },
          },
          animation: {
            type: 'object',
            additionalProperties: false,
            required: ['label', 'view', 'sceneReady', 'invocation', 'webMcpTool'],
            properties: {
              label: { const: 'Animation' },
              view: { const: 'animation' },
              sceneReady: { type: 'boolean' },
              invocation: { type: 'string', minLength: 1 },
              webMcpTool: { const: buildWebName(XR_ANIMATION_WEB_MCP_TOOL_IDS.control) },
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
    description: 'Inspect browser-local camera, official LiteRT pose model, accelerator, confidence, latency, bounding-box availability, selected XR humanoid, existing scene/animation target owners, privacy, and native /motion.control @canvas #pose grammar without exposing frames or pose geometry.',
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
            boundingBoxEnabled: { type: 'boolean' },
            boundingBoxAvailable: { type: 'boolean' },
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
    description: 'Open, start, or stop browser-local LiteRT human-pose capture in XR Mode; operation=open may also set the default-off preview bounding box through structured fields or the native /motion.control, @canvas, and #pose grammar.',
    inputSchema: MOTION_CONTROL_INPUT_SCHEMA,
    outputSchema: { type: 'object', additionalProperties: true, required: ['ok', 'message'] },
    annotations: mutationAnnotations,
  }]
}
