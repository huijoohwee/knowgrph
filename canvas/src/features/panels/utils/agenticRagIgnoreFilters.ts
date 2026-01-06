import {
  buildAgenticRagIgnoreFiltersFromRawPatterns,
  type AgenticRagIgnoreFiltersSummary,
} from '@/lib/graph/jsonld/index'
import type { GraphRagWorkflowJsonLd } from '@/features/panels/utils/graphragConfig'

export const computeInvalidIgnorePrefixes = (ignoreFilters: AgenticRagIgnoreFiltersSummary | null): string[] => {
  const ignorePatterns = ignoreFilters?.rawPatterns ?? []
  const seen = new Set<string>()
  ignorePatterns.forEach((pattern) => {
    const text = pattern.trim()
    const index = text.indexOf(':')
    if (index <= 0) return
    const prefix = text.slice(0, index).trim().toLowerCase()
    if (!prefix) return
    if (prefix === 'dir' || prefix === 'glob' || prefix === 'path') return
    seen.add(prefix)
  })
  return Array.from(seen)
}

export const applyIgnoreCodebasePathsUpdate = (
  current: GraphRagWorkflowJsonLd,
  value: string,
): GraphRagWorkflowJsonLd => {
  const parts = value
    .split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0)
  const filters = buildAgenticRagIgnoreFiltersFromRawPatterns(parts)
  return {
    ...current,
    dataset: {
      ...(current.dataset || {}),
      ignoreCodebasePaths: filters.rawPatterns,
      ignoreCodebasePathsResolved: filters.resolvedPatterns,
    },
  }
}

