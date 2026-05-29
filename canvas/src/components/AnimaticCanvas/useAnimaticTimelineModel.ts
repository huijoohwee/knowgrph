import React from 'react'
import { hashText } from '@/features/parsers/hash'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import type { GraphData } from '@/lib/graph/types'
import { buildAnimaticTimelineModel, type AnimaticTimelineModel } from './animaticTimeline'

type UseAnimaticTimelineModelArgs = {
  graphData: GraphData | null
  graphDataRevision: number
  markdownText: string
}

export function useAnimaticTimelineModel({
  graphData,
  graphDataRevision,
  markdownText,
}: UseAnimaticTimelineModelArgs): AnimaticTimelineModel {
  const markdownHash = React.useMemo(() => hashText(markdownText), [markdownText])
  const timelineSourceKey = React.useMemo(
    () =>
      buildScopedGraphSemanticKey('animatic-timeline-model', {
        graphData,
        graphRevision: graphDataRevision,
        graphSemanticKey: markdownHash,
      }),
    [graphData, graphDataRevision, markdownHash],
  )
  const timelineModelRef = React.useRef<{ key: string; model: AnimaticTimelineModel } | null>(null)
  return React.useMemo(() => {
    const cached = timelineModelRef.current
    if (cached?.key === timelineSourceKey) return cached.model
    const model = buildAnimaticTimelineModel({ graphData, markdownText })
    timelineModelRef.current = { key: timelineSourceKey, model }
    return model
  }, [graphData, markdownText, timelineSourceKey])
}
