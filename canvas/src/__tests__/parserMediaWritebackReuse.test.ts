import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testParserMediaWritebackReusesSharedMediaPropertyHelper() {
  const builderPath = resolve(process.cwd(), 'src', 'features', 'parsers', 'markdownJsonLdBuilder.ts')
  const utilsPath = resolve(process.cwd(), 'src', 'features', 'parsers', 'markdownJsonLdUtils.ts')
  const parserPath = resolve(process.cwd(), 'src', 'lib', 'parsers', 'markdownJsonLd.impl.ts')
  const webpagePath = resolve(process.cwd(), 'src', 'lib', 'websites', 'webpageLayoutToGraph.ts')
  const mermaidPath = resolve(process.cwd(), 'src', 'lib', 'mermaid', 'mermaidFrontmatterGeometry.ts')

  const builderText = readFileSync(builderPath, 'utf8')
  const utilsText = readFileSync(utilsPath, 'utf8')
  const parserText = readFileSync(parserPath, 'utf8')
  const webpageText = readFileSync(webpagePath, 'utf8')
  const mermaidText = readFileSync(mermaidPath, 'utf8')

  if (!builderText.includes("import { buildNodeMediaProperties } from '@/lib/canvas/graph-elements/mediaProperties'")) {
    throw new Error('expected markdownJsonLdBuilder to import shared buildNodeMediaProperties helper')
  }
  if (!builderText.includes('buildNodeMediaProperties({ kind: \'iframe\'')) {
    throw new Error('expected markdownJsonLdBuilder link/media ingestion to reuse shared media property helper')
  }
  if (!utilsText.includes("import { buildNodeMediaProperties } from '@/lib/canvas/graph-elements/mediaProperties'")) {
    throw new Error('expected markdownJsonLdUtils to import shared buildNodeMediaProperties helper')
  }
  if (!utilsText.includes('buildNodeMediaProperties({')) {
    throw new Error('expected markdownJsonLdUtils media classification to reuse shared media property helper')
  }
  if (!parserText.includes("import { buildNodeMediaProperties } from '@/lib/canvas/graph-elements/mediaProperties'")) {
    throw new Error('expected markdownJsonLd parser to import shared buildNodeMediaProperties helper')
  }
  if (!parserText.includes('buildNodeMediaProperties({ kind: \'image\'')) {
    throw new Error('expected markdownJsonLd parser POI image writeback to reuse shared media property helper')
  }
  if (!webpageText.includes("import { buildNodeMediaProperties } from '@/lib/canvas/graph-elements/mediaProperties'")) {
    throw new Error('expected webpageLayoutToGraph to import shared buildNodeMediaProperties helper')
  }
  if (!webpageText.includes('applyNodeMediaProperties({ properties, kind: tag === \'VIDEO\' ? \'video\' : \'audio\'')) {
    throw new Error('expected webpageLayoutToGraph to reuse shared media property helper for DOM media nodes')
  }
  if (!mermaidText.includes("import { patchNodeMediaProperties } from '@/lib/canvas/graph-elements/mediaSpec'")) {
    throw new Error('expected mermaidFrontmatterGeometry to import shared patchNodeMediaProperties helper')
  }
  if (!mermaidText.includes('const nextMediaProps = patchNodeMediaProperties({')) {
    throw new Error('expected mermaidFrontmatterGeometry image writeback to reuse shared patchNodeMediaProperties helper')
  }
}
