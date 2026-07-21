import { GAME_MODE_WEB_MCP_TOOL_IDS } from '../game-fps/gameModeMcpContract.mjs'

export const GAME_MODE_AGENT_READY_TOOL_IDS = Object.freeze({
  inspectLocalGameMode: GAME_MODE_WEB_MCP_TOOL_IDS.inspect,
  controlLocalGameMode: GAME_MODE_WEB_MCP_TOOL_IDS.control,
})

const GAME_MODE_OPERATIONS = Object.freeze([
  'open', 'start', 'stop', 'restart', 'fire', 'reload', 'save', 'exit',
])

const GAME_MODE_INPUT_SCHEMA = Object.freeze({
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: ['invocation'],
      properties: {
        invocation: {
          type: 'string',
          minLength: 1,
          pattern: '\\S',
          description: 'Native invocation such as /game.mode @canvas #gameplay operation=start.',
        },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['operation'],
      properties: { operation: { type: 'string', enum: GAME_MODE_OPERATIONS } },
    },
  ],
})

export function buildGameModeAgentReadyToolContracts({ buildWebName, readOnlyAnnotations, mutationAnnotations }) {
  return [{
    name: GAME_MODE_AGENT_READY_TOOL_IDS.inspectLocalGameMode,
    webName: buildWebName(GAME_MODE_AGENT_READY_TOOL_IDS.inspectLocalGameMode),
    title: 'Inspect Local Game Mode',
    description: 'Inspect the one browser-local Game Mode activation owner, deterministic native Agentic ECS mission, four scored NPC actions, normalized slab AABB hitscan, shared renderer and input ownership, HUD/runtime errors, Decision persistence, and native /game.mode @canvas #gameplay grammar.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    outputSchema: {
      type: 'object',
      additionalProperties: true,
      required: ['schema', 'webMcpTools', 'invocationGrammar', 'gameMode', 'mission', 'decisions', 'runtime'],
    },
    annotations: readOnlyAnnotations,
  }, {
    name: GAME_MODE_AGENT_READY_TOOL_IDS.controlLocalGameMode,
    webName: buildWebName(GAME_MODE_AGENT_READY_TOOL_IDS.controlLocalGameMode),
    title: 'Control Local Game Mode',
    description: 'Open, start, stop, restart, fire, reload, save terminal Decisions, or exit the browser-local deterministic Game Mode through structured fields or /game.mode @canvas #gameplay without creating another Canvas, ECS world, or persistence owner.',
    inputSchema: GAME_MODE_INPUT_SCHEMA,
    outputSchema: { type: 'object', additionalProperties: true, required: ['ok', 'message'] },
    annotations: mutationAnnotations,
  }]
}
