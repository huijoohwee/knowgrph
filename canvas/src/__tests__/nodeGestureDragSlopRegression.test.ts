import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readUtf8 = (filePath: string): string => readFileSync(filePath, 'utf8')

export function testNodeDragBehaviorKeepsTouchIntentThresholdsCentralized() {
  const dragText = readUtf8(resolve(process.cwd(), 'src/components/GraphCanvas/drag.ts'))
  const helperText = readUtf8(resolve(process.cwd(), 'src/lib/canvas/dragIntent.ts'))
  if (!helperText.includes('export const CANVAS_TOUCH_DRAG_SLOP_PX = 8')) {
    throw new Error('expected canvas drag intent helper to keep a shared touch drag slop threshold')
  }
  if (!helperText.includes('export const CANVAS_PEN_DRAG_SLOP_PX = 4')) {
    throw new Error('expected canvas drag intent helper to keep a shared pen drag slop threshold')
  }
  if (!dragText.includes("import { readCanvasDragIntentThresholdPx } from '@/lib/canvas/dragIntent'")) {
    throw new Error('expected node drag behavior to reuse the shared canvas drag intent helper')
  }
  if (!dragText.includes('const activateDrag =')) {
    throw new Error('expected node drag behavior to defer layout churn until drag intent is confirmed')
  }
  if (!dragText.includes('if (!(distancePx >= dragThresholdPx)) return')) {
    throw new Error('expected node drag behavior to block tiny pointer drift before moving nodes')
  }
}

export function testNodeClickSelectionRespectsPreventedDragClicks() {
  const nodesText = readUtf8(resolve(process.cwd(), 'src/components/GraphCanvas/layers/nodes.ts'))
  if (!nodesText.includes("if ((event as unknown as { defaultPrevented?: unknown }).defaultPrevented) return")) {
    throw new Error('expected node click selection to ignore prevented click events after drag gestures')
  }
}
