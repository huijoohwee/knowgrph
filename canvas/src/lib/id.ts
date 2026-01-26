export function createId(prefix: string): string {
  const safePrefix = String(prefix || '').trim() || 'id'
  try {
    const anyCrypto = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined
    const uuid = anyCrypto?.randomUUID?.()
    if (uuid) return `${safePrefix}-${uuid}`
  } catch {
    void 0
  }
  return `${safePrefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
