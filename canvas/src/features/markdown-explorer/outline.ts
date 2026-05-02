import type { WorkspaceOutlineItem } from '@/features/workspace-fs/types'
import { slugify } from 'grph-shared/markdown/slugify'

export function computeMarkdownOutline(text: string): WorkspaceOutlineItem[] {
  const lines = String(text ?? '').split(/\r?\n/)
  let inFence = false
  const out: WorkspaceOutlineItem[] = []
  const usedHeadingIds = new Set<string>()
  const headingIdCounters = new Map<string, number>()
  const allocateUniqueHeadingId = (raw: string): string => {
    const base = String(raw || '').trim()
    if (!base) return ''
    if (!usedHeadingIds.has(base)) {
      usedHeadingIds.add(base)
      return base
    }
    let n = headingIdCounters.get(base) || 1
    for (;;) {
      const candidate = `${base}-${n}`
      if (!usedHeadingIds.has(candidate)) {
        headingIdCounters.set(base, n + 1)
        usedHeadingIds.add(candidate)
        return candidate
      }
      n += 1
    }
  }
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line)
    if (!m) continue
    const level = m[1].length
    const text = m[2]
    const slug = slugify(text) || `h${level}`
    out.push({ id: allocateUniqueHeadingId(slug), text, level, line: i + 1 })
  }
  return out
}
