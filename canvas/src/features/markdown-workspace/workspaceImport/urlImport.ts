import type { WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import { WORKSPACE_ROOT_PATH, normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { parseGitHubRepoUrl } from '../githubRepoApi'
import { importGitHubFolder } from '../githubRepoImport'
import type { WorkspaceImportProgress, WorkspaceImportResult } from './types'
import { fetchWorkspaceUrlContent } from './urlContent'
import type { Canvas2dRendererId } from '@/lib/config.render'
import type { WorkspaceUrlImportDocumentModeId } from './canvasPresets'
import { shouldApplyImportedCanvasDocumentToGraph } from './applyPolicy'
import {
  persistImportedShareUrlArtifacts,
  resolveImportedShareUrlPrimaryWorkspacePath,
} from './shareUrlExport'
import { writeWorkspaceFileTextEnsuringFile } from '@/features/chat/chatWorkspaceFsWrite'

export async function importWorkspaceUrl(args: {
  fs: WorkspaceFs
  urlRaw: string
  parentPath?: WorkspacePath
  onProgress?: (p: WorkspaceImportProgress) => void
  canvas2dRenderer?: Canvas2dRendererId | null
  documentSemanticMode?: WorkspaceUrlImportDocumentModeId | null
  viewHint?: 'markdown' | 'json' | 'html'
  fetchUrlContent?: typeof fetchWorkspaceUrlContent
}): Promise<WorkspaceImportResult> {
  const rawUrl = String(args.urlRaw || '').trim()
  if (!rawUrl) return { createdPaths: [], sources: [], skipped: [], failed: [] }
  const parentPath = args.parentPath || WORKSPACE_ROOT_PATH

  const repoRef = parseGitHubRepoUrl(rawUrl)
  if (repoRef) {
    return importGitHubFolder({ fs: args.fs, repoRef, parentPath, onProgress: args.onProgress })
  }

  try {
    args.onProgress?.({ phase: 'fetching', current: 0, label: 'Fetching' })
  } catch {
    void 0
  }
  const fetchUrlContentImpl = args.fetchUrlContent || fetchWorkspaceUrlContent
  const fetched = await fetchUrlContentImpl(rawUrl, {
    mode: 'import',
    viewHint: args.viewHint === 'json' ? 'json' : args.viewHint === 'html' ? 'html' : 'markdown',
    canvas2dRenderer: args.canvas2dRenderer,
    documentSemanticMode: args.documentSemanticMode,
    onProgress: p => {
      try {
        args.onProgress?.({ phase: 'fetching', current: p, total: 100, label: 'Fetching' })
      } catch {
        void 0
      }
    },
  })
  try {
    args.onProgress?.({ phase: 'writing', current: 0, label: 'Writing' })
  } catch {
    void 0
  }
  const sharePrimaryPath = resolveImportedShareUrlPrimaryWorkspacePath({
    url: fetched.normalizedUrl || rawUrl,
    importedName: fetched.name,
  })
  const createdPath = sharePrimaryPath
    ? (await writeWorkspaceFileTextEnsuringFile({
        fs: args.fs,
        path: sharePrimaryPath,
        text: fetched.text,
      }), sharePrimaryPath)
    : await args.fs.createFile({ parentPath, name: fetched.name, text: fetched.text })
  try {
    args.onProgress?.({ phase: 'writing', current: 1, total: 1, label: 'Writing' })
  } catch {
    void 0
  }
  const normalized = normalizeWorkspacePath(createdPath)
  await persistImportedShareUrlArtifacts({
    fs: args.fs,
    url: fetched.normalizedUrl || rawUrl,
    importedName: fetched.name,
    importedText: fetched.text,
    importedWorkspacePath: normalized,
  })
  const applyToGraph = shouldApplyImportedCanvasDocumentToGraph({
    path: normalized || fetched.name,
    text: fetched.text,
  })
  return {
    createdPaths: [normalized],
    sources: [{ path: normalized, source: { kind: 'url', url: fetched.normalizedUrl } }],
    skipped: [],
    failed: [],
    applyToGraph,
  }
}
