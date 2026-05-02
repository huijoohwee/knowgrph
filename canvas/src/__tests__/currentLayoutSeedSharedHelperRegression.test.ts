import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testCurrentLayoutSeedHelperIsReusedAcrossHtmlExportAndD3LayoutPrep() {
  const positioningText = readFileSync(resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'positioning.ts'), 'utf8')
  const htmlExportText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'graph', 'htmlCanvasSvgExport.ts'), 'utf8')
  const d3LayoutPrepText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'utils', 'd3SceneLayoutPrepContext.ts'),
    'utf8',
  )

  if (!positioningText.includes('export function readCurrentLayoutSeedContext')) {
    throw new Error('expected positioning to centralize current layout seed derivation upstream')
  }
  if (!htmlExportText.includes('const currentLayoutSeed = readCurrentLayoutSeedContext({')) {
    throw new Error('expected html canvas svg export to reuse the shared current layout seed helper')
  }
  if (!d3LayoutPrepText.includes('const currentLayoutSeed = readCurrentLayoutSeedContext({')) {
    throw new Error('expected D3 scene layout prep to reuse the shared current layout seed helper')
  }
  if (!htmlExportText.includes('const pickedLayoutSeed = determineLayoutPositions({\n    ...currentLayoutSeed,')) {
    throw new Error('expected html canvas svg export to spread the shared current layout seed into determineLayoutPositions')
  }
  if (!d3LayoutPrepText.includes('const { layoutPositionsForMode, skipInitialLayout, cacheKey } = determineLayoutPositions({\n    ...currentLayoutSeed,')) {
    throw new Error('expected D3 scene layout prep to spread the shared current layout seed into determineLayoutPositions')
  }
  if (htmlExportText.includes('frontmatterMode: frontmatterModeEnabled,')) {
    throw new Error('expected html canvas svg export to stop restating current layout seed frontmatter mode inline once the shared helper exists')
  }
  if (d3LayoutPrepText.includes('frontmatterMode: !!args.effectiveFrontmatterModeEnabled,')) {
    throw new Error('expected D3 scene layout prep to stop restating current layout seed frontmatter mode inline once the shared helper exists')
  }
}
