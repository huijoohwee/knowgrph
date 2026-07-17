export const XR_SCENE_MCP_SCHEMA = 'knowgrph-xr-scene-mcp/v1'

export const XR_SCENE_WEB_MCP_TOOL_IDS = Object.freeze({
  inspect: 'inspect_local_xr_scene_assets',
  control: 'control_local_xr_scene',
})

export const XR_SCENE_INVOCATION_COMMANDS = Object.freeze({
  stage: '/xr.stage',
  place: '/xr.place',
  label: '/xr.label',
  remove: '/xr.remove',
})

const cleanTarget = value => String(value || '').trim().replace(/^@+/, '')
const cleanTransition = value => String(value || '').trim() === 'hold' ? 'hold' : 'linear'

export const buildXrStageInvocation = stageId => (
  `${XR_SCENE_INVOCATION_COMMANDS.stage} @${cleanTarget(stageId)}`
)

export const buildXrPlaceInvocation = (assetId, transition = 'linear') => {
  const target = `@${cleanTarget(assetId)}`
  return `${XR_SCENE_INVOCATION_COMMANDS.place} ${target} transition=${cleanTransition(transition)}`
}
