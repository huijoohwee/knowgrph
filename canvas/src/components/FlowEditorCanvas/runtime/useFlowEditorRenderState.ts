import React from 'react'

import { deriveFlowEditorViewGraph } from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import { buildOverlayTopologyLayoutSignature } from '@/lib/flowEditor/overlayTopologyLayoutSignature'
import type { GraphData } from '@/lib/graph/types'
import { readFrontmatterFlowRenderSettings } from '@/lib/graph/frontmatterFlowSettings'
import { shouldPreferScopedGraphDataAuthority } from '@/lib/flowEditor/flowEditorGraphAuthority'
import { resolveFlowEditorDraftGraphDataForBaseReset } from '@/lib/flowEditor/flowEditorDraftGraphData'

export function useFlowEditorRenderState(args: {
  active: boolean
  editorRuntimeActive: boolean
  flowEditorViewActive: boolean
  workspaceMutationBlocked: boolean
  baseGraphData: GraphData | null
  baseGraphDataRevision: number
  flowEditorBaseGraphData: GraphData | null
  collapsedGroupIdsForView: string[]
  frontmatterOnlyPolicyActive: boolean
  activeDocumentKey: string
  selectedEdgeId: string | null
}) {
  const [draftGraphData, setDraftGraphData] = React.useState<GraphData | null>(null)
  const draftGraphDataRef = React.useRef<GraphData | null>(null)
  const draftDocumentKeyRef = React.useRef<string | null>(null)
  const flowEditorBaseGraphDataRef = React.useRef(args.flowEditorBaseGraphData)
  flowEditorBaseGraphDataRef.current = args.flowEditorBaseGraphData

  const draftGraphDataRevision = React.useMemo(() => {
    const draft = draftGraphData
    if (!draft) return args.baseGraphDataRevision
    const meta = draft.metadata
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return args.baseGraphDataRevision
    const raw = (meta as Record<string, unknown>).graphDataRevision
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : args.baseGraphDataRevision
  }, [args.baseGraphDataRevision, draftGraphData])

  React.useLayoutEffect(() => {
    if (!args.editorRuntimeActive) {
      const hadDraft = draftGraphDataRef.current !== null || draftDocumentKeyRef.current !== null
      draftGraphDataRef.current = null
      draftDocumentKeyRef.current = null
      if (hadDraft) setDraftGraphData(null)
      return
    }
    const base = flowEditorBaseGraphDataRef.current
    const nextDraft = resolveFlowEditorDraftGraphDataForBaseReset({
      activeDocumentKey: args.activeDocumentKey,
      previousDocumentKey: draftDocumentKeyRef.current,
      currentDraftGraphData: draftGraphDataRef.current,
      nextBaseGraphData: base,
    })
    draftDocumentKeyRef.current = args.activeDocumentKey
    draftGraphDataRef.current = nextDraft
    if (nextDraft === base) {
      setDraftGraphData(prev => (prev === base ? prev : base))
      return
    }
    setDraftGraphData(prev => (prev === nextDraft ? prev : nextDraft))
  }, [args.activeDocumentKey, args.baseGraphDataRevision, args.editorRuntimeActive])

  const rawRenderGraphDataOverride = React.useMemo((): GraphData | null => {
    const baseForRender = args.flowEditorBaseGraphData || args.baseGraphData
    const graphDataForRender = args.flowEditorViewActive
      ? (
          shouldPreferScopedGraphDataAuthority({
            candidateGraphData: draftGraphData,
            authorityGraphData: baseForRender,
          })
            ? baseForRender
            : (draftGraphData || baseForRender)
        )
      : args.baseGraphData
    return deriveFlowEditorViewGraph({
      graphData: graphDataForRender,
      collapsedGroupIds: args.collapsedGroupIdsForView,
      forceFrontmatterFlow: args.frontmatterOnlyPolicyActive,
    })
  }, [
    args.baseGraphData,
    args.collapsedGroupIdsForView,
    args.flowEditorViewActive,
    args.flowEditorBaseGraphData,
    args.frontmatterOnlyPolicyActive,
    draftGraphData,
  ])
  const rawRenderGraphTopologyLayoutSignature = React.useMemo(() => {
    return buildOverlayTopologyLayoutSignature(rawRenderGraphDataOverride)
  }, [rawRenderGraphDataOverride])

  const [stableRenderGraphOverride, setStableRenderGraphOverride] = React.useState<{
    documentKey: string
    graphData: GraphData | null
    topologyLayoutSignature: string
  } | null>(null)

  React.useLayoutEffect(() => {
    if (!args.active) {
      if (stableRenderGraphOverride !== null) setStableRenderGraphOverride(null)
      return
    }
    const nextGraph = rawRenderGraphDataOverride
    const nextTopologyLayoutSignature = rawRenderGraphTopologyLayoutSignature
    const nextHasNodes = Array.isArray(nextGraph?.nodes) && nextGraph.nodes.length > 0
    const shouldPreserveStableDuringWorkspaceMutation =
      args.workspaceMutationBlocked
      && args.flowEditorViewActive
      && !nextHasNodes
    if (nextHasNodes || !args.frontmatterOnlyPolicyActive) {
      setStableRenderGraphOverride(prev => {
        if (shouldPreserveStableDuringWorkspaceMutation && prev?.documentKey === args.activeDocumentKey) return prev
        const preserveStableGraphAcrossFlowViewClose =
          args.flowEditorViewActive !== true
          && prev?.documentKey === args.activeDocumentKey
          && !!prev?.graphData
          && prev.topologyLayoutSignature.length > 0
          && prev.topologyLayoutSignature === nextTopologyLayoutSignature
        if (preserveStableGraphAcrossFlowViewClose) return prev
        if (
          prev?.documentKey === args.activeDocumentKey
          && prev.topologyLayoutSignature.length > 0
          && prev.topologyLayoutSignature === nextTopologyLayoutSignature
        ) return prev
        if (prev?.documentKey === args.activeDocumentKey && prev.graphData === nextGraph) return prev
        return {
          documentKey: args.activeDocumentKey,
          graphData: nextGraph,
          topologyLayoutSignature: nextTopologyLayoutSignature,
        }
      })
      return
    }
    setStableRenderGraphOverride(prev => {
      if (prev?.documentKey === args.activeDocumentKey) return prev
      return {
        documentKey: args.activeDocumentKey,
        graphData: nextGraph,
        topologyLayoutSignature: nextTopologyLayoutSignature,
      }
    })
  }, [
    args.active,
    args.activeDocumentKey,
    args.flowEditorViewActive,
    args.frontmatterOnlyPolicyActive,
    args.workspaceMutationBlocked,
    rawRenderGraphDataOverride,
    rawRenderGraphTopologyLayoutSignature,
    stableRenderGraphOverride,
  ])

  const renderGraphDataOverride = React.useMemo((): GraphData | null => {
    const nextGraph = rawRenderGraphDataOverride
    const nextHasNodes = Array.isArray(nextGraph?.nodes) && nextGraph.nodes.length > 0
    const stableGraph = stableRenderGraphOverride?.graphData || null
    const stableHasNodes = Array.isArray(stableGraph?.nodes) && stableGraph.nodes.length > 0
    const preserveStableGraphDuringWorkspaceMutation =
      args.workspaceMutationBlocked
      && args.flowEditorViewActive
      && !nextHasNodes
      && stableRenderGraphOverride?.documentKey === args.activeDocumentKey
      && stableHasNodes
    if (preserveStableGraphDuringWorkspaceMutation) return stableGraph
    const preserveStableGraphAcrossFlowViewClose =
      args.flowEditorViewActive !== true
      && stableRenderGraphOverride?.documentKey === args.activeDocumentKey
      && stableHasNodes
      && stableRenderGraphOverride.topologyLayoutSignature.length > 0
      && stableRenderGraphOverride.topologyLayoutSignature === rawRenderGraphTopologyLayoutSignature
    if (preserveStableGraphAcrossFlowViewClose) return stableGraph
    if (nextHasNodes) return nextGraph
    if (!args.frontmatterOnlyPolicyActive) return nextGraph
    if (stableRenderGraphOverride?.documentKey !== args.activeDocumentKey) return nextGraph
    return stableHasNodes ? stableGraph : nextGraph
  }, [
    args.activeDocumentKey,
    args.flowEditorViewActive,
    args.frontmatterOnlyPolicyActive,
    args.workspaceMutationBlocked,
    rawRenderGraphDataOverride,
    rawRenderGraphTopologyLayoutSignature,
    stableRenderGraphOverride,
  ])

  const frontmatterFlowRenderSettings = React.useMemo(() => {
    return readFrontmatterFlowRenderSettings(renderGraphDataOverride)
  }, [renderGraphDataOverride])

  const selectedDraftEdge = React.useMemo(() => {
    if (!draftGraphData || !args.selectedEdgeId) return null
    const edges = Array.isArray(draftGraphData.edges) ? draftGraphData.edges : []
    return edges.find(edge => String(edge.id || '') === args.selectedEdgeId) || null
  }, [draftGraphData, args.selectedEdgeId])

  return {
    draftGraphData,
    draftGraphDataRef,
    draftGraphDataRevision,
    frontmatterFlowRenderSettings,
    renderGraphDataOverride,
    selectedDraftEdge,
    setDraftGraphData,
  }
}
