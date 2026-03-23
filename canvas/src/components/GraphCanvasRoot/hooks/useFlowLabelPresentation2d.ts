import { useEffect, type MutableRefObject } from 'react'
import type * as d3 from 'd3'
import type { GraphData, GraphNode } from '@/lib/graph/types'

export function useFlowLabelPresentation2d(args: {
  active: boolean
  labelsSelRef: MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>
  sceneGraphData: GraphData | null
  flowState: { valuesByNodeId: Record<string, unknown>; kindsByNodeId: Record<string, unknown> }
  schemaNodesPresentationJson: string
}): void {
  const { active, labelsSelRef, sceneGraphData, flowState, schemaNodesPresentationJson } = args

  useEffect(() => {
    if (!active) return
    if (!labelsSelRef.current || !sceneGraphData) return
    const { valuesByNodeId, kindsByNodeId } = flowState
    if (Object.keys(kindsByNodeId).length === 0) return
    labelsSelRef.current.text((d: GraphNode) => {
      const kind = kindsByNodeId[d.id as unknown as string]
      if (!kind) return d.label
      const rawValue = valuesByNodeId[d.id as unknown as string]
      if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) return d.label
      const rounded = Math.round(rawValue * 100) / 100
      return `${d.label} (${rounded})`
    })
  }, [active, flowState, labelsSelRef, sceneGraphData, schemaNodesPresentationJson])
}

