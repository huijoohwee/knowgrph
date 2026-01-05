import { UI_COPY } from '@/lib/config'

export const buildInvalidJsonError = (message: string): string => `${UI_COPY.invalidJsonPrefix}${message}`

export type SerializationParseResult = {
  value: unknown
  error: string
}

export const parseJsonOrError = (raw: string): SerializationParseResult => {
  const text = raw.trim()
  if (!text) return { value: {}, error: '' }
  try {
    return { value: JSON.parse(text), error: '' }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { value: {}, error: buildInvalidJsonError(msg) }
  }
}
