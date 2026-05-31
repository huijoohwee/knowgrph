import type { GraphData, JSONValue } from '@/lib/graph/types'
import type { TraversalSummary } from '@/features/panels/utils/orchestratorTraversal'
import type { GetGraph, SetGraph } from './graphDataSliceAccess'
import { isJsonValue } from '@/lib/graph/jsonValue'
import { containsFrontmatterMermaid, isMarkdownLikeFileName, normalizeMermaidMmdToMarkdown } from 'grph-shared/markdown/mermaidInput'
import { persistGraphDataToLocalStorage } from '@/hooks/store/graphDataPersistence'
import { buildSourceFileLifecycleState } from '@/features/source-files/sourceFileParsedState'
import { isFrontmatterOnlyPolicyActive } from '@/lib/config.render'
import { buildFlowWidgetOverlayEligibleNodeIdSet } from '@/lib/graph/flowWidgetEligibility'
import { parseCanvasWorkspaceFrontmatterPreset, type CanvasWorkspaceFrontmatterPreset } from '@/lib/markdown/frontmatter'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { hashStringToHexSharedContentCached } from '@/lib/hash/textHashCache'
import {
  buildWorkspaceGraphMutationTransitionState,
  isWorkspaceGraphMutationBlocked,
} from '@/features/workspace-table/workspaceTableSsot'
import {
  syncGraphFieldsWithGraphData,
  readGraphRagWorkflowJsonTextFromGraphData,
  withGraphDataRevision,
} from '@/hooks/store/graphDataSliceUtils'

type PendingMarkdownApplyRequest = {
  name: string
  text: string
  force: boolean
  applyViewPreset: boolean
  preset?: CanvasWorkspaceFrontmatterPreset | null
  requireActiveMarkdownDocument: boolean
}

let markdownApplyInFlight = false
let queuedMarkdownApplyRequest: PendingMarkdownApplyRequest | null = null
let activeMarkdownApplyKey = ''
let queuedMarkdownApplyKey = ''
let lastCompletedMarkdownApplyKey = ''
let lastCompletedMarkdownApplyGraph: GraphData | null = null
let lastCompletedMarkdownApplyGraphRevision = -1
let lastCompletedMarkdownApplyGraphContentRevision = -1

function buildCanvasWorkspacePresetApplyKey(preset: CanvasWorkspaceFrontmatterPreset | null | undefined): string {
  if (!preset) return ''
  return [
    preset.canvasSurfaceMode || '',
    preset.canvasRenderMode || '',
    preset.canvas2dRenderer || '',
    preset.canvas3dMode || '',
    preset.documentSemanticMode || '',
    preset.frontmatterModeEnabled === true ? 'fm:1' : preset.frontmatterModeEnabled === false ? 'fm:0' : 'fm:',
    preset.multiDimTableModeEnabled === true ? 'mdtbl:1' : preset.multiDimTableModeEnabled === false ? 'mdtbl:0' : 'mdtbl:',
    preset.documentStructureBaselineLock === true ? 'lock:1' : preset.documentStructureBaselineLock === false ? 'lock:0' : 'lock:',
  ].join('|')
}

function buildMarkdownApplyRequestSemanticKey(request: PendingMarkdownApplyRequest): string {
  const name = String(request.name || '').trim()
  const text = String(request.text || '')
  const textHash = hashStringToHexSharedContentCached(text, 'markdown-document-graph-apply')
  return buildScopedGraphSemanticKey('markdown-document-graph-apply-request', {
    graphSemanticKey: [
      name,
      text.length,
      textHash,
      request.force ? 'force:1' : 'force:0',
      request.applyViewPreset ? 'view:1' : 'view:0',
      request.requireActiveMarkdownDocument ? 'active-doc:1' : 'active-doc:0',
      buildCanvasWorkspacePresetApplyKey(request.preset),
    ].join('|'),
  })
}

function buildMarkdownDocumentSwitchMutationSemanticKey(args: {
  name: string | null
  text: string | null
  applyViewPreset: boolean
}): string {
  const name = String(args.name || '').trim()
  const text = String(args.text || '')
  const textHash = hashStringToHexSharedContentCached(text, 'markdown-document-source-switch')
  return buildScopedGraphSemanticKey('markdown-document-source-switch', {
    graphSemanticKey: [
      name,
      text.length,
      textHash,
      args.applyViewPreset ? 'view:1' : 'view:0',
    ].join('|'),
  })
}

function isCompletedMarkdownApplyRequestCurrent(get: GetGraph, request: PendingMarkdownApplyRequest, requestKey: string): boolean {
  if (!requestKey || lastCompletedMarkdownApplyKey !== requestKey) return false
  const state = get()
  return !!(
    state.graphData &&
    state.graphData === lastCompletedMarkdownApplyGraph &&
    state.graphDataRevision === lastCompletedMarkdownApplyGraphRevision &&
    state.graphContentRevision === lastCompletedMarkdownApplyGraphContentRevision &&
    state.markdownDocumentName === request.name &&
    state.markdownDocumentText === request.text
  )
}

function isMarkdownApplyRequestInFlight(requestKey: string): boolean {
  return !!requestKey && (requestKey === activeMarkdownApplyKey || requestKey === queuedMarkdownApplyKey)
}

function isMarkdownApplyRequestActiveDocumentCurrent(get: GetGraph, request: PendingMarkdownApplyRequest): boolean {
  if (!request.requireActiveMarkdownDocument) return true
  const state = get()
  return state.markdownDocumentName === request.name && state.markdownDocumentText === request.text
}

function buildPendingMarkdownDocumentGraph(args: {
  name: string
  currentGraph: GraphData | null
  preset?: CanvasWorkspaceFrontmatterPreset | null
}): GraphData {
  const name = String(args.name || '').trim()
  const currentMeta = ((args.currentGraph?.metadata || null) as Record<string, unknown> | null) || null
  const currentBaselineGraphMetaKey =
    typeof currentMeta?.baselineGraphMetaKey === 'string'
      ? String(currentMeta.baselineGraphMetaKey || '').trim()
      : ''
  const currentSource = typeof currentMeta?.source === 'string' ? String(currentMeta.source || '').trim() : ''
  const source = name ? `markdown:${name}` : (currentSource || 'markdown:pending')
  const baselineGraphMetaKey =
    currentBaselineGraphMetaKey
    || buildGraphMetaKeyIgnoringPending(args.currentGraph)
    || source
  const preset = args.preset || null
  const context =
    preset?.frontmatterModeEnabled === true || preset?.canvas2dRenderer === 'flowEditor'
      ? 'frontmatter-flow'
      : 'markdown'
  const kind =
    context === 'frontmatter-flow'
      ? 'frontmatter-flow'
      : 'markdown'
  return {
    type: 'Graph',
    context,
    metadata: {
      kind,
      source,
      baselineGraphMetaKey,
      canvasWorkspacePreset: preset
        ? ({
            canvasSurfaceMode: preset.canvasSurfaceMode || null,
            canvasRenderMode: preset.canvasRenderMode || null,
            canvas2dRenderer: preset.canvas2dRenderer || null,
            canvas3dMode: preset.canvas3dMode || null,
            documentSemanticMode: preset.documentSemanticMode || null,
            frontmatterModeEnabled: preset.frontmatterModeEnabled ?? null,
            multiDimTableModeEnabled: preset.multiDimTableModeEnabled ?? null,
            documentStructureBaselineLock: preset.documentStructureBaselineLock ?? null,
          } as Record<string, JSONValue>)
        : null,
      pending: true,
    },
    nodes: [],
    edges: [],
  } as GraphData
}

function resetFrontmatterFlowWidgetRuntimeState(get: GetGraph, graphData: GraphData): void {
  const state = get()
  const enforceFrontmatterOnly = isFrontmatterOnlyPolicyActive({
    canvasRenderMode: state.canvasRenderMode,
    canvas2dRenderer: state.canvas2dRenderer,
  })
  if (!enforceFrontmatterOnly) return
  if (isWorkspaceGraphMutationBlocked(state)) return

  const parsedNodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  const eligibleFlowWidgetNodeIds = buildFlowWidgetOverlayEligibleNodeIdSet(parsedNodes as any)
  const isEligibleFlowWidgetNodeId = (id: unknown): boolean => {
    const normalized = String(id || '').trim()
    return !!normalized && eligibleFlowWidgetNodeIds.has(normalized)
  }
  const activeWidgetIds = Array.isArray(state.openWidgetNodeIds) ? state.openWidgetNodeIds : []
  const sanitizedWidgetIds = activeWidgetIds
    .map(id => String(id || '').trim())
    .filter(isEligibleFlowWidgetNodeId)
  state.setOpenWidgetNodeIds(sanitizedWidgetIds)
  const currentPinnedByNodeId = state.flowWidgetPinnedByNodeId || {}
  const nextPinnedByNodeId = Object.fromEntries(
    Object.entries(currentPinnedByNodeId).filter(([id]) => isEligibleFlowWidgetNodeId(id)),
  ) as Record<string, boolean>
  state.setFlowWidgetPinnedByNodeId(nextPinnedByNodeId)
}

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
    const shouldAutoEnableFrontmatter = opts?.autoEnableFrontmatter !== false
    const state = get()
    const requestedApplyViewPreset = typeof opts?.applyViewPreset === 'boolean' ? opts.applyViewPreset !== false : true
    const sameActiveDocumentText =
      state.markdownDocumentName === name &&
      state.markdownDocumentText === text
    const applyViewPreset =
      requestedApplyViewPreset === false &&
      sameActiveDocumentText &&
      state.markdownDocumentApplyViewPreset === true
        ? true
        : requestedApplyViewPreset
    const needsAutoEnable = shouldAutoEnableFrontmatter &&
      !(state.frontmatterModeEnabled || false) &&
      containsFrontmatterMermaid(nextText)
    const documentSwitches =
      state.markdownDocumentName !== name ||
      state.markdownDocumentText !== text ||
      state.markdownDocumentApplyViewPreset !== applyViewPreset
    if (
      !needsAutoEnable &&
      !documentSwitches
    ) return
    const transitionState = documentSwitches
      ? buildWorkspaceGraphMutationTransitionState({
          workspaceViewMode: state.workspaceViewMode,
          workspaceCanvasPaneOpen: state.workspaceCanvasPaneOpen,
          markdownWorkspaceIndexingInFlight: state.markdownWorkspaceIndexingInFlight,
          transitionSemanticKey: buildMarkdownDocumentSwitchMutationSemanticKey({
            name,
            text,
            applyViewPreset,
          }),
        })
      : {}
    set({
      markdownDocumentName: name,
      markdownDocumentText: text,
      markdownDocumentApplyViewPreset: applyViewPreset,
      markdownTokens: null, // Invalidate tokens
      markdownTokensPath: null,
      markdownTokensKey: null,
      markdownTokensMeta: null,
      markdownTokensStartLineOffset: null,
      ...(needsAutoEnable ? { frontmatterModeEnabled: true } : {}),
      ...transitionState,
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
    canvasWorkspacePreset?: CanvasWorkspaceFrontmatterPreset | null
    normalizeMermaidMmd?: boolean
  }): Promise<boolean> => {
    const name = String(args?.name || '').trim()
    if (!name) return false
    const rawText = String(args?.text || '')
    const text = args?.normalizeMermaidMmd === false ? rawText : normalizeMermaidMmdToMarkdown(name, rawText)
    const hasProvidedCanvasPreset = Object.prototype.hasOwnProperty.call(args || {}, 'canvasWorkspacePreset')
    const shouldApplyExplicitCanvasPreset = hasProvidedCanvasPreset && !!args.canvasWorkspacePreset
    const shouldResolveCanvasPreset =
      shouldApplyExplicitCanvasPreset ||
      args?.applyViewPreset !== false ||
      args?.applyToGraph === true
    const parsedTextPreset = shouldResolveCanvasPreset
      ? (hasProvidedCanvasPreset ? args.canvasWorkspacePreset ?? null : parseCanvasWorkspaceFrontmatterPreset(text))
      : null
    const applyViewPresetForSwitch = args?.applyViewPreset !== false
    get().setMarkdownDocument(name, text, {
      autoEnableFrontmatter: args?.autoEnableFrontmatter,
      applyViewPreset: args?.applyViewPreset,
    })

    if ((args?.applyViewPreset !== false || shouldApplyExplicitCanvasPreset) && text.trim()) {
      try {
        const { applyCanvasFrontmatterPreset } = (await import('@/features/parsers/canvasFrontmatterPreset')) as typeof import('@/features/parsers/canvasFrontmatterPreset')
        applyCanvasFrontmatterPreset({
          graphData: get().graphData,
          rawText: text,
          preset: parsedTextPreset || undefined,
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
      const request: PendingMarkdownApplyRequest = {
        name,
        text,
        force: args?.forceApplyToGraph !== false,
        applyViewPreset: applyViewPresetForSwitch,
        preset: parsedTextPreset,
        requireActiveMarkdownDocument: true,
      }
      const requestKey = buildMarkdownApplyRequestSemanticKey(request)
      if (isCompletedMarkdownApplyRequestCurrent(get, request, requestKey)) return true
      if (isMarkdownApplyRequestInFlight(requestKey)) return false

      if (applyViewPresetForSwitch) {
        get().setGraphData(buildPendingMarkdownDocumentGraph({
          name,
          currentGraph: get().graphData,
          preset: parsedTextPreset,
        }))
      }
      try {
        const graphApplied = await get().applyMarkdownDocumentToGraph(name, text, {
          force: args?.forceApplyToGraph !== false,
          preset: parsedTextPreset,
          applyViewPreset: applyViewPresetForSwitch,
          requireActiveMarkdownDocument: true,
        })
        if (graphApplied) return true
        const active = get()
        return !!(
          applyViewPresetForSwitch &&
          active.markdownDocumentName === name &&
          active.markdownDocumentText === text
        )
      } catch {
        const active = get()
        return !!(
          applyViewPresetForSwitch &&
          active.markdownDocumentName === name &&
          active.markdownDocumentText === text
        )
      }
    }
    return true
  },

  applyMarkdownDocumentToGraph: async (name: string, text: string, opts?: { force?: boolean; preset?: CanvasWorkspaceFrontmatterPreset | null; applyViewPreset?: boolean; requireActiveMarkdownDocument?: boolean }) => {
    const runApply = async (request: PendingMarkdownApplyRequest): Promise<boolean> => {
      const nextName = String(request.name || '').trim()
      const nextText = String(request.text || '')
      if (!nextName || !nextText.trim()) return false

      const lower = nextName.toLowerCase()
      const isMarkdown = isMarkdownLikeFileName(lower)
      if (!isMarkdown) return false

      const state = get()
      const shouldApply = (() => {
        if (request.force) return true
        if ((state.documentSemanticMode || 'document') !== 'document') return false

        if (state.frontmatterModeEnabled || false) {
          const hasFrontmatterMermaid = containsFrontmatterMermaid(nextText)
          if (hasFrontmatterMermaid) return true
        }

        return true
      })()

      if (!shouldApply) return false
      if (!isMarkdownApplyRequestActiveDocumentCurrent(get, request)) return false

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

      const canReuseParsedSourceGraph = !!(
        exactSourceFile &&
        exactSourceFile.status === 'parsed' &&
        String(exactSourceFile.text || '') === nextText &&
        exactSourceFile.parsedGraphData
      )
      const parsedTextPreset = request.preset === undefined
        ? parseCanvasWorkspaceFrontmatterPreset(nextText)
        : request.preset
      if (canReuseParsedSourceGraph) {
        const reusedGraph = exactSourceFile.parsedGraphData as GraphData
        if (!isMarkdownApplyRequestActiveDocumentCurrent(get, request)) return false
        if (request.applyViewPreset !== false) {
          const { applyCanvasFrontmatterPreset } = (await import('@/features/parsers/canvasFrontmatterPreset')) as typeof import('@/features/parsers/canvasFrontmatterPreset')
          applyCanvasFrontmatterPreset({
            graphData: reusedGraph,
            rawText: nextText,
            preset: parsedTextPreset || undefined,
          })
        }
        if (!isMarkdownApplyRequestActiveDocumentCurrent(get, request)) return false
        get().setGraphData(reusedGraph)
        const { applyFrontmatterFlowImportModes } = (await import('@/features/parsers/frontmatterFlowImportMode')) as typeof import('@/features/parsers/frontmatterFlowImportMode')
        applyFrontmatterFlowImportModes(reusedGraph, {
          applyViewPreset: request.applyViewPreset,
          resetWidgetLayout: request.applyViewPreset,
          preset: parsedTextPreset,
          rawText: nextText,
        })
        resetFrontmatterFlowWidgetRuntimeState(get, reusedGraph)
        return !!(((reusedGraph.nodes || []).length > 0) || ((reusedGraph.edges || []).length > 0))
      }

      const { loadGraphDataFromTextViaParser } = (await import('@/features/parsers/loader')) as typeof import('@/features/parsers/loader')
      const res = await loadGraphDataFromTextViaParser(nextName, nextText, { applyToStore: false, syncMarkdownDocument: false })
      const parsedGraph = res?.graphData || null
      if (!isMarkdownApplyRequestActiveDocumentCurrent(get, request)) return false
      if (request.applyViewPreset !== false) {
        const { applyCanvasFrontmatterPreset } = (await import('@/features/parsers/canvasFrontmatterPreset')) as typeof import('@/features/parsers/canvasFrontmatterPreset')
        applyCanvasFrontmatterPreset({
          graphData: parsedGraph,
          rawText: nextText,
          preset: parsedTextPreset || undefined,
        })
      }
      if (parsedGraph) {
        if (!isMarkdownApplyRequestActiveDocumentCurrent(get, request)) return false
        get().setGraphData(parsedGraph)
        const { applyFrontmatterFlowImportModes } = (await import('@/features/parsers/frontmatterFlowImportMode')) as typeof import('@/features/parsers/frontmatterFlowImportMode')
        applyFrontmatterFlowImportModes(parsedGraph, {
          applyViewPreset: request.applyViewPreset,
          resetWidgetLayout: request.applyViewPreset,
          preset: parsedTextPreset,
          rawText: nextText,
        })
        resetFrontmatterFlowWidgetRuntimeState(get, parsedGraph)
      }
      return !!(parsedGraph && ((parsedGraph.nodes || []).length > 0 || (parsedGraph.edges || []).length > 0))
    }

    const request: PendingMarkdownApplyRequest = {
      name: String(name || ''),
      text: String(text || ''),
      force: opts?.force === true,
      applyViewPreset: opts?.applyViewPreset !== false,
      preset: opts?.preset,
      requireActiveMarkdownDocument: opts?.requireActiveMarkdownDocument === true,
    }
    const requestKey = buildMarkdownApplyRequestSemanticKey(request)
    if (isCompletedMarkdownApplyRequestCurrent(get, request, requestKey)) return true
    if (markdownApplyInFlight) {
      if (isMarkdownApplyRequestInFlight(requestKey)) return false
      queuedMarkdownApplyRequest = request
      queuedMarkdownApplyKey = requestKey
      return false
    }
    markdownApplyInFlight = true
    activeMarkdownApplyKey = requestKey
    try {
      let currentRequest: PendingMarkdownApplyRequest | null = request
      let currentRequestKey = requestKey
      let result = false
      while (currentRequest) {
        if (isCompletedMarkdownApplyRequestCurrent(get, currentRequest, currentRequestKey)) {
          result = true
        } else {
          result = await runApply(currentRequest)
          if (result) {
            const state = get()
            lastCompletedMarkdownApplyKey = currentRequestKey
            lastCompletedMarkdownApplyGraph = state.graphData as GraphData | null
            lastCompletedMarkdownApplyGraphRevision = state.graphDataRevision
            lastCompletedMarkdownApplyGraphContentRevision = state.graphContentRevision
          }
        }
        currentRequest = queuedMarkdownApplyRequest
        currentRequestKey = queuedMarkdownApplyKey
        activeMarkdownApplyKey = currentRequestKey
        queuedMarkdownApplyRequest = null
        queuedMarkdownApplyKey = ''
      }
      return result
    } finally {
      queuedMarkdownApplyRequest = null
      queuedMarkdownApplyKey = ''
      activeMarkdownApplyKey = ''
      markdownApplyInFlight = false
    }
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
