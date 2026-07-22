import React from 'react'

import { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'
import {
  buildFixedStoryboardCardReferencePlacements2d,
  readStoryboardWidgetPlacementSize2d,
  type StoryboardCardPlacement,
} from '@/components/StoryboardWidgetCanvas/storyboardCardPlacements2d'
import { applyAuthoredPlacementsForNewStoryboardCards2d } from '@/components/StoryboardWidgetCanvas/storyboardIncrementalLayout2d'
import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import type { CanvasAspectRatioMode } from '@/lib/canvas/canvasAspectRatioDisplayControls'
import { readSnapGridConfigFromSchema } from '@/lib/canvas/gridSnap'
import { buildGraphDocumentMetaKey } from '@/lib/graph/graphMetaKey'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { isProbeTreeLayoutOwnedNode } from '@/lib/storyboardWidget/probeTreeLayoutContract'

export const reconcileStableStoryboardCardPlacements2d = (
  previous: ReadonlyMap<string, StoryboardCardPlacement> | null,
  candidate: ReadonlyMap<string, StoryboardCardPlacement>,
  replaceCandidateIds: ReadonlySet<string> = new Set(),
): Map<string, StoryboardCardPlacement> => {
  if (!previous) return new Map(candidate)
  let changed = previous.size !== candidate.size
  const next = new Map<string, StoryboardCardPlacement>()
  for (const [id, candidatePlacement] of candidate) {
    const stablePlacement = previous.get(id)
    const placement = replaceCandidateIds.has(id) ? candidatePlacement : stablePlacement || candidatePlacement
    next.set(id, placement)
    if (!stablePlacement) changed = true
    else if (placement.x !== stablePlacement.x || placement.y !== stablePlacement.y) changed = true
  }
  return changed ? next : previous instanceof Map ? previous : new Map(previous)
}

export function useStableStoryboardCardPlacements2d(args: {
  aspectRatioMode: CanvasAspectRatioMode
  graphData: GraphData | null
  graphRevision: number
  layoutKey: string
  schema: GraphSchema | null | undefined
  widgetRegistry?: ReadonlyArray<WidgetRegistryEntry> | null
}): ReadonlyMap<string, StoryboardCardPlacement> {
  const grid = readSnapGridConfigFromSchema(args.schema)
  const identity = `${buildGraphDocumentMetaKey(args.graphData) || String(args.layoutKey || '').trim()}:${args.aspectRatioMode}:${grid.enabled ? `${grid.x}:${grid.y}` : 'free'}`
  const nodeById = React.useMemo(() => {
    const out = new Map<string, GraphNode>()
    const nodes = Array.isArray(args.graphData?.nodes) ? args.graphData.nodes : []
    for (const node of nodes) {
      const id = String(node?.id || '').trim()
      if (id) out.set(id, node)
    }
    return out
  }, [args.graphData])
  const candidate = React.useMemo(() => {
    const board = buildStoryboardBoardModel({
      graphData: args.graphData,
      graphRevision: args.graphRevision,
      widgetRegistry: args.widgetRegistry,
    })
    return buildFixedStoryboardCardReferencePlacements2d({
      aspectRatioMode: args.aspectRatioMode,
      board,
      flowWidgetPinnedByNodeId: null,
      nodeById,
      readPlacementSize: node => readStoryboardWidgetPlacementSize2d(node, args.aspectRatioMode),
      schema: args.schema,
    })
  }, [args.aspectRatioMode, args.graphData, args.graphRevision, args.schema, args.widgetRegistry, nodeById])
  const probeTreeLayoutOwnedNodeIds = React.useMemo(() => new Set(
    (args.graphData?.nodes || []).filter(isProbeTreeLayoutOwnedNode).map(node => String(node.id || '').trim()).filter(Boolean),
  ), [args.graphData])
  const stableRef = React.useRef<{ identity: string; placements: Map<string, StoryboardCardPlacement> } | null>(null)
  if (!stableRef.current || stableRef.current.identity !== identity) {
    stableRef.current = { identity, placements: new Map(candidate) }
  } else {
    const incrementalCandidate = applyAuthoredPlacementsForNewStoryboardCards2d({
      candidate,
      nodeById,
      previous: stableRef.current.placements,
    })
    stableRef.current.placements = reconcileStableStoryboardCardPlacements2d(stableRef.current.placements, incrementalCandidate, probeTreeLayoutOwnedNodeIds)
  }
  return stableRef.current.placements
}
