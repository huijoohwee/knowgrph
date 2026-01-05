import { LRUCache } from '@/lib/cache/LRUCache'

export const testLRUCacheBasic = () => {
  const c = new LRUCache<string, number>(2)
  c.set('a', 1)
  c.set('b', 2)
  if (c.get('a') !== 1) throw new Error('LRU get failed')
  c.set('c', 3)
  if (c.get('b') !== undefined) throw new Error('LRU eviction order failed')
}

export const testLRUCacheClear = () => {
  const c = new LRUCache<string, number>(10)
  c.set('x', 42)
  c.clear()
  if (c.get('x') !== undefined) throw new Error('Clear failed')
}
