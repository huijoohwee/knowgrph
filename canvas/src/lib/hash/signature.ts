import { hashString32, hashStringToHex } from '@/lib/hash/stringHash'
import { isPlainObject } from '@/lib/graph/value'

type SignaturePrimitive = string | number | boolean | null | undefined

const readPlainObject = (value: unknown): Record<string, unknown> | null => {
  return isPlainObject(value) ? (value as Record<string, unknown>) : null
}

const normalizePrimitive = (value: SignaturePrimitive): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  return String(value)
}

export const buildSignatureText = (parts: SignaturePrimitive[]): string => {
  return parts.map(normalizePrimitive).join('|')
}

export const hashSignatureParts = (parts: SignaturePrimitive[]): string => {
  return hashStringToHex(buildSignatureText(parts))
}

export const hashSignatureParts32 = (parts: SignaturePrimitive[]): number => {
  return hashString32(buildSignatureText(parts))
}

export const normalizeStringArrayForSignature = (
  value: unknown,
  options?: {
    unique?: boolean
    sort?: boolean
  },
): string[] => {
  const raw = Array.isArray(value) ? value : []
  const normalized = raw.map(v => String(v ?? '').trim()).filter(Boolean)
  if (normalized.length === 0) return []
  const unique = options?.unique === true ? Array.from(new Set(normalized)) : normalized
  if (options?.sort === true) unique.sort((left, right) => left.localeCompare(right))
  return unique
}

export const hashScopedStringArraySignature = (
  scope: SignaturePrimitive,
  value: unknown,
  options?: {
    unique?: boolean
    sort?: boolean
  },
): string => {
  return hashSignatureParts([scope, ...normalizeStringArrayForSignature(value, options)])
}

export const hashStringArraySignature = (
  value: unknown,
  options?: {
    maxSamples?: number
    includeTail?: boolean
  },
): string => {
  const raw = Array.isArray(value) ? value : []
  const items = raw.map(v => String(v ?? ''))
  const maxSamples = Math.max(0, Math.floor(options?.maxSamples ?? 40))
  const includeTail = options?.includeTail !== false

  if (items.length === 0) return hashSignatureParts(['len', 0])
  if (maxSamples === 0) return hashSignatureParts(['len', items.length])

  const head = items.slice(0, maxSamples)
  const tail =
    includeTail && items.length > maxSamples ? items.slice(Math.max(0, items.length - maxSamples)) : []
  return hashSignatureParts(['len', items.length, 'head', ...head, 'tail', ...tail])
}

export const hashStringArraySignature32 = (
  value: unknown,
  options?: {
    maxSamples?: number
    includeTail?: boolean
  },
): number => {
  const raw = Array.isArray(value) ? value : []
  const items = raw.map(v => String(v ?? ''))
  const maxSamples = Math.max(0, Math.floor(options?.maxSamples ?? 40))
  const includeTail = options?.includeTail !== false

  if (items.length === 0) return hashSignatureParts32(['len', 0])
  if (maxSamples === 0) return hashSignatureParts32(['len', items.length])

  const head = items.slice(0, maxSamples)
  const tail =
    includeTail && items.length > maxSamples ? items.slice(Math.max(0, items.length - maxSamples)) : []
  return hashSignatureParts32(['len', items.length, 'head', ...head, 'tail', ...tail])
}

const normalizeObjectValue = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (Array.isArray(value)) return `arr:${value.length}:${hashStringArraySignature(value, { maxSamples: 12 })}`
  if (typeof value === 'object') return 'obj'
  return String(value)
}

const normalizeObjectValueFor32 = (value: unknown, depth: number): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (Array.isArray(value)) return `arr:${value.length}:${hashStringArraySignature32(value, { maxSamples: 12 })}`
  if (typeof value !== 'object') return String(value)
  if (depth <= 0) {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
    return `obj:${keys.length}`
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort().slice(0, 8)
  const parts: SignaturePrimitive[] = ['obj', Object.keys(obj).length]
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i]
    parts.push(key, normalizeObjectValueFor32(obj[key], depth - 1))
  }
  return `objh:${hashSignatureParts32(parts)}`
}

export const hashRecordSignature = (
  value: unknown,
  options?: {
    maxEntries?: number
  },
): string => {
  const obj = readPlainObject(value)
  if (!obj) return hashSignatureParts(['count', 0])

  const maxEntries = Math.max(0, Math.floor(options?.maxEntries ?? 60))
  const keys = Object.keys(obj)
  if (keys.length === 0) return hashSignatureParts(['count', 0])

  keys.sort()
  const sampled = keys.slice(0, maxEntries)
  const parts: SignaturePrimitive[] = ['count', keys.length]
  for (let i = 0; i < sampled.length; i += 1) {
    const key = sampled[i]
    parts.push(key, normalizeObjectValue(obj[key]))
  }
  return hashSignatureParts(parts)
}

export const hashRecordSignature32 = (
  value: unknown,
  options?: {
    maxEntries?: number
    maxDepth?: number
  },
): number => {
  const obj = readPlainObject(value)
  if (!obj) return hashSignatureParts32(['count', 0])

  const maxEntries = Math.max(0, Math.floor(options?.maxEntries ?? 80))
  const maxDepth = Math.max(0, Math.floor(options?.maxDepth ?? 1))
  const keys = Object.keys(obj)
  if (keys.length === 0) return hashSignatureParts32(['count', 0])

  keys.sort()
  const sampled = keys.slice(0, maxEntries)
  const parts: SignaturePrimitive[] = ['count', keys.length]
  for (let i = 0; i < sampled.length; i += 1) {
    const key = sampled[i]
    parts.push(key, normalizeObjectValueFor32(obj[key], maxDepth))
  }
  return hashSignatureParts32(parts)
}

export const hashArrayOfObjectsSignature = (
  value: unknown,
  options?: {
    maxItems?: number
    maxKeysPerItem?: number
  },
): string => {
  const raw = Array.isArray(value) ? value : []
  const maxItems = Math.max(0, Math.floor(options?.maxItems ?? 30))
  const maxKeysPerItem = Math.max(0, Math.floor(options?.maxKeysPerItem ?? 10))

  if (raw.length === 0) return hashSignatureParts(['len', 0])

  const parts: SignaturePrimitive[] = ['len', raw.length]
  const sliced = raw.slice(0, maxItems)
  for (let i = 0; i < sliced.length; i += 1) {
    const item = sliced[i]
    const obj = readPlainObject(item)
    if (!obj) {
      parts.push(String(item ?? ''))
      continue
    }
    const keys = Object.keys(obj).sort().slice(0, maxKeysPerItem)
    for (let k = 0; k < keys.length; k += 1) {
      const key = keys[k]
      parts.push(key, normalizeObjectValue(obj[key]))
    }
    parts.push(';')
  }
  return hashSignatureParts(parts)
}

export const hashArrayOfObjectsSignature32 = (
  value: unknown,
  options?: {
    maxItems?: number
    maxKeysPerItem?: number
    maxDepth?: number
  },
): number => {
  const raw = Array.isArray(value) ? value : []
  const maxItems = Math.max(0, Math.floor(options?.maxItems ?? 30))
  const maxKeysPerItem = Math.max(0, Math.floor(options?.maxKeysPerItem ?? 10))
  const maxDepth = Math.max(0, Math.floor(options?.maxDepth ?? 1))

  if (raw.length === 0) return hashSignatureParts32(['len', 0])

  const parts: SignaturePrimitive[] = ['len', raw.length]
  const sliced = raw.slice(0, maxItems)
  for (let i = 0; i < sliced.length; i += 1) {
    const item = sliced[i]
    const obj = readPlainObject(item)
    if (!obj) {
      parts.push(String(item ?? ''))
      continue
    }
    const keys = Object.keys(obj).sort().slice(0, maxKeysPerItem)
    for (let k = 0; k < keys.length; k += 1) {
      const key = keys[k]
      parts.push(key, normalizeObjectValueFor32(obj[key], maxDepth))
    }
    parts.push(';')
  }
  return hashSignatureParts32(parts)
}
