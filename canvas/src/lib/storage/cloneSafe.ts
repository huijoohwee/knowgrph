const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export const toCloneSafeValue = (
  value: unknown,
  seen: WeakSet<object> = new WeakSet<object>(),
): unknown => {
  if (value == null) return null
  const kind = typeof value
  if (kind === 'string' || kind === 'boolean') return value
  if (kind === 'number') return Number.isFinite(value) ? value : null
  if (kind === 'bigint') {
    const num = Number(value)
    return Number.isFinite(num) ? num : String(value)
  }
  if (kind === 'function' || kind === 'symbol' || kind === 'undefined') return undefined
  if (kind !== 'object') return undefined

  const obj = value as object
  if (seen.has(obj)) return null
  seen.add(obj)

  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null
  if (Array.isArray(value)) {
    const out = value.map(item => {
      const next = toCloneSafeValue(item, seen)
      return next === undefined ? null : next
    })
    return out
  }
  if (ArrayBuffer.isView(value)) return Array.from(value as unknown as ArrayLike<number>)
  if (value instanceof ArrayBuffer) return Array.from(new Uint8Array(value))

  if (!isPlainObject(value)) {
    try {
      const json = (value as { toJSON?: () => unknown }).toJSON?.()
      return toCloneSafeValue(json, seen)
    } catch {
      return null
    }
  }

  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    const next = toCloneSafeValue(v, seen)
    if (next === undefined) continue
    out[k] = next
  }
  return out
}

export const toCloneSafeObject = (
  value: unknown,
  fallback: Record<string, unknown> = {},
): Record<string, unknown> => {
  const next = toCloneSafeValue(value)
  if (!next || typeof next !== 'object' || Array.isArray(next)) return { ...fallback }
  return next as Record<string, unknown>
}

export const toCloneSafeObjectOrNull = (value: unknown): Record<string, unknown> | null => {
  if (value == null) return null
  const next = toCloneSafeValue(value)
  if (!next || typeof next !== 'object' || Array.isArray(next)) return null
  return next as Record<string, unknown>
}

