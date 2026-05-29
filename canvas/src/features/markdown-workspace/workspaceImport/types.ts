import type { WorkspacePath } from '@/features/workspace-fs/types'
import type { WorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import type { CorpusImportManifest } from '@/features/queryable-corpus/sourceFilesCorpusManifest'

export type WorkspaceImportResult = {
  createdPaths: WorkspacePath[]
  removedPaths?: WorkspacePath[]
  sources: Array<{ path: WorkspacePath; source: WorkspaceEntrySource }>
  skipped: Array<{ name: string; reason: 'unsupported' | 'missing-name' }>
  failed: Array<{ name: string; error: string }>
  applyToGraph?: boolean
  corpusManifest?: CorpusImportManifest
}

export type WorkspaceUrlContent = {
  normalizedUrl: string
  name: string
  title?: string
  text: string
  thinkingText?: string
  thinkingTextTask?: Promise<string>
}

export type WorkspaceImportProgress = {
  phase: 'listing' | 'fetching' | 'writing'
  current: number
  total?: number
  label?: string
}
