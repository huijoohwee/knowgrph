import type { WorkspacePath } from '@/features/workspace-fs/types'
import type { WorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'

export type WorkspaceImportResult = {
  createdPaths: WorkspacePath[]
  sources: Array<{ path: WorkspacePath; source: WorkspaceEntrySource }>
  skipped: Array<{ name: string; reason: 'unsupported' | 'missing-name' }>
  failed: Array<{ name: string; error: string }>
  applyToGraph?: boolean
}

export type WorkspaceUrlContent = {
  normalizedUrl: string
  name: string
  text: string
}

export type WorkspaceImportProgress = {
  phase: 'listing' | 'fetching' | 'writing'
  current: number
  total?: number
  label?: string
}
