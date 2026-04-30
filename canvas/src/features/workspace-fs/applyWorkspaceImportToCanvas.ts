import { useGraphStore } from '@/hooks/useGraphStore'
import type { SourceFile } from '@/hooks/store/types'
import type { GraphData } from '@/lib/graph/types'
import {
  WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS,
  WORKSPACE_IMPORT_AUTO_APPLY_ENABLED,
  WORKSPACE_IMPORT_AUTO_PARSE_MAX_FILES,
  WORKSPACE_IMPORT_AUTO_PARSE_MAX_FILE_CHARS,
  WORKSPACE_IMPORT_AUTO_PARSE_MAX_TOTAL_CHARS,
} from '@/lib/config'
import { DEFAULT_CANVAS_2D_RENDERER } from '@/lib/config.render'
import { isFrontmatterOnlyDoc } from '@/lib/markdown/frontmatter'
import { applyFrontmatterFlowImportModes } from '@/features/parsers/frontmatterFlowImportMode'
import { applyCanvasFrontmatterPreset } from '@/features/parsers/canvasFrontmatterPreset'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import type { WorkspaceEntry, WorkspaceFs, WorkspacePath } from './types'
import { normalizeWorkspacePath, workspaceDocumentKey } from './path'
import { loadWorkspaceSourceIndex, type WorkspaceSourceIndex } from './sourceIndex'
import { mergeWorkspaceEntriesIntoSourceFiles, workspaceSourcePathKey } from './syncToSourceFiles'
import { runInIdle } from '@/features/panels/utils/idle'
import { scheduleApplyComposedGraphFromSourceFiles } from '@/features/source-files/applyComposedGraphFromSourceFiles'
import { buildSourceFileParseIdentityHash } from '@/features/source-files/sourceFileParseIdentity'

type ApplyWorkspaceImportToCanvasOpts = {
  applyToGraph?: boolean
  workspaceEntries?: WorkspaceEntry[]
  sourcesByPath?: WorkspaceSourceIndex
}

type ApplyWorkspaceImportToCanvasResult = {
  sourceFilesUpdated: boolean
  enabledCount: number
  parsedCount: number
}

export function applyInteractiveImportModes(args?: { graphData?: GraphData | null; frontmatterOnlyDoc?: boolean; rawText?: string | null }): void {
  const store = useGraphStore.getState()
  const graphData = args?.graphData || null
  const frontmatterOnlyDoc = args?.frontmatterOnlyDoc === true
  const rawText = String(args?.rawText || '')
  const presetApplied = applyCanvasFrontmatterPreset({ rawText })

  if (graphData) {
    try {
      applyFrontmatterFlowImportModes(graphData)
    } catch {
      void 0
    }
  } else if (presetApplied) {
    try {
      if (store.multiDimTableModeEnabled !== false) store.setMultiDimTableModeEnabled(false)
    } catch {
      void 0
    }
  } else if (frontmatterOnlyDoc) {
    try {
      applyCanvasFrontmatterPreset({
        rawText,
        defaultCanvasRenderMode: '2d',
        defaultCanvas2dRenderer: DEFAULT_CANVAS_2D_RENDERER,
        defaultDocumentSemanticMode: 'document',
        defaultFrontmatterModeEnabled: true,
        disableMultiDimTableMode: true,
      })
    } catch {
      void 0
    }
  } else {
    try {
      applyCanvasFrontmatterPreset({
        rawText,
        defaultCanvasRenderMode: '2d',
        defaultCanvas2dRenderer: DEFAULT_CANVAS_2D_RENDERER,
        defaultFrontmatterModeEnabled: true,
      })
    } catch {
      void 0
    }
  }

  try {
    const schema = store.schema
    const layout = schema?.layout
    if (layout?.mode !== 'block') {
      store.setSchema({ ...schema, layout: { ...(layout || {}), mode: 'block' } })
    }
  } catch {
    void 0
  }
}

export async function applyWorkspaceImportToCanvas(args: {
  fs: WorkspaceFs
  createdPaths: WorkspacePath[]
  opts?: ApplyWorkspaceImportToCanvasOpts
}): Promise<ApplyWorkspaceImportToCanvasResult> {
  const rawCreated = Array.isArray(args.createdPaths) ? args.createdPaths : []
  const applyToGraph = args.opts?.applyToGraph !== false && WORKSPACE_IMPORT_AUTO_APPLY_ENABLED

  const createdPaths = Array.from(
    new Set(
      rawCreated
        .map(p => normalizeWorkspacePath(p))
        .map(p => (p === '/' ? '' : p))
        .filter(Boolean),
    ),
  )
  if (createdPaths.length === 0) return { sourceFilesUpdated: false, enabledCount: 0, parsedCount: 0 }

  const store = useGraphStore.getState()
  const existing = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
  const fs = args.fs
  const workspaceEntries = Array.isArray(args.opts?.workspaceEntries) ? args.opts.workspaceEntries : await fs.listEntries()
  const sourcesByPath = args.opts?.sourcesByPath || loadWorkspaceSourceIndex()
  const merged = mergeWorkspaceEntriesIntoSourceFiles({ existing, workspaceEntries, sourcesByPath })

  const indexByWorkspaceSourcePath = new Map<string, number>()
  for (let i = 0; i < merged.length; i += 1) {
    const srcPath = String(merged[i]?.source?.path || '')
    if (srcPath.startsWith('workspace:')) indexByWorkspaceSourcePath.set(srcPath, i)
  }

  let next: SourceFile[] | null = null
  const ensureNext = (): SourceFile[] => {
    if (next) return next
    next = merged.slice()
    return next
  }

  let enabledCount = 0
  for (const path of createdPaths) {
    const idx = indexByWorkspaceSourcePath.get(workspaceSourcePathKey(path))
    if (idx == null) continue
    const file = merged[idx]
    if (!file) continue
    if (applyToGraph && !file.enabled) {
      ensureNext()[idx] = { ...file, enabled: true }
      enabledCount += 1
    }
  }

  if (!applyToGraph) {
    if (next) {
      store.setSourceFiles(next)
      return { sourceFilesUpdated: true, enabledCount, parsedCount: 0 }
    }
    if (merged !== existing) {
      store.setSourceFiles(merged)
      return { sourceFilesUpdated: true, enabledCount: 0, parsedCount: 0 }
    }
    return { sourceFilesUpdated: false, enabledCount: 0, parsedCount: 0 }
  }

  const { loadGraphDataFromTextViaParser } = (await import('@/features/parsers/loader')) as typeof import('@/features/parsers/loader')

  let remainingFiles = WORKSPACE_IMPORT_AUTO_PARSE_MAX_FILES
  let remainingChars = WORKSPACE_IMPORT_AUTO_PARSE_MAX_TOTAL_CHARS
  let parsedCount = 0
  let preferredInteractiveImportGraphData: GraphData | null = null
  let sawFrontmatterOnlyDoc = false
  let preferredInteractiveImportRawText: string | null = null

  for (const path of createdPaths) {
    if (remainingFiles <= 0 || remainingChars <= 0) break
    const idx = indexByWorkspaceSourcePath.get(workspaceSourcePathKey(path))
    if (idx == null) continue
    const current = (next || merged)[idx]
    if (!current) continue
    if (!current.enabled) continue

    let text = typeof current.text === 'string' ? current.text : ''
    if (!text.trim()) {
      try {
        text = String((await fs.readFileText(path)) || '')
      } catch {
        text = ''
      }
    }
    if (!text.trim()) continue
    if (text.length > WORKSPACE_IMPORT_AUTO_PARSE_MAX_FILE_CHARS) continue
    if (text.length > remainingChars) continue

    const textHash = buildSourceFileParseIdentityHash({
      cacheNamespace: `workspace-import:${path}`,
      name: workspaceDocumentKey(path),
      text,
    })
    if (current.parsedGraphData && String(current.parsedTextHash || '') === textHash) continue

    remainingFiles -= 1
    remainingChars -= text.length

    const nameForParse = workspaceDocumentKey(path)
    let res: Awaited<ReturnType<typeof loadGraphDataFromTextViaParser>> | null = null
    try {
      res = await runInIdle(() => loadGraphDataFromTextViaParser(nameForParse, text, { applyToStore: false }), { timeoutMs: 650 })
    } catch {
      res = null
    }
    const graphData = res?.graphData || null
    const parserId = typeof res?.parserId === 'string' ? res.parserId : undefined
    const inlineText = text.length <= WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS ? text : ''
    if (!preferredInteractiveImportGraphData && graphData && isFrontmatterFlowGraph(graphData)) {
      preferredInteractiveImportGraphData = graphData
      preferredInteractiveImportRawText = text
    }
    if (!sawFrontmatterOnlyDoc && isFrontmatterOnlyDoc(text)) {
      sawFrontmatterOnlyDoc = true
      if (!preferredInteractiveImportRawText) preferredInteractiveImportRawText = text
    }

    const base = ensureNext()[idx]
    const hasGraphContent = !!(
      graphData &&
      (((graphData.nodes && graphData.nodes.length) || 0) > 0 || ((graphData.edges && graphData.edges.length) || 0) > 0)
    )
    if (hasGraphContent) {
      ensureNext()[idx] = {
        ...base,
        text: inlineText,
        status: 'parsed',
        error: undefined,
        parsedParserId: parserId,
        parsedTextHash: textHash,
        parsedGraphRevision: 0,
        parsedGraphData: graphData,
      }
      parsedCount += 1
    } else if (res) {
      ensureNext()[idx] = {
        ...base,
        text: inlineText,
        status: 'idle',
        error: undefined,
        parsedParserId: parserId,
        parsedTextHash: textHash,
        parsedGraphRevision: undefined,
        parsedGraphData: undefined,
      }
    } else {
      ensureNext()[idx] = {
        ...base,
        text: inlineText,
        status: 'error',
        error: 'Parse failed',
        parsedParserId: parserId,
        parsedTextHash: textHash,
        parsedGraphRevision: undefined,
        parsedGraphData: undefined,
      }
    }
  }

  if (next) {
    store.setSourceFiles(next)
    scheduleApplyComposedGraphFromSourceFiles()
    applyInteractiveImportModes({
      graphData: preferredInteractiveImportGraphData,
      frontmatterOnlyDoc: sawFrontmatterOnlyDoc,
      rawText: preferredInteractiveImportRawText,
    })
    return { sourceFilesUpdated: true, enabledCount, parsedCount }
  }
  if (merged !== existing) {
    store.setSourceFiles(merged)
    return { sourceFilesUpdated: true, enabledCount, parsedCount: 0 }
  }
  return { sourceFilesUpdated: false, enabledCount: 0, parsedCount: 0 }
}
