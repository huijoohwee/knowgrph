export class LRUCache<K, V> {
  private maxSize: number
  private ttlMs?: number
  private map: Map<K, { value: V; expiresAt?: number }>

  constructor(maxSize: number = 200, ttlMs?: number) {
    this.maxSize = maxSize
    this.ttlMs = ttlMs
    this.map = new Map()
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key)
    if (!entry) return undefined

    if (entry.expiresAt != null && Date.now() > entry.expiresAt) {
      this.map.delete(key)
      return undefined
    }

    this.map.delete(key)
    this.map.set(key, entry)
    return entry.value
  }

  set(key: K, value: V) {
    if (this.map.has(key)) this.map.delete(key)

    const expiresAt = this.ttlMs != null ? Date.now() + this.ttlMs : undefined
    this.map.set(key, { value, expiresAt })

    while (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      this.map.delete(oldest)
    }
  }

  delete(key: K) {
    this.map.delete(key)
  }

  clear() {
    this.map.clear()
  }

  deleteWhere(predicate: (args: { key: K; value: V }) => boolean) {
    const entries = Array.from(this.map.entries())
    for (const [key, entry] of entries) {
      if (predicate({ key, value: entry.value })) this.map.delete(key)
    }
  }
}

