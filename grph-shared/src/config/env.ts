export function readEnvString(key: string, defaultValue: string): string {
  const metaRaw = (() => {
    if (typeof import.meta === 'undefined') return undefined
    const meta = import.meta as unknown as { env?: Record<string, unknown> }
    const env = meta.env
    return env && env[key]
  })()
  if (typeof metaRaw === 'string') {
    const trimmed = metaRaw.trim()
    if (trimmed.length > 0) return trimmed
  }

  const processRaw =
    typeof process !== 'undefined' && process.env ? process.env[key] : undefined
  if (typeof processRaw === 'string') {
    const trimmed = processRaw.trim()
    if (trimmed.length > 0) return trimmed
  }

  return defaultValue
}
