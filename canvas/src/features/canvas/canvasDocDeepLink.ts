import { KNOWGRPH_STORAGE_ROUTE_PATHS } from '@/lib/storage/knowgrphStorageSyncContract'

const DEEP_LINK_PREFIX = '/doc/'
const DEEP_LINK_PARAM = 'kgPath'
const LOCAL_DOC_PARAM = 'kgDoc'

export type RemoteDocDeepLink = { kind: 'remote'; workspaceId: string; canonicalPath: string }
export type LocalDocDeepLink = { kind: 'local'; relativePath: string }
export type DocDeepLink = RemoteDocDeepLink | LocalDocDeepLink

export function parseDocDeepLink(search: string): DocDeepLink | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

  const localRaw = String(params.get(LOCAL_DOC_PARAM) || '').trim()
  if (localRaw) {
    return { kind: 'local', relativePath: localRaw }
  }

  const rawPath = String(params.get(DEEP_LINK_PARAM) || '').trim()
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
  const base = KNOWGRPH_STORAGE_ROUTE_PATHS.docPrefix
  return `${base}${encodeURIComponent(workspaceId)}/${encodeURIComponent(canonicalPath)}`
}

export function consumeDeepLinkParams(search: string): void {
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    let changed = false
    if (params.has(LOCAL_DOC_PARAM)) { params.delete(LOCAL_DOC_PARAM); changed = true }
    if (params.has(DEEP_LINK_PARAM)) { params.delete(DEEP_LINK_PARAM); changed = true }
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
