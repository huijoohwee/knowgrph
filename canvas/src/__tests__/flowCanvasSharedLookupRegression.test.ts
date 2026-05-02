import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasLayoutFallbackSeedUsesSharedLookup() {
  const text = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasLayoutState.ts'),
    'utf8',
  )

  if (!text.includes("cacheScope: 'flow-canvas-layout-state-scene-graph'") || !text.includes('preferCurrentGraphDataRefs: true')) {
    throw new Error('expected FlowCanvas layout state to build a shared scene-graph lookup for fallback seeding')
  }
  if (!text.includes("const node = sceneGraphNodeById?.get(id) || null")) {
    throw new Error('expected FlowCanvas fallback seed logic to read nodes from the shared scene-graph lookup')
  }
  if (text.includes("const node = nodes.find(entry => String(entry?.id || '').trim() === id) || null")) {
    throw new Error('expected FlowCanvas fallback seed logic to remove the raw array find scan once the shared lookup exists')
  }
}

export function testFlowCanvasRichMediaResizeUsesSharedNodePropsLookup() {
  const text = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx'),
    'utf8',
  )

  if (!text.includes("const baseProps = sceneNodePropsByIdRef.current.get(id) || {}")) {
    throw new Error('expected FlowCanvas Rich Media resize start to reuse the shared scene-node props lookup')
  }
  if (!text.includes("const baseProps = sceneNodePropsByIdRef.current.get(node.id) || {}")) {
    throw new Error('expected FlowCanvas Rich Media resize commit to reuse the shared scene-node props lookup')
  }
  if (text.includes("store.graphData?.nodes?.find(entry => String(entry?.id || '') === id) || null")) {
    throw new Error('expected FlowCanvas Rich Media resize start to remove the raw store node array scan')
  }
  if (text.includes("store.graphData?.nodes?.find(entry => String(entry?.id || '') === node.id) || null")) {
    throw new Error('expected FlowCanvas Rich Media resize commit to remove the raw store node array scan')
  }
}

export function testGroupsLayerAltDragUsesSharedGraphLookup() {
  const text = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layers', 'groups.ts'),
    'utf8',
  )

  if (!text.includes("cacheScope: 'graph-canvas-groups-graph'") || !text.includes('const graphNodeById = graphLookup?.nodeById || new Map<string, GraphNode>()')) {
    throw new Error('expected groups layer to build a shared full-graph lookup for live group mutations')
  }
  if (!text.includes('const subgraphNode = graphNodeById.get(id) || null')) {
    throw new Error('expected groups layer alt-drag z-index writes to use the shared graph lookup')
  }
  if (text.includes("const subgraphNode = (graphData.nodes || []).find(n => String(n.id) === id) || null")) {
    throw new Error('expected groups layer alt-drag z-index writes to remove the raw graphData.nodes find scan')
  }
}
