const DIRECT_WORKSPACE_IMPORT_PATHS = ['/__codebase_file', '/__codebase_asset']

const readCurrentOrigin = (): string => {
  try {
    const location =
      (globalThis as { location?: Location }).location
      || (globalThis as { window?: { location?: Location } }).window?.location
    const origin = String(location?.origin || '').trim()
    return origin === 'null' ? '' : origin
  } catch {
    return ''
  }
}

const isDirectWorkspaceImportPath = (pathname: string): boolean => {
  if (pathname.startsWith('/@fs/')) return true
  return DIRECT_WORKSPACE_IMPORT_PATHS.includes(pathname)
}

export function resolveSameOriginWorkspaceImportFetchPath(rawUrl: string): string {
  const currentOrigin = readCurrentOrigin()
  if (!currentOrigin) return ''
  try {
    const parsed = new URL(String(rawUrl || '').trim())
    if (parsed.origin !== currentOrigin) return ''
    if (!isDirectWorkspaceImportPath(parsed.pathname)) return ''
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return ''
  }
}
