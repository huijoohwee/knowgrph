import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import MarkdownTokenRenderer from '@/features/markdown/ui/MarkdownTokenRenderer'
import { DataViewTagChip } from '@/features/markdown/ui/MarkdownDataViewChips'
import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import { MarkdownWorkspaceDisplayMenu, readMarkdownToolbarHighlightCount } from '@/features/markdown-workspace/MarkdownWorkspaceToolbarInlineMenus'
import {
  readRendererDocumentMetadataTokens,
  readRendererHighlightTokens,
  RendererDocumentMetadataSummary,
} from '@/features/toolbar/ui/RendererGraphTopologySummary'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import { getDocumentLocationFromMetadata, resolveMarkdownNavigationMetadata } from '@/lib/graph/markdownMetadata'
import { findMarkdownTextHighlightLineRange } from '@/lib/markdown/markdownTextHighlights'
import { MarkdownSigilText, renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'
import {
  buildSemanticTextHighlightOverlayStyle,
  getSemanticHighlightSurfaceAttributes,
  resolveSemanticHighlightColors,
  SEMANTIC_HIGHLIGHT_DEFAULT_BACKGROUND,
  SEMANTIC_HIGHLIGHT_DEFAULT_COLOR,
  SEMANTIC_HIGHLIGHT_SURFACES,
} from '@/lib/ui/semanticHighlight'

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
    if (!html.includes('data-kg-semantic-highlight-surface="markdown-text-highlight"')) {
      throw new Error('expected toolbar text-highlight toggle to use shared semantic highlight surface')
    }
    if (!html.includes('background-color:#FEF3C7') || !html.includes('color:#78350F')) {
      throw new Error('expected toolbar text-highlight badge to use shared semantic fallback colors')
    }
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

export const testSemanticHighlightSharedSurfacesCoverKeywordDashboardRendererSelection = () => {
  const surfaces = new Set<string>(Object.values(SEMANTIC_HIGHLIGHT_SURFACES))
  for (const expected of ['selection-match', 'markdown-text-highlight', 'd3-graph', 'keyword-mode', 'dashboard', 'renderer']) {
    if (!surfaces.has(expected)) throw new Error(`expected shared semantic highlight surface ${expected}`)
  }
  const rendererAttrs = getSemanticHighlightSurfaceAttributes(SEMANTIC_HIGHLIGHT_SURFACES.renderer)
  if (rendererAttrs['data-kg-semantic-highlight-surface'] !== 'renderer') {
    throw new Error('expected renderer surface attributes from shared helper')
  }
  const fallback = resolveSemanticHighlightColors({ defaultHighlight: true })
  if (fallback.background !== SEMANTIC_HIGHLIGHT_DEFAULT_BACKGROUND || fallback.color !== SEMANTIC_HIGHLIGHT_DEFAULT_COLOR) {
    throw new Error(`expected shared default mark colors, got ${JSON.stringify(fallback)}`)
  }
  const overlayStyle = buildSemanticTextHighlightOverlayStyle({
    id: 'selection-peer:agent-labs',
    left: 24,
    top: 40,
    width: 56,
    height: 16,
  })
  const left = Number.parseFloat(String(overlayStyle.left || '0'))
  const top = Number.parseFloat(String(overlayStyle.top || '0'))
  const height = Number.parseFloat(String(overlayStyle.height || '0'))
  if (!(left < 24)) throw new Error(`expected organic text marker to pad horizontally, got ${String(overlayStyle.left)}`)
  if (!(top > 40)) throw new Error(`expected organic text marker to sit in the text band, got ${String(overlayStyle.top)}`)
  if (!(height > 0 && height < 16)) throw new Error(`expected organic text marker to be shorter than the glyph rect, got ${String(overlayStyle.height)}`)
  if (!String(overlayStyle.transform || '').includes('rotate')) throw new Error('expected organic text marker to carry stable shape jitter')
}

export const testMarkdownTokenRendererTextHighlightUsesSharedSemanticSurface = () => {
  const { tokens } = lexMarkdown('Alpha highlight line')
  const html = renderToStaticMarkup(
    <MarkdownTokenRenderer
      tokens={tokens}
      activeDocumentPath="/docs/highlight.md"
      highlightedLineRange={{ start: 1, end: 1 }}
      markdownWordWrap
      markdownPresentationMode={false}
      uiPanelTextFontClass="font-sans"
      uiPanelMonospaceTextClass="font-mono text-xs"
      mermaidFrontmatterConfig={null}
      rootThemeMode="light"
      previewOverlayScope="container"
      markdownTextHighlight
    />,
  )
  if (!html.includes('kg-semantic-highlight-markdown-text-highlight')) {
    throw new Error(`expected MarkdownTokenRenderer text highlight to use shared semantic class, got ${html}`)
  }
  if (!html.includes('background-color:#FEF3C7') || !html.includes('color:#78350F')) {
    throw new Error(`expected MarkdownTokenRenderer text highlight to use shared semantic fallback colors, got ${html}`)
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

export const testRendererSummaryReadsDocumentMetadataTokens = () => {
  const tokens = readRendererDocumentMetadataTokens({
    nodes: [],
    edges: [],
    metadata: {
      documentMetadataEntries: [
        { type: 'ui-path', value: 'Toolbar > Comment', note: 'Open `#1D4ED8|bg#DBEAFE:comment tools`', lineStart: 9 },
        { type: 'shortcut', value: '`#1D4ED8|bg#DBEAFE:Ctrl+S`', note: 'Save ==before== switching panes', lineStart: 4 },
        { type: 'audience', value: 'Reviewer', note: 'Used by appendix summaries', lineStart: 7 },
        { type: 'surface', value: 'Viewer', note: 'Visible in the runtime summary', lineStart: 8 },
        { type: 'status', value: 'draft', note: 'Shows current document state', lineStart: 10 },
        { type: 'priority', value: 'high', note: 'Pinned for operator review', lineStart: 6 },
        { type: 'overflow', value: 'ignored', note: 'Should be trimmed by the summary cap', lineStart: 12 },
      ],
    },
  } as unknown as GraphData)
  if (tokens.length !== 6) throw new Error(`expected capped document metadata tokens, got ${tokens.length}`)
  if (tokens[0]?.type !== 'shortcut' || tokens[0]?.lineStart !== 4) {
    throw new Error(`expected document metadata tokens to sort by lineStart, got ${JSON.stringify(tokens[0])}`)
  }
  if (tokens.some(token => token.value === 'ignored')) {
    throw new Error('expected renderer metadata tokens to cap overflow entries')
  }
}

export const testRendererSummaryRendersDocumentMetadataVisibleSurface = () => {
  const entries = readRendererDocumentMetadataTokens({
    nodes: [],
    edges: [],
    metadata: {
      documentMetadataEntries: [
        { type: 'ui-path', value: 'Toolbar > Comment', note: 'Open `#1D4ED8|bg#DBEAFE:comment tools`', lineStart: 9 },
        { type: 'shortcut', value: '`#1D4ED8|bg#DBEAFE:Ctrl+S`', note: 'Save ==before== switching panes', lineStart: 4 },
      ],
    },
  } as unknown as GraphData)
  const html = renderToStaticMarkup(<RendererDocumentMetadataSummary entries={entries} />)
  if (!html.includes('Document metadata 2')) throw new Error('expected document metadata section title in renderer summary')
  if (!html.includes('data-kg-renderer-document-metadata-list="1"')) throw new Error('expected renderer summary metadata list marker')
  if (!html.includes('UI path')) throw new Error('expected ui-path label to be humanized in the visible surface')
  if (!html.includes('Ctrl+S') || !html.includes('comment tools') || !html.includes('before')) {
    throw new Error(`expected rendered metadata surface to include formatted values and notes, got ${html}`)
  }
  if (html.includes('`#1D4ED8|bg#DBEAFE:Ctrl+S`') || html.includes('==before==')) {
    throw new Error('expected visible metadata surface to hide raw sigil syntax')
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
