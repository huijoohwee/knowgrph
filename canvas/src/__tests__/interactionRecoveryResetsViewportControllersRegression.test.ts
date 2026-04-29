import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testInteractionRecoveryResetsViewportControllers() {
  const p = resolve(process.cwd(), 'src', 'lib', 'canvas', 'interaction-recovery.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('__kgViewportControllerDestroy')) {
    throw new Error('expected interaction recovery to reset viewport controllers via __kgViewportControllerDestroy')
  }
  if (!text.includes('data-kg-canvas-interactive')) {
    throw new Error('expected interaction recovery to scan canvas interactive roots')
  }
  if (!text.includes('normalizeInlineDragStylesIfStuck')) {
    throw new Error('expected interaction recovery to normalize stuck drag styles')
  }
  if (!text.includes("runGlobalInteractionCleanup({ resetViewportControllers: true })")) {
    throw new Error('expected pointer-end interaction recovery to flush viewport controller state')
  }
}

export function testFlowCanvasRegistersViewportControllerDestroy() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'bindFlowCanvasNativeInteractions.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('__kgViewportControllerDestroy')) {
    throw new Error('expected FlowCanvas to expose viewport controller destroy on canvas element')
  }
}
