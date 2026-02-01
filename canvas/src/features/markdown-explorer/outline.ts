import type { WorkspaceOutlineItem } from '@/features/workspace-fs/types'

const slugify = (s: string) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

export function computeMarkdownOutline(text: string): WorkspaceOutlineItem[] {
  const lines = String(text ?? '').split(/\r?\n/)
  let inFence = false
  const out: WorkspaceOutlineItem[] = []
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
    const slug = slugify(text)
    out.push({ id: `${slug || 'h'}-${i + 1}`, text, level, line: i + 1 })
  }
  return out
}
