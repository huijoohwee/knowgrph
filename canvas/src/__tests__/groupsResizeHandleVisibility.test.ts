import * as d3 from 'd3'
import { JSDOM } from 'jsdom'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { createGroupsLayer } from '@/components/GraphCanvas/layers/groups'
import { useGraphStore } from '@/hooks/useGraphStore'

export function testGroupsLayerResizeHandleVisibleWhenSelected() {
  const dom = new JSDOM('<!doctype html><html><body><svg xmlns="http://www.w3.org/2000/svg"></svg></body></html>')
  const svgEl = dom.window.document.querySelector('svg')
  if (!svgEl) throw new Error('expected svg element')

  const gSel = d3.select(svgEl).append('g')

  const nodes: GraphNode[] = [{ id: 'n1', x: 100, y: 120, label: 'A', type: 'Node', properties: {} } as unknown as GraphNode]
  const graphData: GraphData = { nodes, edges: [], type: 'application/json' } as unknown as GraphData
  const schema: GraphSchema = { behavior: { allowEdgeCreation: true, allowNodeDrag: true }, layout: { groups: { enabled: true, shape: 'rect' } } } as unknown as GraphSchema

  const groupsOverride: GraphGroup[] = [{ id: 'g1', label: 'G', depth: 0, memberNodeIds: ['n1'], style: {} }]

  useGraphStore.setState({ selectedGroupId: null } as unknown as never)

  const layer = createGroupsLayer({
    g: gSel as unknown as d3.Selection<SVGGElement, unknown, null, undefined>,
    graphData,
    edgesForDisplay: [],
    schema,
    groupsOverride,
    simulation: null,
    setSelectionSource: () => {},
    selectNode: () => {},
    selectGroup: () => {},
    selectGroupExpanded: () => {},
    toggleGroupCollapsed: () => {},
  })
  layer.update()

  const groupEl = svgEl.querySelector('g[data-kg-group-id="g1"]')
  if (!groupEl) throw new Error('expected group element')

  const handleEl = svgEl.querySelector(
    'g[data-kg-layer="group-resize-handles"] g[data-kg-group-resize="br"][data-kg-group-id="g1"]',
  ) as SVGGElement | null
  if (!handleEl) throw new Error('expected resize handle group')
  if (handleEl.style.display !== 'none') throw new Error('expected resize handle to be hidden when no group is selected')

  useGraphStore.setState({ selectedGroupId: 'g1' } as unknown as never)
  layer.update()
  if (handleEl.style.display === 'none') throw new Error('expected resize handle to be visible when group is selected')
  const dot = handleEl.querySelector('circle[data-kg-group-resize-dot="1"]')
  if (!dot) throw new Error('expected resize handle dot')

  const resizeLayer = svgEl.querySelector('g[data-kg-layer="group-resize-handles"]')
  if (!resizeLayer) throw new Error('expected resize handles layer')
  const lastChild = resizeLayer.lastElementChild
  if (!lastChild) throw new Error('expected resize handles layer children')
  if (lastChild !== handleEl) throw new Error('expected resize handle to render above group shapes')

  useGraphStore.setState({ selectedGroupId: null } as unknown as never)
  layer.update()
  if (handleEl.style.display !== 'none') throw new Error('expected resize handle to hide when selection is cleared')
}
