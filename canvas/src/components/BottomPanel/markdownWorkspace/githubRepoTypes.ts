import type { WorkspacePath } from '@/features/workspace-fs/types'
import type { WorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'

export type WorkspaceImportResult = {
  createdPaths: WorkspacePath[]
  sources: Array<{ path: WorkspacePath; source: WorkspaceEntrySource }>
  skipped: Array<{ name: string; reason: 'unsupported' | 'missing-name' }>
  failed: Array<{ name: string; error: string }>
}

export type WorkspaceImportProgress = {
  phase: 'listing' | 'fetching' | 'writing'
  current: number
  total?: number
  label?: string
}

export type GitHubRepoRef = {
  owner: string
  repo: string
  ref: string | null
  subdirPath: string
}

export type GitHubRepoMeta = {
  name?: unknown
  full_name?: unknown
  description?: unknown
  license?: unknown
  stargazers_count?: unknown
  forks_count?: unknown
  updated_at?: unknown
  default_branch?: unknown
}

