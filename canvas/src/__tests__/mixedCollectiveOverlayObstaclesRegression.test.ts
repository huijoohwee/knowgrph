import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorWidgetCollisionTreatsRichMediaOverlaysAsCurrentSurfaceObstacles() {
  const collisionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const text = readFileSync(collisionPath, 'utf8')
  if (!text.includes('RICH_MEDIA_OVERLAY_ROOT_SELECTOR')) {
    throw new Error('expected Flow Editor widget collective collision to inspect Rich Media overlay roots on the active surface')
  }
  if (!text.includes('queryActiveSurfaceOverlays(RICH_MEDIA_OVERLAY_ROOT_SELECTOR)')) {
    throw new Error('expected Flow Editor widget collective collision to query Rich Media overlay roots through the active-surface selector')
  }
  if (!text.includes("id: `rich-media:${id}`")) {
    throw new Error('expected Flow Editor widget collective collision to add current-surface Rich Media overlays into pinned obstacle resolution')
  }
}

export function testFlowEditorRichMediaCollectiveTreatsWidgetOverlaysAsCurrentSurfaceObstacles() {
  const overlaysPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const loopPath = resolve(process.cwd(), 'src', 'lib', 'render', 'mediaOverlayLayoutLoop2d.ts')
  const overlaysText = readFileSync(overlaysPath, 'utf8')
  const loopText = readFileSync(loopPath, 'utf8')
  if (!overlaysText.includes('getCollisionObstacles: () => {')) {
    throw new Error('expected Flow Editor Rich Media collective layout to provide widget overlay obstacles')
  }
  if (!overlaysText.includes('queryActiveFlowEditorOverlays()')) {
    throw new Error('expected Flow Editor Rich Media collective layout to query widget overlay roots through the active-surface selector')
  }
  if (!overlaysText.includes('FLOW_EDITOR_OVERLAY_SURFACE_ROOT_ATTR')) {
    throw new Error('expected Flow Editor Rich Media collective obstacles to be bounded by the active surface root')
  }
  if (!loopText.includes('getCollisionObstacles?: () => Array<{ id: string; left: number; top: number; width: number; height: number }>')) {
    throw new Error('expected media overlay layout loop SSOT to support external mixed-collective collision obstacles')
  }
  if (!loopText.includes('obstacles: externalObstacles')) {
    throw new Error('expected media overlay layout loop SSOT to pass mixed-collective obstacles into collision relaxation')
  }
}
