import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import type { WorkspaceEntry, WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import { applyCanvasFrontmatterPreset } from '@/features/parsers/canvasFrontmatterPreset'
import type { WorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import {
  hydrateWorkspaceFileFromPendingLocalImport,
  peekPendingWorkspaceLocalImport,
} from '../workspaceImport'
import type { WorkspaceImportResult } from '../workspaceImport/types'
import { shouldApplyImportedCanvasDocumentToGraph } from '../workspaceImport/applyPolicy'
import { normalizeCorpusImportManifest } from '@/features/queryable-corpus/sourceFilesCorpusManifest'

export function normalizeWorkspaceImportResult(raw: unknown): WorkspaceImportResult {
  const rec = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const createdPaths = Array.isArray(rec.createdPaths)
    ? rec.createdPaths.map(path => String(path || '').trim()).filter(Boolean)
    : []
  const removedPaths = Array.isArray(rec.removedPaths)
    ? rec.removedPaths.map(path => String(path || '').trim()).filter(Boolean)
    : []
  const sources = Array.isArray(rec.sources)
    ? rec.sources
        .map((item): WorkspaceImportResult['sources'][number] | null => {
          const path = String((item as { path?: unknown } | null)?.path || '').trim() as WorkspacePath
          const rawSource = (item as { source?: unknown } | null)?.source
          if (!path || !rawSource || typeof rawSource !== 'object') return null
          const kind = String((rawSource as { kind?: unknown }).kind || '').trim()
          if (kind === 'url') {
            const url = String((rawSource as { url?: unknown }).url || '').trim()
            if (!url) return null
            return { path, source: { kind: 'url' as const, url } }
          }
          if (kind === 'local') {
            const originalName = typeof (rawSource as { originalName?: unknown }).originalName === 'string'
              ? String((rawSource as { originalName?: string }).originalName || '').trim()
              : ''
            return originalName
              ? { path, source: { kind: 'local' as const, originalName } }
              : { path, source: { kind: 'local' as const } }
          }
          return null
        })
        .filter((item): item is WorkspaceImportResult['sources'][number] => !!item)
    : []
  const skipped = Array.isArray(rec.skipped)
    ? rec.skipped
        .map(item => {
          const name = String((item as { name?: unknown } | null)?.name || '').trim()
          const reasonRaw = String((item as { reason?: unknown } | null)?.reason || '').trim()
          const reason = reasonRaw === 'missing-name' ? 'missing-name' : reasonRaw === 'unsupported' ? 'unsupported' : ''
          if (!reason) return null
          return { name, reason }
        })
        .filter((item): item is WorkspaceImportResult['skipped'][number] => !!item)
    : []
  const failed = Array.isArray(rec.failed)
    ? rec.failed
        .map(item => {
          const name = String((item as { name?: unknown } | null)?.name || '').trim()
          const error = String((item as { error?: unknown } | null)?.error || '').trim()
          if (!error) return null
          return { name, error }
        })
        .filter((item): item is WorkspaceImportResult['failed'][number] => !!item)
    : []
  const applyToGraph = typeof rec.applyToGraph === 'boolean' ? rec.applyToGraph : undefined
  const corpusManifest = normalizeCorpusImportManifest(rec.corpusManifest)
  return {
    createdPaths,
    ...(removedPaths.length > 0 ? { removedPaths } : {}),
    sources,
    skipped,
    failed,
    ...(typeof applyToGraph === 'boolean' ? { applyToGraph } : {}),
    ...(corpusManifest ? { corpusManifest } : {}),
  }
}

export async function resolveImportedCanvasDocumentApplyToGraph(args: {
  fs: WorkspaceFs
  createdPaths: string[]
}): Promise<boolean> {
  const createdPaths = Array.isArray(args.createdPaths)
    ? args.createdPaths.map(path => String(path || '').trim()).filter(Boolean)
    : []
  for (const path of createdPaths) {
    const text = String((await args.fs.readFileText(path).catch(() => '')) || '')
    if (shouldApplyImportedCanvasDocumentToGraph({ path, text })) return true
    if (peekPendingWorkspaceLocalImport(path)) continue
    const hydrated = await hydrateWorkspaceFileFromPendingLocalImport({ fs: args.fs, path }).catch(() => null)
    const hydratedText = String(hydrated?.text || '')
    if (shouldApplyImportedCanvasDocumentToGraph({ path, text: hydratedText })) return true
  }
  return false
}

export async function applyWorkspaceImportToCanvasBestEffort(args: {
  fs: WorkspaceFs
  createdPaths: string[]
  opts?: {
    applyToGraph?: boolean
    workspaceEntries?: WorkspaceEntry[]
    sourcesByPath?: Record<string, WorkspaceEntrySource | undefined> | null
    removedPaths?: string[]
  } | null
}): Promise<void> {
  const createdPaths = Array.isArray(args.createdPaths)
    ? args.createdPaths.map(path => String(path || '').trim()).filter(Boolean)
    : []
  if (createdPaths.length === 0) return
  try {
    const { applyWorkspaceImportToCanvas } = (await import('@/features/workspace-fs/applyWorkspaceImportToCanvas')) as typeof import(
      '@/features/workspace-fs/applyWorkspaceImportToCanvas'
    )
    await applyWorkspaceImportToCanvas({
      fs: args.fs,
      createdPaths,
      ...(args.opts ? { opts: args.opts } : {}),
    })
  } catch {
    void 0
  }
}

export async function pickFirstCreatedFilePathForImportFocus(fs: WorkspaceFs, createdPaths: string[]): Promise<string | null> {
  const normalized = Array.isArray(createdPaths) ? createdPaths.map(path => String(path || '').trim()).filter(Boolean) : []
  if (normalized.length === 0) return null

  try {
    const createdSet = new Set(normalized)
    const entries = await fs.listEntries()
    const firstFile = entries.find(entry => entry.kind === 'file' && createdSet.has(String(entry.path || '').trim()))
    if (firstFile) return String(firstFile.path || '').trim() || null
  } catch {
    void 0
  }

  const fileLike = normalized.find(path => /\/[^/]+\.[^/]+$/.test(path))
  if (fileLike) return fileLike
  return normalized[0] || null
}

export async function activateFirstImportedWorkspaceFile(args: {
  fs: WorkspaceFs
  createdPaths: string[]
  applyToGraph?: boolean
}): Promise<void> {
  const createdPaths = Array.isArray(args.createdPaths)
    ? args.createdPaths.map(path => String(path || '').trim()).filter(Boolean)
    : []
  if (createdPaths.length === 0) return
  try {
    const [
      { workspaceBasename, workspaceDocumentKey },
      { normalizeMermaidMmdToMarkdown },
    ] = await Promise.all([
      import('@/features/workspace-fs/path') as Promise<typeof import('@/features/workspace-fs/path')>,
      import('grph-shared/markdown/mermaidInput') as Promise<typeof import('grph-shared/markdown/mermaidInput')>,
    ])

    const firstPath = (await pickFirstCreatedFilePathForImportFocus(args.fs, createdPaths)) || ''
    if (!firstPath) return

    const pendingImport = peekPendingWorkspaceLocalImport(firstPath as WorkspacePath)
    const hydrated = pendingImport?.kind === 'glb' || pendingImport?.kind === 'gltf'
      ? null
      : await hydrateWorkspaceFileFromPendingLocalImport({ fs: args.fs, path: firstPath }).catch(() => null)
    const text = String((hydrated?.text || (await args.fs.readFileText(firstPath).catch(() => ''))) || '')
    const docKey = workspaceDocumentKey(firstPath)
    const name = docKey || workspaceBasename(firstPath) || firstPath
    const state = useGraphStore.getState()
    const normalizedPath = firstPath as WorkspacePath
    try {
      useMarkdownExplorerStore.getState().setActivePath(normalizedPath)
    } catch {
      try {
        useMarkdownExplorerStore.setState({
          activePath: normalizedPath,
          lastSetActivePath: { path: normalizedPath, atMs: Date.now() },
        })
      } catch {
        void 0
      }
    }

    await state.setActiveMarkdownDocument({
      name,
      text: normalizeMermaidMmdToMarkdown(name, text),
      normalizeMermaidMmd: false,
      sourceUrl: null,
      jsonSourceText: null,
      applyViewPreset: args.applyToGraph === true,
      applyToGraph: args.applyToGraph === true,
    })
    if (args.applyToGraph === true) {
      try {
        applyCanvasFrontmatterPreset({
          graphData: useGraphStore.getState().graphData,
          rawText: text,
        })
      } catch {
        void 0
      }
    }
  } catch {
    void 0
  }
}
