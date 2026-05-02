import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testCurrentLayoutResolutionContextHelperIsReusedAcrossHtmlExportAndD3LayoutPrep() {
  const positioningText = readFileSync(resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'positioning.ts'), 'utf8')
  const htmlExportText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'graph', 'htmlCanvasSvgExport.ts'), 'utf8')
  const d3LayoutPrepText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'utils', 'd3SceneLayoutPrepContext.ts'),
    'utf8',
  )

  if (!positioningText.includes('export function readCurrentLayoutResolutionContext')) {
    throw new Error('expected positioning to centralize current layout resolution context derivation upstream')
  }
  if (!positioningText.includes('mode: readLayoutMode(args.schema),')) {
    throw new Error('expected current layout resolution context helper to centralize layout mode derivation')
  }
  if (!positioningText.includes("semanticMode: String(args.semanticMode || 'document'),")) {
    throw new Error('expected current layout resolution context helper to centralize semantic mode derivation')
  }
  if (!positioningText.includes("renderVariant: args.renderMode === '2d'")) {
    throw new Error('expected current layout resolution context helper to centralize render variant derivation')
  }
  if (!htmlExportText.includes('const layoutResolutionContext = readCurrentLayoutResolutionContext({')) {
    throw new Error('expected html canvas svg export to reuse the shared current layout resolution context helper')
  }
  if (!d3LayoutPrepText.includes('const layoutResolutionContext = readCurrentLayoutResolutionContext({')) {
    throw new Error('expected D3 scene layout prep to reuse the shared current layout resolution context helper')
  }
  if (htmlExportText.includes("const semanticModeKey = String(layoutSemanticModeKey || documentSemanticMode || 'document')")) {
    throw new Error('expected html canvas svg export to stop deriving semantic mode inline once the shared current layout resolution context helper exists')
  }
  if (htmlExportText.includes("const renderVariant = String(canvas2dRenderer || 'd3')")) {
    throw new Error('expected html canvas svg export to stop deriving render variant inline once the shared current layout resolution context helper exists')
  }
  if (d3LayoutPrepText.includes('const mode = readLayoutMode(args.schema)')) {
    throw new Error('expected D3 scene layout prep to stop deriving layout mode inline once the shared current layout resolution context helper exists')
  }
  if (d3LayoutPrepText.includes("renderVariant: args.canvasRenderMode === '2d' ? args.canvas2dRenderer : ''")) {
    throw new Error('expected D3 scene layout prep to stop deriving render variant inline once the shared current layout resolution context helper exists')
  }
}
