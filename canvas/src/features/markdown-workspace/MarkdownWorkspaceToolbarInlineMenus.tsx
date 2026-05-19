import React from 'react'
import type { MarkdownPresentationApi } from './markdownWorkspaceTypes'
import { uiToolbarRowScrollListClassName } from '@/features/toolbar/ui/toolbarStyles'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useGraphStore } from '@/hooks/useGraphStore'
import { extractMarkdownAnnotationsFromText } from '@/lib/markdown/markdownSigil'
import { countMarkdownTextHighlightLineMatches } from '@/lib/markdown/markdownTextHighlights'
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  WrapText,
} from 'lucide-react'

export const readMarkdownToolbarHighlightCount = (markdown: string): number => {
  return extractMarkdownAnnotationsFromText(markdown, 100, 120_000).length
}

const readSelectedHighlightLabel = (
  graphData: ReturnType<typeof useActiveGraphRenderData>,
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
): string => {
  const nodeId = selectedNodeId ? String(selectedNodeId).trim() : ''
  const edgeId = selectedEdgeId ? String(selectedEdgeId).trim() : ''
  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
  const edges = Array.isArray(graphData?.edges) ? graphData.edges : []
  if (nodeId) {
    const node = nodes.find(item => String(item?.id || '').trim() === nodeId)
    const props = (node?.properties || {}) as Record<string, unknown>
    return String(props['markdown:highlight:text'] || props['keyword:key'] || node?.label || '').trim()
  }
  if (edgeId) {
    const edge = edges.find(item => String(item?.id || '').trim() === edgeId)
    return String(edge?.label || '').trim()
  }
  return ''
}

export function MarkdownWorkspacePresentationNavMenu(props: {
  canNavigateSlides: boolean
  toolbarButtonClassName: string
  presentationApiRef: React.MutableRefObject<MarkdownPresentationApi | null>
}) {
  if (!props.canNavigateSlides) return null
  return (
    <menu className={`${uiToolbarRowScrollListClassName} gap-1`} aria-label="Presentation navigation">
      <li className="list-none">
        <button
          type="button"
          className={props.toolbarButtonClassName}
          title="Previous slide"
          onClick={() => props.presentationApiRef.current?.prev()}
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={1.6} />
        </button>
      </li>
      <li className="list-none">
        <button
          type="button"
          className={props.toolbarButtonClassName}
          title="Next slide"
          onClick={() => props.presentationApiRef.current?.next()}
        >
          <ChevronRight className="w-4 h-4" strokeWidth={1.6} />
        </button>
      </li>
    </menu>
  )
}

export function MarkdownWorkspaceDisplayMenu(props: {
  toolbarButtonClassName: string
  markdownTextHighlight: boolean
  setMarkdownTextHighlight: (next: boolean) => void
  markdownWordWrap: boolean
  setMarkdownWordWrap: (next: boolean) => void
  highlightCount?: number
}) {
  const markdownDocumentText = useGraphStore(s => s.markdownDocumentText || '')
  const selectedNodeId = useGraphStore(s => s.selectedNodeId || null)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId || null)
  const renderGraphData = useActiveGraphRenderData(true)
  const selectedHighlightLabel = React.useMemo(
    () => readSelectedHighlightLabel(renderGraphData, selectedNodeId, selectedEdgeId),
    [renderGraphData, selectedEdgeId, selectedNodeId],
  )
  const storeHighlightCount = React.useMemo(
    () => Math.max(
      readMarkdownToolbarHighlightCount(markdownDocumentText),
      selectedHighlightLabel ? countMarkdownTextHighlightLineMatches(markdownDocumentText, selectedHighlightLabel) : 0,
    ),
    [markdownDocumentText, selectedHighlightLabel],
  )
  const highlightCount = typeof props.highlightCount === 'number' && Number.isFinite(props.highlightCount)
    ? Math.max(0, Math.floor(props.highlightCount))
    : storeHighlightCount
  const highlightCountLabel = highlightCount >= 100 ? '99+' : String(highlightCount)
  const highlightToggleTitle = highlightCount > 0
    ? `Toggle text highlight (${highlightCountLabel})`
    : 'Toggle text highlight'

  return (
    <menu className={`${uiToolbarRowScrollListClassName} gap-1`} aria-label="Display">
      <li className="list-none">
        <button
          type="button"
          className={`${props.toolbarButtonClassName} relative`}
          aria-pressed={props.markdownTextHighlight}
          aria-label={highlightToggleTitle}
          title={highlightToggleTitle}
          data-kg-sigil-highlight-count={highlightCount}
          onClick={() => props.setMarkdownTextHighlight(!props.markdownTextHighlight)}
        >
          <Eye className="w-4 h-4" strokeWidth={1.6} />
          {highlightCount > 0 ? (
            <span className="pointer-events-none absolute -right-1 -top-1 min-w-[1rem] rounded-sm border border-yellow-200 bg-yellow-50 px-0.5 text-center text-[9px] leading-3 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/70 dark:text-yellow-300">
              {highlightCountLabel}
            </span>
          ) : null}
        </button>
      </li>
      <li className="list-none">
        <button
          type="button"
          className={props.toolbarButtonClassName}
          aria-pressed={props.markdownWordWrap}
          title="Toggle word wrap"
          onClick={() => props.setMarkdownWordWrap(!props.markdownWordWrap)}
        >
          <WrapText className="w-4 h-4" strokeWidth={1.6} />
        </button>
      </li>
    </menu>
  )
}
