export function reorderList<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  const n = items.length
  if (fromIndex === toIndex) return items as T[]
  if (fromIndex < 0 || fromIndex >= n) return items as T[]
  if (toIndex < 0 || toIndex >= n) return items as T[]
  const next = items.slice() as T[]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

