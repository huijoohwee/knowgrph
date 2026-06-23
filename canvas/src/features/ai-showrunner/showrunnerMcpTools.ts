export const SHOWRUNNER_MCP_TOOL_NAMES = Object.freeze({
  startRun: 'knowgrph.showrunner.start_run',
  runStatus: 'knowgrph.showrunner.run_status',
  postChoice: 'knowgrph.showrunner.post_choice',
  submitCritique: 'knowgrph.showrunner.submit_critique',
  approveStage: 'knowgrph.showrunner.approve_stage',
  getArtifact: 'knowgrph.showrunner.get_artifact',
} as const)

export const SHOWRUNNER_MCP_START_RUN_INPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: {
    brief_path: { type: 'string' },
    brief_markdown: { type: 'string' },
    dry_run: { type: 'boolean', default: true },
  },
})

export const SHOWRUNNER_MCP_RUN_ID_INPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['run_id'],
  properties: {
    run_id: { type: 'string' },
  },
})

export const SHOWRUNNER_MCP_TOOL_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: true,
  required: ['ok'],
  properties: {
    ok: { type: 'boolean' },
    run_id: { type: 'string' },
    run_status: { type: 'string' },
    error: { type: 'object', additionalProperties: true },
  },
})
