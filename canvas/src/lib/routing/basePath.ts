export function resolveRouterBasename(baseUrl: unknown): string | undefined {
  const raw = String(baseUrl || '').trim() || '/'
  if (raw === '/' || raw === '') return undefined
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`
  const noTrailing = withLeading.endsWith('/') ? withLeading.slice(0, -1) : withLeading
  if (noTrailing === '/' || noTrailing === '') return undefined
  return noTrailing
}

