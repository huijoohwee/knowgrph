const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const normalizeParentPath = (raw: string | null | undefined): string => {
  const trimmed = String(raw || '').trim().replace(/\\/g, '/')
  return trimmed.replace(/^\/+/, '').replace(/\/+$/, '')
}

export const findNextSourceFileIndex = (names: string[], parentPath: string): number => {
  let max = 0
  const prefix = normalizeParentPath(parentPath)
  const re = prefix
    ? new RegExp(`^${escapeRegex(prefix)}/source-(\\d+)\\.md$`, 'i')
    : /^source-(\d+)\.md$/i
  for (const name of names) {
    const match = re.exec(String(name || '').trim())
    if (!match) continue
    const n = Number(match[1])
    if (!Number.isFinite(n)) continue
    max = Math.max(max, Math.floor(n))
  }
  return Math.max(1, max + 1)
}

