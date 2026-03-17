export type NodeSort = { key: 'id' | 'label' | 'type' | 'properties'; dir: 'asc' | 'desc' } | null
export type EdgeSort = { key: 'id' | 'source' | 'target' | 'label' | 'properties'; dir: 'asc' | 'desc' } | null

export const sortBy = <T,>(items: T[], selector: (item: T) => string, dir: 'asc' | 'desc') => {
  const arr = items.slice()
  arr.sort((a, b) => {
    const av = selector(a)
    const bv = selector(b)
    if (av < bv) return dir === 'asc' ? -1 : 1
    if (av > bv) return dir === 'asc' ? 1 : -1
    return 0
  })
  return arr
}

export const nextToggleNodeSort = (
  prev: NodeSort,
  key: 'id' | 'label' | 'type' | 'properties'
): NodeSort => {
  if (!prev || prev.key !== key) return { key, dir: 'asc' }
  return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
}

export const nextToggleEdgeSort = (
  prev: EdgeSort,
  key: 'id' | 'source' | 'target' | 'label' | 'properties'
): EdgeSort => {
  if (!prev || prev.key !== key) return { key, dir: 'asc' }
  return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
}

