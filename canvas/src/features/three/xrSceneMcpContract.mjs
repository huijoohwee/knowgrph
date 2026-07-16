export const XR_SCENE_MCP_SCHEMA = 'knowgrph-xr-scene-mcp/v1'

export const XR_SCENE_WEB_MCP_TOOL_IDS = Object.freeze({
  inspect: 'inspect_local_xr_scene_assets',
  control: 'control_local_xr_scene',
})

export const XR_SCENE_INVOCATION_COMMANDS = Object.freeze({
  stage: '/xr.stage',
  place: '/xr.place',
  animate: '/xr.animate',
  label: '/xr.label',
  remove: '/xr.remove',
})

export const XR_SCENE_MOTION_TOKENS = Object.freeze({
  travel: '#travel',
  hold: '#hold',
})

const cleanTarget = value => String(value || '').trim().replace(/^@+/, '')
const cleanMotion = value => String(value || '').trim().replace(/^#+/, '') === 'hold' ? 'hold' : 'travel'

export const buildXrStageInvocation = stageId => (
  `${XR_SCENE_INVOCATION_COMMANDS.stage} @${cleanTarget(stageId)}`
)

export const buildXrPlaceInvocation = (assetId, motion = 'travel') => {
  const target = `@${cleanTarget(assetId)}`
  const motionToken = XR_SCENE_MOTION_TOKENS[cleanMotion(motion)]
  return `${XR_SCENE_INVOCATION_COMMANDS.place} ${target} ${motionToken}`
}

export const buildXrAnimateInvocation = (subjectId, motion = 'travel') => {
  const target = `@${cleanTarget(subjectId)}`
  const motionToken = XR_SCENE_MOTION_TOKENS[cleanMotion(motion)]
  return `${XR_SCENE_INVOCATION_COMMANDS.animate} ${target} ${motionToken}`
}
