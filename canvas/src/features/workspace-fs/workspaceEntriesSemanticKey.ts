import type { WorkspaceEntry } from '@/features/workspace-fs/types'
import { isWorkspacePathUnderSourceRoots } from '@/features/workspace-fs/workspaceSourceRoots'
import { hashStringToHex } from '@/lib/hash/stringHash'

export function buildWorkspaceEntriesSemanticKey(args: {
  entries: ReadonlyArray<WorkspaceEntry>
  docsOnly?: boolean
  forceIncludePaths?: ReadonlyArray<string>
  forceIncludeOnly?: boolean
  workspaceSourceRootPaths?: ReadonlyArray<string>
}): string {
  const docsOnly = args.docsOnly === true
  const forceInclude = new Set(
    (Array.isArray(args.forceIncludePaths) ? args.forceIncludePaths : [])
      .map(path => String(path || '').trim())
      .filter(Boolean),
  )
  const forceIncludeOnly = args.forceIncludeOnly === true && forceInclude.size > 0
  const rows: string[] = []
  const entries = Array.isArray(args.entries) ? args.entries : []
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]
    if (!entry || entry.kind !== 'file') continue
    const path = String(entry.path || '').trim()
    if (!path) continue
    if (forceIncludeOnly && !forceInclude.has(path)) continue
    if (docsOnly && !isWorkspacePathUnderSourceRoots(path, args.workspaceSourceRootPaths)) continue
    const text = typeof entry.text === 'string' ? entry.text : ''
    rows.push(`${path}:${hashStringToHex(text)}`)
  }
  rows.sort()
  return rows.join('|')
}
