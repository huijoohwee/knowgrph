export function deepClone<T>(value: T): T {
  const anyGlobal = globalThis as unknown as { structuredClone?: unknown }
  const sc = anyGlobal.structuredClone
  if (typeof sc === 'function') {
    try {
      return (sc as (v: unknown) => unknown)(value) as T
    } catch {
      void 0
    }
  }

  return JSON.parse(JSON.stringify(value)) as T
}

