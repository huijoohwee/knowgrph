import type { WorkspaceImportWebsiteOpts } from '@/features/markdown-explorer/workspaceActionBridge'

export function buildAutoWebsiteImportOptions(): WorkspaceImportWebsiteOpts {
  return {
    generateArtifactDocs: true,
    browserEnhance: true,
    minPages: 100,
    source: 'import-url',
  }
}
