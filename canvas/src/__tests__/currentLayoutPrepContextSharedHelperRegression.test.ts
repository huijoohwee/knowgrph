import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testCurrentLayoutPrepContextHelperIsReusedAcrossHtmlExportAndD3LayoutPrep() {
  const positioningText = readFileSync(resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'positioning.ts'), 'utf8')
  const htmlExportText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'graph', 'htmlCanvasSvgExport.ts'), 'utf8')
  const d3LayoutPrepText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'utils', 'd3SceneLayoutPrepContext.ts'),
    'utf8',
  )

  if (!positioningText.includes('export function readCurrentLayoutPrepContext')) {
    throw new Error('expected positioning to centralize current layout prep context derivation upstream')
  }
  if (!positioningText.includes('const datasetKey = computeLayoutDatasetKey({')) {
    throw new Error('expected current layout prep context helper to centralize dataset key derivation')
  }
  if (!positioningText.includes('const layoutViewKey = buildLayoutViewKey({')) {
    throw new Error('expected current layout prep context helper to centralize layout view key derivation')
  }
  if (!htmlExportText.includes('const currentLayoutPrep = readCurrentLayoutPrepContext({')) {
    throw new Error('expected html canvas svg export to reuse the shared current layout prep context helper')
  }
  if (!d3LayoutPrepText.includes('const currentLayoutPrep = readCurrentLayoutPrepContext({')) {
    throw new Error('expected D3 scene layout prep to reuse the shared current layout prep context helper')
  }
  if (htmlExportText.includes('const datasetKey = computeLayoutDatasetKey({')) {
    throw new Error('expected html canvas svg export to stop deriving dataset key inline once the shared current layout prep context helper exists')
  }
  if (htmlExportText.includes('const layoutViewKey = buildLayoutViewKey({')) {
    throw new Error('expected html canvas svg export to stop deriving layout view key inline once the shared current layout prep context helper exists')
  }
  if (d3LayoutPrepText.includes('const datasetKey = computeLayoutDatasetKey({')) {
    throw new Error('expected D3 scene layout prep to stop deriving dataset key inline once the shared current layout prep context helper exists')
  }
  if (d3LayoutPrepText.includes('const layoutViewKey = buildLayoutViewKey({')) {
    throw new Error('expected D3 scene layout prep to stop deriving layout view key inline once the shared current layout prep context helper exists')
  }
}
