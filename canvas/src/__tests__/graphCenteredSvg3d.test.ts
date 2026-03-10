import type { GraphData } from '@/lib/graph/types'
import { exportGraphAsCentered3dSvgMarkup } from '@/lib/graph/graphCenteredSvg3d'
import { defaultSchema } from '@/lib/graph/schema'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export function testGraphCenteredSvg3dCentersAndAnimates() {
  const g: GraphData = {
    type: 'Graph',
    nodes: [
      { id: 'a', type: 'Entity', label: 'A', properties: { pos3d: [80, 0, 40] } },
      { id: 'b', type: 'Entity', label: 'B', properties: { pos3d: [-80, 0, -40] } },
    ],
    edges: [{ id: 'e1', source: 'a', target: 'b', label: 'rel', properties: {} }],
  }

  const svg = exportGraphAsCentered3dSvgMarkup({
    graphData: g,
    schema: defaultSchema,
    widthPx: 900,
    heightPx: 600,
    paddingPx: 60,
    includeXmlDeclaration: false,
    animated: true,
    frames: 12,
    durationSec: 4,
  })
  if (!svg) throw new Error('expected svg markup')
  if (!svg.includes('<script')) throw new Error('expected script animation')
  if (!svg.includes('data-kg-3d-payload=')) throw new Error('expected embedded 3d payload')
  if (!svg.includes('data-node-id="a"') || !svg.includes('data-node-id="b"')) throw new Error('expected node elements present')
  if (svg.includes('0.35+t*0.65')) throw new Error('expected no depth-based opacity curve')

  const m = svg.match(/viewBox="([^"]+)"/)
  if (!m) throw new Error('expected viewBox')
  const parts = String(m[1] || '').trim().split(/[ ,]+/).map(Number)
  if (parts.length !== 4) throw new Error('expected 4 viewBox numbers')
  const [x, y, w, h] = parts
  const cx = x + w / 2
  const cy = y + h / 2
  if (!(Math.abs(cx) < 1e-6)) throw new Error(`expected centered viewBox cx=0, got ${cx}`)
  if (!(Math.abs(cy) < 1e-6)) throw new Error(`expected centered viewBox cy=0, got ${cy}`)
}

export function testGraphCenteredSvg3dResolvesThemeColorsWhenDocumentAvailable() {
  const env = initJsdomHarness()
  try {
    const doc = env.dom.window.document
    doc.documentElement.style.setProperty('--kg-canvas-bg', '#112233')
    doc.documentElement.style.setProperty('--kg-text-primary', '#ddeeff')
    doc.documentElement.style.setProperty('--kg-canvas-label-fill', '#ddeeff')
    doc.documentElement.style.setProperty('--kg-border', '#445566')
    doc.documentElement.style.setProperty('--kg-canvas-node-stroke', '#445566')

    const g: GraphData = {
      type: 'Graph',
      nodes: [{ id: 'a', type: 'Entity', label: 'A', properties: { pos3d: [10, 0, 0] } }],
      edges: [],
    }
    const svg = exportGraphAsCentered3dSvgMarkup({
      graphData: g,
      schema: defaultSchema,
      widthPx: 800,
      heightPx: 600,
      paddingPx: 40,
      includeXmlDeclaration: false,
      animated: false,
    })
    if (!svg) throw new Error('expected svg markup')
    if (!/fill="rgb\(\s*17,\s*34,\s*51\s*\)"/.test(svg) && !/fill="#112233"/i.test(svg)) {
      throw new Error('expected background fill to use theme canvas bg')
    }
    if (!/stroke="rgb\(\s*68,\s*85,\s*102\s*\)"/.test(svg) && !/stroke="#445566"/i.test(svg)) {
      throw new Error('expected node stroke to use theme border')
    }
    if (!/fill="rgb\(\s*221,\s*238,\s*255\s*\)"/.test(svg) && !/fill="#ddeeff"/i.test(svg)) {
      throw new Error('expected label fill to use theme text')
    }
  } finally {
    env.restore()
  }
}

export function testGraphCenteredSvg3dEdgeRgbaAlphaControlsStrokeOpacity() {
  const g: GraphData = {
    type: 'Graph',
    nodes: [
      { id: 'a', type: 'Entity', label: 'A', properties: { pos3d: [40, 0, 0] } },
      { id: 'b', type: 'Entity', label: 'B', properties: { pos3d: [-40, 0, 0] } },
    ],
    edges: [{ id: 'e1', source: 'a', target: 'b', label: 'rel', properties: { 'visual:stroke': 'rgba(255,0,0,0.2)' } }],
  }
  const svg = exportGraphAsCentered3dSvgMarkup({
    graphData: g,
    schema: defaultSchema,
    widthPx: 900,
    heightPx: 600,
    paddingPx: 60,
    includeXmlDeclaration: false,
    animated: false,
  })
  if (!svg) throw new Error('expected svg markup')
  if (!svg.includes('stroke="rgb(255, 0, 0)"')) throw new Error('expected rgba to be normalized to rgb stroke')
  if (!svg.includes('stroke-opacity="0.2"')) throw new Error('expected rgba alpha to drive stroke-opacity')
}

export function testGraphCenteredSvg3dShaderLineModeIgnoresSchemaEdgeOpacity() {
  const g: GraphData = {
    type: 'Graph',
    nodes: [
      { id: 'a', type: 'Entity', label: 'A', properties: { pos3d: [40, 0, 0] } },
      { id: 'b', type: 'Entity', label: 'B', properties: { pos3d: [-40, 0, 0] } },
    ],
    edges: [{ id: 'e1', source: 'a', target: 'b', label: 'rel', properties: {} }],
  }
  const svg = exportGraphAsCentered3dSvgMarkup({
    graphData: g,
    schema: defaultSchema,
    widthPx: 900,
    heightPx: 600,
    paddingPx: 60,
    includeXmlDeclaration: false,
    animated: false,
    threeEdgeRenderer: 'shaderLine',
  })
  if (!svg) throw new Error('expected svg markup')
  if (!svg.includes('stroke-opacity="1"')) throw new Error('expected shaderLine export to use opaque edges')
}

export function testGraphCenteredSvg3dNodeVisualOpacityAffectsSvgOpacity() {
  const g: GraphData = {
    type: 'Graph',
    nodes: [
      { id: 'a', type: 'Entity', label: 'A', properties: { pos3d: [0, 0, 0], 'visual:opacity': 0.2 } },
    ],
    edges: [],
  }
  const svg = exportGraphAsCentered3dSvgMarkup({
    graphData: g,
    schema: defaultSchema,
    widthPx: 900,
    heightPx: 600,
    paddingPx: 60,
    includeXmlDeclaration: false,
    animated: false,
  })
  if (!svg) throw new Error('expected svg markup')
  if (!svg.includes('data-node-id="a"')) throw new Error('expected node present')
  if (!svg.includes('opacity="0.2"')) throw new Error('expected visual:opacity to drive exported node opacity')
}
