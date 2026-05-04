import type { MarkdownDataViewColumn } from '@/features/markdown/ui/markdownDataViewModel'
import type { WorkspaceDataViewGraphColumnRole } from './workspaceDataViewConfig'

const normalizeGraphRoleSource = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim()

export const inferRoleForColumn = (name: string): WorkspaceDataViewGraphColumnRole => {
  const lower = normalizeGraphRoleSource(name).toLowerCase()
  if (lower === 'task') return 'node'
  if (lower === 'status') return 'color'
  if (lower === 'category') return 'group'
  if (lower === 'dependency' || lower === 'dependencies') return 'dependsOn'
  if (lower === 'predecessor' || lower === 'predecessors') return 'predecessor'
  if (lower === 'successor' || lower === 'successors') return 'successor'
  return 'none'
}

export const buildSuggestedRoles = (columns: readonly MarkdownDataViewColumn[]): Record<string, WorkspaceDataViewGraphColumnRole> => {
  const out: Record<string, WorkspaceDataViewGraphColumnRole> = {}
  for (const column of columns) {
    out[column.id] = inferRoleForColumn(column.name)
  }
  return out
}

export const WORKSPACE_DATA_VIEW_GRAPH_ROLE_OPTIONS: Array<{ value: WorkspaceDataViewGraphColumnRole; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'node', label: 'Node (title)' },
  { value: 'color', label: 'Node color' },
  { value: 'group', label: 'Cluster / group' },
  { value: 'dependsOn', label: 'Edge: dependency' },
  { value: 'predecessor', label: 'Edge: predecessor' },
  { value: 'successor', label: 'Edge: successor' },
]
