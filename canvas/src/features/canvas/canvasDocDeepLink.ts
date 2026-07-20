import {
  buildKnowgrphStorageDefaultDocPath,
  buildKnowgrphStorageDocPath,
  KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID,
  KNOWGRPH_STORAGE_ROUTE_PATHS,
} from '@/lib/storage/knowgrphStorageSyncContract'
import { readEnvString } from '@/lib/config.env'
import {
  decodePublishedDocShareToken,
  encodePublishedDocShareToken,
  PUBLISHED_DOC_SHARE_TOKEN_PARAM,
} from './canvasDocShareToken.mjs'

const DEEP_LINK_PREFIX = '/doc/'
const DEFAULT_DEEP_LINK_PREFIX = '/doc-default/'
const SHARE_DEEP_LINK_PREFIX = '/share/'
const CANVAS_PREVIEW_PARAM = 'kgPreview'
const LIVE_CANVAS_HERO_PREVIEW_PARAM = 'kgLiveHero'
const DEEP_LINK_PARAM = 'kgPath'
export const LOCAL_DOC_PARAM = 'kgDoc'
const LOCAL_DOC_HISTORY_STATE_KEY = '__knowgrphLocalDocPath'
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
  if (link) return link.kind === 'local' ? link.relativePath : null
  if (typeof window === 'undefined') return null
  const state = window.history?.state
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null
  const retainedPath = String((state as Record<string, unknown>)[LOCAL_DOC_HISTORY_STATE_KEY] || '').trim()
  return retainedPath || null
}

function buildLocalDocHistoryState(relativePath: string | null): Record<string, unknown> | null {
  const current = window.history?.state
  const next = current && typeof current === 'object' && !Array.isArray(current)
    ? { ...(current as Record<string, unknown>) }
    : {}
  if (relativePath) next[LOCAL_DOC_HISTORY_STATE_KEY] = relativePath
  else delete next[LOCAL_DOC_HISTORY_STATE_KEY]
  return Object.keys(next).length > 0 ? next : null
}

export function clearRetainedLocalDocDeepLinkPath(): void {
  if (typeof window === 'undefined') return
  try {
    const nextState = buildLocalDocHistoryState(null)
    window.history.replaceState(nextState, '')
  } catch {
    void 0
  }
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
  const token = encodePublishedDocShareToken(args)
  if (!token) return `${APP_BASE_PATH}/`
  return `${APP_BASE_PATH}${SHARE_DEEP_LINK_PREFIX}${encodeURIComponent(token)}`
}

export function buildPublishedDocShareDeepLink(args: {
  workspaceId?: string | null
  canonicalPath: string
}): string {
  return buildPublishedDocSharePath(args)
}

const readPublishedDocShareOrigin = (origin?: string | null): string => {
  const explicitOrigin = String(origin || '').trim()
  if (explicitOrigin) return explicitOrigin.replace(/\/+$/, '')
  const configuredOrigin = String(readEnvString('VITE_KNOWGRPH_STORAGE_BASE_URL', '') || '').trim()
  if (configuredOrigin) return configuredOrigin.replace(/\/+$/, '')
  if (typeof window !== 'undefined' && window.location?.origin) {
    return String(window.location.origin || '').replace(/\/+$/, '')
  }
  return 'https://airvio.co'
}

export function buildPublishedDocShareUrl(args: {
  workspaceId?: string | null
  canonicalPath: string
  origin?: string | null
}): string | null {
  const canonicalPath = String(args.canonicalPath || '').trim()
  if (!canonicalPath) return null
  const workspaceId = String(args.workspaceId || '').trim()
  const identity = workspaceId && workspaceId !== KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID
    ? { workspaceId, canonicalPath }
    : { canonicalPath }
  return `${readPublishedDocShareOrigin(args.origin)}${buildPublishedDocShareDeepLink(identity)}`
}

export function buildPublishedDocCanvasEmbedUrl(args: {
  workspaceId?: string | null
  canonicalPath: string
  origin?: string | null
}): string | null {
  const shareUrl = buildPublishedDocShareUrl(args)
  if (!shareUrl) return null
  return appendCanvasPreviewParam(shareUrl)
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
  return buildPublishedDocShareUrl({ ...parsed, origin: args.origin })
}

export function buildPublishedDocCanvasEmbedUrlFromSource(args: {
  sourceUrl: string
  origin?: string | null
}): string | null {
  const parsed = parsePublishedDocSourceUrl(args.sourceUrl)
  if (!parsed) return null
  return buildPublishedDocCanvasEmbedUrl({ ...parsed, origin: args.origin })
}

export function appendCanvasPreviewParam(url: string): string | null {
  const trimmed = String(url || '').trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : 'https://airvio.co')
    parsed.searchParams.set(CANVAS_PREVIEW_PARAM, '1')
    return parsed.toString()
  } catch {
    return null
  }
}

export function buildLocalDocCanvasEmbedUrl(args: {
  relativePath: string
  origin?: string | null
  pathname?: string | null
}): string | null {
  const relativePath = String(args.relativePath || '').trim().replace(/^\/+/, '')
  if (!relativePath) return null
  const origin = String(args.origin || '').trim()
    || (typeof window !== 'undefined' ? String(window.location.origin || '').trim() : '')
  const pathname = String(args.pathname || '').trim()
    || (typeof window !== 'undefined' ? String(window.location.pathname || '/').trim() : '/')
  if (!origin) return null
  try {
    const url = new URL(pathname || '/', origin)
    url.search = ''
    url.hash = ''
    url.searchParams.set(LOCAL_DOC_PARAM, relativePath)
    url.searchParams.set(CANVAS_PREVIEW_PARAM, '1')
    url.searchParams.set(LIVE_CANVAS_HERO_PREVIEW_PARAM, '1')
    return url.toString()
  } catch {
    return null
  }
}

export function isSameOriginCanvasEmbedUrl(url: string, origin?: string | null): boolean {
  const candidate = String(url || '').trim()
  const runtimeOrigin = String(origin || '').trim()
    || (typeof window !== 'undefined' ? String(window.location.origin || '').trim() : '')
  if (!candidate || !runtimeOrigin) return false
  try {
    return new URL(candidate, runtimeOrigin).origin === new URL(runtimeOrigin).origin
  } catch {
    return false
  }
}

export function consumeDeepLinkParams(search: string): void {
  try {
    const link = parseDocDeepLink(search)
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
    const retainedLocalPath = link?.kind === 'local' ? link.relativePath : null
    const nextState = buildLocalDocHistoryState(retainedLocalPath)
    window.history.replaceState(nextState, '', nextUrl)
    try {
      window.dispatchEvent(new PopStateEvent('popstate', { state: nextState }))
    } catch {
      window.dispatchEvent(new Event('popstate'))
    }
  } catch {
    void 0
  }
}
