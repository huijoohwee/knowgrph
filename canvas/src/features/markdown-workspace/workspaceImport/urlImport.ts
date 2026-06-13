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
  resolveImportedShareUrlArtifactPathsForWrite,
} from './shareUrlExport'
import { persistImportedWebpageUrlArtifact } from './webpageUrlExport'
import { writeWorkspaceFileTextEnsuringFile } from '@/features/chat/chatWorkspaceFsWrite'
import { buildCorpusImportManifest, buildCorpusSourceUnit } from '@/features/queryable-corpus/sourceFilesCorpusManifest'
import {
  buildStrybldrStoryboardDocument,
  buildStrybldrWorkspaceDocumentName,
  serializeStrybldrStoryboardMarkdown,
} from '@/features/strybldr/strybldrStoryboard'
import { importXrImageWorkspaceAssetsFromUrl, isXrImageAssetUrl } from './xrImageAssets'
import { materializeCsvJsonImportArtifacts } from './csvJsonConversion'

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

  if (isXrImageAssetUrl(rawUrl)) {
    try {
      args.onProgress?.({ phase: 'fetching', current: 0, label: 'Fetching XR image asset' })
    } catch {
      void 0
    }
    const imported = await importXrImageWorkspaceAssetsFromUrl({
      fs: args.fs,
      url: rawUrl,
      parentPath: '/image/knowgrph/xr',
    })
    try {
      args.onProgress?.({ phase: 'writing', current: imported.createdPaths.length, total: imported.createdPaths.length, label: 'Writing XR image assets' })
    } catch {
      void 0
    }
    const sourceUnit = buildCorpusSourceUnit({
      workspacePath: imported.createdPaths[0] || rawUrl,
      relativePath: rawUrl,
      originalName: rawUrl,
      text: imported.sourceText,
      mimeHint: 'image/*',
      byteSize: imported.sourceText.length,
      mediaKind: 'image',
      status: 'parsed',
      importMode: 'url',
    })
    return {
      createdPaths: imported.createdPaths,
      sources: imported.sources,
      skipped: [],
      failed: [],
      applyToGraph: true,
      corpusManifest: buildCorpusImportManifest({
        sourceUnits: [sourceUnit],
        skipped: [],
        failed: [],
      }),
    }
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
  const sourceUrl = fetched.normalizedUrl || rawUrl
  const sharePrimaryPaths = await resolveImportedShareUrlArtifactPathsForWrite({
    fs: args.fs,
    url: sourceUrl,
    importedName: fetched.name,
    importedTitle: fetched.title,
    importedText: fetched.text,
  })
  const sharePrimaryPath = sharePrimaryPaths?.exportMarkdownPath || null
  const webpageUrlArtifact = sharePrimaryPath
    ? null
    : await persistImportedWebpageUrlArtifact({
        fs: args.fs,
        url: sourceUrl,
        importedName: fetched.name,
        importedText: fetched.text,
      })
  const webpageUrlArtifactPath = webpageUrlArtifact?.exportMarkdownPath || null
  const createdPath = sharePrimaryPath
    ? (await writeWorkspaceFileTextEnsuringFile({
        fs: args.fs,
        path: sharePrimaryPath,
        text: fetched.text,
      }), sharePrimaryPath)
    : webpageUrlArtifactPath
      ? webpageUrlArtifactPath
    : await args.fs.createFile({ parentPath, name: fetched.name, text: fetched.text })
  try {
    args.onProgress?.({ phase: 'writing', current: 1, total: 1, label: 'Writing' })
  } catch {
    void 0
  }
  const normalized = normalizeWorkspacePath(createdPath)
  const persistedShareArtifacts = await persistImportedShareUrlArtifacts({
    fs: args.fs,
    url: sourceUrl,
    importedName: fetched.name,
    importedTitle: fetched.title,
    importedText: fetched.text,
    importedThinkingText: fetched.thinkingText,
    ...(fetched.thinkingTextTask ? { importedThinkingTextTask: fetched.thinkingTextTask } : {}),
    importedWorkspacePath: normalized,
  })
  const sources: WorkspaceImportResult['sources'] = [{ path: normalized, source: { kind: 'url', url: sourceUrl } }]
  const jsonSourceDocuments: NonNullable<WorkspaceImportResult['jsonSourceDocuments']> = []
  const removedPaths = [
    ...(webpageUrlArtifact?.removedPaths || []),
    ...(persistedShareArtifacts?.removedPaths || []),
  ]
  if (persistedShareArtifacts) {
    const knownSourcePaths = new Set(sources.map(item => normalizeWorkspacePath(item.path)))
    const artifactPaths = [persistedShareArtifacts.exportMarkdownPath, persistedShareArtifacts.exportThinkingPath]
      .filter((path): path is string => typeof path === 'string' && !!path.trim())
    for (const path of artifactPaths) {
      const artifactPath = normalizeWorkspacePath(path)
      if (!artifactPath || knownSourcePaths.has(artifactPath)) continue
      knownSourcePaths.add(artifactPath)
      sources.push({ path: artifactPath, source: { kind: 'url', url: sourceUrl } })
    }
  }
  const sourceUnit = buildCorpusSourceUnit({
    workspacePath: normalized,
    relativePath: fetched.name,
    originalName: fetched.name,
    text: fetched.text,
    mimeHint: fetched.sourceMimeHint || 'text/markdown',
    byteSize: fetched.text.length,
    mediaKind: fetched.sourceMediaKind,
    status: 'parsed',
    importMode: 'url',
  })
  const applyToGraph = shouldApplyImportedCanvasDocumentToGraph({
    path: normalized || fetched.name,
    text: fetched.text,
  })
  const createdPaths: WorkspacePath[] = [normalized]
  const csvJsonDerived = await materializeCsvJsonImportArtifacts({
    fs: args.fs,
    sourcePath: normalized,
    sourceName: fetched.name,
    sourceText: fetched.text,
    source: { kind: 'url', url: sourceUrl },
    options: { sourceKind: 'url', sourceUrl },
  })
  if (csvJsonDerived.createdPaths.length > 0 || csvJsonDerived.jsonSourceDocuments.length > 0) {
    createdPaths.push(...csvJsonDerived.createdPaths)
    sources.push(...csvJsonDerived.sources)
    jsonSourceDocuments.push(...csvJsonDerived.jsonSourceDocuments)
  }
  let effectiveApplyToGraph = applyToGraph
  if (args.canvas2dRenderer === 'storyboard') {
    const storyDoc = buildStrybldrStoryboardDocument({
      sourceUnits: [sourceUnit],
      mediaUrlBySourceUnitId: { [sourceUnit.id]: sourceUrl },
    })
    const storySource = storyDoc.sources[0] || null
    if (storySource) {
      const storyName = buildStrybldrWorkspaceDocumentName(storySource)
      const storyPath = await args.fs.createFile({
        parentPath,
        name: storyName,
        text: serializeStrybldrStoryboardMarkdown(storyDoc),
      })
      const normalizedStoryPath = normalizeWorkspacePath(storyPath)
      createdPaths.unshift(normalizedStoryPath)
      sources.unshift({ path: normalizedStoryPath, source: { kind: 'url', url: sourceUrl } })
      effectiveApplyToGraph = true
    }
  }
  return {
    createdPaths,
    sources,
    ...(removedPaths.length > 0 ? { removedPaths } : {}),
    ...(jsonSourceDocuments.length > 0 ? { jsonSourceDocuments } : {}),
    skipped: [],
    failed: [],
    applyToGraph: effectiveApplyToGraph,
    corpusManifest: buildCorpusImportManifest({
      sourceUnits: [sourceUnit],
      skipped: [],
      failed: [],
    }),
  }
}
