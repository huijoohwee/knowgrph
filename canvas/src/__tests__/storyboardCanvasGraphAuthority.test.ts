import { resolveStoryboardCanvasGraphDataAuthority } from '@/components/StoryboardWidgetCanvas/runtime/storyboardCanvasGraphAuthority'
import type { GraphData } from '@/lib/graph/types'

const graph = (id: string): GraphData => ({
  type: 'Graph',
  nodes: [{ id, label: id, type: 'Node', properties: {} }],
  edges: [],
})

export function testStoryboardCanvasGraphAuthorityPrefersLiveNonEmptyDraft() {
  const resolved = resolveStoryboardCanvasGraphDataAuthority({
    baseGraphData: graph('base'),
    draftGraphData: graph('draft'),
    renderGraphData: graph('render'),
  })
  if (resolved.nodes?.[0]?.id !== 'draft') throw new Error('expected a live non-empty draft to own Storyboard display')
}

export function testStoryboardCanvasGraphAuthorityRejectsEmptyTransientDraft() {
  const resolved = resolveStoryboardCanvasGraphDataAuthority({
    baseGraphData: graph('base'),
    draftGraphData: { type: 'Graph', nodes: [], edges: [] },
    renderGraphData: graph('render'),
  })
  if (resolved.nodes?.[0]?.id !== 'render') throw new Error('expected an empty transient draft to preserve the stable Storyboard render graph')
}
