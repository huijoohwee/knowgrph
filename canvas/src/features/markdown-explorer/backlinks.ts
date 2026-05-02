import type { WorkspaceBacklink, WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { workspaceBasename, workspaceStem } from '@/features/workspace-fs/path'

type BacklinkEntryLike = Pick<WorkspaceEntry, 'path' | 'kind' | 'name' | 'text'>

export type WorkspaceBacklinkSourceSummary = {
  sourceDocKey: string
  sourceLabel: string
  count: number
}

function collectBacklinkReferences(args: {
  activePath?: WorkspacePath | null
  targetDocKey?: string | null
}): string[] {
  const rawRefs = [
    String(args.activePath || '').trim(),
    String(args.targetDocKey || '').trim(),
  ].filter(Boolean)
  if (rawRefs.length === 0) return []

  const refs = new Set<string>()
  for (const ref of rawRefs) {
    refs.add(ref)
    const base = workspaceBasename(ref)
    const stem = workspaceStem(ref)
    if (base) refs.add(base)
    if (stem) refs.add(stem)
  }
  return [...refs]
}

export function computeWorkspaceBacklinks(args: {
  activePath?: WorkspacePath | null
  targetDocKey?: string | null
  entries: ReadonlyArray<BacklinkEntryLike>
}): WorkspaceBacklink[] {
  const activePath = String(args.activePath || '').trim()
  const targetDocKey = String(args.targetDocKey || '').trim()
  const references = collectBacklinkReferences({ activePath, targetDocKey })
  if (references.length === 0) return []

  const markdownLinkNeedles = references.map(ref => `](${ref})`)
  const wikiNeedles = references.map(ref => `[[${ref}]]`)
  const out: WorkspaceBacklink[] = []

  for (const entry of args.entries || []) {
    if (!entry || entry.kind !== 'file') continue
    const entryPath = String(entry.path || '').trim()
    const entryName = String(entry.name || '').trim()
    if (activePath && entryPath === activePath) continue
    if (!activePath && targetDocKey && (entryName === targetDocKey || entryPath === targetDocKey)) continue
    const text = String(entry.text ?? '')
    if (!text) continue
    const mightMatch =
      markdownLinkNeedles.some(needle => text.includes(needle))
      || wikiNeedles.some(needle => text.includes(needle))
    if (!mightMatch) continue

    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i += 1) {
      const lineText = lines[i]
      if (!lineText) continue
      if (markdownLinkNeedles.some(needle => lineText.includes(needle))) {
        out.push({ fromPath: entryPath, line: i + 1, lineText })
        continue
      }
      if (wikiNeedles.some(needle => lineText.includes(needle))) {
        out.push({ fromPath: entryPath, line: i + 1, lineText })
      }
    }
  }
  return out
}

export function summarizeWorkspaceBacklinksBySource(backlinks: ReadonlyArray<WorkspaceBacklink>): WorkspaceBacklinkSourceSummary[] {
  const countsBySource = new Map<string, WorkspaceBacklinkSourceSummary>()
  for (const backlink of backlinks || []) {
    const sourceDocKey = String(backlink.fromPath || '').trim()
    if (!sourceDocKey) continue
    const existing = countsBySource.get(sourceDocKey)
    if (existing) {
      existing.count += 1
      continue
    }
    countsBySource.set(sourceDocKey, {
      sourceDocKey,
      sourceLabel: sourceDocKey,
      count: 1,
    })
  }
  return [...countsBySource.values()].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count
    return left.sourceLabel.localeCompare(right.sourceLabel)
  })
}

export function computeBacklinks(args: { activePath: WorkspacePath; entries: WorkspaceEntry[] }): WorkspaceBacklink[] {
  return computeWorkspaceBacklinks({
    activePath: args.activePath,
    entries: args.entries,
  })
}
