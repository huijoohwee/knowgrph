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

