export class MemoryStorage implements Storage {
  private store: Record<string, string> = {}

  get length(): number {
    return Object.keys(this.store).length
  }

  clear(): void {
    this.store = {}
  }

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store)
    return index >= 0 && index < keys.length ? keys[index] : null
  }

  removeItem(key: string): void {
    delete this.store[key]
  }

  setItem(key: string, value: string): void {
    this.store[key] = value
  }
}

export const createMemoryStorage = (initial?: Record<string, string>): Storage => {
  const storage = new MemoryStorage()
  if (initial) {
    for (const [key, value] of Object.entries(initial)) {
      storage.setItem(key, value)
    }
  }
  return storage
}

