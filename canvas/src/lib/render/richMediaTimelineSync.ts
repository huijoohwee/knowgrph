import type { GraphData } from '@/lib/graph/types'
import { buildMermaidGanttTimelineModel } from '@/lib/mermaid/mermaidGanttBarInteraction'
import {
  readFrontmatterMermaidDiagramCodes,
  resolveMermaidDiagramCode,
} from '@/lib/mermaid/mermaidDiagramCode'

export const RICH_MEDIA_TIMELINE_TRANSPORT_FRAME_MESSAGE = 'knowgrph:timeline-transport-frame'
export const RICH_MEDIA_TIMELINE_TRANSPORT_MS_PER_UNIT = 1000

export function resolveRichMediaTimelineDurationUnits(graphData: GraphData | null | undefined): number {
  if (!graphData) return 0
  const ganttCode = resolveMermaidDiagramCode(
    readFrontmatterMermaidDiagramCodes(graphData, 'gantt'),
    'gantt',
  )
  if (!ganttCode) return 0
  return buildMermaidGanttTimelineModel(ganttCode).durationMinutes
}

export function resolveRichMediaTimelineMediaTargetSeconds(args: {
  mediaDurationSeconds: number
  positionUnits: number
  timelineDurationUnits: number
  unitMs?: number
}): number {
  const unitMs = Number.isFinite(args.unitMs) && Number(args.unitMs) > 0
    ? Number(args.unitMs)
    : RICH_MEDIA_TIMELINE_TRANSPORT_MS_PER_UNIT
  const positionUnits = Number.isFinite(args.positionUnits) ? Math.max(0, args.positionUnits) : 0
  const timelineDurationUnits = Number.isFinite(args.timelineDurationUnits) ? Math.max(0, args.timelineDurationUnits) : 0
  const timelineDurationSeconds = timelineDurationUnits * (unitMs / 1000)
  const positionSeconds = positionUnits * (unitMs / 1000)
  const mediaDurationSeconds = Number.isFinite(args.mediaDurationSeconds) && args.mediaDurationSeconds > 0
    ? args.mediaDurationSeconds
    : 0
  if (timelineDurationSeconds > 0 && mediaDurationSeconds > timelineDurationSeconds + 0.5) {
    return (Math.min(positionUnits, timelineDurationUnits) / timelineDurationUnits) * mediaDurationSeconds
  }
  return positionSeconds
}
