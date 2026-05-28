import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { ensureMarkdownFileName } from '@/features/workspace-fs/upsertWorkspaceTextDocument'

const REPORT_SHARE_HINT_RX = /\/report\/share\//i
const SHARE_HINT_RX = /\/share\//i

export const sanitizeShareUrlArtifactToken = (value: unknown, fallback: string): string => {
  const text = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return text || fallback
}

export type ShareUrlArtifactKind = 'reportShare' | 'share'

export const isShareUrlArtifactEligible = (value: string): boolean => {
  try {
    const url = new URL(String(value || '').trim())
    return SHARE_HINT_RX.test(url.pathname)
  } catch {
    return false
  }
}

export const readShareUrlArtifactKind = (value: string): ShareUrlArtifactKind => {
  try {
    const url = new URL(String(value || '').trim())
    return REPORT_SHARE_HINT_RX.test(url.pathname) ? 'reportShare' : 'share'
  } catch {
    return 'share'
  }
}

export const readShareUrlArtifactExportToken = (value: string, importedName?: string | null): string => {
  try {
    const url = new URL(String(value || '').trim())
    const segments = url.pathname.split('/').map(part => String(part || '').trim()).filter(Boolean)
    const shareIndex = segments.findIndex(part => part.toLowerCase() === 'share')
    if (shareIndex >= 0 && shareIndex + 1 < segments.length) {
      return sanitizeShareUrlArtifactToken(segments[shareIndex + 1], 'share')
    }
    const lastSegment = segments[segments.length - 1] || ''
    if (lastSegment) return sanitizeShareUrlArtifactToken(lastSegment, 'share')
  } catch {
    void 0
  }
  const importedBaseName = ensureMarkdownFileName(String(importedName || '').trim() || 'share.md').replace(/\.md$/i, '')
  return sanitizeShareUrlArtifactToken(importedBaseName, 'share')
}

export const resolveShareUrlArtifactPaths = (args: {
  rootFolderPath: string
  url: string
  importedName?: string | null
}): {
  exportToken: string
  exportFolderPath: string
  exportMarkdownPath: string
  exportThinkingPath: string
  kind: ShareUrlArtifactKind
} => {
  const exportToken = readShareUrlArtifactExportToken(args.url, args.importedName)
  const exportFolderPath = normalizeWorkspacePath(`${args.rootFolderPath === '/' ? '' : args.rootFolderPath}/${exportToken}`)
  return {
    exportToken,
    exportFolderPath,
    exportMarkdownPath: normalizeWorkspacePath(`${exportFolderPath}/${ensureMarkdownFileName(exportToken)}`),
    exportThinkingPath: normalizeWorkspacePath(`${exportFolderPath}/${exportToken}-thinking.md`),
    kind: readShareUrlArtifactKind(args.url),
  }
}
