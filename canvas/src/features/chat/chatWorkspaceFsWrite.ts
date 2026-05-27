import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { ensureWorkspaceFolderTreeIfMissing } from '@/features/workspace-fs/ensureFolderTreeIfMissing'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'

export const ensureWorkspaceFolderPathExists = async (folderPath: string): Promise<string> => {
  const normalized = normalizeWorkspacePath(folderPath)
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  await ensureWorkspaceFolderTreeIfMissing({ fs, folderPath: normalized })
  return normalized
}

export const writeWorkspaceFileTextEnsuringFile = async (args: {
  fs?: Awaited<ReturnType<typeof getWorkspaceFs>>
  path: string
  text: string
}): Promise<void> => {
  const normalized = normalizeWorkspacePath(args.path)
  const fs = args.fs || await getWorkspaceFs()
  const existing = await fs.readFileText(normalized)
  if (existing === null) {
    const idx = normalized.lastIndexOf('/')
    const parentPath = normalizeWorkspacePath(idx > 0 ? normalized.slice(0, idx) : '/')
    const name = normalized.split('/').filter(Boolean).slice(-1)[0] || ''
    if (name) {
      await ensureWorkspaceFolderTreeIfMissing({ fs, folderPath: parentPath })
      try {
        await fs.createFile({ parentPath, name, text: args.text })
        return
      } catch {
        void 0
      }
    }
  }
  await fs.writeFileText(normalized, args.text)
}
