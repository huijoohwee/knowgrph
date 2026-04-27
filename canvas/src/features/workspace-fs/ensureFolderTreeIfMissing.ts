import { getWorkspaceFs } from './workspaceFs'
import { normalizeWorkspacePath } from './path'
import type { WorkspaceFs, WorkspacePath } from './types'

export async function ensureWorkspaceFolderTreeIfMissing(args: {
  folderPath: WorkspacePath
  fs?: WorkspaceFs
}): Promise<void> {
  const normalized = normalizeWorkspacePath(args.folderPath)
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 0) return
  const fs = args.fs ?? (await getWorkspaceFs())
  await fs.ensureSeed()
  const list = await fs.listEntries()
  const folders = new Set(
    list
      .filter(entry => entry.kind === 'folder')
      .map(entry => normalizeWorkspacePath(entry.path)),
  )
  let parent: WorkspacePath = '/'
  for (const rawSegment of segments) {
    const name = String(rawSegment || '').trim()
    if (!name) continue
    const next = normalizeWorkspacePath(`${parent === '/' ? '' : parent}/${name}`)
    if (!folders.has(next)) {
      try {
        await fs.createFolder({ parentPath: parent, name })
        folders.add(next)
      } catch {
        void 0
      }
    }
    parent = next
  }
}
