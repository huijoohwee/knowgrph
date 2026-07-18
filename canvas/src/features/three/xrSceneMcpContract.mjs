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
  physics: '/xr.physics',
  present: '/xr.present',
})

export const XR_SCENE_INVOCATION_BINDINGS = Object.freeze({
  canvas: '@canvas',
  scene: '@scene',
})

export const XR_SCENE_INVOCATION_SEMANTICS = Object.freeze({
  world: '#world',
  body: '#body',
  impulse: '#impulse',
  controller: '#controller',
  reticle: '#reticle',
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

export const buildXrPhysicsInvocation = (semantic, operation, pairs = {}) => {
  const normalizedSemantic = String(semantic || '').trim().replace(/^#+/, '')
  const normalizedOperation = String(operation || '').trim()
  const pairText = Object.entries(pairs)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
    .map(([key, value]) => {
      const normalizedValue = Array.isArray(value) ? value.join(',') : String(value).trim()
      return `${key}=${key === 'subject' ? encodeURIComponent(normalizedValue) : normalizedValue}`
    })
    .join(' ')
  return [
    XR_SCENE_INVOCATION_COMMANDS.physics,
    XR_SCENE_INVOCATION_BINDINGS.canvas,
    `#${normalizedSemantic}`,
    `operation=${normalizedOperation}`,
    pairText,
  ].filter(Boolean).join(' ')
}

export const buildXrPresentInvocation = () => (
  `${XR_SCENE_INVOCATION_COMMANDS.present} ${XR_SCENE_INVOCATION_BINDINGS.scene} ${XR_SCENE_INVOCATION_SEMANTICS.reticle}`
)
