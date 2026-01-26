import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphSchema } from '@/lib/graph/schema'
import type {
  AgenticGraphRagPathValue,
  AgenticRagNodeView,
  GraphData,
  GraphNode,
  JSONValue,
} from '@/lib/graph/types'
import {
  agenticRagNodeFromGraphNode,
  getAgenticRagContextComparison,
  getAgenticRagIgnoreFiltersSummary,
  buildAgenticRagIgnoreFiltersFromRawPatterns,
} from '@/lib/graph/jsonld/index'
import {
  findGraphRagTraversalEdgeIds,
  findTraversalEdgeIds,
  isGraphRagPathValue,
  toParsedTraversePath,
} from '@/lib/graph/graphragTraversal'
import {
  ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS,
  TRAVERSAL_MAX_DEPTH_DEFAULT,
  buildEdgeIdsForPath,
  buildGraphRagTraversalSummary,
  findGraphRagOwnerNode,
  persistTraversalSummaryToGraph,
  runEdgeTraversalSequenceGlobal,
  type GraphRagTraversalSummary,
} from '@/features/panels/utils/orchestratorTraversal'
import { lsInt, lsSetInt } from '@/lib/persistence'
import { IMPORT_EXPORT_STATUS_COPY, LS_KEYS } from '@/lib/config'
import { buildGraphRagWorkflowFromGraphData, type GraphRagWorkflowJsonLd } from '@/features/panels/utils/graphragConfig'
import { validateGraphRagWorkflowJsonLdObject } from '@/features/panels/utils/workflowJsonLd'
import type { GraphRagPathHelper } from '@/features/panels/views/OrchestratorTraversalPanelsModel'
import { buildOrchestratorTraversalSectionViewModel } from '@/features/panels/views/OrchestratorTraversalSectionModel'
import AgenticRagContextSection from '@/features/panels/views/AgenticRagContextSection'
import { OrchestratorTraversalSection } from '@/features/panels/views/OrchestratorTraversalStackSection'
import { useOrchestratorTraversalEditState } from '@/features/panels/hooks/useOrchestratorTraversalEditState'
import Tooltip from '@/features/panels/ui/Tooltip'
import {
  ORCHESTRATOR_TRAVERSAL_TOOLTIP,
  ZERO_TO_ONE_GRAPH_TRAVERSAL_LABEL,
  AGENTIC_RAG_NODE_JSON_STATUS_NONE,
  AGENTIC_RAG_NODE_JSON_STATUS_COPIED,
  UI_COPY,
} from '@/lib/config'
import { getOrchestratorSectionListLabel } from '@/features/panels/config'
import { getPillClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type OrchestratorSettingsSectionProps = {
  variant: 'floatingPanel' | 'bottomPanel'
  graphRagCollapsed: boolean
  presetsCollapsed: boolean
  editorCollapsed: boolean
  contextCollapsed: boolean
  setGraphRagCollapsed: (next: boolean) => void
  setPresetsCollapsed: (next: boolean) => void
  setEditorCollapsed: (next: boolean) => void
  setContextCollapsed: (next: boolean) => void
  indexingCollapsed: boolean
  setIndexingCollapsed: (next: boolean) => void
  tracingCollapsed: boolean
  setTracingCollapsed: (next: boolean) => void
}

export default function OrchestratorSettingsSection({
  variant,
  graphRagCollapsed,
  presetsCollapsed,
  editorCollapsed,
  contextCollapsed,
  setGraphRagCollapsed,
  setPresetsCollapsed,
  setEditorCollapsed,
  setContextCollapsed,
  indexingCollapsed,
  setIndexingCollapsed,
  tracingCollapsed,
  setTracingCollapsed,
}: OrchestratorSettingsSectionProps) {
  const schema = useGraphStore(s => s.schema) as GraphSchema
  const setSchema = useGraphStore(s => s.setSchema)
  const setThreeConfig = useGraphStore(s => s.setThreeConfig)
  const setCharge = useGraphStore(s => s.setCharge)
  const setCollisionByType = useGraphStore(s => s.setCollisionByType)
  const data = useGraphStore(s => s.graphData)
  const setGraphData = useGraphStore(s => s.setGraphData)
  const graphId = useGraphStore(s => s.graphId)
  const graphRagWorkflowJsonText = useGraphStore(s => s.graphRagWorkflowJsonText)
  const setGraphRagWorkflowJsonText = useGraphStore(s => s.setGraphRagWorkflowJsonText)
  const setLastTraversalSummary = useGraphStore(s => s.setLastTraversalSummary)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectNode = useGraphStore(s => s.selectNode)
  const selectEdge = useGraphStore(s => s.selectEdge)
  const requestAiKgTraversal = useGraphStore(s => s.requestAiKgTraversal)
  const setRequestAiKgTraversal = useGraphStore(s => s.setRequestAiKgTraversal)
  const uiIconPillClass = useGraphStore(s => s.uiIconPillClass)
  const uiIconPillBadgeTextSizeClass = useGraphStore(s => s.uiIconPillBadgeTextSizeClass)
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const [traversalDelayMs, setTraversalDelayMs] = React.useState(() =>
    lsInt(LS_KEYS.orchestratorTraversalDelayMs, ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS),
  )
  const [traversalStartNodeId, setTraversalStartNodeId] = React.useState('')
  const [traversalMaxDepth, setTraversalMaxDepth] = React.useState(TRAVERSAL_MAX_DEPTH_DEFAULT)
  const [traversalLabelFilter, setTraversalLabelFilter] = React.useState('')
  const [agenticCopyStatus, setAgenticCopyStatus] = React.useState<string | null>(null)
  const { lastTraversal, setLastTraversal, editState, editPaths } = useOrchestratorTraversalEditState()

  const handleSetTraversalDelayMs = React.useCallback(
    (value: number) => {
      const clamped = lsSetInt(LS_KEYS.orchestratorTraversalDelayMs, value, {
        min: ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS,
        max: ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS,
      })
      setTraversalDelayMs(clamped)
    },
    [],
  )

  const graphRagWorkflowState = React.useMemo(() => {
    const graph = data as GraphData | null
    const safeGraphId = typeof graphId === 'string' && graphId.trim() ? graphId : 'graph'
    const fallback = buildGraphRagWorkflowFromGraphData(safeGraphId, graph)
    const text = typeof graphRagWorkflowJsonText === 'string' ? graphRagWorkflowJsonText : ''
    const trimmed = text.trim()
    if (!trimmed) {
      return {
        workflow: fallback,
        source: 'generated' as const,
        error: null as string | null,
        validationErrors: [] as string[],
      }
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown
      const result = validateGraphRagWorkflowJsonLdObject(parsed)
      if (!result.ok) {
        return {
          workflow: fallback,
          source: 'invalid' as const,
          error: result.errors[0] || IMPORT_EXPORT_STATUS_COPY.graphRagWorkflowJsonLdInvalid,
          validationErrors: result.errors,
        }
      }
      return {
        workflow: parsed as GraphRagWorkflowJsonLd,
        source: 'loaded' as const,
        error: null as string | null,
        validationErrors: [] as string[],
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err || '')
      return {
        workflow: fallback,
        source: 'parse-error' as const,
        error: IMPORT_EXPORT_STATUS_COPY.graphRagWorkflowJsonInvalid(message),
        validationErrors: [] as string[],
      }
    }
  }, [data, graphId, graphRagWorkflowJsonText])

  const workflowDoc: GraphRagWorkflowJsonLd = graphRagWorkflowState.workflow
  const workflowSource = graphRagWorkflowState.source
  const workflowError = graphRagWorkflowState.error
  const workflowValidationErrors = graphRagWorkflowState.validationErrors

  const agenticContext = React.useMemo(
    () => getAgenticRagContextComparison(data as GraphData | null),
    [data],
  )

  const ignoreFilters = React.useMemo(
    () => getAgenticRagIgnoreFiltersSummary(data as GraphData | null),
    [data],
  )

  const handleUpdateWorkflow = React.useCallback(
    (updater: (current: GraphRagWorkflowJsonLd) => GraphRagWorkflowJsonLd) => {
      const next = updater(workflowDoc)
      try {
        const text = JSON.stringify(next, null, 2)
        setGraphRagWorkflowJsonText(text)
      } catch {
        void 0
      }
    },
    [workflowDoc, setGraphRagWorkflowJsonText],
  )

  const handleSetAgenticContextUrl = React.useCallback(
    (value: string) => {
      const graph = data as GraphData | null
      if (!graph) return
      const raw = graph.context as JSONValue | undefined
      let ctx: Record<string, JSONValue> = {}
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw) as JSONValue
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            ctx = parsed as Record<string, JSONValue>
          }
        } catch {
          ctx = {}
        }
      } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        ctx = raw as Record<string, JSONValue>
      }
      const trimmed = value.trim()
      if (trimmed) {
        ctx['@vocab'] = trimmed
      } else {
        delete ctx['@vocab']
      }
      const next: GraphData = {
        ...graph,
        context: ctx as JSONValue,
      }
      setGraphData(next)
    },
    [data, setGraphData],
  )

  const handleSetIgnoreCodebasePaths = React.useCallback(
    (value: string) => {
      const graph = data as GraphData | null
      if (!graph) return
      const parts = value
        .split(',')
        .map(part => part.trim())
        .filter(part => part.length > 0)
      const filters = buildAgenticRagIgnoreFiltersFromRawPatterns(parts)
      const metaRaw = graph.metadata as unknown
      const currentMeta =
        metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw)
          ? (metaRaw as Record<string, JSONValue>)
          : {}
      const nextMeta: Record<string, JSONValue> = {
        ...currentMeta,
        ignoreCodebasePaths: filters.rawPatterns as JSONValue,
        ignoreCodebasePathsResolved: filters.resolvedPatterns as JSONValue,
      }
      const next: GraphData = {
        ...graph,
        metadata: nextMeta,
      }
      setGraphData(next)
    },
    [data, setGraphData],
  )

  const graphNodesById = React.useMemo(() => {
    const graph = data as GraphData | null
    if (!graph || !Array.isArray(graph.nodes)) return {} as Record<string, { label: string }>
    const map: Record<string, { label: string }> = {}
    graph.nodes.forEach(node => {
      const id = String(node.id)
      const label = typeof node.label === 'string' && node.label.length > 0 ? node.label : id
      map[id] = { label }
    })
    return map
  }, [data])

  const graphEdgesById = React.useMemo(() => {
    const graph = data as GraphData | null
    if (!graph || !Array.isArray(graph.edges)) {
      return {} as Record<string, { source: string; target: string; label: string }>
    }
    const map: Record<string, { source: string; target: string; label: string }> = {}
    graph.edges.forEach(edge => {
      const id = String(edge.id)
      const source = String(edge.source)
      const target = String(edge.target)
      const label = String(edge.label ?? '')
      map[id] = { source, target, label }
    })
    return map
  }, [data])

  const graphRagPathHelper: GraphRagPathHelper | null = React.useMemo(() => {
    const graph = data as GraphData | null
    const owner = findGraphRagOwnerNode(graph, selectedNodeId)
    if (!owner) return null
    const props = owner.properties ?? {}
    const raw = (props as Record<string, JSONValue>).graphRAGPath as
      | AgenticGraphRagPathValue
      | undefined
    if (!isGraphRagPathValue(raw)) return null
    const traversePath = toParsedTraversePath(raw)
    if (!traversePath || !Array.isArray(traversePath.traverse) || traversePath.traverse.length === 0) {
      return null
    }
    return {
      ownerNodeId: String(owner.id),
      ownerNodeLabel:
        typeof owner.label === 'string' && owner.label.length > 0 ? owner.label : String(owner.id),
      traverse: traversePath.traverse.map(id => String(id)),
    }
  }, [data, selectedNodeId])

  const previewEdgeIds = React.useMemo(() => {
    const graph = data as GraphData | null
    const traversal = lastTraversal
    if (!graph || !Array.isArray(graph.edges)) return []
    if (!traversal || traversal.mode !== 'graphRag') return []
    const ownerId = String(traversal.ownerNodeId || '').trim()
    if (!ownerId) return []
    const pathIds = [ownerId, ...(traversal.traverseNodeIds || [])].map(id => String(id))
    return buildEdgeIdsForPath(graph, pathIds)
  }, [data, lastTraversal])

  React.useEffect(() => {
    setLastTraversal(null)
  }, [data, setLastTraversal])

  React.useEffect(() => {
    setLastTraversalSummary(lastTraversal)
  }, [lastTraversal, setLastTraversalSummary])

  const runEdgeTraversalSequence = React.useCallback(
    (edgeIds: string[], startNodeId?: string | null) => {
      runEdgeTraversalSequenceGlobal(edgeIds, startNodeId)
    },
    [],
  )

  const runGraphRagTraversal = React.useCallback(() => {
    const graph = data as GraphData | null
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return
    let edgeIds: string[] = []
    const summary: GraphRagTraversalSummary | null = buildGraphRagTraversalSummary(graph, selectedNodeId)
    if (summary) {
      edgeIds = summary.edgeIds.map(id => String(id))
      setLastTraversal(summary)
    } else {
      edgeIds = findGraphRagTraversalEdgeIds(graph)
      if (!edgeIds.length) return
      setLastTraversal({
        mode: 'graphRag',
        ownerNodeId: '',
        ownerNodeLabel: '',
        query: null,
        example: null,
        traverseNodeIds: [],
        multiHop: [],
        hops: [],
        edgeIds,
      })
    }
    const startNodeId =
      summary && summary.ownerNodeId && summary.ownerNodeId.trim().length > 0
        ? summary.ownerNodeId
        : selectedNodeId || null
    runEdgeTraversalSequence(edgeIds, startNodeId)
  }, [data, selectedNodeId, runEdgeTraversalSequence, setLastTraversal])

  const runGenericTraversalQuery = React.useCallback(() => {
    const graph = data as GraphData | null
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return
    const trimmedStart = traversalStartNodeId.trim()
    const startNodeId = trimmedStart.length > 0 ? trimmedStart : (selectedNodeId || '')
    if (!startNodeId) return
    const depth = Number.isFinite(traversalMaxDepth) && traversalMaxDepth > 0 ? traversalMaxDepth : 1
    const labelParts = traversalLabelFilter.split(',').map(s => s.trim()).filter(s => s.length > 0)
    const edgeIds = findTraversalEdgeIds(graph, {
      startNodeId,
      maxDepth: depth,
      allowedEdgeLabels: labelParts.length > 0 ? labelParts : undefined,
    })
    if (!edgeIds.length) return
    setLastTraversal({
      mode: 'generic',
      startNodeId,
      maxDepth: depth,
      labelFilter: traversalLabelFilter,
      edgeIds,
    })
    runEdgeTraversalSequence(edgeIds, startNodeId)
  }, [
    data,
    traversalStartNodeId,
    traversalMaxDepth,
    traversalLabelFilter,
    selectedNodeId,
    runEdgeTraversalSequence,
    setLastTraversal,
  ])

  const selectedAgenticNode: AgenticRagNodeView | null = React.useMemo(() => {
    const graph = data as GraphData | null
    if (!graph || !Array.isArray(graph.nodes) || !selectedNodeId) return null
    const node = graph.nodes.find(n => String(n.id) === String(selectedNodeId)) as GraphNode | undefined
    if (!node) return null
    return agenticRagNodeFromGraphNode(node)
  }, [data, selectedNodeId])

  const handleCopyAgenticRagNodeJson = React.useCallback(async () => {
    try {
      if (!selectedAgenticNode) {
        setAgenticCopyStatus(AGENTIC_RAG_NODE_JSON_STATUS_NONE)
        return
      }
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        setAgenticCopyStatus(UI_COPY.orchestratorClipboardNotAvailable)
        return
      }
      const text = JSON.stringify(selectedAgenticNode, null, 2)
      await navigator.clipboard.writeText(text)
      setAgenticCopyStatus(AGENTIC_RAG_NODE_JSON_STATUS_COPIED)
    } catch {
      setAgenticCopyStatus(UI_COPY.orchestratorCopyFailed)
    }
  }, [selectedAgenticNode])

  React.useEffect(() => {
    if (!requestAiKgTraversal) return
    runGraphRagTraversal()
    setRequestAiKgTraversal(false)
  }, [requestAiKgTraversal, runGraphRagTraversal, setRequestAiKgTraversal])

  React.useEffect(() => {
    const graph = data as GraphData | null
    const next = persistTraversalSummaryToGraph(graph, lastTraversal)
    if (!graph || !next || next === graph) return
    useGraphStore.getState().setGraphData(next)
  }, [data, lastTraversal])

  const traversalViewModel = buildOrchestratorTraversalSectionViewModel({
    graphNodesById,
    graphEdgesById,
    previewEdgeIds,
    lastTraversal,
    setLastTraversal,
    selectNode: id => selectNode(id),
    selectEdge: id => selectEdge(id),
    editState,
    editPaths,
    selectedAgenticNode,
    agenticCopyStatus,
    onCopyAgenticRagNodeJson: handleCopyAgenticRagNodeJson,
  })

  return (
    <div
      className={
        variant === 'floatingPanel'
          ? [
              `mt-1 ${UI_THEME_TOKENS.text.primary}`,
              uiPanelKeyValueTextSizeClass,
              uiPanelTextFontClass,
            ].join(' ')
          : 'mt-1'
      }
    >
      {variant === 'bottomPanel' && (
        <div
          className={
            [
              'flex items-center justify-between gap-2 px-0.5 py-1 text-gray-700',
              uiPanelKeyValueTextSizeClass,
              uiPanelTextFontClass,
            ].join(' ')
          }
        >
          <Tooltip
            content={ORCHESTRATOR_TRAVERSAL_TOOLTIP}
            maxWidthPx={280}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
          >
            <div className="flex items-center gap-1">
              <div
                className={getPillClass('badge', {
                  baseClass: `${uiIconPillClass} inline-flex items-center px-1.5 py-[1px] font-medium uppercase tracking-wide`,
                  badgeTextSizeClass: uiIconPillBadgeTextSizeClass,
                  textColorClass: 'text-blue-700',
                })}
              >
                {`${ZERO_TO_ONE_GRAPH_TRAVERSAL_LABEL} · ${getOrchestratorSectionListLabel()}`}
              </div>
            </div>
          </Tooltip>
        </div>
      )}
      <OrchestratorTraversalSection
        variant={variant}
        showPresetsAndEditor={variant === 'floatingPanel'}
        graphRagCollapsed={graphRagCollapsed}
        presetsCollapsed={presetsCollapsed}
        editorCollapsed={editorCollapsed}
        setGraphRagCollapsed={setGraphRagCollapsed}
        setPresetsCollapsed={setPresetsCollapsed}
        setEditorCollapsed={setEditorCollapsed}
        workflowProps={{
          workflowDoc,
          workflowSource,
          workflowError,
          workflowValidationErrors,
          traversalDelayMs,
          onChangeTraversalDelayMs: handleSetTraversalDelayMs,
          lastTraversal,
          onUpdateWorkflow: handleUpdateWorkflow,
          indexingCollapsed,
          onToggleIndexingCollapsed: setIndexingCollapsed,
          tracingCollapsed,
          onToggleTracingCollapsed: setTracingCollapsed,
          agenticContext,
          ignoreFilters,
          onChangeAgenticContextUrl: handleSetAgenticContextUrl,
          onChangeIgnoreCodebasePaths: handleSetIgnoreCodebasePaths,
        }}
        presetsProps={{
          runGraphRagTraversal,
          traversalStartNodeId,
          setTraversalStartNodeId,
          traversalMaxDepth,
          setTraversalMaxDepth,
          traversalLabelFilter,
          setTraversalLabelFilter,
          runGenericTraversalQuery,
          selectedNodeId,
          graphRagPathHelper,
          graphNodesById,
          selectNode,
          duckdbQueriesFromConfig: workflowDoc.duckdbQueries,
        }}
        editorProps={{
          traversalViewModel,
          schema,
          setSchema,
          setThreeConfig,
          setCharge,
          setCollisionByType,
          traversalDelayMs,
          onChangeTraversalDelayMs: handleSetTraversalDelayMs,
        }}
      />
      {variant === 'bottomPanel' && (
        <AgenticRagContextSection
          collapsed={contextCollapsed}
          onToggle={setContextCollapsed}
          graphData={data as GraphData | null}
        />
      )}
    </div>
  )
}
