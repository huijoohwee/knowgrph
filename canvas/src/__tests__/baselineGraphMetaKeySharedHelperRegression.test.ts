import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testBaselineGraphMetaKeyHelperIsReusedAcrossLayoutPrepAndHtmlExport() {
  const graphMetaKeyText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'graph', 'graphMetaKey.ts'), 'utf8')
  const htmlExportText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'graph', 'htmlCanvasSvgExport.ts'), 'utf8')
  const d3LayoutPrepText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'utils', 'd3SceneLayoutPrepContext.ts'),
    'utf8',
  )

  if (!graphMetaKeyText.includes("import { toMetadataRecord } from '@/lib/graph/documentMetadata'")) {
    throw new Error('expected graphMetaKey to reuse the shared document metadata coercion helper upstream')
  }
  if (!graphMetaKeyText.includes('const rec = toMetadataRecord(graph?.metadata)')) {
    throw new Error('expected graph meta key readers to reuse the shared document metadata coercion helper')
  }
  if (!graphMetaKeyText.includes('export function readBaselineGraphMetaKey')) {
    throw new Error('expected graphMetaKey to centralize baseline graph meta key fallback derivation upstream')
  }
  if (!htmlExportText.includes('fallbackGraphMetaKey: graphMetaKey')) {
    throw new Error('expected html canvas svg export to thread the shared baseline graph meta key through layout runtime context')
  }
  if (!d3LayoutPrepText.includes('fallbackGraphMetaKey: args.graphMetaKey')) {
    throw new Error('expected D3 scene layout prep to thread the shared baseline graph meta key through layout runtime context')
  }
}
