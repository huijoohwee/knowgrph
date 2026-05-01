import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowFitRuntimePathsReuseSharedHelpers() {
  const fitRuntimeText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'fitRuntime.ts'),
    'utf8',
  )
  const layoutStateText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasLayoutState.ts'),
    'utf8',
  )
  const runtimeText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasRuntime.ts'),
    'utf8',
  )

  if (!fitRuntimeText.includes('export function buildFlowFitOptions') || !fitRuntimeText.includes('export function readFlowEditorPortExtraPadScreenPx')) {
    throw new Error('expected FlowCanvas fit runtime helpers to centralize shared fit option and port padding logic')
  }
  if (!layoutStateText.includes('buildFlowFitOptions({') || !layoutStateText.includes('readFlowEditorPortExtraPadScreenPx(')) {
    throw new Error('expected FlowCanvas layout state to reuse shared Flow fit runtime helpers instead of duplicating fit prep logic')
  }
  if (!runtimeText.includes('buildFlowFitOptions({') || !runtimeText.includes('readFlowEditorPortExtraPadScreenPx(')) {
    throw new Error('expected FlowCanvas runtime to reuse shared Flow fit runtime helpers instead of duplicating fit prep logic')
  }
}
