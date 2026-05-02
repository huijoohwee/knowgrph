import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testBaselineGraphMetaKeyHelperIsReusedAcrossLayoutPrepAndHtmlExport() {
  const graphMetaKeyText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'graph', 'graphMetaKey.ts'), 'utf8')
  const htmlExportText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'graph', 'htmlCanvasSvgExport.ts'), 'utf8')
  const d3LayoutPrepText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'utils', 'd3SceneLayoutPrepContext.ts'),
    'utf8',
  )

  if (!graphMetaKeyText.includes('function readGraphMetaRecord(')) {
    throw new Error('expected graphMetaKey to centralize graph metadata coercion upstream')
  }
  if (!graphMetaKeyText.includes('const rec = readGraphMetaRecord(graph)')) {
    throw new Error('expected graph meta key readers to reuse the shared metadata coercion helper')
  }
  if (!graphMetaKeyText.includes('export function readBaselineGraphMetaKey')) {
    throw new Error('expected graphMetaKey to centralize baseline graph meta key fallback derivation upstream')
  }
  if (!htmlExportText.includes('readBaselineGraphMetaKey(graphDataForDisplay, graphMetaKey)')) {
    throw new Error('expected html canvas svg export to reuse the shared baseline graph meta key helper')
  }
  if (!d3LayoutPrepText.includes('readBaselineGraphMetaKey(args.sceneGraphData, args.graphMetaKey)')) {
    throw new Error('expected D3 scene layout prep to reuse the shared baseline graph meta key helper')
  }
}
