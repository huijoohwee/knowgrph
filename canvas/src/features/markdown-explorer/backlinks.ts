import type { WorkspaceBacklink, WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { workspaceBasename, workspaceStem } from '@/features/workspace-fs/path'

export function computeBacklinks(args: { activePath: WorkspacePath; entries: WorkspaceEntry[] }): WorkspaceBacklink[] {
  const activePath = String(args.activePath || '').trim()
  if (!activePath) return []
  const base = workspaceBasename(activePath)
  const stem = workspaceStem(activePath)

  const mdLinkNeedle = `](${activePath})`
  const wikiNeedles = [
    stem ? `[[${stem}]]` : null,
    base ? `[[${base}]]` : null,
    activePath ? `[[${activePath}]]` : null,
  ].filter(Boolean) as string[]

  const out: WorkspaceBacklink[] = []
  for (const entry of args.entries || []) {
    if (!entry || entry.kind !== 'file') continue
    if (entry.path === activePath) continue
    const text = String(entry.text ?? '')
    if (!text) continue
    const mightMatch =
      (mdLinkNeedle && text.includes(mdLinkNeedle)) ||
      (wikiNeedles.length > 0 && wikiNeedles.some(n => text.includes(n)))
    if (!mightMatch) continue

    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i += 1) {
      const lineText = lines[i]
      if (!lineText) continue
      if (mdLinkNeedle && lineText.includes(mdLinkNeedle)) {
        out.push({ fromPath: entry.path, line: i + 1, lineText })
        continue
      }
      if (wikiNeedles.some(n => lineText.includes(n))) {
        out.push({ fromPath: entry.path, line: i + 1, lineText })
      }
    }
  }
  return out
}
