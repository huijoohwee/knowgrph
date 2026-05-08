import type { GraphData, JSONValue } from '@/lib/graph/types'
import type { TraversalSummary } from '@/features/panels/utils/orchestratorTraversal'
import type { GetGraph, SetGraph } from './graphDataSliceAccess'
import { isJsonValue } from '@/lib/graph/jsonValue'
import { containsFrontmatterMermaid, isMarkdownLikeFileName, normalizeMermaidMmdToMarkdown } from 'grph-shared/markdown/mermaidInput'
import { persistGraphDataToLocalStorage } from '@/hooks/store/graphDataPersistence'
import { buildSourceFileLifecycleState } from '@/features/source-files/sourceFileParsedState'
import { isFrontmatterOnlyPolicyActive } from '@/lib/config.render'
import { buildFlowWidgetEligibleNodeIdSet } from '@/lib/graph/flowWidgetEligibility'
import { parseCanvasWorkspaceFrontmatterPreset } from '@/lib/markdown/frontmatter'
import { setGeospatialModeEnabled } from '@/features/geospatial/gympgrphBridge'
import {
  syncGraphFieldsWithGraphData,
  readGraphRagWorkflowJsonTextFromGraphData,
  withGraphDataRevision,
} from '@/hooks/store/graphDataSliceUtils'

export function createGraphDataDocumentActions(set: SetGraph, get: GetGraph) {
  return ({
  resyncGraphFieldsFromGraphData: () => {
    const current = get().graphData
    if (!current) return
    try {
      syncGraphFieldsWithGraphData(get, current)
    } catch {
      void 0
    }
  },

  setMarkdownDocument: (
    name: string | null,
    text: string | null,
    opts?: { autoEnableFrontmatter?: boolean; applyViewPreset?: boolean },
  ) => {
    const nextText = String(text || '')
    const hasFrontmatterMermaid = containsFrontmatterMermaid(nextText)
    const shouldAutoEnableFrontmatter = opts?.autoEnableFrontmatter !== false
    const applyViewPreset = typeof opts?.applyViewPreset === 'boolean' ? opts.applyViewPreset !== false : true
    const state = get()
    const needsAutoEnable = shouldAutoEnableFrontmatter && hasFrontmatterMermaid && !(state.frontmatterModeEnabled || false)
    if (
      !needsAutoEnable &&
      state.markdownDocumentName === name &&
      state.markdownDocumentText === text &&
      state.markdownDocumentApplyViewPreset === applyViewPreset
    ) return
    set({
      markdownDocumentName: name,
      markdownDocumentText: text,
      markdownDocumentApplyViewPreset: applyViewPreset,
      markdownTokens: null, // Invalidate tokens
      markdownTokensPath: null,
      markdownTokensKey: null,
      markdownTokensMeta: null,
      markdownTokensStartLineOffset: null,
      ...(shouldAutoEnableFrontmatter && hasFrontmatterMermaid ? { frontmatterModeEnabled: true } : {}),
    })
  },

  setActiveMarkdownDocument: async (args: {
    name: string
    text: string
    sourceUrl?: string | null
    jsonSourceText?: string | null
    autoEnableFrontmatter?: boolean
    applyViewPreset?: boolean
    recent?: Omit<import('@/hooks/store/types').RecentFileEntry, 'id' | 'timestamp'> | null
    applyToGraph?: boolean
    forceApplyToGraph?: boolean
    normalizeMermaidMmd?: boolean
  }): Promise<boolean> => {
    const name = String(args?.name || '').trim()
    if (!name) return false
    const rawText = String(args?.text || '')
    const text = args?.normalizeMermaidMmd === false ? rawText : normalizeMermaidMmdToMarkdown(name, rawText)

    get().setMarkdownDocument(name, text, {
      autoEnableFrontmatter: args?.autoEnableFrontmatter,
      applyViewPreset: args?.applyViewPreset,
    })

    if (args?.applyViewPreset !== false && !args?.applyToGraph && text.trim()) {
      try {
        const { applyCanvasFrontmatterPreset } = (await import('@/features/parsers/canvasFrontmatterPreset')) as typeof import('@/features/parsers/canvasFrontmatterPreset')
        applyCanvasFrontmatterPreset({
          graphData: get().graphData,
          rawText: text,
        })
      } catch {
        void 0
      }
    }

    if ('sourceUrl' in (args as Record<string, unknown>)) {
      get().setMarkdownDocumentSourceUrl(typeof args.sourceUrl === 'string' ? args.sourceUrl : null)
    }
    if ('jsonSourceText' in (args as Record<string, unknown>)) {
      const nextJson = typeof args.jsonSourceText === 'string' ? args.jsonSourceText : null
      get().setJsonSourceDocument(name, nextJson)
    }
    const recent = args?.recent ?? null
    if (recent) {
      try {
        get().addRecentFile(recent)
      } catch {
        void 0
      }
    }

    if (args?.applyToGraph) {
      try {
        return await get().applyMarkdownDocumentToGraph(name, text, { force: args?.forceApplyToGraph !== false })
      } catch {
        return false
      }
    }
    return true
  },

  applyMarkdownDocumentToGraph: async (name: string, text: string, opts?: { force?: boolean }) => {
    const nextName = String(name || '').trim()
    const nextText = String(text || '')
    if (!nextName || !nextText.trim()) return false

    const lower = nextName.toLowerCase()
    const isMarkdown = isMarkdownLikeFileName(lower)
    if (!isMarkdown) return false

    const state = get()
    const shouldApply = (() => {
      if (opts?.force) return true
      if ((state.documentSemanticMode || 'document') !== 'document') return false

      if (state.frontmatterModeEnabled || false) {
        const hasFrontmatterMermaid = containsFrontmatterMermaid(nextText)
        if (hasFrontmatterMermaid) return true
      }

      return true
    })()

    if (!shouldApply) return false

    const exactSourceFile = state.sourceFiles.find(file => String(file?.name || '').trim() === nextName) || null
    if (exactSourceFile) {
      const nextSourceText = nextText
      if (
        String(exactSourceFile.text || '') !== nextSourceText ||
        exactSourceFile.status === 'error'
      ) {
        get().updateSourceFile(exactSourceFile.id, {
          text: nextSourceText,
          ...buildSourceFileLifecycleState({
            status: 'idle',
            previousState: exactSourceFile,
            preserveParsedState: true,
          }),
        })
      }
    }

    const { loadGraphDataFromTextViaParser } = (await import('@/features/parsers/loader')) as typeof import('@/features/parsers/loader')
    const res = await loadGraphDataFromTextViaParser(nextName, nextText, { applyToStore: false, syncMarkdownDocument: false })
    const parsedGraph = res?.graphData || null
    const { applyCanvasFrontmatterPreset } = (await import('@/features/parsers/canvasFrontmatterPreset')) as typeof import('@/features/parsers/canvasFrontmatterPreset')
    applyCanvasFrontmatterPreset({
      graphData: parsedGraph,
      rawText: nextText,
    })
    const parsedTextPreset = parseCanvasWorkspaceFrontmatterPreset(nextText)
    const strictFlowEditorPreset =
      parsedTextPreset?.canvasSurfaceMode === '2d' &&
      parsedTextPreset?.canvas2dRenderer === 'flowEditor' &&
      parsedTextPreset?.documentSemanticMode === 'document' &&
      parsedTextPreset?.frontmatterModeEnabled === true
    if (strictFlowEditorPreset) {
      const nextState = get()
      if (nextState.documentStructureBaselineLock === true) nextState.setDocumentStructureBaselineLock(false)
      nextState.setCanvasRenderMode('2d')
      nextState.setCanvas2dRenderer('flowEditor')
      void setGeospatialModeEnabled(false).catch(() => void 0)
      nextState.setDocumentSemanticMode('document')
      nextState.setFrontmatterModeEnabled(true)
    }
    if (parsedGraph) {
      get().setGraphData(parsedGraph)
      const { applyFrontmatterFlowImportModes } = (await import('@/features/parsers/frontmatterFlowImportMode')) as typeof import('@/features/parsers/frontmatterFlowImportMode')
      applyFrontmatterFlowImportModes(parsedGraph)
      const afterApplyState = get()
      const enforceFrontmatterOnly = isFrontmatterOnlyPolicyActive({
        canvasRenderMode: afterApplyState.canvasRenderMode,
        canvas2dRenderer: afterApplyState.canvas2dRenderer,
      })
      if (enforceFrontmatterOnly) {
        const parsedNodes = Array.isArray(parsedGraph.nodes) ? parsedGraph.nodes : []
        const eligibleFlowWidgetNodeIds = buildFlowWidgetEligibleNodeIdSet(parsedNodes as any)
        const isEligibleFlowWidgetNodeId = (id: unknown): boolean => {
          const normalized = String(id || '').trim()
          return !!normalized && eligibleFlowWidgetNodeIds.has(normalized)
        }
        const activeWidgetIds = Array.isArray(afterApplyState.openWidgetNodeIds) ? afterApplyState.openWidgetNodeIds : []
        const sanitizedWidgetIds = activeWidgetIds
          .map(id => String(id || '').trim())
          .filter(isEligibleFlowWidgetNodeId)
        afterApplyState.setOpenWidgetNodeIds(sanitizedWidgetIds)
        const currentPinnedByNodeId = afterApplyState.flowWidgetPinnedByNodeId || {}
        const nextPinnedByNodeId = Object.fromEntries(
          Object.entries(currentPinnedByNodeId).filter(([id]) => isEligibleFlowWidgetNodeId(id)),
        ) as Record<string, boolean>
        afterApplyState.setFlowWidgetPinnedByNodeId(nextPinnedByNodeId)
        const currentPosByNodeId = afterApplyState.flowWidgetPosByNodeId || {}
        const nextPosByNodeId = Object.fromEntries(
          Object.entries(currentPosByNodeId).filter(([id]) => isEligibleFlowWidgetNodeId(id)),
        ) as Record<string, { top: number; left: number }>
        afterApplyState.setFlowWidgetPosByNodeId(nextPosByNodeId)
        // Frontmatter flow imports should reseed overlay placement from graph anchors,
        // not stale persisted world coordinates from previous documents/sessions.
        afterApplyState.setFlowWidgetWorldPosByNodeId({})
      }
    }
    return !!(parsedGraph && ((parsedGraph.nodes || []).length > 0 || (parsedGraph.edges || []).length > 0))
  },

  setMarkdownTokens: (args: {
    tokens: import('@/features/markdown/ui/markdownPreviewLex').TokenWithLines[] | null
    path?: string | null
    key?: string | null
    meta?: import('@/lib/markdown').MarkdownFrontmatter | null
    startLineOffset?: number | null
  }) => {
    set(state => {
      const nextPath = args.path ?? null
      const nextKey = args.key ?? null
      const nextMeta = args.meta ?? null
      const nextOffset = args.startLineOffset ?? null
      if (
        state.markdownTokens === args.tokens &&
        state.markdownTokensPath === nextPath &&
        state.markdownTokensKey === nextKey &&
        state.markdownTokensMeta === nextMeta &&
        state.markdownTokensStartLineOffset === nextOffset
      ) {
        return state
      }
      return {
        markdownTokens: args.tokens,
        markdownTokensPath: nextPath,
        markdownTokensKey: nextKey,
        markdownTokensMeta: nextMeta,
        markdownTokensStartLineOffset: nextOffset,
      }
    })
  },

  setJsonSourceDocument: (name: string | null, text: string | null) => {
    const trimmed = typeof text === 'string' ? text.trim() : ''
    const nextText = trimmed ? text : null
    set(state => ({
      ...state,
      jsonSourceDocumentText: nextText,
    }))
  },

  setMarkdownPreviewMermaidFocus: (
    focus: { code: string; frontmatterConfig: Record<string, unknown> | null } | null,
  ) => {
    if (!focus) {
      set({
        markdownPreviewMermaidFocusCode: null,
        markdownPreviewMermaidFocusConfig: null,
      })
      return
    }
    const nextCode = typeof focus.code === 'string' ? focus.code : ''
    const cfg = focus.frontmatterConfig
    const nextConfig =
      cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? (cfg as Record<string, unknown>) : null
    set({
      markdownPreviewMermaidFocusCode: nextCode,
      markdownPreviewMermaidFocusConfig: nextConfig,
    })
  },

  setMarkdownPreviewActiveMediaKey: (key: string | null) => {
    const nextKey = typeof key === 'string' ? key.trim() : ''
    set({
      markdownPreviewActiveMediaKey: nextKey ? nextKey : null,
    })
  },

  setMarkdownDocumentSourceUrl: (url: string | null) => {
    set({ markdownDocumentSourceUrl: url })
  },

  setGraphRagWorkflowJsonText: (text: string | null) => {
    const nextText = typeof text === 'string' ? text : null
    set({ graphRagWorkflowJsonText: nextText })
    const graphData = get().graphData
    if (!graphData) return

    const nextMetadata = { ...(graphData.metadata || {}) } as Record<string, JSONValue>
    const trimmed = typeof nextText === 'string' ? nextText.trim() : ''
    if (!trimmed) {
      if ('graphRagWorkflowJsonText' in nextMetadata) delete nextMetadata.graphRagWorkflowJsonText
      if ('graphRagWorkflowJsonLd' in nextMetadata) delete nextMetadata.graphRagWorkflowJsonLd
    } else {
      nextMetadata.graphRagWorkflowJsonText = nextText as unknown as JSONValue
      try {
        const parsed = JSON.parse(trimmed) as unknown
        if (isJsonValue(parsed) && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const t = (parsed as Record<string, unknown>)['@type']
          if (t === 'rag:GraphRAGWorkflow' || t === 'GraphRAGWorkflow') {
            nextMetadata.graphRagWorkflowJsonLd = parsed as JSONValue
          } else if ('graphRagWorkflowJsonLd' in nextMetadata) {
            delete nextMetadata.graphRagWorkflowJsonLd
          }
        } else if ('graphRagWorkflowJsonLd' in nextMetadata) {
          delete nextMetadata.graphRagWorkflowJsonLd
        }
      } catch {
        if ('graphRagWorkflowJsonLd' in nextMetadata) delete nextMetadata.graphRagWorkflowJsonLd
      }
    }

    const nextGraphDataBase: GraphData = {
      ...graphData,
      metadata: nextMetadata,
    }
    const nextRevision = (get().graphDataRevision || 0) + 1
    const nextGraphData = withGraphDataRevision(nextGraphDataBase, nextRevision)
    set({ graphData: nextGraphData, graphDataRevision: nextRevision })
    try {
      persistGraphDataToLocalStorage(nextGraphData)
    } catch {
      void 0
    }
    try {
      get().scheduleHistory('Update GraphRAG workflow')
    } catch {
      void 0
    }
  },

  setLastTraversalSummary: (summary: TraversalSummary | null) => {
    set({ lastTraversalSummary: summary })
  },
  })
}
