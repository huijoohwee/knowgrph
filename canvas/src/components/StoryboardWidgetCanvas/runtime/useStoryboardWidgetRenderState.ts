import React from 'react'

import { deriveStoryboardWidgetViewGraph } from '@/components/StoryboardWidgetCanvas/storyboardWidgetCanvasShared'
import { buildOverlayTopologyLayoutSignature } from '@/lib/storyboardWidget/overlayTopologyLayoutSignature'
import type { GraphData } from '@/lib/graph/types'
import { readFrontmatterFlowRenderSettings } from '@/lib/graph/frontmatterFlowSettings'
import { shouldPreferScopedGraphDataAuthority } from '@/lib/storyboardWidget/storyboardWidgetGraphAuthority'
import { buildStoryboardWidgetDraftGraphBaseSignature, resolveStoryboardWidgetDraftGraphDataForBaseReset } from '@/lib/storyboardWidget/storyboardWidgetDraftGraphData'

export function useStoryboardWidgetRenderState(args: {
  active: boolean
  editorRuntimeActive: boolean
  storyboardWidgetViewActive: boolean
  workspaceMutationBlocked: boolean
  baseGraphData: GraphData | null
  baseGraphDataRevision: number
  storyboardWidgetBaseGraphData: GraphData | null
  collapsedGroupIdsForView: string[]
  frontmatterOnlyPolicyActive: boolean
  activeDocumentKey: string
  selectedEdgeId: string | null
  historyIndex: number
  preferDraftGraphData?: boolean
}) {
  const [draftGraphData, setDraftGraphData] = React.useState<GraphData | null>(null)
  const draftGraphDataRef = React.useRef<GraphData | null>(null)
  const draftDocumentKeyRef = React.useRef<string | null>(null)
  const appliedBaseGraphDataRef = React.useRef<GraphData | null>(null)
  const appliedHistoryIndexRef = React.useRef(args.historyIndex)
  const storyboardWidgetBaseGraphDataRef = React.useRef(args.storyboardWidgetBaseGraphData)
  storyboardWidgetBaseGraphDataRef.current = args.storyboardWidgetBaseGraphData
  const storyboardWidgetBaseContentSignature = React.useMemo(
    () => buildStoryboardWidgetDraftGraphBaseSignature(args.storyboardWidgetBaseGraphData),
    [args.storyboardWidgetBaseGraphData],
  )

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
      appliedBaseGraphDataRef.current = null
      if (hadDraft) setDraftGraphData(null)
      return
    }
    const base = storyboardWidgetBaseGraphDataRef.current
    const historyIndexChanged = appliedHistoryIndexRef.current !== args.historyIndex
    const nextDraft = resolveStoryboardWidgetDraftGraphDataForBaseReset({
      activeDocumentKey: args.activeDocumentKey,
      previousDocumentKey: draftDocumentKeyRef.current,
      currentDraftGraphData: draftGraphDataRef.current,
      nextBaseGraphData: base,
      previousBaseGraphData: appliedBaseGraphDataRef.current,
      forceBaseReset: historyIndexChanged,
    })
    appliedHistoryIndexRef.current = args.historyIndex
    appliedBaseGraphDataRef.current = base
    draftDocumentKeyRef.current = args.activeDocumentKey
    draftGraphDataRef.current = nextDraft
    if (nextDraft === base) {
      setDraftGraphData(prev => (prev === base ? prev : base))
      return
    }
    setDraftGraphData(prev => (prev === nextDraft ? prev : nextDraft))
  }, [args.activeDocumentKey, args.baseGraphDataRevision, args.editorRuntimeActive, args.historyIndex, storyboardWidgetBaseContentSignature])

  const rawRenderGraphDataOverride = React.useMemo((): GraphData | null => {
    const baseForRender = args.storyboardWidgetBaseGraphData || args.baseGraphData
    const graphDataForRender = args.preferDraftGraphData
      ? (draftGraphData || baseForRender)
      : args.storyboardWidgetViewActive
      ? (
          shouldPreferScopedGraphDataAuthority({
            candidateGraphData: draftGraphData,
            authorityGraphData: baseForRender,
          })
            ? baseForRender
            : (draftGraphData || baseForRender)
        )
      : args.baseGraphData
    return deriveStoryboardWidgetViewGraph({
      graphData: graphDataForRender,
      collapsedGroupIds: args.collapsedGroupIdsForView,
      forceFrontmatterFlow: args.frontmatterOnlyPolicyActive,
    })
  }, [
    args.baseGraphData,
    args.collapsedGroupIdsForView,
    args.storyboardWidgetViewActive,
    args.storyboardWidgetBaseGraphData,
    args.frontmatterOnlyPolicyActive,
    args.preferDraftGraphData,
    draftGraphData,
  ])
  const rawRenderGraphTopologyLayoutSignature = React.useMemo(() => {
    return buildOverlayTopologyLayoutSignature(rawRenderGraphDataOverride)
  }, [rawRenderGraphDataOverride])
  const rawRenderGraphContentSignature = React.useMemo(() => {
    return buildStoryboardWidgetDraftGraphBaseSignature(rawRenderGraphDataOverride)
  }, [rawRenderGraphDataOverride])

  const [stableRenderGraphOverride, setStableRenderGraphOverride] = React.useState<{
    documentKey: string
    graphData: GraphData | null
    topologyLayoutSignature: string
    contentSignature: string
  } | null>(null)

  React.useLayoutEffect(() => {
    if (!args.active) {
      setStableRenderGraphOverride(prev => (prev === null ? prev : null))
      return
    }
    const nextGraph = rawRenderGraphDataOverride
    const nextTopologyLayoutSignature = rawRenderGraphTopologyLayoutSignature
    const nextContentSignature = rawRenderGraphContentSignature
    const nextHasNodes = Array.isArray(nextGraph?.nodes) && nextGraph.nodes.length > 0
    const shouldPreserveStableDuringWorkspaceMutation =
      args.workspaceMutationBlocked
      && args.storyboardWidgetViewActive
      && !nextHasNodes
    if (nextHasNodes || !args.frontmatterOnlyPolicyActive) {
      setStableRenderGraphOverride(prev => {
        if (shouldPreserveStableDuringWorkspaceMutation && prev?.documentKey === args.activeDocumentKey) return prev
        const preserveStableGraphAcrossFlowViewClose =
          args.storyboardWidgetViewActive !== true
          && prev?.documentKey === args.activeDocumentKey
          && !!prev?.graphData
          && prev.topologyLayoutSignature.length > 0
          && prev.topologyLayoutSignature === nextTopologyLayoutSignature
          && prev.contentSignature === nextContentSignature
        if (preserveStableGraphAcrossFlowViewClose) return prev
        if (
          prev?.documentKey === args.activeDocumentKey
          && prev.topologyLayoutSignature === nextTopologyLayoutSignature
          && prev.contentSignature === nextContentSignature
        ) return prev
        if (prev?.documentKey === args.activeDocumentKey && prev.graphData === nextGraph) return prev
        return {
          documentKey: args.activeDocumentKey,
          graphData: nextGraph,
          topologyLayoutSignature: nextTopologyLayoutSignature,
          contentSignature: nextContentSignature,
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
        contentSignature: nextContentSignature,
      }
    })
  }, [
    args.active,
    args.activeDocumentKey,
    args.storyboardWidgetViewActive,
    args.frontmatterOnlyPolicyActive,
    args.workspaceMutationBlocked,
    rawRenderGraphDataOverride,
    rawRenderGraphContentSignature,
    rawRenderGraphTopologyLayoutSignature,
  ])

  const renderGraphDataOverride = React.useMemo((): GraphData | null => {
    const nextGraph = rawRenderGraphDataOverride
    const nextHasNodes = Array.isArray(nextGraph?.nodes) && nextGraph.nodes.length > 0
    const stableGraph = stableRenderGraphOverride?.graphData || null
    const stableHasNodes = Array.isArray(stableGraph?.nodes) && stableGraph.nodes.length > 0
    const preserveStableGraphDuringWorkspaceMutation =
      args.workspaceMutationBlocked
      && args.storyboardWidgetViewActive
      && !nextHasNodes
      && stableRenderGraphOverride?.documentKey === args.activeDocumentKey
      && stableHasNodes
    if (preserveStableGraphDuringWorkspaceMutation) return stableGraph
    const preserveStableGraphAcrossFlowViewClose =
      args.storyboardWidgetViewActive !== true
      && stableRenderGraphOverride?.documentKey === args.activeDocumentKey
      && stableHasNodes
      && stableRenderGraphOverride.topologyLayoutSignature.length > 0
      && stableRenderGraphOverride.topologyLayoutSignature === rawRenderGraphTopologyLayoutSignature
      && stableRenderGraphOverride.contentSignature === rawRenderGraphContentSignature
    if (preserveStableGraphAcrossFlowViewClose) return stableGraph
    if (nextHasNodes) return nextGraph
    if (!args.frontmatterOnlyPolicyActive) return nextGraph
    if (stableRenderGraphOverride?.documentKey !== args.activeDocumentKey) return nextGraph
    return stableHasNodes ? stableGraph : nextGraph
  }, [
    args.activeDocumentKey,
    args.storyboardWidgetViewActive,
    args.frontmatterOnlyPolicyActive,
    args.workspaceMutationBlocked,
    rawRenderGraphDataOverride,
    rawRenderGraphContentSignature,
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
