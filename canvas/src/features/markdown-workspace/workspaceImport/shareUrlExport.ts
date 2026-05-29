import type { WorkspaceFs } from '@/features/workspace-fs/types'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { ensureChatWorkspaceMirrorFolder, mirrorChatWorkspaceFileToHost } from '@/features/chat/chatWorkspaceMirror'
import { resolveShareUrlArtifactPaths, isShareUrlArtifactEligible } from '@/features/chat/shareUrlArtifacts'
import { writeWorkspaceFileTextEnsuringFile } from '@/features/chat/chatWorkspaceFsWrite'
import { readWorkspaceImportShareExportRootPathSetting } from '@/lib/workspace/workspaceStoreSyncSettings'
import { restoreWebpageMarkdownSyntaxFidelity } from '@/lib/markdown/webpageMarkdownSyntaxFidelity'

export const persistImportedShareUrlArtifacts = async (args: {
  fs: WorkspaceFs
  url: string
  importedName: string
  importedTitle?: string
  importedText: string
  importedThinkingText?: string
  importedWorkspacePath: string
  rootFolderPath?: string
}): Promise<null | {
  exportToken: string
  exportFolderPath: string
  exportMarkdownPath: string
  exportThinkingPath: string
}> => {
  const url = String(args.url || '').trim()
  if (!isShareUrlArtifactEligible(url)) return null
  const rootFolderPath = String(args.rootFolderPath || '').trim() || readWorkspaceImportShareExportRootPathSetting()
  const {
    exportToken,
    exportFolderPath,
    exportMarkdownPath,
    exportThinkingPath,
  } = resolveShareUrlArtifactPaths({
    rootFolderPath,
    url,
    importedName: args.importedName,
    importedTitle: args.importedTitle,
    importedText: args.importedText,
  })
  const importedText = String(args.importedText || '').trimEnd() + '\n'
  const importedThinkingText = restoreWebpageMarkdownSyntaxFidelity(
    String(args.importedThinkingText || '').replace(/\r\n/g, '\n'),
  ).trim()
  const thinkingBody = importedThinkingText
  const thinkingText = thinkingBody ? `${thinkingBody}\n` : ''
  const importedWorkspacePath = normalizeWorkspacePath(args.importedWorkspacePath)
  if (importedWorkspacePath !== exportMarkdownPath) {
    await writeWorkspaceFileTextEnsuringFile({
      fs: args.fs,
      path: exportMarkdownPath,
      text: importedText,
    })
  }
  await writeWorkspaceFileTextEnsuringFile({
    fs: args.fs,
    path: exportThinkingPath,
    text: thinkingText,
  })
  await ensureChatWorkspaceMirrorFolder(exportFolderPath)
  await mirrorChatWorkspaceFileToHost({
    workspacePath: exportMarkdownPath,
    text: importedText,
  })
  await mirrorChatWorkspaceFileToHost({
    workspacePath: exportThinkingPath,
    text: thinkingText,
  })
  return {
    exportToken,
    exportFolderPath,
    exportMarkdownPath,
    exportThinkingPath,
  }
}

export const resolveImportedShareUrlPrimaryWorkspacePath = (args: {
  url: string
  importedName: string
  importedTitle?: string
  importedText?: string
  rootFolderPath?: string
}): string | null => {
  const url = String(args.url || '').trim()
  if (!isShareUrlArtifactEligible(url)) return null
  const rootFolderPath = String(args.rootFolderPath || '').trim() || readWorkspaceImportShareExportRootPathSetting()
  return resolveShareUrlArtifactPaths({
    rootFolderPath,
    url,
    importedName: args.importedName,
    importedTitle: args.importedTitle,
    importedText: args.importedText,
  }).exportMarkdownPath
}
