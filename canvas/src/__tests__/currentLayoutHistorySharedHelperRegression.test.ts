import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testCurrentLayoutHistoryHelperIsReusedAcrossHtmlExportAndD3LayoutPrep() {
  const positioningText = readFileSync(resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'positioning.ts'), 'utf8')
  const htmlExportText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'graph', 'htmlCanvasSvgExport.ts'), 'utf8')
  const d3LayoutPrepText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'utils', 'd3SceneLayoutPrepContext.ts'),
    'utf8',
  )

  if (!positioningText.includes('export function readCurrentLayoutHistoryContext')) {
    throw new Error('expected positioning to centralize determineLayoutPositions history derivation upstream')
  }
  if (!htmlExportText.includes('const currentLayoutHistory = readCurrentLayoutHistoryContext({')) {
    throw new Error('expected html canvas svg export to reuse the shared current layout history helper')
  }
  if (!d3LayoutPrepText.includes('const currentLayoutHistory = readCurrentLayoutHistoryContext({')) {
    throw new Error('expected D3 scene layout prep to reuse the shared current layout history helper')
  }
  if (!htmlExportText.includes('const pickedLayoutSeed = determineLayoutPositions({\n    ...currentLayoutSeed,\n    layoutVariant,\n    ...currentLayoutHistory,')) {
    throw new Error('expected html canvas svg export to spread the shared current layout history into determineLayoutPositions')
  }
  if (!d3LayoutPrepText.includes('const { layoutPositionsForMode, skipInitialLayout, cacheKey } = determineLayoutPositions({\n    ...currentLayoutSeed,\n    layoutVariant,\n    ...currentLayoutHistory,')) {
    throw new Error('expected D3 scene layout prep to spread the shared current layout history into determineLayoutPositions')
  }
  if (htmlExportText.includes('const pickedLayoutSeed = determineLayoutPositions({\n    ...currentLayoutSeed,\n    layoutVariant,\n    prevViewKey: null,')) {
    throw new Error('expected html canvas svg export to stop restating null determineLayoutPositions history inline once the shared helper exists')
  }
  if (d3LayoutPrepText.includes('const { layoutPositionsForMode, skipInitialLayout, cacheKey } = determineLayoutPositions({\n    ...currentLayoutSeed,\n    layoutVariant,\n    prevViewKey: args.prevLayoutViewKey,')) {
    throw new Error('expected D3 scene layout prep to stop restating previous determineLayoutPositions history inline once the shared helper exists')
  }
}
