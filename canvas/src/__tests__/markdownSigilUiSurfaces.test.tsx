import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DataViewTagChip } from '@/features/markdown/ui/MarkdownDataViewChips'
import { MarkdownWorkspaceDisplayMenu, readMarkdownToolbarHighlightCount } from '@/features/markdown-workspace/MarkdownWorkspaceToolbarInlineMenus'
import { readRendererHighlightTokens } from '@/features/toolbar/ui/RendererGraphTopologySummary'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import { getDocumentLocationFromMetadata, resolveMarkdownNavigationMetadata } from '@/lib/graph/markdownMetadata'
import { findMarkdownTextHighlightLineRange } from '@/lib/markdown/markdownTextHighlights'
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

export const testRendererSummaryIncludesSelectedTextHighlightToken = () => {
  const tokens = readRendererHighlightTokens({
    nodes: [
      {
        id: 'kw:agent',
        label: 'Agent Labs',
        type: 'Keyword',
        properties: {
          'keyword:key': 'agent labs',
          'keyword:frequency': 4,
          'visual:fill': '#DBEAFE',
          'visual:labelColor': '#1D4ED8',
        },
      },
    ],
    edges: [],
    metadata: {},
  } as unknown as GraphData, { selectedNodeId: 'kw:agent' })
  if (tokens.length !== 1) throw new Error(`expected one selected renderer token, got ${tokens.length}`)
  if (tokens[0]?.source !== 'selection') throw new Error('expected selected renderer token source')
  if (tokens[0]?.label !== 'agent labs') throw new Error('expected selected renderer token to use keyword key')
  if (tokens[0]?.background !== '#DBEAFE' || tokens[0]?.color !== '#1D4ED8') {
    throw new Error('expected selected renderer token to reuse visual colors')
  }
}

export const testRendererSummaryPinsSelectedTextHighlightToken = () => {
  const highlightedNodes = Array.from({ length: 12 }, (_, i) => ({
    id: `kw:ranked:${i}`,
    label: `Ranked ${i}`,
    type: 'Keyword',
    properties: {
      'keyword:highlight': true,
      'keyword:highlight:count': 200 - i,
      'keyword:frequency': 200 - i,
    },
  }))
  const tokens = readRendererHighlightTokens({
    nodes: [
      ...highlightedNodes,
      {
        id: 'kw:selected',
        label: 'Selected keyword',
        type: 'Keyword',
        properties: {
          'keyword:key': 'selected keyword',
          'keyword:frequency': 1,
          'visual:fill': '#FEF3C7',
          'visual:labelColor': '#78350F',
        },
      },
    ],
    edges: [],
    metadata: {},
  } as unknown as GraphData, { selectedNodeId: 'kw:selected' })
  if (tokens.length !== 8) throw new Error(`expected capped renderer tokens, got ${tokens.length}`)
  if (tokens[0]?.source !== 'selection' || tokens[0]?.label !== 'selected keyword') {
    throw new Error(`expected selected keyword token to be pinned first, got ${JSON.stringify(tokens[0])}`)
  }
}

export const testMarkdownTextHighlightFindsSelectedKeywordLine = () => {
  const range = findMarkdownTextHighlightLineRange([
    '# Transcript',
    'Opening context without the term.',
    'Agent Labs ships a local renderer validation path.',
    'Closing context without the term.',
  ].join('\n'), 'agent labs')
  if (!range) throw new Error('expected text highlight range')
  if (range.start !== 3 || range.end !== 3 || range.count !== 1) {
    throw new Error(`expected line 3 single-match highlight, got ${JSON.stringify(range)}`)
  }
}

export const testKeywordNavigationMetadataResolvesMentionSourceLine = () => {
  const sourceNode = {
    id: 'doc:line-3',
    label: 'Agent Labs ships a local renderer validation path.',
    type: 'KeywordSource',
    metadata: { documentPath: 'workspace/transcript.md', lineStart: 3, lineEnd: 3 },
  }
  const keywordNode = {
    id: 'kw:agent',
    label: 'Agent Labs',
    type: 'Keyword',
    properties: { 'keyword:key': 'agent labs' },
    metadata: { derived: true, kind: 'keyword' },
  }
  const edge = {
    id: 'kw:mention:1',
    source: 'doc:line-3',
    target: 'kw:agent',
    label: 'mentions',
    properties: { count: 2, 'keyword:kind': 'sourceMention' },
  }
  const meta = resolveMarkdownNavigationMetadata({
    node: keywordNode as never,
    edge: null,
    graphLookup: {
      nodeById: new Map([
        ['doc:line-3', sourceNode as never],
        ['kw:agent', keywordNode as never],
      ]),
      incidentEdgesByNodeId: new Map([
        ['kw:agent', [edge as never]],
        ['doc:line-3', [edge as never]],
      ]),
    },
  })
  const location = getDocumentLocationFromMetadata(meta)
  if (!location) throw new Error('expected keyword mention source location')
  if (location.documentPath !== 'workspace/transcript.md' || location.lineStart !== 3 || location.lineEnd !== 3) {
    throw new Error(`expected keyword mention source line 3, got ${JSON.stringify(location)}`)
  }
}
