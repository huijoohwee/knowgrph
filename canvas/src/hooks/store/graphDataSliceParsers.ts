import type { GraphSchema } from '@/lib/graph/schema'

export function parseLayoutMode(raw: unknown): NonNullable<NonNullable<GraphSchema['layout']>['mode']> | null {
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (!text) return null
  const normalized = text.toLowerCase()
  if (normalized === 'force') return 'force'
  if (normalized === 'radial' || normalized === 'radial-cluster' || normalized === 'cluster') return 'radial'
  if (normalized === 'stratify') return 'stratify'
  if (normalized === 'tree' || normalized === 'tidy-tree' || normalized === 'dendrogram') return 'stratify'
  return null
}
