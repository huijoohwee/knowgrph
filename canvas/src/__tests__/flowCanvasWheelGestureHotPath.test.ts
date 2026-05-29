import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sliceBetween = (text: string, startNeedle: string, endNeedle: string): string => {
  const start = text.indexOf(startNeedle)
  const end = text.indexOf(endNeedle, Math.max(0, start))
  if (start < 0 || end <= start) return ''
  return text.slice(start, end)
}

export function testFlowCanvasWheelGestureUsesSubscribedInteractionSnapshot() {
  const bindText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'bindFlowCanvasNativeInteractions.ts'), 'utf8')
  const wheelText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'wheelAndGesture.ts'), 'utf8')
  const contextText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'context.ts'), 'utf8')

  const requiredSnippets = [
    'readFlowViewportInteractionSnapshot',
    'const unsubscribeViewportInteractionSnapshot = useGraphStore.subscribe(',
    'readViewportInteractionSnapshot: () => FlowViewportInteractionSnapshot',
    'readViewportInteractionSnapshot,',
    'const storeState = ctx.readViewportInteractionSnapshot()',
    'getSchema: () => ctx.readViewportInteractionSnapshot().schema',
    'disableAutoZoomModes: () => disableAutoZoomModesForUserGesture(ctx.readViewportInteractionSnapshot())',
  ]
  const combined = `${bindText}\n${wheelText}\n${contextText}`
  for (const snippet of requiredSnippets) {
    if (!combined.includes(snippet)) throw new Error(`expected FlowCanvas wheel/gesture snapshot snippet: ${snippet}`)
  }

  if (wheelText.includes('useGraphStore')) {
    throw new Error('expected wheel and gesture handlers to use the subscribed interaction snapshot instead of reading the graph store')
  }

  const controllerBinding = sliceBetween(bindText, 'const viewportWheelController = createInfiniteCanvasViewportController({', '  try {')
  if (!controllerBinding) throw new Error('expected FlowCanvas native interaction binding to create a viewport wheel controller')
  if (controllerBinding.includes('useGraphStore.getState()')) {
    throw new Error('expected viewport controller callbacks to read the subscribed interaction snapshot instead of graph-store state')
  }
}

export function testInfiniteCanvasPointerMoveReusesDragSessionTuning() {
  const controllerText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'canvas', 'infinite-canvas-engine', 'controller.ts'), 'utf8')

  const requiredSnippets = [
    'interactionSpeed: number',
    'scaleExtent: { minK: number; maxK: number }',
    'zoomExponentMultiplier: number',
    'interactionSpeed,',
    'scaleExtent,',
    'zoomExponentMultiplier,',
    'const dx = rawDx * drag.interactionSpeed',
    'const dy = rawDy * drag.interactionSpeed',
    'scaleExtent: drag.scaleExtent',
    'zoomExponentMultiplier: drag.zoomExponentMultiplier',
  ]
  for (const snippet of requiredSnippets) {
    if (!controllerText.includes(snippet)) throw new Error(`expected infinite-canvas drag-session tuning snippet: ${snippet}`)
  }

  const pointerMoveText = sliceBetween(controllerText, "const handlePointerMove: InfiniteCanvasViewportController['handlePointerMove']", '  const endPointer')
  if (!pointerMoveText) throw new Error('expected infinite-canvas controller to expose a pointermove handler')
  const forbidden = [
    'args.getCanvasPanSpeedMultiplier()',
    'args.getCanvasInteractionSpeedMultiplier()',
    'args.getFlowWheelZoomSpeedMultiplier()',
    'args.getFlowWheelZoomIncrementMultiplier()',
    'readZoomSpeed(',
    'readScaleExtent(',
  ]
  for (const snippet of forbidden) {
    if (pointerMoveText.includes(snippet)) {
      throw new Error(`expected infinite-canvas pointermove to reuse pointerdown session tuning instead of ${snippet}`)
    }
  }
}
