import type { GraphFieldSettingsById } from '@/features/graph-fields/graphFields'
import type { SourceFile } from '@/hooks/store/types'
import type { GraphData } from '@/lib/graph/types'

export const VERSION_HISTORY_MAX_ENTRIES = 100

export type VersionHistorySource = 'graph' | 'gitGraph' | 'manual' | 'import' | 'runtime'

export type VersionHistoryEntry = {
  id: string
  parentId: string | null
  label: string
  timestamp: number
  source: VersionHistorySource
  contentSignature: string
  graphData: GraphData
  graphFieldSettingsById: GraphFieldSettingsById
  markdownDocumentName: string | null
  markdownDocumentText: string | null
  activeSourceFileSnapshot: SourceFile | null
}

export const inferVersionHistorySource = (label: string): VersionHistorySource => {
  const normalized = String(label || '').trim().toLowerCase()
  if (normalized.includes('gitgraph')) return 'gitGraph'
  if (normalized.includes('manual snapshot')) return 'manual'
  if (normalized.includes('import')) return 'import'
  if (normalized.includes('runtime') || normalized.includes('run ')) return 'runtime'
  return 'graph'
}
