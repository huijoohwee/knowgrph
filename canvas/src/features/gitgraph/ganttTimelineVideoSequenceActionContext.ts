import {
  buildMermaidGanttTimelineModel,
  type MermaidGanttTimelineTaskSpan,
} from '@/lib/mermaid/mermaidGanttBarInteraction'
import { readYamlFrontmatterMermaidDiagramCodes } from '@/lib/mermaid/mermaidDiagramCode'
import { resolveMermaidGanttCode } from '@/lib/mermaid/mermaidGitGraph'

type TimelineDocumentSnapshot = {
  markdownDocumentName: string
  markdownText: string
}

export type GanttTimelineVideoSequenceActionContext = {
  code: string
  markdownDocumentName: string
  markdownText: string
  selectedSpan: MermaidGanttTimelineTaskSpan
}

export function resolveGanttTimelineVideoSequenceActionContext(args: {
  code: string
  markdownDocumentName: string
  markdownText: string
  maxMinutes: number
  readDocumentSnapshot: () => TimelineDocumentSnapshot
  selectedSpan: MermaidGanttTimelineTaskSpan | null
}): GanttTimelineVideoSequenceActionContext | null {
  if (!args.selectedSpan || args.maxMinutes <= 0) return null
  const currentDocument = args.readDocumentSnapshot()
  if (currentDocument.markdownDocumentName !== args.markdownDocumentName) return null
  const markdownText = currentDocument.markdownText || args.markdownText
  const code = currentDocument.markdownText === args.markdownText
    ? args.code
    : resolveMermaidGanttCode(readYamlFrontmatterMermaidDiagramCodes(markdownText, 'gantt'))
  if (!code) return null
  const timelineModel = buildMermaidGanttTimelineModel(code)
  const selectedSpan = timelineModel.taskSpans.find(span => span.rowKey === args.selectedSpan?.rowKey)
    || timelineModel.taskSpans.find(span => span.lineIndex === args.selectedSpan?.lineIndex)
  return selectedSpan
    ? { code, markdownDocumentName: currentDocument.markdownDocumentName, markdownText, selectedSpan }
    : null
}

export function resolveGanttTimelineVideoSequenceSelectedRowKey(args: {
  code: string
  lineIndex: number | undefined
}): string {
  if (typeof args.lineIndex !== 'number') return ''
  return buildMermaidGanttTimelineModel(args.code).taskSpans.find(span => span.lineIndex === args.lineIndex)?.rowKey || ''
}
