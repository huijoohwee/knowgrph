import type { WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { ensureWorkspaceFolderTreeIfMissing } from '@/features/workspace-fs/ensureFolderTreeIfMissing'
import { ensureMarkdownFileName } from '@/features/workspace-fs/upsertWorkspaceTextDocument'
import { ensureWorkspaceDocsMirrorFolder, upsertWorkspaceDocsMirrorText } from '@/features/workspace-fs/workspaceSeedProvider'
import { readWorkspaceImportShareExportRootPathSetting } from '@/lib/workspace/workspaceStoreSyncSettings'
import { readWorkspaceImportMarkdownSourceUrl, workspaceImportSourceUrlsMatch } from './sourceUrlIdentity'

const hasWebpageSourceFrontmatter = (text: string): boolean =>
  !!readWorkspaceImportMarkdownSourceUrl(text)

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(String(value || '').trim())

const readParentPath = (path: string): WorkspacePath => {
  const normalized = normalizeWorkspacePath(path)
  const idx = normalized.lastIndexOf('/')
  return idx > 0 ? normalizeWorkspacePath(normalized.slice(0, idx)) : '/'
}

export const isImportedWebpageUrlArtifactEligible = (args: {
  url: string
  importedName: string
  importedText: string
}): boolean => {
  if (!isHttpUrl(args.url)) return false
  if (!/\.(?:md|markdown|mdx|mmd)$/i.test(ensureMarkdownFileName(args.importedName))) return false
  return hasWebpageSourceFrontmatter(args.importedText)
}

export const persistImportedWebpageUrlArtifact = async (args: {
  fs: WorkspaceFs
  url: string
  importedName: string
  importedText: string
  rootFolderPath?: string
}): Promise<null | { exportMarkdownPath: string }> => {
  if (!isImportedWebpageUrlArtifactEligible(args)) return null
  const rootFolderPath = normalizeWorkspacePath(
    String(args.rootFolderPath || '').trim() || readWorkspaceImportShareExportRootPathSetting(),
  )
  if (!rootFolderPath || rootFolderPath === '/') return null

  const importedText = String(args.importedText || '').trimEnd() + '\n'
  const fileName = ensureMarkdownFileName(args.importedName)
  const primaryPath = normalizeWorkspacePath(`${rootFolderPath}/${fileName}`)
  const existing = await args.fs.readFileText(primaryPath)
  let exportMarkdownPath = primaryPath

  if (existing !== null) {
    const existingSourceUrl = readWorkspaceImportMarkdownSourceUrl(existing)
    if (!existingSourceUrl || !workspaceImportSourceUrlsMatch(args.url, existingSourceUrl)) {
      await ensureWorkspaceFolderTreeIfMissing({ fs: args.fs, folderPath: rootFolderPath })
      exportMarkdownPath = await args.fs.createFile({
        parentPath: rootFolderPath,
        name: fileName,
        text: importedText,
      })
    }
  }

  if (exportMarkdownPath === primaryPath) {
    await ensureWorkspaceFolderTreeIfMissing({ fs: args.fs, folderPath: readParentPath(exportMarkdownPath) })
    if (existing === null) {
      exportMarkdownPath = await args.fs.createFile({ parentPath: rootFolderPath, name: fileName, text: importedText })
    } else {
      await args.fs.writeFileText(exportMarkdownPath, importedText)
    }
  }

  await ensureWorkspaceDocsMirrorFolder({ workspacePath: readParentPath(exportMarkdownPath) })
  await upsertWorkspaceDocsMirrorText({ workspacePath: exportMarkdownPath, text: importedText })
  return { exportMarkdownPath: normalizeWorkspacePath(exportMarkdownPath) }
}
