import type { JSONValue } from '@/lib/graph/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function isJsonValue(value: unknown, depth: number = 0): value is JSONValue {
  if (depth > 20) return false
  if (value === null) return true
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.every(v => isJsonValue(v, depth + 1))
  if (!isRecord(value)) return false
  for (const v of Object.values(value)) {
    if (!isJsonValue(v, depth + 1)) return false
  }
  return true
}

