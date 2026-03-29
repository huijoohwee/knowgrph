import type { GraphSchema } from '@/lib/graph/schema'

export function parseLayoutMode(raw: unknown): NonNullable<NonNullable<GraphSchema['layout']>['mode']> | null {
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (!text) return null
  const normalized = text.toLowerCase()
  if (normalized.includes('bipartite') || normalized.includes('hub-and-spoke') || normalized.includes('hub_and_spoke')) return 'block'
  if (normalized.includes('radar') || normalized.includes('galaxy') || normalized.includes('planetary') || normalized.includes('orbital')) return 'radial'
  if (normalized === 'block' || normalized === 'bipartite' || normalized === 'hub-and-spoke' || normalized === 'hub_and_spoke') return 'block'
  if (normalized === 'force') return 'radial'
  if (normalized === 'radial' || normalized === 'radial-cluster' || normalized === 'cluster') return 'radial'
  if (normalized === 'stratify') return 'radial'
  if (normalized === 'tree' || normalized === 'tidy-tree' || normalized === 'dendrogram') return 'radial'
  return null
}
