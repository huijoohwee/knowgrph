import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testBaselineDocumentLayoutPositionsHelperIsReusedAcrossHtmlExportAndD3LayoutPrep() {
  const positioningText = readFileSync(resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'positioning.ts'), 'utf8')
  const htmlExportText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'graph', 'htmlCanvasSvgExport.ts'), 'utf8')
  const d3LayoutPrepText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'utils', 'd3SceneLayoutPrepContext.ts'),
    'utf8',
  )

  if (positioningText.includes('export function readCurrentBaselineDocumentLayoutPositions')) {
    throw new Error('expected positioning to keep current baseline document layout cache lookup internal once the runtime context helper is the sole public entrypoint')
  }
  if (positioningText.includes('export function readPreviousBaselineDocumentLayoutPositions')) {
    throw new Error('expected positioning to keep previous baseline document layout cache lookup internal once the runtime context helper is the sole public entrypoint')
  }
  if (positioningText.includes('export function readBaselineDocumentLayoutPositions')) {
    throw new Error('expected positioning to keep baseline document layout position derivation internal once the runtime context helper is the sole public entrypoint')
  }
  if (!positioningText.includes('export function readBaselineDocumentLayoutRuntimeContext')) {
    throw new Error('expected positioning to centralize baseline layout runtime context derivation upstream')
  }
  if (positioningText.includes('export function readShouldSkipInitialLayoutFromBaselineDocumentPositions')) {
    throw new Error('expected positioning to keep baseline skip-initial-layout derivation internal once the runtime context helper becomes the sole public entrypoint')
  }
  if (!positioningText.includes('const readCachedPositionMap =')) {
    throw new Error('expected positioning baseline layout helpers to centralize non-empty cache entry reads upstream')
  }
  if (!positioningText.includes('const baselineGraphMetaKey = readBaselineGraphMetaKey(args.graphData, args.fallbackGraphMetaKey)')) {
    throw new Error('expected positioning baseline layout helper to reuse the shared baseline graph meta key helper')
  }
  if (!positioningText.includes("semanticMode: 'document'")) {
    throw new Error('expected positioning baseline layout helper to lock baseline semantic mode to document')
  }
  if (!htmlExportText.includes('readBaselineDocumentLayoutRuntimeContext({')) {
    throw new Error('expected html canvas svg export to reuse the shared baseline layout runtime context helper')
  }
  if (!d3LayoutPrepText.includes('readBaselineDocumentLayoutRuntimeContext({')) {
    throw new Error('expected D3 scene layout prep to reuse the shared baseline layout runtime context helper')
  }
  if (htmlExportText.includes('readBaselineDocumentLayoutPositions({')) {
    throw new Error('expected html canvas svg export to stop reading baseline layout positions separately once the runtime context helper exists')
  }
  if (htmlExportText.includes('readShouldSkipInitialLayoutFromBaselineDocumentPositions({')) {
    throw new Error('expected html canvas svg export to stop deriving baseline skip intent separately once the runtime context helper exists')
  }
  if (d3LayoutPrepText.includes('readBaselineDocumentLayoutPositions({')) {
    throw new Error('expected D3 scene layout prep to stop reading baseline layout positions separately once the runtime context helper exists')
  }
  if (d3LayoutPrepText.includes('readShouldSkipInitialLayoutFromBaselineDocumentPositions({')) {
    throw new Error('expected D3 scene layout prep to stop deriving baseline skip intent separately once the runtime context helper exists')
  }
  if (htmlExportText.includes('readCurrentBaselineDocumentLayoutPositions({')) {
    throw new Error('expected html canvas svg export to stop open-coding current baseline document layout lookup once the combined helper exists')
  }
  if (d3LayoutPrepText.includes('readCurrentBaselineDocumentLayoutPositions({')) {
    throw new Error('expected D3 scene layout prep to stop open-coding current baseline document layout lookup once the combined helper exists')
  }
  if (d3LayoutPrepText.includes('readPreviousBaselineDocumentLayoutPositions({')) {
    throw new Error('expected D3 scene layout prep to stop open-coding previous baseline document layout lookup once the combined helper exists')
  }
  if (d3LayoutPrepText.includes('const baselineFromPrevKey = buildLayoutPositionCacheKey({')) {
    throw new Error('expected D3 scene layout prep to stop rebuilding the previous baseline document layout cache key inline')
  }
  if (d3LayoutPrepText.includes('const lookup = (key: string | null)')) {
    throw new Error('expected D3 scene layout prep to stop reading non-empty cache entries inline')
  }
  if (htmlExportText.includes('const baselineLayoutPositions = (() => {')) {
    throw new Error('expected html canvas svg export to stop owning a local baseline layout derivation block')
  }
  if (d3LayoutPrepText.includes('const baselineLayoutPositions = (() => {')) {
    throw new Error('expected D3 scene layout prep to stop owning a local baseline layout derivation block')
  }
  if (htmlExportText.includes("String(documentSemanticMode || 'document') === 'keyword' && !!baselineLayoutPositions")) {
    throw new Error('expected html canvas svg export to stop restating keyword baseline skip-initial-layout logic inline')
  }
  if (d3LayoutPrepText.includes("String(args.documentSemanticMode || 'document') === 'keyword'")) {
    throw new Error('expected D3 scene layout prep to stop restating keyword baseline skip-initial-layout logic inline')
  }
}
