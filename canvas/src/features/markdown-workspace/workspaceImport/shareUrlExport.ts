import type { WorkspaceFs } from '@/features/workspace-fs/types'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { ensureChatWorkspaceMirrorFolder, mirrorChatWorkspaceFileToHost } from '@/features/chat/chatWorkspaceMirror'
import { buildShareUrlArtifactConflictExportToken, resolveShareUrlArtifactPaths, isShareUrlArtifactEligible } from '@/features/chat/shareUrlArtifacts'
import { writeWorkspaceFileTextEnsuringFile } from '@/features/chat/chatWorkspaceFsWrite'
import { setWorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import { readWorkspaceImportShareExportRootPathSetting } from '@/lib/workspace/workspaceStoreSyncSettings'
import { restoreWebpageMarkdownSyntaxFidelity } from '@/lib/markdown/webpageMarkdownSyntaxFidelity'
import { hashSignatureParts } from '@/lib/hash/signature'
import { readWorkspaceImportMarkdownSourceUrl, workspaceImportSourceUrlsMatch } from './sourceUrlIdentity'

const normalizeImportedShareThinkingText = (text: string | undefined): string =>
  restoreWebpageMarkdownSyntaxFidelity(String(text || '').replace(/\r\n/g, '\n')).trim()

const buildImportedShareThinkingFileText = (text: string | undefined): string => {
  const body = normalizeImportedShareThinkingText(text)
  return body ? `${body}\n` : ''
}

type ImportedShareUrlArtifactPaths = ReturnType<typeof resolveShareUrlArtifactPaths>

const resolveImportedShareUrlArtifactPathsForWriteInternal = async (args: {
  fs: WorkspaceFs
  rootFolderPath: string
  url: string
  importedName: string
  importedTitle?: string
  importedText: string
  currentWritePath?: string
}): Promise<ImportedShareUrlArtifactPaths> => {
  const primary = resolveShareUrlArtifactPaths({
    rootFolderPath: args.rootFolderPath,
    url: args.url,
    importedName: args.importedName,
    importedTitle: args.importedTitle,
    importedText: args.importedText,
  })
  const existing = await args.fs.readFileText(primary.exportMarkdownPath)
  if (existing == null) return primary
  if (args.currentWritePath && normalizeWorkspacePath(args.currentWritePath) === primary.exportMarkdownPath) return primary
  const existingSourceUrl = readWorkspaceImportMarkdownSourceUrl(existing)
  if (existingSourceUrl && workspaceImportSourceUrlsMatch(args.url, existingSourceUrl)) return primary

  const baseConflictToken = buildShareUrlArtifactConflictExportToken(primary.exportToken, args.url)
  for (let index = 0; index < 20; index += 1) {
    const exportTokenOverride = index === 0
      ? (baseConflictToken === primary.exportToken ? `${baseConflictToken}-source` : baseConflictToken)
      : `${baseConflictToken}-${index + 1}`
    const candidate = resolveShareUrlArtifactPaths({
      rootFolderPath: args.rootFolderPath,
      url: args.url,
      importedName: args.importedName,
      importedTitle: args.importedTitle,
      importedText: args.importedText,
      exportTokenOverride,
    })
    const candidateExisting = await args.fs.readFileText(candidate.exportMarkdownPath)
    if (candidateExisting == null) return candidate
    const candidateSourceUrl = readWorkspaceImportMarkdownSourceUrl(candidateExisting)
    if (candidateSourceUrl && workspaceImportSourceUrlsMatch(args.url, candidateSourceUrl)) return candidate
  }
  return resolveShareUrlArtifactPaths({
    rootFolderPath: args.rootFolderPath,
    url: args.url,
    importedName: args.importedName,
    importedTitle: args.importedTitle,
    importedText: args.importedText,
    exportTokenOverride: `${baseConflictToken}-${hashSignatureParts([args.url]).slice(0, 12)}`,
  })
}

export const resolveImportedShareUrlArtifactPathsForWrite = async (args: {
  fs: WorkspaceFs
  url: string
  importedName: string
  importedTitle?: string
  importedText: string
  rootFolderPath?: string
}): Promise<ImportedShareUrlArtifactPaths | null> => {
  const url = String(args.url || '').trim()
  if (!isShareUrlArtifactEligible(url)) return null
  const rootFolderPath = String(args.rootFolderPath || '').trim() || readWorkspaceImportShareExportRootPathSetting()
  return await resolveImportedShareUrlArtifactPathsForWriteInternal({
    fs: args.fs,
    rootFolderPath,
    url,
    importedName: args.importedName,
    importedTitle: args.importedTitle,
    importedText: args.importedText,
  })
}

export const persistImportedShareUrlArtifacts = async (args: {
  fs: WorkspaceFs
  url: string
  importedName: string
  importedTitle?: string
  importedText: string
  importedThinkingText?: string
  importedThinkingTextTask?: Promise<string>
  importedWorkspacePath: string
  rootFolderPath?: string
  mirrorToHost?: boolean
}): Promise<null | {
  exportToken: string
  exportFolderPath: string
  exportMarkdownPath: string
  exportThinkingPath?: string
  removedPaths?: string[]
}> => {
  const url = String(args.url || '').trim()
  if (!isShareUrlArtifactEligible(url)) return null
  const rootFolderPath = String(args.rootFolderPath || '').trim() || readWorkspaceImportShareExportRootPathSetting()
  const {
    exportToken,
    exportFolderPath,
    exportMarkdownPath,
    exportThinkingPath,
  } = await resolveImportedShareUrlArtifactPathsForWriteInternal({
    fs: args.fs,
    rootFolderPath,
    url,
    importedName: args.importedName,
    importedTitle: args.importedTitle,
    importedText: args.importedText,
    currentWritePath: args.importedWorkspacePath,
  })
  const importedText = String(args.importedText || '').trimEnd() + '\n'
  const thinkingText = buildImportedShareThinkingFileText(args.importedThinkingText)
  const shouldRegisterThinkingPath = !!thinkingText
  const removedPaths: string[] = []
  const importedWorkspacePath = normalizeWorkspacePath(args.importedWorkspacePath)
  if (importedWorkspacePath !== exportMarkdownPath) {
    await writeWorkspaceFileTextEnsuringFile({
      fs: args.fs,
      path: exportMarkdownPath,
      text: importedText,
    })
  }
  if (thinkingText) {
    await writeWorkspaceFileTextEnsuringFile({
      fs: args.fs,
      path: exportThinkingPath,
      text: thinkingText,
    })
  } else {
    const existingThinkingText = await args.fs.readFileText(exportThinkingPath)
    if (existingThinkingText !== null && !existingThinkingText.trim()) await args.fs.deleteEntry(exportThinkingPath)
    if (existingThinkingText === null || !existingThinkingText.trim()) removedPaths.push(exportThinkingPath)
  }
  if (args.mirrorToHost !== false) {
    await ensureChatWorkspaceMirrorFolder(exportFolderPath)
    await mirrorChatWorkspaceFileToHost({
      workspacePath: exportMarkdownPath,
      text: importedText,
    })
    if (thinkingText) await mirrorChatWorkspaceFileToHost({ workspacePath: exportThinkingPath, text: thinkingText })
  }
  if (args.importedThinkingTextTask && args.mirrorToHost !== false) {
    void args.importedThinkingTextTask.then(async rawThinkingText => {
      const nextThinkingText = buildImportedShareThinkingFileText(rawThinkingText)
      if (!nextThinkingText || nextThinkingText === thinkingText) return
      await writeWorkspaceFileTextEnsuringFile({ fs: args.fs, path: exportThinkingPath, text: nextThinkingText })
      await mirrorChatWorkspaceFileToHost({ workspacePath: exportThinkingPath, text: nextThinkingText })
      setWorkspaceEntrySource(exportThinkingPath, { kind: 'url', url })
    }).catch(() => void 0)
  }
  return {
    exportToken,
    exportFolderPath,
    exportMarkdownPath,
    ...(shouldRegisterThinkingPath ? { exportThinkingPath } : {}),
    ...(removedPaths.length > 0 ? { removedPaths } : {}),
  }
}
