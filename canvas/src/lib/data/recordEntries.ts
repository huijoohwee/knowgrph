import { isPlainObject } from '@/lib/graph/value'

export type RecordEntry = { key: string; value: Record<string, unknown> }

export function coerceRecordEntries(raw: unknown): RecordEntry[] {
  if (Array.isArray(raw)) {
    const out: RecordEntry[] = []
    for (let i = 0; i < raw.length; i += 1) {
      const v = raw[i]
      if (!isPlainObject(v)) continue
      out.push({ key: String(i), value: v })
    }
    return out
  }
  if (isPlainObject(raw)) {
    const out: RecordEntry[] = []
    for (const [k, v] of Object.entries(raw)) {
      if (!isPlainObject(v)) continue
      out.push({ key: k, value: v })
    }
    return out
  }
  return []
}

