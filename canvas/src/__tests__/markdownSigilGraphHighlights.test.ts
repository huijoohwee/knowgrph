import { applyMarkdownSigilHighlightsToGraphData } from '@/lib/graph/markdownSigilGraphHighlights'
import { extractMarkdownAnnotationsFromText } from '@/lib/markdown/markdownSigil'
import type { GraphData } from '@/lib/graph/types'

export const testMarkdownSigilGraphHighlightsReturnSameGraphWhenNoSigils = () => {
  const graph = {
    type: 'Graph',
    nodes: [{ id: 'n1', label: 'Plain node', type: 'Note', properties: {} }],
    edges: [],
    metadata: { sourceLayerHash: 'plain' },
  }
  const out = applyMarkdownSigilHighlightsToGraphData({ graphData: graph as GraphData, graphRevision: 1 })
  if (out !== graph) throw new Error('expected unchanged graph reference when no sigil/highlight syntax exists')
}

export const testMarkdownSigilGraphHighlightsAnnotateLabelForRenderers = () => {
  const graph = {
    type: 'Graph',
    nodes: [{ id: 'n1', label: '`#D85A30|bg#FEF3C7:Urgent task`', type: 'Task', properties: {} }],
    edges: [],
    metadata: { sourceLayerHash: 'sigil-label' },
  }
  const out = applyMarkdownSigilHighlightsToGraphData({ graphData: graph as GraphData, graphRevision: 2 })
  if (!out || out === graph) throw new Error('expected highlighted render graph clone')
  const node = out.nodes?.[0]
  if (!node) throw new Error('expected highlighted node')
  if (node.label !== 'Urgent task') throw new Error('expected render label to use sigil text')
  const props = (node.properties || {}) as Record<string, unknown>
  if (props['markdown:highlight'] !== true) throw new Error('expected markdown highlight marker')
  if (props['visual:fill'] !== '#FEF3C7') throw new Error('expected background to map to visual fill')
  if (props['visual:labelColor'] !== '#D85A30') throw new Error('expected color to map to visual label color')
  if (props['visual:stroke'] !== '#D85A30') throw new Error('expected color to map to visual stroke')
  const meta = (out.metadata || {}) as Record<string, unknown>
  if (meta.markdownSigilHighlightCount !== 1) throw new Error('expected graph highlight count metadata')
}

export const testMarkdownSigilGraphHighlightsReuseKeywordMetadata = () => {
  const graph = {
    type: 'Graph',
    nodes: [
      {
        id: 'kw:1',
        label: 'Agent Labs',
        type: 'Keyword',
        properties: {
          'keyword:highlight': true,
          'keyword:highlight:color': '#1D4ED8',
          'keyword:highlight:background': '#DBEAFE',
        },
      },
    ],
    edges: [],
    metadata: { sourceLayerHash: 'keyword-highlight' },
  }
  const out = applyMarkdownSigilHighlightsToGraphData({ graphData: graph as GraphData, graphRevision: 3 })
  const props = ((out?.nodes || [])[0]?.properties || {}) as Record<string, unknown>
  if (props['visual:fill'] !== '#DBEAFE') throw new Error('expected keyword highlight background to map to visual fill')
  if (props['visual:labelColor'] !== '#1D4ED8') throw new Error('expected keyword highlight color to map to label color')
}

export const testMarkdownSigilGraphHighlightsDefaultMarkGetsVisualFallback = () => {
  const graph = {
    type: 'Graph',
    nodes: [{ id: 'n1', label: '==Review queue==', type: 'Task', properties: {} }],
    edges: [],
    metadata: { sourceLayerHash: 'default-mark' },
  }
  const out = applyMarkdownSigilHighlightsToGraphData({ graphData: graph as GraphData, graphRevision: 4 })
  const node = out?.nodes?.[0]
  const props = (node?.properties || {}) as Record<string, unknown>
  if (node?.label !== 'Review queue') throw new Error('expected default mark label to be unwrapped for renderers')
  if (props['visual:fill'] !== '#FEF3C7') throw new Error('expected default mark fill fallback')
  if (props['visual:stroke'] !== '#D97706') throw new Error('expected default mark stroke fallback')
  if (props['visual:labelColor'] !== '#78350F') throw new Error('expected default mark label fallback')
}

export const testMarkdownSigilAnnotationExtractionReusesCache = () => {
  const markdown = [
    '`#D85A30|bg#FEF3C7:Agent labs` coordinate review.',
    '==Deployment review== remains visible to renderers.',
  ].join('\n')
  const first = extractMarkdownAnnotationsFromText(markdown)
  const second = extractMarkdownAnnotationsFromText(markdown)
  if (first !== second) throw new Error('expected repeated annotation extraction to reuse cached result')
  if (first.length !== 2) throw new Error('expected sigil and default mark annotations')
}
