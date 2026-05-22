import { hashText } from '@/features/parsers/hash'

const schemaPreviewHashCache = new WeakMap<object, string>()

export const hashSchemaForPreviewSync = (schema: unknown): string => {
  if (!schema || typeof schema !== 'object') return ''
  const key = schema as object
  const cached = schemaPreviewHashCache.get(key)
  if (cached) return cached
  let hashed = ''
  try {
    hashed = hashText(JSON.stringify(schema))
  } catch {
    hashed = ''
  }
  if (hashed) schemaPreviewHashCache.set(key, hashed)
  return hashed
}
