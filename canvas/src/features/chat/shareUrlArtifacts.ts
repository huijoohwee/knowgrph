import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { ensureMarkdownFileName } from '@/features/workspace-fs/upsertWorkspaceTextDocument'
import { extractYamlFrontmatterHeaderBlock, readYamlFrontmatterValue } from '@/lib/markdown/frontmatter'

const REPORT_SHARE_HINT_RX = /\/report\/share\//i
const HOST_LABEL_STOPWORDS = new Set(['www', 'app', 'chat', 'share'])

const readUrlPathSegments = (value: string): string[] => {
  try {
    return new URL(String(value || '').trim())
      .pathname
      .split('/')
      .map(part => String(part || '').trim().toLowerCase())
      .filter(Boolean)
  } catch {
    return []
  }
}

const hasExportableArtifactPath = (value: string): boolean => {
  const segments = readUrlPathSegments(value)
  if (segments.length === 0) return false
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i]
    if ((segment === 'share' || segment === 'chat') && !!segments[i + 1]) return true
  }
  return false
}

export const sanitizeShareUrlArtifactToken = (value: unknown, fallback: string): string => {
  const text = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return text || fallback
}

const readShareUrlArtifactHostLabelTokens = (value: string): Set<string> => {
  try {
    const hostname = new URL(String(value || '').trim()).hostname.toLowerCase()
    return new Set(
      hostname
        .split('.')
        .map(part => sanitizeShareUrlArtifactToken(part, ''))
        .filter(part => part.length > 1 && !HOST_LABEL_STOPWORDS.has(part) && !/^\d+$/.test(part)),
    )
  } catch {
    return new Set()
  }
}

const stripTrailingShareUrlSiteTitleSuffix = (value: unknown, sourceUrl: string): string => {
  const text = String(value || '').trim().replace(/\s+/g, ' ')
  if (!text) return ''
  const hostLabels = readShareUrlArtifactHostLabelTokens(sourceUrl)
  if (hostLabels.size === 0) return text
  const suffixMatch = text.match(/\s(?:-|\||:|\u2013|\u2014)\s*([^-|:\u2013\u2014]+)$/)
  if (!suffixMatch || suffixMatch.index == null) return text
  const suffixToken = sanitizeShareUrlArtifactToken(suffixMatch[1], '')
  if (!suffixToken || !hostLabels.has(suffixToken)) return text
  return text.slice(0, suffixMatch.index).trim()
}

const isShareUrlArtifactSiteOnlyTitleToken = (token: string, sourceUrl: string): boolean => {
  const comparableToken = sanitizeShareUrlArtifactToken(token, '')
  return !!comparableToken && readShareUrlArtifactHostLabelTokens(sourceUrl).has(comparableToken)
}

export const sanitizeShareUrlArtifactTitleToken = (
  value: unknown,
  fallback: string,
  sourceUrl = '',
): string => {
  const text = stripTrailingShareUrlSiteTitleSuffix(value, sourceUrl)
    .replace(/\.(?:md|markdown|mdx|mmd)$/i, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!text || isShareUrlArtifactSiteOnlyTitleToken(text, sourceUrl)) return fallback
  return text
}

const stripInlineMarkdownForArtifactTitle = (value: unknown): string => {
  return String(value || '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const readShareUrlArtifactImportedMarkdownTitleToken = (markdown: unknown, sourceUrl: string): string => {
  const text = String(markdown || '').replace(/\r\n/g, '\n')
  const header = extractYamlFrontmatterHeaderBlock(text)
  if (!header) return ''
  const title = stripInlineMarkdownForArtifactTitle(readYamlFrontmatterValue(header.rawBlock, 'title'))
  return title ? sanitizeShareUrlArtifactTitleToken(title, '', sourceUrl) : ''
}

const readShareUrlArtifactImportedTitleToken = (args: {
  importedTitle?: string | null
  importedText?: string | null
  sourceUrl: string
}): string => {
  const titleToken = sanitizeShareUrlArtifactTitleToken(args.importedTitle, '', args.sourceUrl)
  if (titleToken) return titleToken
  return readShareUrlArtifactImportedMarkdownTitleToken(args.importedText, args.sourceUrl)
}

export type ShareUrlArtifactKind = 'reportShare' | 'share'
export type ShareUrlArtifactExportTokenOptions = {
  importedTitle?: string | null
  importedText?: string | null
}

export const isShareUrlArtifactEligible = (value: string): boolean => {
  return hasExportableArtifactPath(value)
}

export const readShareUrlArtifactKind = (value: string): ShareUrlArtifactKind => {
  try {
    const url = new URL(String(value || '').trim())
    return REPORT_SHARE_HINT_RX.test(url.pathname) ? 'reportShare' : 'share'
  } catch {
    return 'share'
  }
}

export const readShareUrlArtifactUrlToken = (value: string): string => {
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
  return ''
}

export const readShareUrlArtifactExportToken = (
  value: string,
  importedName?: string | null,
  options?: ShareUrlArtifactExportTokenOptions,
): string => {
  const titleToken = readShareUrlArtifactImportedTitleToken({
    importedTitle: options?.importedTitle,
    importedText: options?.importedText,
    sourceUrl: value,
  })
  if (titleToken) return titleToken
  const urlToken = readShareUrlArtifactUrlToken(value)
  if (urlToken) return urlToken
  const importedBaseName = ensureMarkdownFileName(String(importedName || '').trim() || 'share.md').replace(/\.md$/i, '')
  return sanitizeShareUrlArtifactToken(importedBaseName, 'share')
}

export const resolveShareUrlArtifactPaths = (args: {
  rootFolderPath: string
  url: string
  importedName?: string | null
  importedTitle?: string | null
  importedText?: string | null
  exportTokenOverride?: string | null
}): {
  exportToken: string
  exportFolderPath: string
  exportMarkdownPath: string
  exportThinkingPath: string
  kind: ShareUrlArtifactKind
} => {
  const exportToken = args.exportTokenOverride
    ? sanitizeShareUrlArtifactTitleToken(args.exportTokenOverride, '', args.url) || sanitizeShareUrlArtifactToken(args.exportTokenOverride, 'share')
    : readShareUrlArtifactExportToken(args.url, args.importedName, {
        importedTitle: args.importedTitle,
        importedText: args.importedText,
      })
  const exportFolderPath = normalizeWorkspacePath(`${args.rootFolderPath === '/' ? '' : args.rootFolderPath}/${exportToken}`)
  return {
    exportToken,
    exportFolderPath,
    exportMarkdownPath: normalizeWorkspacePath(`${exportFolderPath}/${ensureMarkdownFileName(exportToken)}`),
    exportThinkingPath: normalizeWorkspacePath(`${exportFolderPath}/${exportToken}-thinking.md`),
    kind: readShareUrlArtifactKind(args.url),
  }
}

export const buildShareUrlArtifactConflictExportToken = (primaryToken: string, sourceUrl: string): string => {
  const primary = sanitizeShareUrlArtifactTitleToken(primaryToken, '', sourceUrl) || sanitizeShareUrlArtifactToken(primaryToken, 'share')
  const urlToken = readShareUrlArtifactUrlToken(sourceUrl)
  if (!urlToken || sanitizeShareUrlArtifactToken(primary, '') === urlToken) return primary
  return sanitizeShareUrlArtifactTitleToken(`${primary}-${urlToken}`, '', sourceUrl)
    || sanitizeShareUrlArtifactToken(`${primary}-${urlToken}`, 'share')
}
