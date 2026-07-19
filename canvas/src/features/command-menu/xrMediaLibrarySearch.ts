export function matchesXrMediaLibrarySearch(searchText: string, values: readonly string[]): boolean {
  const tokens = String(searchText || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  const haystack = values.join(' ').toLowerCase()
  return tokens.every(token => haystack.includes(token))
}
