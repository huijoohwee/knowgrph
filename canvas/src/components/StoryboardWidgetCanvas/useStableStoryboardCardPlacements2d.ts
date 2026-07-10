import React from 'react'

import { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'
import {
  buildFixedStoryboardCardReferencePlacements2d,
  readStoryboardWidgetPlacementSize2d,
  type StoryboardCardPlacement,
} from '@/components/StoryboardWidgetCanvas/storyboardCardPlacements2d'
import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import type { CanvasAspectRatioMode } from '@/lib/canvas/canvasAspectRatioDisplayControls'
import { readSnapGridConfigFromSchema } from '@/lib/canvas/gridSnap'
import { buildGraphDocumentMetaKey } from '@/lib/graph/graphMetaKey'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData, GraphNode } from '@/lib/graph/types'

export const reconcileStableStoryboardCardPlacements2d = (
  previous: ReadonlyMap<string, StoryboardCardPlacement> | null,
  candidate: ReadonlyMap<string, StoryboardCardPlacement>,
): Map<string, StoryboardCardPlacement> => {
  if (!previous) return new Map(candidate)
  let changed = previous.size !== candidate.size
  const next = new Map<string, StoryboardCardPlacement>()
  for (const [id, candidatePlacement] of candidate) {
    const stablePlacement = previous.get(id)
    next.set(id, stablePlacement || candidatePlacement)
    if (!stablePlacement) changed = true
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
  const candidate = React.useMemo(() => {
    const nodes = Array.isArray(args.graphData?.nodes) ? args.graphData.nodes : []
    const nodeById = new Map<string, GraphNode>()
    for (const node of nodes) {
      const id = String(node?.id || '').trim()
      if (id) nodeById.set(id, node)
    }
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
  }, [args.aspectRatioMode, args.graphData, args.graphRevision, args.schema, args.widgetRegistry])
  const stableRef = React.useRef<{ identity: string; placements: Map<string, StoryboardCardPlacement> } | null>(null)
  if (!stableRef.current || stableRef.current.identity !== identity) {
    stableRef.current = { identity, placements: new Map(candidate) }
  } else {
    stableRef.current.placements = reconcileStableStoryboardCardPlacements2d(stableRef.current.placements, candidate)
  }
  return stableRef.current.placements
}
