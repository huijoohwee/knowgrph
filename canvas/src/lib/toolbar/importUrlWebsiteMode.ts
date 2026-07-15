import type { WorkspaceImportWebsiteOpts } from '@/features/markdown-explorer/workspaceActionBridge'

export function buildAutoWebsiteImportOptions(): WorkspaceImportWebsiteOpts {
  return {
    generateArtifactDocs: true,
    browserEnhance: false,
    headless: true,
    proxyRotation: true,
    downloadAssets: true,
    applyToCanvas: true,
    maxDownloads: 120,
    maxDownloadBytes: 250 * 1024 * 1024,
    minPages: 100,
    source: 'import-url',
  }
}
