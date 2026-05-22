import {
  buildKnowgrphStorageDefaultDocPath,
  buildKnowgrphStorageDocPath,
  KNOWGRPH_STORAGE_ROUTE_PATHS,
} from '@/lib/storage/knowgrphStorageSyncContract'
import {
  decodePublishedDocShareToken,
  encodePublishedDocShareToken,
  PUBLISHED_DOC_SHARE_TOKEN_PARAM,
} from './canvasDocShareToken.mjs'

const DEEP_LINK_PREFIX = '/doc/'
const DEFAULT_DEEP_LINK_PREFIX = '/doc-default/'
const DEEP_LINK_PARAM = 'kgPath'
const LOCAL_DOC_PARAM = 'kgDoc'
const WORKSPACE_ID_PARAM = 'kgWorkspaceId'
const CANONICAL_PATH_PARAM = 'kgCanonicalPath'
const APP_BASE_PATH = '/knowgrph'

export type RemoteDocDeepLink = { kind: 'remote'; workspaceId: string; canonicalPath: string }
export type DefaultRemoteDocDeepLink = { kind: 'default-remote'; canonicalPath: string }
export type LocalDocDeepLink = { kind: 'local'; relativePath: string }
export type DocDeepLink = RemoteDocDeepLink | DefaultRemoteDocDeepLink | LocalDocDeepLink

export function parseDocDeepLink(search: string): DocDeepLink | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

  const localRaw = String(params.get(LOCAL_DOC_PARAM) || '').trim()
  if (localRaw) {
    return { kind: 'local', relativePath: localRaw }
  }

  const shareToken = decodePublishedDocShareToken(params.get(PUBLISHED_DOC_SHARE_TOKEN_PARAM))
  if (shareToken) {
    return shareToken.workspaceId
      ? { kind: 'remote', workspaceId: shareToken.workspaceId, canonicalPath: shareToken.canonicalPath }
      : { kind: 'default-remote', canonicalPath: shareToken.canonicalPath }
  }

  const canonicalPathParam = String(params.get(CANONICAL_PATH_PARAM) || '').trim()
  if (canonicalPathParam) {
    const canonicalPath = decodeURIComponent(canonicalPathParam).trim()
    if (!canonicalPath) return null
    const workspaceIdParam = String(params.get(WORKSPACE_ID_PARAM) || '').trim()
    if (!workspaceIdParam) {
      return { kind: 'default-remote', canonicalPath }
    }
    const workspaceId = decodeURIComponent(workspaceIdParam).trim()
    if (!workspaceId) return null
    return { kind: 'remote', workspaceId, canonicalPath }
  }

  const rawPath = String(params.get(DEEP_LINK_PARAM) || '').trim()
  if (rawPath.startsWith(DEFAULT_DEEP_LINK_PREFIX)) {
    const canonicalPath = decodeURIComponent(rawPath.slice(DEFAULT_DEEP_LINK_PREFIX.length)).trim()
    if (!canonicalPath) return null
    return { kind: 'default-remote', canonicalPath }
  }
  if (!rawPath.startsWith(DEEP_LINK_PREFIX)) return null
  const suffix = rawPath.slice(DEEP_LINK_PREFIX.length)
  if (!suffix) return null
  const firstSlash = suffix.indexOf('/')
  if (firstSlash < 1) return null
  const workspaceId = decodeURIComponent(suffix.slice(0, firstSlash)).trim()
  const canonicalPath = decodeURIComponent(suffix.slice(firstSlash + 1)).trim()
  if (!workspaceId || !canonicalPath) return null
  return { kind: 'remote', workspaceId, canonicalPath }
}

export function readCurrentDocDeepLinkSearch(): string {
  if (typeof window === 'undefined') return ''
  return String(window.location?.search || '')
}

export function readLocalDocDeepLinkPathFromCurrentLocation(): string | null {
  const link = parseDocDeepLink(readCurrentDocDeepLinkSearch())
  return link?.kind === 'local' ? link.relativePath : null
}

export function buildDocViewUrl(workspaceId: string, canonicalPath: string): string {
  return buildKnowgrphStorageDocPath(workspaceId, canonicalPath)
}

export function buildDefaultDocViewUrl(canonicalPath: string): string {
  return buildKnowgrphStorageDefaultDocPath(canonicalPath)
}

export function buildPublishedDocSharePath(args: {
  workspaceId?: string | null
  canonicalPath: string
}): string {
  const canonicalPath = String(args.canonicalPath || '').trim()
  if (!canonicalPath) return `${APP_BASE_PATH}/`
  const workspaceId = String(args.workspaceId || '').trim()
  return workspaceId
    ? `${APP_BASE_PATH}${DEEP_LINK_PREFIX}${encodeURIComponent(workspaceId)}/${encodeURIComponent(canonicalPath)}`
    : `${APP_BASE_PATH}${DEFAULT_DEEP_LINK_PREFIX}${encodeURIComponent(canonicalPath)}`
}

export function buildPublishedDocShareDeepLink(args: {
  workspaceId?: string | null
  canonicalPath: string
}): string {
  const token = encodePublishedDocShareToken(args)
  if (!token) return `${APP_BASE_PATH}/`
  const params = new URLSearchParams()
  params.set(PUBLISHED_DOC_SHARE_TOKEN_PARAM, token)
  return `${APP_BASE_PATH}/?${params.toString()}`
}

function parsePublishedDocSourceUrl(sourceUrl: string): { workspaceId: string | null; canonicalPath: string } | null {
  const trimmed = String(sourceUrl || '').trim()
  if (!trimmed) return null
  const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://airvio.co'
  let pathname = ''
  try {
    pathname = new URL(trimmed, fallbackOrigin).pathname
  } catch {
    return null
  }
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'
  if (normalizedPath.startsWith(KNOWGRPH_STORAGE_ROUTE_PATHS.defaultDocPrefix)) {
    const canonicalPath = decodeURIComponent(normalizedPath.slice(KNOWGRPH_STORAGE_ROUTE_PATHS.defaultDocPrefix.length)).trim()
    if (!canonicalPath) return null
    return { workspaceId: null, canonicalPath }
  }
  if (!normalizedPath.startsWith(KNOWGRPH_STORAGE_ROUTE_PATHS.docPrefix)) return null
  const suffix = normalizedPath.slice(KNOWGRPH_STORAGE_ROUTE_PATHS.docPrefix.length)
  const firstSlash = suffix.indexOf('/')
  if (firstSlash < 1) return null
  const workspaceId = decodeURIComponent(suffix.slice(0, firstSlash)).trim()
  const canonicalPath = decodeURIComponent(suffix.slice(firstSlash + 1)).trim()
  if (!workspaceId || !canonicalPath) return null
  return { workspaceId, canonicalPath }
}

export function buildPublishedDocShareUrlFromSource(args: {
  sourceUrl: string
  origin?: string | null
}): string | null {
  const parsed = parsePublishedDocSourceUrl(args.sourceUrl)
  if (!parsed) return null
  const origin = String(args.origin || '').trim() || (typeof window !== 'undefined' ? window.location.origin : '')
  if (!origin) return null
  return `${origin}${buildPublishedDocShareDeepLink(parsed)}`
}

export function consumeDeepLinkParams(search: string): void {
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    let changed = false
    if (params.has(LOCAL_DOC_PARAM)) { params.delete(LOCAL_DOC_PARAM); changed = true }
    if (params.has(DEEP_LINK_PARAM)) { params.delete(DEEP_LINK_PARAM); changed = true }
    if (params.has(PUBLISHED_DOC_SHARE_TOKEN_PARAM)) { params.delete(PUBLISHED_DOC_SHARE_TOKEN_PARAM); changed = true }
    if (params.has(WORKSPACE_ID_PARAM)) { params.delete(WORKSPACE_ID_PARAM); changed = true }
    if (params.has(CANONICAL_PATH_PARAM)) { params.delete(CANONICAL_PATH_PARAM); changed = true }
    if (!changed) return
    const next = params.toString()
    const nextUrl = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash || ''}`
    window.history.replaceState(null, '', nextUrl)
    try {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    } catch {
      window.dispatchEvent(new Event('popstate'))
    }
  } catch {
    void 0
  }
}
