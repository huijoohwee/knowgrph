export function replaceAtIndex<T>(items: T[], index: number, next: T): T[]
export function replaceAtIndex<T>(items: ReadonlyArray<T>, index: number, next: T): ReadonlyArray<T>
export function replaceAtIndex<T>(items: ReadonlyArray<T>, index: number, next: T): ReadonlyArray<T> {
  if (index < 0 || index >= items.length) return items
  if (Object.is(items[index], next)) return items
  const out = items.slice() as T[]
  out[index] = next
  return out
}

export function patchAtIndex<T>(items: T[], index: number, patch: (cur: T) => T): T[]
export function patchAtIndex<T>(items: ReadonlyArray<T>, index: number, patch: (cur: T) => T): ReadonlyArray<T>
export function patchAtIndex<T>(items: ReadonlyArray<T>, index: number, patch: (cur: T) => T): ReadonlyArray<T> {
  if (index < 0 || index >= items.length) return items
  const cur = items[index]!
  const next = patch(cur)
  return replaceAtIndex(items, index, next)
}

export function findIndexById<T, Id>(
  items: ReadonlyArray<T>,
  id: Id,
  getId: (item: T) => Id,
): number {
  for (let i = 0; i < items.length; i += 1) {
    if (Object.is(getId(items[i]!), id)) return i
  }
  return -1
}

export function patchById<T, Id>(
  items: T[],
  id: Id,
  getId: (item: T) => Id,
  patch: (cur: T) => T,
  hintIndex?: number,
): T[]
export function patchById<T, Id>(
  items: ReadonlyArray<T>,
  id: Id,
  getId: (item: T) => Id,
  patch: (cur: T) => T,
  hintIndex?: number,
): ReadonlyArray<T>
export function patchById<T, Id>(
  items: ReadonlyArray<T>,
  id: Id,
  getId: (item: T) => Id,
  patch: (cur: T) => T,
  hintIndex?: number,
): ReadonlyArray<T> {
  const idx =
    typeof hintIndex === 'number' && hintIndex >= 0 && hintIndex < items.length && Object.is(getId(items[hintIndex]!), id)
      ? hintIndex
      : findIndexById(items, id, getId)
  if (idx < 0) return items
  return patchAtIndex(items, idx, patch)
}
