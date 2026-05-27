import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { ensureMarkdownFileName } from '@/features/workspace-fs/upsertWorkspaceTextDocument'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { fetchWorkspaceUrlContent } from '@/features/markdown-workspace/workspaceImport/urlContent'
import { ensureChatWorkspaceMirrorFolder, mirrorChatWorkspaceFileToHost } from './chatWorkspaceMirror'
import { writeWorkspaceFileTextEnsuringFile } from './chatWorkspaceFsWrite'

const REPORT_SHARE_HINT_RX = /\/report\/share\//i
const SHARE_HINT_RX = /\/share\//i

const sanitizePathToken = (value: unknown, fallback: string): string => {
  const text = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return text || fallback
}

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

export const isDereferenceEligibleShareUrl = (value: string): boolean => {
  try {
    const url = new URL(String(value || '').trim())
    return SHARE_HINT_RX.test(url.pathname)
  } catch {
    return false
  }
}

const readShareKind = (value: string): 'reportShare' | 'share' => {
  try {
    const url = new URL(String(value || '').trim())
    return REPORT_SHARE_HINT_RX.test(url.pathname) ? 'reportShare' : 'share'
  } catch {
    return 'share'
  }
}

export type DereferencedChatStreamArtifact = {
  url: string
  workspacePath: string
  fileName: string
  kind: 'reportShare' | 'share'
  semanticKey: string
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
  const out: DereferencedChatStreamArtifact[] = []
  for (let i = 0; i < eligibleUrls.length; i += 1) {
    const url = eligibleUrls[i] || ''
    const kind = readShareKind(url)
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
      `${kind === 'reportShare' ? 'report-share' : 'share'}-${ordinal}-${sanitizePathToken(baseName, kind)}`,
    )
    const workspacePath = normalizeWorkspacePath(`${args.folderPath === '/' ? '' : args.folderPath}/${fileName}`)
    await writeWorkspaceFileTextEnsuringFile({
      fs,
      path: workspacePath,
      text: String(imported.text || '').trimEnd() + '\n',
    })
    void mirrorChatWorkspaceFileToHost({
      workspacePath,
      text: String(imported.text || '').trimEnd() + '\n',
    })
    out.push({
      url,
      workspacePath,
      fileName,
      kind,
      semanticKey,
    })
  }
  return out
}
