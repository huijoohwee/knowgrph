import type { WorkspaceFs } from '@/features/workspace-fs/types'

export type MarkdownWorkspaceRuntimeGetFs = () => Promise<WorkspaceFs>

export type MarkdownWorkspaceRuntimeSetActiveDocument = (args: {
  name: string
  text: string
  normalizeMermaidMmd?: boolean
  autoEnableFrontmatter?: boolean
  applyViewPreset?: boolean
  sourceUrl?: string | null
}) => Promise<boolean>
