export const safeJsonStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? null, null, 2)
  } catch {
    return 'null'
  }
}

export const tryParseJson = (text: string): { ok: true; value: unknown } | { ok: false; error: string } => {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON'
    return { ok: false, error: message }
  }
}

export const coerceJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

