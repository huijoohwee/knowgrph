type Entry<V> = { value: V; expiresAt: number | null }

export class LRUCache<K, V> {
  private maxSize: number
  private ttlMs: number | null
  private map: Map<K, Entry<V>>

  constructor(maxSize = 200, ttlMs: number | null = null) {
    this.maxSize = Math.max(1, maxSize)
    this.ttlMs = ttlMs && ttlMs > 0 ? ttlMs : null
    this.map = new Map()
  }

  get(key: K): V | undefined {
    const e = this.map.get(key)
    if (!e) return undefined
    if (e.expiresAt && e.expiresAt <= Date.now()) {
      this.map.delete(key)
      return undefined
    }
    this.map.delete(key)
    this.map.set(key, e)
    return e.value
  }

  set(key: K, value: V) {
    const expiresAt = this.ttlMs ? Date.now() + this.ttlMs : null
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, { value, expiresAt })
    if (this.map.size > this.maxSize) {
      const firstKey = this.map.keys().next().value as K
      this.map.delete(firstKey)
    }
  }

  delete(key: K) {
    this.map.delete(key)
  }

  clear() {
    this.map.clear()
  }

  deleteWhere(predicate: (key: K) => boolean) {
    const keys: K[] = []
    for (const k of this.map.keys()) keys.push(k)
    for (const k of keys) { if (predicate(k)) this.map.delete(k) }
  }
}
