export function buildCollapsedGroupIdsKey(collapsedGroupIds: unknown): string {
  const ids = Array.isArray(collapsedGroupIds) ? collapsedGroupIds : []
  const normalized = ids.map(x => String(x || '').trim()).filter(Boolean)
  if (normalized.length === 0) return ''
  const unique = Array.from(new Set(normalized))
  unique.sort((a, b) => a.localeCompare(b))
  return unique.join('|')
}
