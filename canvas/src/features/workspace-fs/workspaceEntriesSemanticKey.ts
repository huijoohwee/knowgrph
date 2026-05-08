import type { WorkspaceEntry } from '@/features/workspace-fs/types'
import { hashStringToHex } from '@/lib/hash/stringHash'

export function buildWorkspaceEntriesSemanticKey(args: {
  entries: ReadonlyArray<WorkspaceEntry>
  docsOnly?: boolean
}): string {
  const docsOnly = args.docsOnly === true
  const rows: string[] = []
  const entries = Array.isArray(args.entries) ? args.entries : []
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]
    if (!entry || entry.kind !== 'file') continue
    const path = String(entry.path || '').trim()
    if (!path) continue
    if (docsOnly && !path.startsWith('/docs/')) continue
    const text = typeof entry.text === 'string' ? entry.text : ''
    rows.push(`${path}:${hashStringToHex(text)}`)
  }
  rows.sort()
  return rows.join('|')
}
