import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getEdgeBaseStroke, getNodeBaseFill, getNodeLabelColor } from '@/lib/graph/visualStyles'

export const testVisualStylesReusesSharedReaders = () => {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'graph', 'visualStyles.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { readNodeProperties } from '@/lib/graph/nodeProperties'")) {
    throw new Error('expected visual styles to reuse the shared node properties reader upstream')
  }
  if (!text.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected visual styles to reuse the shared plain-object guard upstream')
  }
  if (!text.includes('const readPlainObject = (value: unknown): Record<string, unknown> | null => {')) {
    throw new Error('expected visual styles to centralize edge property coercion in one local helper')
  }
  if (!text.includes('const props = readNodeProperties(node)')) {
    throw new Error('expected node visual styles to reuse the shared node properties reader')
  }
  if (text.includes("rawProps && typeof rawProps === 'object' && !Array.isArray(rawProps)")) {
    throw new Error('expected visual styles to stop coercing properties inline')
  }
}

export const testVisualStylesPreferExplicitVisualOverrides = () => {
  const schema = {
    nodeStyles: { Widget: { color: '#123456' } },
    nodeStroke: { Widget: { color: '#654321' } },
    edgeStyles: { linksTo: { color: '#abcdef' } },
    labelStyles: { color: '#101010' },
    behavior: { allowEdgeCreation: true, allowNodeDrag: true },
  } as never
  const fill = getNodeBaseFill(
    { id: 'n1', type: 'Widget', properties: { 'visual:fill': '#ff00aa', fill: '#00ffaa' } } as never,
    schema,
  )
  const label = getNodeLabelColor(
    { id: 'n1', type: 'Widget', properties: { 'visual:labelColor': '#334455', 'visual:color': '#556677' } } as never,
    schema,
  )
  const edgeStroke = getEdgeBaseStroke(
    { id: 'e1', label: 'linksTo', properties: { 'visual:stroke': '#112233', 'visual:color': '#445566' } } as never,
    schema,
  )
  if (fill !== '#ff00aa') throw new Error(`expected node visual fill override, got ${fill}`)
  if (label !== '#334455') throw new Error(`expected node label visual override, got ${label}`)
  if (edgeStroke !== '#112233') throw new Error(`expected edge stroke visual override, got ${edgeStroke}`)
}
