import fs from 'node:fs'
import path from 'node:path'

import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'
import {
  FRONTMATTER_BALANCED_EDGE_ROUTE,
  FRONTMATTER_COLLECTIVE_INDEX_KEY,
  FRONTMATTER_COLLECTIVE_GROUP_ID_KEY,
  FRONTMATTER_COLLECTIVE_ITEM_KEY,
  FRONTMATTER_COLLECTIVE_ROLE_INDEX_KEY,
  FRONTMATTER_COLLECTIVE_ROLE_KEY,
  FRONTMATTER_DIRECTOR_BRIEF_SHOTS_GROUP_ID,
  resolveFrontmatterOverlayEdgeCrowdingLiftPx,
  resolveFrontmatterOverlayEdgeCurveOptions,
} from '@/lib/storyboardWidget/frontmatterCollectiveLayout'

export function testFrontmatterDirectorBriefWidgetsCarrySemanticCollectiveLayout() {
  const md = [
    '---',
    'kgCanvas2dRenderer: storyboard',
    'kgFrontmatterModeEnabled: true',
    'director_brief:',
    '  shots:',
    '    - shot: A',
    '      description: First neutral scene.',
    '      image_prompt: First image.',
    '      video_prompt: First video.',
    '    - shot: B',
    '      description: Second neutral scene.',
    '      image_prompt: Second image.',
    '      video_prompt: Second video.',
    '---',
  ].join('\n')

  const parsed = tryParseMarkdownFrontmatterFlowGraph('semantic-collective.md', md)
  if (!parsed) throw new Error('expected frontmatter flow parse result')
  const semanticNodes = parsed.graphData.nodes.filter(node => {
    const props = (node.properties || {}) as Record<string, unknown>
    return String(props[FRONTMATTER_COLLECTIVE_GROUP_ID_KEY] || '') === FRONTMATTER_DIRECTOR_BRIEF_SHOTS_GROUP_ID
  })
  if (semanticNodes.length !== 12) {
    throw new Error(`expected semantic collective metadata on derived widgets and panels, got ${semanticNodes.length}`)
  }
  const roles = new Set(semanticNodes.map(node => String(((node.properties || {}) as Record<string, unknown>)[FRONTMATTER_COLLECTIVE_ROLE_KEY] || '')))
  for (const role of ['text', 'textPanel', 'image', 'imagePanel', 'video', 'videoPanel']) {
    if (!roles.has(role)) throw new Error(`expected derived collective role ${role}`)
  }
  const semanticEdges = parsed.graphData.edges.filter(edge => {
    const props = (edge.properties || {}) as Record<string, unknown>
    return String(props.layoutRoute || '') === FRONTMATTER_BALANCED_EDGE_ROUTE
  })
  if (semanticEdges.length !== 10) throw new Error(`expected balanced semantic route on derived edges, got ${semanticEdges.length}`)
}

export function testFrontmatterDirectorBriefWidgetsUseCentroidBalancedSourceBand() {
  const md = [
    '---',
    'kgCanvas2dRenderer: storyboard',
    'kgFrontmatterModeEnabled: true',
    'nodes:',
    '  - id: anchor',
    '    type: default',
    '    label: Anchor',
    '    pos: { x: 0, y: 0 }',
    'director_brief:',
    '  shots:',
    '    - shot: A',
    '      description: First neutral scene.',
    '    - shot: B',
    '      description: Second neutral scene.',
    '    - shot: C',
    '      description: Third neutral scene.',
    '    - shot: D',
    '      description: Fourth neutral scene.',
    '    - shot: E',
    '      description: Fifth neutral scene.',
    '---',
  ].join('\n')

  const parsed = tryParseMarkdownFrontmatterFlowGraph('semantic-centroid.md', md)
  if (!parsed) throw new Error('expected frontmatter flow parse result')
  const semanticNodes = parsed.graphData.nodes.filter(node => {
    const props = (node.properties || {}) as Record<string, unknown>
    return String(props[FRONTMATTER_COLLECTIVE_GROUP_ID_KEY] || '') === FRONTMATTER_DIRECTOR_BRIEF_SHOTS_GROUP_ID
  })
  const ys = semanticNodes.map(node => Number(node.y)).filter(Number.isFinite)
  if (ys.length !== semanticNodes.length) throw new Error('expected all semantic collective nodes to carry finite y coordinates')
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const centroidY = ys.reduce((sum, y) => sum + y, 0) / Math.max(1, ys.length)
  if (Math.abs(centroidY) > 700 || maxY - minY > 2200) {
    throw new Error(`expected derived director-brief collective source band to stay centroid-balanced around the authored graph, got centroidY=${centroidY} span=${maxY - minY}`)
  }
}

export function testFrontmatterOverlayEdgesUseSemanticCollectiveLayoutInsteadOfDemoIds() {
  const sourceNode = {
    id: 'neutral-text',
    type: 'TextGeneration',
    properties: {
      [FRONTMATTER_COLLECTIVE_GROUP_ID_KEY]: FRONTMATTER_DIRECTOR_BRIEF_SHOTS_GROUP_ID,
      [FRONTMATTER_COLLECTIVE_ITEM_KEY]: 'neutral-scene',
      [FRONTMATTER_COLLECTIVE_ROLE_KEY]: 'text',
      [FRONTMATTER_COLLECTIVE_INDEX_KEY]: 2,
      [FRONTMATTER_COLLECTIVE_ROLE_INDEX_KEY]: 0,
    },
  }
  const targetNode = {
    id: 'neutral-panel',
    type: 'RichMediaPanel',
    properties: {
      [FRONTMATTER_COLLECTIVE_GROUP_ID_KEY]: FRONTMATTER_DIRECTOR_BRIEF_SHOTS_GROUP_ID,
      [FRONTMATTER_COLLECTIVE_ITEM_KEY]: 'neutral-scene',
      [FRONTMATTER_COLLECTIVE_ROLE_KEY]: 'textPanel',
      [FRONTMATTER_COLLECTIVE_INDEX_KEY]: 2,
      [FRONTMATTER_COLLECTIVE_ROLE_INDEX_KEY]: 0,
    },
  }
  const edge = {
    id: 'neutral-edge',
    properties: {
      layoutRoute: FRONTMATTER_BALANCED_EDGE_ROUTE,
      layoutLane: -1,
    },
  }
  const curve = resolveFrontmatterOverlayEdgeCurveOptions({
    graphMetaKind: 'frontmatter-flow',
    edge,
    sourceNode,
    targetNode,
    sourceId: 'neutral-text',
    targetId: 'neutral-panel',
  })
  if (!curve) throw new Error('expected semantic frontmatter collective edge to derive curve options')
  if (curve.phase !== -1 || !(curve.bend < 0)) {
    throw new Error(`expected layoutLane to control semantic edge phase, got ${JSON.stringify(curve)}`)
  }
  const lift = resolveFrontmatterOverlayEdgeCrowdingLiftPx({
    graphMetaKind: 'frontmatter-flow',
    edge,
    sourceNode,
    targetNode,
    sourceId: 'neutral-text',
    targetId: 'neutral-panel',
    sourceY: 20,
    targetY: 420,
    sourceHeight: 320,
    targetHeight: 320,
  })
  if (!(lift > 0)) throw new Error(`expected semantic crowded edge lift, got ${lift}`)
}

export function testStoryboardWidgetOverlayRuntimeHasNoDemoSpecificShotEdgeIds() {
  const root = process.cwd()
  const runtimeFiles = [
    path.resolve(root, 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'storyboardWidgetRenderGraph.ts'),
    path.resolve(root, 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'useStoryboardWidgetOverlayEdges.ts'),
  ]
  const generatedShotIdPrefix = ['db', 'shot'].join('-')
  const forbidden = [
    new RegExp(`${generatedShotIdPrefix}-S0\\[[^\\]]+\\]`),
    new RegExp(`${generatedShotIdPrefix}-S0[1-9]-`),
  ]
  for (const file of runtimeFiles) {
    const text = fs.readFileSync(file, 'utf8')
    for (const pattern of forbidden) {
      if (pattern.test(text)) throw new Error(`forbidden demo-specific shot edge id matcher found in ${file}`)
    }
  }
}
