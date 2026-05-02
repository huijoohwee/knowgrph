import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testD3SceneLayoutPrepContextHelperIsReusedByD3SceneHook() {
  const hookPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3GraphScene2d.ts')
  const helperPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'utils', 'd3SceneLayoutPrepContext.ts')
  const hookText = readFileSync(hookPath, 'utf8')
  const helperText = readFileSync(helperPath, 'utf8')

  if (!helperText.includes('export function buildD3SceneLayoutPrepContext')) {
    throw new Error('expected shared D3 scene layout prep helper to be defined upstream')
  }
  if (!helperText.includes('const zoomViewKey = buildZoomViewKey({')) {
    throw new Error('expected D3 scene layout prep helper to centralize zoom view key derivation')
  }
  if (!helperText.includes('const { layoutPositionsForMode, skipInitialLayout, cacheKey } = determineLayoutPositions({')) {
    throw new Error('expected D3 scene layout prep helper to centralize layout position derivation')
  }
  if (!helperText.includes('const baselineLayoutRuntime = readBaselineDocumentLayoutRuntimeContext({')) {
    throw new Error('expected D3 scene layout prep helper to centralize baseline layout lookup derivation through the shared runtime context helper')
  }
  if (!helperText.includes('const currentLayoutPrep = readCurrentLayoutPrepContext({')) {
    throw new Error('expected D3 scene layout prep helper to centralize current layout prep context derivation through the shared helper')
  }
  if (!helperText.includes('const layoutResolutionContext = readCurrentLayoutResolutionContext({')) {
    throw new Error('expected D3 scene layout prep helper to centralize current layout resolution context derivation through the shared helper')
  }
  if (!helperText.includes('const currentLayoutSeed = readCurrentLayoutSeedContext({')) {
    throw new Error('expected D3 scene layout prep helper to centralize current layout seed derivation through the shared helper')
  }
  if (!helperText.includes('const currentLayoutHistory = readCurrentLayoutHistoryContext({')) {
    throw new Error('expected D3 scene layout prep helper to centralize determineLayoutPositions history derivation through the shared helper')
  }
  if (!hookText.includes('const layoutPrep = buildD3SceneLayoutPrepContext({')) {
    throw new Error('expected useD3GraphScene2d to reuse the shared D3 scene layout prep helper')
  }
  if (!hookText.includes('const {\n        zoomViewKey,\n        layoutViewKey,\n        mode,\n        datasetKey,')) {
    throw new Error('expected useD3GraphScene2d to consume the shared layout prep context bundle instead of rebuilding it inline')
  }
}
