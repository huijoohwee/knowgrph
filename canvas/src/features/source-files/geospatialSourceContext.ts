import type { GraphData } from '@/lib/graph/types'
import type { SourceFile } from '@/hooks/store/types'
import { buildMarkdownGeodataCandidateProfile } from '@/lib/markdown/markdownGeodataAnalysis'
import { normalizeComposedSourcePath, readComposedSourceFilePath } from './composedSourceSelection'
import { isGeospatialSourceFileEligible } from './geospatialSourceEligibility'

export { isGeospatialSourceFileEligible } from './geospatialSourceEligibility'

export type GeospatialSourceContextResolvedFrom = 'direct' | 'sourceFiles' | 'none'

export type GeospatialSourceContextResolution = {
  bestSourceFile: SourceFile | null
  sourceGraph: GraphData | null
  markdownContext: { markdownText: string; sourceDocumentPath: string } | null
  resolvedFrom: GeospatialSourceContextResolvedFrom
}

const isMarkdownLikeName = (value: string): boolean => /\.(md|markdown|mmd)$/i.test(String(value || '').trim())

type EligibleGeospatialSourceFileProfile = {
  file: SourceFile
  sourcePath: string
  basename: string
}

const basenameLike = (value: string): string => {
  const normalizedPath = normalizeComposedSourcePath(value)
  const parts = normalizedPath.split('/').filter(Boolean)
  return parts.length > 0 ? String(parts[parts.length - 1] || '') : ''
}

const buildEligibleGeospatialSourceFileProfiles = (
  sourceFiles: SourceFile[],
): EligibleGeospatialSourceFileProfile[] => {
  const profiles: EligibleGeospatialSourceFileProfile[] = []
  for (const file of sourceFiles) {
    if (!isGeospatialSourceFileEligible(file)) continue
    const sourcePath = readComposedSourceFilePath(file)
    profiles.push({
      file,
      sourcePath,
      basename: basenameLike(sourcePath),
    })
  }
  return profiles
}

const findUniqueEligibleGeospatialSourceFileByNormalizedPath = (
  profiles: EligibleGeospatialSourceFileProfile[],
  normalizedPath: string,
): SourceFile | null => {
  if (!normalizedPath) return null
  let match: SourceFile | null = null
  for (const profile of profiles) {
    if (profile.sourcePath !== normalizedPath) continue
    if (match) return null
    match = profile.file
  }
  return match
}

const findUniqueEligibleGeospatialSourceFileByBasename = (
  profiles: EligibleGeospatialSourceFileProfile[],
  basename: string,
): SourceFile | null => {
  if (!basename) return null
  let match: SourceFile | null = null
  for (const profile of profiles) {
    if (!profile.sourcePath || !isMarkdownLikeName(profile.sourcePath)) continue
    if (profile.basename !== basename) continue
    if (match) return null
    match = profile.file
  }
  return match
}

export function resolvePreferredGeospatialSourceFile(args: {
  sourceFiles?: SourceFile[] | null
  sourceDocumentPath?: string | null
  graphId?: string | null
}): SourceFile | null {
  const files = Array.isArray(args.sourceFiles) ? args.sourceFiles : []
  const profiles = buildEligibleGeospatialSourceFileProfiles(files)
  const directPathNormalized = normalizeComposedSourcePath(String(args.sourceDocumentPath || ''))
  const graphIdHint = normalizeComposedSourcePath(String(args.graphId || ''))

  const exactDirectPathMatch = findUniqueEligibleGeospatialSourceFileByNormalizedPath(profiles, directPathNormalized)
  if (exactDirectPathMatch) return exactDirectPathMatch

  const exactGraphIdMatch = findUniqueEligibleGeospatialSourceFileByNormalizedPath(profiles, graphIdHint)
  if (exactGraphIdMatch) return exactGraphIdMatch

  const directBasenameMatch = findUniqueEligibleGeospatialSourceFileByBasename(profiles, basenameLike(directPathNormalized))
  if (directBasenameMatch) return directBasenameMatch

  const graphIdBasenameMatch = findUniqueEligibleGeospatialSourceFileByBasename(profiles, basenameLike(graphIdHint))
  if (graphIdBasenameMatch) return graphIdBasenameMatch

  const eligibleMarkdownFiles = profiles.flatMap(profile => {
    const sourcePath = profile.sourcePath
    const text = String(profile.file?.text || '')
    const candidateProfile = buildMarkdownGeodataCandidateProfile(text)
    return !!sourcePath
      && isMarkdownLikeName(sourcePath)
      && (candidateProfile.mayContainEmbeddedGeoJson || candidateProfile.mayContainPoiTables)
      ? [profile.file]
      : []
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
