import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import {
  GEOSPATIAL_WORKSPACE_SEED_BASENAME,
  TEST_VALIDATION_WORKSPACE_SEED_BASENAME,
  WORKSPACE_README_SEED_BASENAME,
} from '@/features/workspace-fs/workspaceFs'

const normalizeString = (value: unknown): string => String(value || '').trim()
const CANONICAL_DOCS_ROOT = 'huijoohwee/docs'
const CANONICAL_DOCS_PARENT_ROOT = 'huijoohwee'

export const looksLikeHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value)

export const normalizeStorageCanonicalPathCandidate = (value: string): string => {
  const normalized = normalizeString(value).replace(/\\/g, '/').replace(/^workspace:/, '').replace(/^\/+/, '')
  if (!normalized || looksLikeHttpUrl(normalized)) return ''
  const lower = normalized.toLowerCase()
  const marker = `${CANONICAL_DOCS_ROOT}/`
  if (lower.includes(marker)) {
    const idx = lower.indexOf(marker)
    return normalized.slice(idx)
  }
  if (lower.startsWith('docs/')) return `${CANONICAL_DOCS_PARENT_ROOT}/${normalized}`
  return normalized
}

export const normalizeMarkdownWorkspaceDocsSourcePathFromCanonicalPath = (canonicalPathRaw: string): string => {
  const canonicalPath = normalizeString(canonicalPathRaw).replace(/\\/g, '/')
  if (!canonicalPath || looksLikeHttpUrl(canonicalPath)) return ''
  const withoutWorkspacePrefix = canonicalPath.startsWith('workspace:') ? canonicalPath.slice('workspace:'.length) : canonicalPath
  const normalized = withoutWorkspacePrefix.replace(/^\/+/, '')
  const lower = normalized.toLowerCase()
  const marker = `${CANONICAL_DOCS_ROOT}/`
  let docsRelative = ''
  const markerIndex = lower.indexOf(marker)
  if (markerIndex >= 0) {
    docsRelative = normalized.slice(markerIndex + marker.length)
  } else if (lower.startsWith('docs/')) {
    docsRelative = normalized.slice('docs/'.length)
  } else {
    return ''
  }
  const rel = docsRelative.split('/').filter(Boolean).join('/')
  if (!rel) return ''
  return `workspace:/docs/${rel}`
}

const isMarkdownLikeCanonicalPath = (value: string): boolean => {
  const lower = normalizeString(value).toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.mdx') || lower.endsWith('.mmd')
}

type StorageCanonicalPathReadOptions = {
  markdownOnly?: boolean
}

const shouldKeepStorageCanonicalPathCandidate = (
  value: string,
  options?: StorageCanonicalPathReadOptions,
): boolean => {
  if (!normalizeString(value)) return false
  if (options?.markdownOnly === false) return true
  return isMarkdownLikeCanonicalPath(value)
}

export const readStorageCanonicalPathCandidatesForDocument = (args: {
  documentCanonicalPath: string
  sourcePath: string
}): string[] => {
  const out = new Set<string>()
  const pushWorkspaceCanonical = (value: string) => {
    const normalized = normalizeString(value).replace(/\\/g, '/')
    if (!normalized.startsWith('workspace:/')) return
    if (!isMarkdownLikeCanonicalPath(normalized)) return
    out.add(normalized)
  }
  const push = (value: string) => {
    const normalized = normalizeStorageCanonicalPathCandidate(value)
    if (!normalized) return
    const lower = normalized.toLowerCase()
    if (!isMarkdownLikeCanonicalPath(lower)) return
    if (lower.includes(`/${CANONICAL_DOCS_ROOT}/${CANONICAL_DOCS_ROOT}/`)) return
    out.add(normalized)
  }
  pushWorkspaceCanonical(args.documentCanonicalPath)
  push(args.documentCanonicalPath)
  const sourcePath = normalizeString(args.sourcePath)
  if (sourcePath.startsWith('workspace:/docs/')) {
    pushWorkspaceCanonical(sourcePath)
    const rel = sourcePath.slice('workspace:/docs/'.length).replace(/^\/+/, '')
    if (rel) {
      push(`${CANONICAL_DOCS_ROOT}/${rel}`)
      push(`docs/${rel}`)
    }
  }
  return [...out]
}

export const readStorageCanonicalPathCandidatesForWorkspacePath = (
  workspacePath: string,
  options?: StorageCanonicalPathReadOptions,
): string[] => {
  const normalized = normalizeWorkspacePath(workspacePath)
  if (!normalized || normalized === '/') return []
  const withoutLeadingSlash = normalized.replace(/^\/+/, '')
  const out = new Set<string>()
  const push = (value: string) => {
    const normalizedCandidate = normalizeStorageCanonicalPathCandidate(value)
    if (!normalizedCandidate || !shouldKeepStorageCanonicalPathCandidate(normalizedCandidate, options)) return
    out.add(normalizedCandidate)
  }
  if (normalized.startsWith('/docs/')) {
    const rel = normalized.slice('/docs/'.length).replace(/^\/+/, '')
    push(`${CANONICAL_DOCS_ROOT}/${rel}`)
    push(`docs/${rel}`)
  }
  if (normalized.split('/').filter(Boolean).length === 1) {
    const basename = normalized.slice(1)
    if (
      basename === WORKSPACE_README_SEED_BASENAME
      || basename === TEST_VALIDATION_WORKSPACE_SEED_BASENAME
      || basename === GEOSPATIAL_WORKSPACE_SEED_BASENAME
    ) {
      push(`${CANONICAL_DOCS_ROOT}/${basename}`)
    }
  }
  push(withoutLeadingSlash)
  return [...out]
}

export const readPrimaryStorageCanonicalPathForWorkspacePath = (
  workspacePath: string,
  options?: StorageCanonicalPathReadOptions,
): string =>
  readStorageCanonicalPathCandidatesForWorkspacePath(workspacePath, options)[0] || ''
