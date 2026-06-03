import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasDragSessionSettingsStayOutOfPointerMoveHotPath() {
  const pointerDownText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'pointerDown.ts'), 'utf8')
  const pointerMoveText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'pointerMove.ts'), 'utf8')
  const listenersText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'listeners.ts'), 'utf8')
  const typesText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'types.ts'), 'utf8')

  const requiredSnippets = [
    'const panInteractionSpeed = readFlowPanInteractionSpeed(storeStateAtDown)',
    'const dragSnapGrid = readSnapGridConfigFromSchema(storeStateAtDown.schema)',
    'interactionSpeed: panInteractionSpeed',
    'interactionSpeed: pending.interactionSpeed',
    'const dx = (sx - drag.startSx) * drag.interactionSpeed',
    'const grid = drag.snapGrid',
    'snapDeltaToGridByAnchor({ anchorStart, rawDelta: { dx, dy }, gridSize: grid })',
    "snapScalarToGrid(nextX0, grid, 'x')",
    "snapScalarToGrid(nextY0, grid, 'y')",
    'snapGrid: SnapGridConfig',
    '...readFlowPinchZoomSessionSettings(storeStateAtDown, startTransform)',
    'scaleExtent: drag.scaleExtent',
    'zoomExponentMultiplier: drag.zoomExponentMultiplier',
    'const edgeScrollEnabled = storeStateAtDown.viewPinned !== true',
    'enabled: local.inBounds === true && drag.edgeScrollEnabled',
  ]
  const combined = `${pointerDownText}\n${pointerMoveText}\n${listenersText}\n${typesText}`
  for (const snippet of requiredSnippets) {
    if (!combined.includes(snippet)) throw new Error(`expected FlowCanvas drag-session hot-path snippet: ${snippet}`)
  }
  if (pointerMoveText.includes('readSnapGridConfigFromSchema')) {
    throw new Error('expected pointermove drag hot path to reuse pointerdown snap-grid session settings')
  }
  if (pointerMoveText.includes('clampCanvasPanSpeedMultiplier')) {
    throw new Error('expected pointermove pan hot path to reuse pointerdown pan-speed session settings')
  }
  if (pointerMoveText.includes('useGraphStore.getState()') || pointerMoveText.includes('readZoomScaleExtent') || pointerMoveText.includes('readZoomSpeed')) {
    throw new Error('expected pointermove drag/pinch hot path to reuse pointerdown drag-session settings instead of reading store/schema state')
  }
  const windowPointerMoveStart = listenersText.indexOf('const onWindowPointerMoveCapture')
  const windowPointerMoveEnd = listenersText.indexOf('const onWindowPointerUpCapture')
  const windowPointerMoveText = windowPointerMoveStart >= 0 && windowPointerMoveEnd > windowPointerMoveStart
    ? listenersText.slice(windowPointerMoveStart, windowPointerMoveEnd)
    : ''
  if (!windowPointerMoveText) {
    throw new Error('expected FlowCanvas listeners to expose the window pointermove proxy owner')
  }
  if (windowPointerMoveText.includes('useGraphStore.getState()') || windowPointerMoveText.includes('readFlowPanInteractionSpeed(')) {
    throw new Error('expected overlay proxy pan hot path to reuse pointerdown pan-speed session settings')
  }
}
