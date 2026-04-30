import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useShallow } from 'zustand/react/shallow'
import type { GraphData } from '@/lib/graph/types'
import type { GraphState } from '@/hooks/useGraphStore'
import { keywordGraphCache, KEYWORD_GRAPH_ALGO_VERSION } from '@/features/semantic-mode/keywordGraph'
import { hashText } from '@/features/parsers/hash'
import { buildGraphMetaKey } from '@/lib/graph/graphMetaKey'
import { LRUCache } from '@/lib/cache/LRUCache'
import { pipelinePerfEnd, pipelinePerfStart } from '@/lib/pipelinePerf'
import { deriveKeywordGraphInWorker, deriveKeywordGraphPreviewInWorker } from '@/features/semantic-mode/keywordGraphWorker'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'
import { useApiGraphBipartiteGraphData } from '@/features/bipartite/apiGraphBipartite'
import type { Canvas2dRendererId } from '@/lib/config'
import { isFrontmatterOnlyPolicyActive } from '@/lib/config.render'
import { buildKeywordSourceTextFromBaselineGraph, markdownToPlainText, stripFrontmatter } from './keywordSourceText'
import { mergeKeywordGraphWithSourceNodes } from './keywordGraphMerge'
import {
  parseWorkspaceFrontmatterMermaidGraphDataCached,
  parseWorkspaceJsonGraphDataCached,
  WORKSPACE_STRUCTURED_PARSE_DEBOUNCE_MS,
} from './workspaceStructuredGraph'

const keywordSourceTextCache = new LRUCache<string, { text: string; hash: string }>(40)
const keywordPreviewGraphCache = new LRUCache<string, GraphData>(20)

const INACTIVE_GRAPH_SLICE = {
  baseGraphDataRaw: null as GraphData | null,
  mode: 'document' as 'document' | 'keyword',
  markdownName: null as string | null,
  markdownText: null as string | null,
  canvasRenderMode: '2d' as '2d' | '3d',
  canvas2dRenderer: 'd3' as Canvas2dRendererId,
  keywordSourceMaxLines: 8000,
  keywordSourceMaxChars: 120_000,
  keywordGraphPreviewDebounceMs: 200,
  keywordGraphFullDebounceMs: 800,
  keywordGraphEdgesPerNode: 6,
  keywordGraphMaxEdgesCap: 2400,
  keywordGraphMentionEdgesPerSourceNode: 6,
  revision: 0,
} as const

export function useActiveGraphData(enabled: boolean = true): GraphData | null {
  const selector = React.useMemo(
    () =>
      enabled
        ? (s: GraphState) => ({
            baseGraphDataRaw: s.graphData as GraphData | null,
            mode: (s.documentSemanticMode || 'document') as 'document' | 'keyword',
            markdownName: s.markdownDocumentName || null,
            markdownText: s.markdownDocumentText || null,
            canvasRenderMode: (s.canvasRenderMode || '2d') as '2d' | '3d',
            canvas2dRenderer: (s.canvas2dRenderer || 'd3') as Canvas2dRendererId,
            keywordSourceMaxLines: s.keywordSourceMaxLines,
            keywordSourceMaxChars: s.keywordSourceMaxChars,
            keywordGraphPreviewDebounceMs: s.keywordGraphPreviewDebounceMs,
            keywordGraphFullDebounceMs: s.keywordGraphFullDebounceMs,
            keywordGraphEdgesPerNode: s.keywordGraphEdgesPerNode,
            keywordGraphMaxEdgesCap: s.keywordGraphMaxEdgesCap,
            keywordGraphMentionEdgesPerSourceNode: s.keywordGraphMentionEdgesPerSourceNode,
            revision: s.graphDataRevision || 0,
          })
        : () => INACTIVE_GRAPH_SLICE,
    [enabled],
  )

  const {
    baseGraphDataRaw,
    mode,
    markdownName,
    markdownText,
    canvasRenderMode,
    canvas2dRenderer,
    keywordSourceMaxLines,
    keywordSourceMaxChars,
    keywordGraphPreviewDebounceMs,
    keywordGraphFullDebounceMs,
    keywordGraphEdgesPerNode,
    keywordGraphMaxEdgesCap,
    keywordGraphMentionEdgesPerSourceNode,
    revision,
  } = useGraphStore(useShallow(selector))
  const frontmatterOnlyPolicyActive = React.useMemo(() => {
    return isFrontmatterOnlyPolicyActive({ canvasRenderMode, canvas2dRenderer })
  }, [canvas2dRenderer, canvasRenderMode])
  const effectiveMode: 'document' | 'keyword' = frontmatterOnlyPolicyActive ? 'document' : mode

  const wantsApiGraphBipartite = false
  const debouncedStructuredMarkdownText = useDebouncedValue(markdownText, WORKSPACE_STRUCTURED_PARSE_DEBOUNCE_MS)
  const workspaceJsonGraphData = React.useMemo(
    () =>
      enabled && !wantsApiGraphBipartite
        ? parseWorkspaceJsonGraphDataCached({ markdownName, markdownText: debouncedStructuredMarkdownText })
        : null,
    [debouncedStructuredMarkdownText, enabled, markdownName, wantsApiGraphBipartite],
  )
  const workspaceFrontmatterMermaidGraphData = React.useMemo(() => {
    if (!enabled || wantsApiGraphBipartite) return null
    return parseWorkspaceFrontmatterMermaidGraphDataCached({
      markdownName,
      markdownText: debouncedStructuredMarkdownText,
    })
  }, [debouncedStructuredMarkdownText, enabled, markdownName, wantsApiGraphBipartite])
  const hasStructuredWorkspaceGraph = !!workspaceJsonGraphData || !!workspaceFrontmatterMermaidGraphData
  const baseGraphData = workspaceJsonGraphData || workspaceFrontmatterMermaidGraphData || baseGraphDataRaw
  const { graphData: apiGraphBipartite } = useApiGraphBipartiteGraphData(wantsApiGraphBipartite)

  const lastRef = React.useRef<GraphData | null>(null)

  React.useEffect(() => {
    if (!enabled) return
    if (!wantsApiGraphBipartite) return
    if (!apiGraphBipartite) return
    lastRef.current = apiGraphBipartite
  }, [apiGraphBipartite, enabled, wantsApiGraphBipartite])

  const lastKeywordRef = React.useRef<{ cacheKey: string; docId: string; graph: GraphData } | null>(null)
  const [asyncBump, setAsyncBump] = React.useState(0)
  const pendingKeyRef = React.useRef<string | null>(null)
  const pendingPreviewKeyRef = React.useRef<string | null>(null)

  const keywordDeriveInputs = React.useMemo(() => {
    if (wantsApiGraphBipartite) return null
    if (hasStructuredWorkspaceGraph) return null
    if (!baseGraphData) return null
    if (effectiveMode !== 'keyword') return null

    const baseMetaKey = buildGraphMetaKey(baseGraphData)
    const baseLayerHash = (() => {
      const meta = (baseGraphData.metadata || null) as Record<string, unknown> | null
      const h = meta && typeof meta.sourceLayerHash === 'string' ? meta.sourceLayerHash.trim() : ''
      return h || ''
    })()

    const meta = baseGraphData.metadata && typeof baseGraphData.metadata === 'object' && !Array.isArray(baseGraphData.metadata)
      ? (baseGraphData.metadata as Record<string, unknown>)
      : null
    const sourceLayerComposition = typeof meta?.sourceLayerComposition === 'string' ? String(meta.sourceLayerComposition) : ''
    const isComposed = sourceLayerComposition === 'compose' || Array.isArray(meta?.sourceLayers)
    const preferredMarkdownText = typeof markdownText === 'string' && markdownText.trim() ? markdownText : ''
    const prefersMarkdown = !isComposed && preferredMarkdownText.length > 0

    const cacheKeyForText = `${baseLayerHash || baseMetaKey || `rev:${String(revision)}`}:L${keywordSourceMaxLines}:C${keywordSourceMaxChars}`
    const cachedText = prefersMarkdown ? null : keywordSourceTextCache.get(cacheKeyForText)

    const sourceText = (() => {
      if (!prefersMarkdown) {
        return cachedText
          ? cachedText.text
          : buildKeywordSourceTextFromBaselineGraph(baseGraphData, { maxLines: keywordSourceMaxLines, maxChars: keywordSourceMaxChars })
      }
      const mdPlain = markdownToPlainText(stripFrontmatter(preferredMarkdownText))
      const baseline = buildKeywordSourceTextFromBaselineGraph(baseGraphData, { maxLines: keywordSourceMaxLines, maxChars: keywordSourceMaxChars })
      const combined = [mdPlain, baseline].filter(Boolean).join('\n')
      if (combined.length <= keywordSourceMaxChars) return combined
      return combined.slice(0, keywordSourceMaxChars)
    })()
    const sourceTextHash = prefersMarkdown
      ? hashText(sourceText)
      : (cachedText ? cachedText.hash : (baseLayerHash || hashText(sourceText)))
    if (!prefersMarkdown && !cachedText) keywordSourceTextCache.set(cacheKeyForText, { text: sourceText, hash: sourceTextHash })

    const docId = baseMetaKey
      ? `graph:${hashText(baseMetaKey)}`
      : markdownName && markdownName.trim()
        ? `md:${hashText(markdownName.trim())}`
        : `graph:${hashText(String(revision))}`

    const tuningKey = `e${keywordGraphEdgesPerNode}-m${keywordGraphMaxEdgesCap}-me${keywordGraphMentionEdgesPerSourceNode}-L${keywordSourceMaxLines}-C${keywordSourceMaxChars}`
    const cacheKey = `keyword:v${KEYWORD_GRAPH_ALGO_VERSION}:${docId}:${sourceTextHash}:${tuningKey}`
    return {
      cacheKey,
      docId,
      sourceText,
      sourceTextHash,
      tuning: {
        edgesPerNode: keywordGraphEdgesPerNode,
        maxEdgesCap: keywordGraphMaxEdgesCap,
        mentionEdgesPerSourceNode: keywordGraphMentionEdgesPerSourceNode,
      },
    }
  }, [
    baseGraphData,
    hasStructuredWorkspaceGraph,
    keywordGraphEdgesPerNode,
    keywordGraphMaxEdgesCap,
    keywordGraphMentionEdgesPerSourceNode,
    keywordSourceMaxChars,
    keywordSourceMaxLines,
    markdownName,
    markdownText,
    effectiveMode,
    revision,
    wantsApiGraphBipartite,
  ])

  const debouncedKeywordPreviewInputs = useDebouncedValue(
    keywordDeriveInputs,
    Math.max(0, Number(keywordGraphPreviewDebounceMs) || 0),
  )
  const debouncedKeywordFullInputs = useDebouncedValue(
    keywordDeriveInputs,
    Math.max(0, Number(keywordGraphFullDebounceMs) || 0),
  )

  const computed = React.useMemo(() => {
    void asyncBump
    if (!baseGraphData) return null
    if (hasStructuredWorkspaceGraph) return baseGraphData
    if (effectiveMode !== 'keyword') return baseGraphData

    const inputs = keywordDeriveInputs
    if (!inputs) return null

    const cached = keywordGraphCache.get(inputs.cacheKey)
    if (cached) return cached.graph
    const preview = keywordPreviewGraphCache.get(inputs.cacheKey)
    if (preview) return preview
    if (lastKeywordRef.current) {
      if (lastKeywordRef.current.cacheKey === inputs.cacheKey) return lastKeywordRef.current.graph
      const prefix = `keyword:v${KEYWORD_GRAPH_ALGO_VERSION}:`
      if (lastKeywordRef.current.docId === inputs.docId && lastKeywordRef.current.cacheKey.startsWith(prefix)) {
        return lastKeywordRef.current.graph
      }
    }
    return baseGraphData
  }, [asyncBump, baseGraphData, hasStructuredWorkspaceGraph, keywordDeriveInputs, effectiveMode])

  const baseGraphDataRef = React.useRef<GraphData | null>(null)
  React.useEffect(() => {
    baseGraphDataRef.current = baseGraphData
  }, [baseGraphData])

  const keywordErrorToastKeyRef = React.useRef<Set<string>>(new Set())
  const readKeywordWorkerLastError = (): string => {
    try {
      const raw = (globalThis as unknown as { __kgKeywordWorkerLastError?: unknown }).__kgKeywordWorkerLastError
      return typeof raw === 'string' ? raw.trim() : ''
    } catch {
      return ''
    }
  }

  React.useEffect(() => {
    if (!enabled) return
    if (!baseGraphData) return
    if (effectiveMode !== 'keyword') return
    const inputs = debouncedKeywordPreviewInputs
    if (!inputs) return

    if (keywordGraphCache.get(inputs.cacheKey)) return
    if (keywordPreviewGraphCache.get(inputs.cacheKey)) return
    if (pendingPreviewKeyRef.current === inputs.cacheKey) return
    pendingPreviewKeyRef.current = inputs.cacheKey

    let canceled = false
    const controller = new AbortController()
    const t0 = pipelinePerfStart()

    void (async () => {
      try {
        if (canceled) return
        const snippet = inputs.sourceText.length > 16_000 ? inputs.sourceText.slice(0, 16_000) : inputs.sourceText
        if (!snippet.trim()) return

        const g = await deriveKeywordGraphPreviewInWorker({
          documentId: inputs.docId,
          documentText: snippet,
          sourceLabel: markdownName || undefined,
          sourceTextHash: inputs.sourceTextHash,
          tuning: {
            edgesPerNode: inputs.tuning.edgesPerNode,
            maxEdgesCap: inputs.tuning.maxEdgesCap,
          },
          timeoutMs: 20_000,
          signal: controller.signal,
        })
        if (!g) return
        const base = baseGraphDataRef.current
        if (!base) return
        const merged = mergeKeywordGraphWithSourceNodes({
          baseGraphData: base,
          keywordGraph: g,
          sourceId: inputs.docId,
          tuning: { mentionEdgesPerSourceNode: inputs.tuning.mentionEdgesPerSourceNode },
        })
        keywordPreviewGraphCache.set(inputs.cacheKey, merged)
        pipelinePerfEnd({ name: 'derive', stage: 'keyword:preview', t0, detail: { cacheKey: inputs.cacheKey } })
        setAsyncBump(v => v + 1)
      } catch {
        void 0
      } finally {
        if (pendingPreviewKeyRef.current === inputs.cacheKey) pendingPreviewKeyRef.current = null
        if (!keywordPreviewGraphCache.get(inputs.cacheKey)) {
          const shouldSkip = controller.signal.aborted || canceled
          if (!shouldSkip) {
            const err = readKeywordWorkerLastError()
            if (err && !keywordErrorToastKeyRef.current.has(`preview:${inputs.cacheKey}`)) {
              keywordErrorToastKeyRef.current.add(`preview:${inputs.cacheKey}`)
              try {
                useGraphStore.getState().upsertUiToast({
                  id: `kw-preview-failed:${hashText(inputs.cacheKey)}`,
                  kind: 'warning',
                  message: `Keyword preview failed: ${err}`,
                  ttlMs: 6000,
                })
              } catch {
                void 0
              }
            }
          }
        }
      }
    })()

    return () => {
      canceled = true
      try {
        controller.abort()
      } catch {
        void 0
      }
      if (pendingPreviewKeyRef.current === inputs.cacheKey) pendingPreviewKeyRef.current = null
    }
  }, [baseGraphData, debouncedKeywordPreviewInputs, enabled, markdownName, effectiveMode])

  React.useEffect(() => {
    if (!enabled) return
    if (!baseGraphData) return
    if (effectiveMode !== 'keyword') return
    const inputs = debouncedKeywordFullInputs
    if (!inputs) return

    if (keywordGraphCache.get(inputs.cacheKey)) return
    if (pendingKeyRef.current === inputs.cacheKey) return
    pendingKeyRef.current = inputs.cacheKey

    const tAll = pipelinePerfStart()
    const tDerive = pipelinePerfStart()
    let canceled = false
    const controller = new AbortController()

    void (async () => {
      try {
        const derivedGraph = await deriveKeywordGraphInWorker({
          documentId: inputs.docId,
          documentText: inputs.sourceText,
          sourceLabel: markdownName || undefined,
          sourceTextHash: inputs.sourceTextHash,
          tuning: {
            edgesPerNode: inputs.tuning.edgesPerNode,
            maxEdgesCap: inputs.tuning.maxEdgesCap,
          },
          timeoutMs: 90_000,
          signal: controller.signal,
        })
        if (canceled) return
        if (!derivedGraph) return

        const base = baseGraphDataRef.current
        if (!base) return
        const graph = mergeKeywordGraphWithSourceNodes({
          baseGraphData: base,
          keywordGraph: derivedGraph,
          sourceId: inputs.docId,
          tuning: { mentionEdgesPerSourceNode: inputs.tuning.mentionEdgesPerSourceNode },
        })
        keywordGraphCache.set(inputs.cacheKey, { graph, nodeCountsById: new Map() })
        pipelinePerfEnd({
          name: 'derive',
          stage: 'keyword:graph',
          t0: tDerive,
          detail: {
            cacheKey: inputs.cacheKey,
            nodes: Array.isArray(graph.nodes) ? graph.nodes.length : 0,
            edges: Array.isArray(graph.edges) ? graph.edges.length : 0,
          },
        })
        pipelinePerfEnd({ name: 'derive', stage: 'keyword:all', t0: tAll, detail: { cacheKey: inputs.cacheKey } })
        setAsyncBump(v => v + 1)
      } catch {
        void 0
      } finally {
        if (pendingKeyRef.current === inputs.cacheKey) pendingKeyRef.current = null
        if (!keywordGraphCache.get(inputs.cacheKey)) {
          const shouldSkip = controller.signal.aborted || canceled
          if (!shouldSkip) {
            const err = readKeywordWorkerLastError()
            if (err && !keywordErrorToastKeyRef.current.has(`full:${inputs.cacheKey}`)) {
              keywordErrorToastKeyRef.current.add(`full:${inputs.cacheKey}`)
              try {
                useGraphStore.getState().upsertUiToast({
                  id: `kw-derive-failed:${hashText(inputs.cacheKey)}`,
                  kind: 'warning',
                  message: `Keyword graph failed: ${err}`,
                  ttlMs: 8000,
                })
              } catch {
                void 0
              }
            }
          }
        }
      }
    })()

    return () => {
      canceled = true
      try {
        controller.abort()
      } catch {
        void 0
      }
    }
  }, [baseGraphData, debouncedKeywordFullInputs, enabled, markdownName, effectiveMode])

  React.useEffect(() => {
    if (!enabled) return
    const next = wantsApiGraphBipartite ? apiGraphBipartite : computed
    lastRef.current = next
    if (wantsApiGraphBipartite) return
    if (effectiveMode === 'keyword' && keywordDeriveInputs) {
      const cached = keywordGraphCache.get(keywordDeriveInputs.cacheKey)
      if (cached && cached.graph) {
        lastKeywordRef.current = { cacheKey: keywordDeriveInputs.cacheKey, docId: keywordDeriveInputs.docId, graph: cached.graph }
      }
    }
  }, [apiGraphBipartite, computed, enabled, keywordDeriveInputs, effectiveMode, wantsApiGraphBipartite])

  const out = wantsApiGraphBipartite ? apiGraphBipartite : computed
  return enabled ? out : lastRef.current
}
