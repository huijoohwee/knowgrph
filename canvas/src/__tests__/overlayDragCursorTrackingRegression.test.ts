import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const mustInclude = (text: string, needle: string, msg: string) => {
  if (!text.includes(needle)) throw new Error(msg)
}

export function testOverlayHeaderDragDisablesGridSnapDuringMove() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useOverlayInteractions2d.ts')
  const text = readFileSync(p, 'utf8')
  mustInclude(text, 'snapToGrid: false', 'expected overlay header drag to disable snapToGrid during move for cursor tracking')
}

export function testOverlayHeaderDragKeepsNodeXySyncedDuringDrag() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useOverlayInteractions2d.ts')
  const text = readFileSync(p, 'utf8')
  mustInclude(text, 'node.x = p.x', 'expected overlay header drag to update node.x during drag so edges stay connected')
  mustInclude(text, 'node.y = p.y', 'expected overlay header drag to update node.y during drag so edges stay connected')
}

export function testOverlayInteractions2dUsesRafValueSchedulerForDragMoves() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useOverlayInteractions2d.ts')
  const text = readFileSync(p, 'utf8')
  mustInclude(text, 'createRafValueScheduler', 'expected overlay interactions to coalesce drag moves via createRafValueScheduler')
  mustInclude(text, '.flush()', 'expected overlay interactions to flush latest drag state on end')
}

export function testOverlayHeaderDragForcesTickRedrawDuringDrag() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useOverlayInteractions2d.ts')
  const text = readFileSync(p, 'utf8')
  mustInclude(text, "sim?.on('tick')", 'expected overlay header drag to invoke tick handler for immediate redraw')
}

export function testFlowCanvasOverlayHeaderDragDisablesGridSnapDuringMove() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  mustInclude(text, 'snapToGrid: false', 'expected FlowCanvas overlay header drag to disable snapToGrid during move for cursor tracking')
}

export function testDesignCanvasOverlayHeaderDragDisablesGridSnapDuringMove() {
  const p = resolve(process.cwd(), 'src', 'components', 'DesignCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  mustInclude(text, 'snapToGrid: false', 'expected DesignCanvas overlay header drag to disable snapToGrid during move for cursor tracking')
}

export function testOverlayPanIgnoresSpeedMultipliersForCursorTracking() {
  const p1 = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useOverlayInteractions2d.ts')
  const p2 = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const p3 = resolve(process.cwd(), 'src', 'components', 'DesignCanvas.tsx')
  const t1 = readFileSync(p1, 'utf8')
  const t2 = readFileSync(p2, 'utf8')
  const t3 = readFileSync(p3, 'utf8')
  mustInclude(t1, 'applySpeedMultipliers: false', 'expected D3 overlay pan to ignore speed multipliers for cursor tracking')
  mustInclude(t2, 'applySpeedMultipliers: false', 'expected FlowCanvas overlay pan to ignore speed multipliers for cursor tracking')
  mustInclude(t3, 'applySpeedMultipliers: false', 'expected DesignCanvas overlay pan to ignore speed multipliers for cursor tracking')
}

export function testGraphCanvasRootOverlayScheduleIncludesMarkdownOverlays() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'GraphCanvasRootImpl.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('requestOverlayScheduleRef={markdownOverlayScheduleRef}')) {
    throw new Error('expected GraphCanvasRoot to pass requestOverlayScheduleRef to MarkdownDesignOverlay')
  }
  if (!text.includes('markdownOverlayScheduleRef.current?.()')) {
    throw new Error('expected GraphCanvasRoot overlay schedule to call markdownOverlayScheduleRef')
  }
}

export function testPanelNodeEdgeEndpointsUsePixelConstantPadOut() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'sceneHandlers.simulationTick2d.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('padOut / zoomK')) {
    throw new Error('expected panel-node edge endpoints to scale padOut by zoomK for consistent pixel gap')
  }
}
