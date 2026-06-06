export const areKanbanRowIdsEqual = (a: readonly string[], b: readonly string[]): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export const reconcileKanbanRowIds = (
  current: readonly string[] | null | undefined,
  ids: readonly string[],
): string[] => {
  const nextIds = ids.map(id => String(id || '').trim()).filter(Boolean)
  const valid = new Set(nextIds)
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of current || []) {
    const key = String(id || '').trim()
    if (!key || !valid.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  for (const id of nextIds) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export const moveKanbanRowIdBeforeTarget = (
  order: readonly string[],
  sourceId: string,
  targetId: string,
): string[] => {
  const source = String(sourceId || '').trim()
  const target = String(targetId || '').trim()
  if (!source || !target || source === target) return order.slice()
  const withoutSource = order.filter(id => id !== source)
  const targetIndex = withoutSource.indexOf(target)
  if (targetIndex < 0) return order.slice()
  const next = withoutSource.slice()
  next.splice(targetIndex, 0, source)
  return next
}
