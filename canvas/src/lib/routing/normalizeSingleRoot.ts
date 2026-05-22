import { PUBLISHED_DOC_SHARE_TOKEN_PARAM } from '@/features/canvas/canvasDocShareToken.mjs'

const SHARE_DEEP_LINK_PREFIX = '/share/'

export function normalizeSingleRootRoute(args: {
  pathname: string
  search: string
  hash: string
}): { pathname: '/'; search: string; hash: string } | null {
  const pathname = String(args.pathname || '')
  if (pathname === '/' || pathname === '') return null

  const search = String(args.search || '')
  const hash = String(args.hash || '')
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

  if (pathname.startsWith(SHARE_DEEP_LINK_PREFIX)) {
    if (!params.get(PUBLISHED_DOC_SHARE_TOKEN_PARAM)) {
      const shareToken = pathname.slice(SHARE_DEEP_LINK_PREFIX.length).trim()
      if (shareToken) {
        params.set(PUBLISHED_DOC_SHARE_TOKEN_PARAM, decodeURIComponent(shareToken))
      }
    }
    const nextSearch = params.toString()
    return {
      pathname: '/',
      search: nextSearch ? `?${nextSearch}` : '',
      hash,
    }
  }

  if (!params.get('kgPath')) {
    params.set('kgPath', pathname)
  }

  const nextSearch = params.toString()
  return {
    pathname: '/',
    search: nextSearch ? `?${nextSearch}` : '',
    hash,
  }
}
