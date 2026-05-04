import type { GraphData } from '@/lib/graph/types'
import type { SourceFile } from '@/hooks/store/types'
import { normalizeComposedSourcePath, readComposedSourceFilePath } from './composedSourceSelection'

export type GeospatialSourceContextResolvedFrom = 'direct' | 'sourceFiles' | 'none'

export type GeospatialSourceContextResolution = {
  bestSourceFile: SourceFile | null
  sourceGraph: GraphData | null
  markdownContext: { markdownText: string; sourceDocumentPath: string } | null
  resolvedFrom: GeospatialSourceContextResolvedFrom
}

const isMarkdownLikeName = (value: string): boolean => /\.(md|markdown|mmd)$/i.test(String(value || '').trim())

const basenameLike = (value: string): string => {
  const normalizedPath = normalizeComposedSourcePath(value)
  const parts = normalizedPath.split('/').filter(Boolean)
  return parts.length > 0 ? String(parts[parts.length - 1] || '') : ''
}

export const isGeospatialSourceFileEligible = (file: SourceFile | null | undefined): boolean => {
  if (!file || file.enabled !== true) return false
  if (typeof file.geoLayerEnabled === 'boolean' && file.geoLayerEnabled !== true) return false
  return true
}

const findUniqueEligibleGeospatialSourceFileByNormalizedPath = (
  sourceFiles: SourceFile[],
  normalizedPath: string,
): SourceFile | null => {
  if (!normalizedPath) return null
  const matches = sourceFiles.filter(file => {
    if (!isGeospatialSourceFileEligible(file)) return false
    return readComposedSourceFilePath(file) === normalizedPath
  })
  return matches.length === 1 ? matches[0] || null : null
}

const findUniqueEligibleGeospatialSourceFileByBasename = (
  sourceFiles: SourceFile[],
  basename: string,
): SourceFile | null => {
  if (!basename) return null
  const matches = sourceFiles.filter(file => {
    if (!isGeospatialSourceFileEligible(file)) return false
    const sourcePath = readComposedSourceFilePath(file)
    if (!sourcePath || !isMarkdownLikeName(sourcePath)) return false
    return basenameLike(sourcePath) === basename
  })
  return matches.length === 1 ? matches[0] || null : null
}

export function resolvePreferredGeospatialSourceFile(args: {
  sourceFiles?: SourceFile[] | null
  sourceDocumentPath?: string | null
  graphId?: string | null
}): SourceFile | null {
  const files = Array.isArray(args.sourceFiles) ? args.sourceFiles : []
  const directPathNormalized = normalizeComposedSourcePath(String(args.sourceDocumentPath || ''))
  const graphIdHint = normalizeComposedSourcePath(String(args.graphId || ''))

  const exactDirectPathMatch = findUniqueEligibleGeospatialSourceFileByNormalizedPath(files, directPathNormalized)
  if (exactDirectPathMatch) return exactDirectPathMatch

  const exactGraphIdMatch = findUniqueEligibleGeospatialSourceFileByNormalizedPath(files, graphIdHint)
  if (exactGraphIdMatch) return exactGraphIdMatch

  const directBasenameMatch = findUniqueEligibleGeospatialSourceFileByBasename(files, basenameLike(directPathNormalized))
  if (directBasenameMatch) return directBasenameMatch

  const graphIdBasenameMatch = findUniqueEligibleGeospatialSourceFileByBasename(files, basenameLike(graphIdHint))
  if (graphIdBasenameMatch) return graphIdBasenameMatch

  const eligibleMarkdownFiles = files.filter(file => {
    if (!isGeospatialSourceFileEligible(file)) return false
    const sourcePath = readComposedSourceFilePath(file)
    const text = String(file?.text || '')
    return !!sourcePath
      && isMarkdownLikeName(sourcePath)
      && (text.includes('"FeatureCollection"') || text.includes('```geojson') || text.includes('```json'))
  })
  return eligibleMarkdownFiles.length === 1 ? eligibleMarkdownFiles[0] || null : null
}

export function resolveGeospatialSourceContext(args: {
  graphData: GraphData
  markdownText?: string | null
  sourceDocumentPath?: string | null
  sourceFiles?: SourceFile[] | null
}): GeospatialSourceContextResolution {
  const directText = String(args.markdownText || '')
  const directPath = String(args.sourceDocumentPath || '').trim()
  const meta = (args.graphData.metadata || {}) as Record<string, unknown>
  const graphId = String(meta.graphId || '').trim()
  const bestSourceFile = resolvePreferredGeospatialSourceFile({
    sourceFiles: args.sourceFiles,
    sourceDocumentPath: directPath,
    graphId,
  })
  const sourceGraph = bestSourceFile?.parsedGraphData || null

  if (directText.trim() && directPath) {
    return {
      bestSourceFile,
      sourceGraph,
      markdownContext: { markdownText: directText, sourceDocumentPath: directPath },
      resolvedFrom: 'direct',
    }
  }
  if (!bestSourceFile) {
    return {
      bestSourceFile: null,
      sourceGraph: null,
      markdownContext: null,
      resolvedFrom: 'none',
    }
  }

  const fallbackPath = normalizeComposedSourcePath(
    String(bestSourceFile.source?.path || bestSourceFile.name || bestSourceFile.id || directPath || '').trim(),
  )
  const fallbackText = String(bestSourceFile.text || '')
  if (!fallbackPath || !fallbackText.trim()) {
    return {
      bestSourceFile,
      sourceGraph,
      markdownContext: null,
      resolvedFrom: 'none',
    }
  }

  return {
    bestSourceFile,
    sourceGraph,
    markdownContext: { markdownText: fallbackText, sourceDocumentPath: fallbackPath },
    resolvedFrom: 'sourceFiles',
  }
}
