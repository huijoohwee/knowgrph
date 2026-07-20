import { MOTION_CONTROL_WEB_MCP_TOOL_IDS } from '../three/motionControlMcpContract.mjs'

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
        invocation: { type: 'string', minLength: 1, pattern: '\\S', description: 'Native invocation such as /motion.control @canvas #pose operation=start backend=auto.' },
      },
    },
    ...['open', 'stop'].map(operation => ({
      type: 'object',
      additionalProperties: false,
      required: ['operation'],
      properties: { operation: { const: operation } },
    })),
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

export function buildMotionControlAgentReadyToolContracts({ buildWebName, readOnlyAnnotations, mutationAnnotations }) {
  return [{
    name: MOTION_CONTROL_AGENT_READY_TOOL_IDS.inspectLocalMotionControl,
    webName: buildWebName(MOTION_CONTROL_AGENT_READY_TOOL_IDS.inspectLocalMotionControl),
    title: 'Inspect Local Motion Control',
    description: 'Inspect browser-local camera, official LiteRT pose model, accelerator, confidence, latency, XR driver, privacy, and native /motion.control @canvas #pose grammar without exposing frames.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    outputSchema: { type: 'object', additionalProperties: true, required: ['schema', 'webMcpTools', 'invocationGrammar', 'model', 'runtime', 'privacy'] },
    annotations: readOnlyAnnotations,
  }, {
    name: MOTION_CONTROL_AGENT_READY_TOOL_IDS.controlLocalMotionControl,
    webName: buildWebName(MOTION_CONTROL_AGENT_READY_TOOL_IDS.controlLocalMotionControl),
    title: 'Control Local Motion Control',
    description: 'Open, start, or stop browser-local LiteRT human-pose capture for XR Mode through structured fields or the native /motion.control, @canvas, and #pose grammar.',
    inputSchema: MOTION_CONTROL_INPUT_SCHEMA,
    outputSchema: { type: 'object', additionalProperties: true, required: ['ok', 'message'] },
    annotations: mutationAnnotations,
  }]
}
