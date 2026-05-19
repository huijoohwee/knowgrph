import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DataViewTagChip } from '@/features/markdown/ui/MarkdownDataViewChips'
import { MarkdownWorkspaceDisplayMenu, readMarkdownToolbarHighlightCount } from '@/features/markdown-workspace/MarkdownWorkspaceToolbarInlineMenus'
import { readRendererHighlightTokens } from '@/features/toolbar/ui/RendererGraphTopologySummary'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import { MarkdownSigilText, renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'

export const testMarkdownSigilInlineTextRendersEmbeddedAnnotations = () => {
  const html = renderToStaticMarkup(
    <span>
      {renderMarkdownSigilInlineText('Alpha `#D85A30|bg#FEF3C7:Urgent task` and ==Review queue==')}
    </span>,
  )
  if (!html.includes('data-kg-sigil="1"')) throw new Error('expected sigil spans in inline UI text')
  if (!html.includes('Urgent task')) throw new Error('expected color sigil display text')
  if (!html.includes('Review queue')) throw new Error('expected default mark display text')
  if (html.includes('#D85A30:Urgent') || html.includes('==Review queue==')) {
    throw new Error('expected raw annotation syntax to be hidden in read surfaces')
  }
}

export const testMarkdownSigilTextComponentUsesDefaultHighlightFallback = () => {
  const html = renderToStaticMarkup(<MarkdownSigilText text="==Deployment review==" />)
  if (!html.includes('data-kg-sigil-default="1"')) throw new Error('expected default highlight marker')
  if (!html.includes('Deployment review')) throw new Error('expected unwrapped default highlight text')
  if (!html.includes('background-color:#FEF3C7')) throw new Error('expected default highlight background')
}

export const testMarkdownSigilDataViewChipUsesDisplayText = () => {
  const html = renderToStaticMarkup(<DataViewTagChip value="`#1D4ED8|bg#DBEAFE:Agent labs`" />)
  if (!html.includes('Agent labs')) throw new Error('expected data-view chip to show sigil display text')
  if (html.includes(':Agent labs') || html.includes('bg#DBEAFE')) throw new Error('expected data-view chip to hide raw sigil syntax')
  if (!html.includes('data-kg-sigil="1"')) throw new Error('expected data-view chip to reuse shared sigil renderer')
}

export const testMarkdownToolbarHighlightToggleCountsSigils = () => {
  const previous = useGraphStore.getState().markdownDocumentText
  useGraphStore.setState({
    markdownDocumentText: 'Alpha ==Review queue== and `#1D4ED8|bg#DBEAFE:Agent labs`',
  } as never)
  try {
    const count = readMarkdownToolbarHighlightCount(String(useGraphStore.getState().markdownDocumentText || ''))
    if (count !== 2) throw new Error(`expected two toolbar highlights, got ${count}`)
    const html = renderToStaticMarkup(
      <MarkdownWorkspaceDisplayMenu
        toolbarButtonClassName="kg-toolbar-btn"
        markdownTextHighlight={false}
        setMarkdownTextHighlight={() => undefined}
        markdownWordWrap={false}
        setMarkdownWordWrap={() => undefined}
        highlightCount={count}
      />,
    )
    if (!html.includes('data-kg-sigil-highlight-count="2"')) throw new Error('expected toolbar highlight count marker')
    if (!html.includes('Toggle text highlight (2)')) throw new Error('expected toolbar title to include highlight count')
  } finally {
    useGraphStore.setState({ markdownDocumentText: previous } as never)
  }
}

export const testRendererSummaryReadsGenericHighlightTokens = () => {
  const tokens = readRendererHighlightTokens({
    nodes: [
      {
        id: 'n1',
        label: 'Raw label',
        properties: {
          'markdown:highlight': true,
          'markdown:highlight:text': '`#D85A30|bg#FEF3C7:Urgent task`',
          'visual:fill': '#FEF3C7',
          'visual:labelColor': '#D85A30',
        },
      },
      {
        id: 'n2',
        label: 'Review queue',
        properties: {
          'keyword:highlight': true,
          'keyword:highlight:count': 3,
          'keyword:highlight:background': '#DBEAFE',
          'keyword:highlight:color': '#1D4ED8',
          'keyword:frequency': 7,
        },
      },
    ],
    edges: [],
    metadata: { markdownSigilHighlightCount: 2 },
  } as unknown as GraphData)
  if (tokens.length !== 2) throw new Error(`expected two renderer highlight tokens, got ${tokens.length}`)
  if (tokens[0]?.label !== 'Review queue') throw new Error('expected keyword highlight token to sort by count')
  if (tokens[1]?.label !== '`#D85A30|bg#FEF3C7:Urgent task`') {
    throw new Error('expected renderer highlight token to preserve sigil source for shared display rendering')
  }
  if (tokens[1]?.background !== '#FEF3C7' || tokens[1]?.color !== '#D85A30') {
    throw new Error('expected renderer highlight token to read visual highlight colors')
  }
}
