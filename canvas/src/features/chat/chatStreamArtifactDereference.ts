import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { ensureMarkdownFileName } from '@/features/workspace-fs/upsertWorkspaceTextDocument'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { fetchWorkspaceUrlContent } from '@/features/markdown-workspace/workspaceImport/urlContent'
import { ensureChatWorkspaceMirrorFolder, mirrorChatWorkspaceFileToHost } from './chatWorkspaceMirror'
import { ensureWorkspaceFolderPathExists, writeWorkspaceFileTextEnsuringFile } from './chatWorkspaceFsWrite'
import {
  isShareUrlArtifactEligible,
  readShareUrlArtifactKind,
  resolveShareUrlArtifactPaths,
  sanitizeShareUrlArtifactToken,
} from './shareUrlArtifacts'

const uniqueUrls = (values: readonly string[]): string[] => {
  const out: string[] = []
  const seen = new Set<string>()
  values.forEach(value => {
    const candidate = String(value || '').trim()
    if (!candidate) return
    const key = candidate.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(candidate)
  })
  return out
}

export const isDereferenceEligibleShareUrl = isShareUrlArtifactEligible

export type DereferencedChatStreamArtifact = {
  url: string
  workspacePath: string
  fileName: string
  kind: 'reportShare' | 'share'
  semanticKey: string
  exportToken: string
  exportFolderPath: string
  exportMarkdownPath: string
}

const readParentWorkspacePath = (value: string): string => {
  const normalized = normalizeWorkspacePath(String(value || '').trim())
  if (!normalized || normalized === '/') return '/'
  const idx = normalized.lastIndexOf('/')
  if (idx <= 0) return '/'
  return normalizeWorkspacePath(normalized.slice(0, idx))
}

export const persistDereferencedChatStreamArtifacts = async (args: {
  folderPath: string
  urls: readonly string[]
  fetchUrlContent?: typeof fetchWorkspaceUrlContent
}): Promise<DereferencedChatStreamArtifact[]> => {
  const fetchUrlContentImpl = args.fetchUrlContent || fetchWorkspaceUrlContent
  const eligibleUrls = uniqueUrls(args.urls.filter(isDereferenceEligibleShareUrl))
  if (eligibleUrls.length === 0) return []
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  await ensureChatWorkspaceMirrorFolder(args.folderPath)
  const rootFolderPath = readParentWorkspacePath(args.folderPath)
  const out: DereferencedChatStreamArtifact[] = []
  for (let i = 0; i < eligibleUrls.length; i += 1) {
    const url = eligibleUrls[i] || ''
    const kind = readShareUrlArtifactKind(url)
    const semanticKey =
      buildScopedGraphSemanticKey('chat-stream-artifact-dereference', {
        graphSemanticKey: `${kind}:${url}`,
      }) || `${kind}:${i + 1}`
    let imported
    try {
      imported = await fetchUrlContentImpl(url, {
        mode: 'import',
        viewHint: 'markdown',
        canvas2dRenderer: 'storyboard',
        documentSemanticMode: 'document',
      })
    } catch {
      continue
    }
    const baseName = ensureMarkdownFileName(imported.name || `${kind}.md`)
      .replace(/\.md$/i, '')
    const ordinal = String(i + 1).padStart(2, '0')
    const fileName = ensureMarkdownFileName(
      `${kind === 'reportShare' ? 'report-share' : 'share'}-${ordinal}-${sanitizeShareUrlArtifactToken(baseName, kind)}`,
    )
    const workspacePath = normalizeWorkspacePath(`${args.folderPath === '/' ? '' : args.folderPath}/${fileName}`)
    const { exportToken, exportFolderPath, exportMarkdownPath } = resolveShareUrlArtifactPaths({
      rootFolderPath,
      url,
      importedName: imported.name,
    })
    const importedText = String(imported.text || '').trimEnd() + '\n'
    await writeWorkspaceFileTextEnsuringFile({
      fs,
      path: workspacePath,
      text: importedText,
    })
    await ensureWorkspaceFolderPathExists(exportFolderPath)
    await writeWorkspaceFileTextEnsuringFile({
      fs,
      path: exportMarkdownPath,
      text: importedText,
    })
    await mirrorChatWorkspaceFileToHost({
      workspacePath,
      text: importedText,
    })
    await ensureChatWorkspaceMirrorFolder(exportFolderPath)
    await mirrorChatWorkspaceFileToHost({
      workspacePath: exportMarkdownPath,
      text: importedText,
    })
    out.push({
      url,
      workspacePath,
      fileName,
      kind,
      semanticKey,
      exportToken,
      exportFolderPath,
      exportMarkdownPath,
    })
  }
  return out
}
