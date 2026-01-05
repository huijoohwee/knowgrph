export const normalized = (v: unknown) => String(v ?? '').toLowerCase()

export const safeStringify = (v: unknown) => {
  try {
    return JSON.stringify(v ?? {})
  } catch {
    return ''
  }
}
