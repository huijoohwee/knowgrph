import { WORKSPACE_ROOT_PATH, normalizeWorkspacePath } from '@/features/workspace-fs/path'
import type { WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'

export async function ensureFolderRel(fs: WorkspaceFs, parentPath: WorkspacePath, relDir: string): Promise<WorkspacePath> {
  const raw = String(relDir || '').replace(/\\/g, '/').replace(/^\/+/, '').trim()
  if (!raw) return parentPath
  const segments = raw.split('/').filter(Boolean)
  let parent = parentPath
  for (const seg of segments) {
    const name = String(seg || '').trim()
    if (!name) continue
    try {
      await fs.createFolder({ parentPath: parent, name })
    } catch {
      void 0
    }
    parent = normalizeWorkspacePath(`${parent}/${name}`)
  }
  return parent
}

export async function ensureWorkspaceFolderRel(fs: WorkspaceFs, relDir: string): Promise<WorkspacePath> {
  return ensureFolderRel(fs, WORKSPACE_ROOT_PATH, relDir)
}
