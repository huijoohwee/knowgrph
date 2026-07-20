import { replaceFirstMermaidGanttFrontmatterCode } from '@/lib/mermaid/mermaidGanttBarInteraction'
import {
  resolveGanttTimelineVideoSequenceSelectedRowKey,
  type GanttTimelineVideoSequenceActionContext,
} from './ganttTimelineVideoSequenceActionContext'

export function commitGanttTimelineVideoSequenceCode(args: {
  actionContext: GanttTimelineVideoSequenceActionContext
  fallbackMarkdownText: string
  nextCode: string | null
  nextLineIndex?: number
  readDocumentSnapshot: () => { markdownDocumentName: string; markdownText: string }
  setMarkdownDocument: (markdownDocumentName: string, markdownText: string, options?: { applyViewPreset?: boolean; historyLabel?: string }) => void
  setSelectedRowKey: (rowKey: string) => void
}) {
  if (!args.nextCode || args.nextCode === args.actionContext.code) return
  const currentDocument = args.readDocumentSnapshot()
  const currentMarkdownText = currentDocument.markdownText || args.fallbackMarkdownText
  if (
    currentDocument.markdownDocumentName !== args.actionContext.markdownDocumentName ||
    currentMarkdownText !== args.actionContext.markdownText
  ) {
    return
  }
  const nextMarkdownText = replaceFirstMermaidGanttFrontmatterCode(args.actionContext.markdownText, args.nextCode)
  if (!nextMarkdownText || nextMarkdownText === args.actionContext.markdownText) return
  args.setMarkdownDocument(args.actionContext.markdownDocumentName, nextMarkdownText, {
    applyViewPreset: false,
    historyLabel: 'Gantt Timeline edit',
  })
  const lineIndex = args.nextLineIndex ?? args.actionContext.selectedSpan.lineIndex
  args.setSelectedRowKey(resolveGanttTimelineVideoSequenceSelectedRowKey({
    code: args.nextCode,
    lineIndex,
  }))
}
