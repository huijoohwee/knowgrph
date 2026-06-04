import type { GraphData, GraphNode } from '@/lib/graph/types'
import { readNodeProperties } from '@/lib/graph/nodeProperties'
import { toMetadataRecord } from '@/lib/graph/documentMetadata'

const isFrontmatterMermaidDiagram = (node: GraphNode | null | undefined): boolean => {
  if (!node || String(node.type || '') !== 'MermaidDiagram') return false
  const props = readNodeProperties(node)
  return props.isMermaidFrontmatter === true || props.mermaidScope === 'frontmatter'
}

const findFrontmatterMermaidDiagramNode = (graphData: GraphData): GraphNode | null => {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (isFrontmatterMermaidDiagram(node)) return node
  }
  return null
}

const readCode = (value: unknown): string => {
  return typeof value === 'string' ? String(value || '').trim() : ''
}

export const readFrontmatterMermaidCode = (graphData: GraphData | null | undefined): string => {
  if (!graphData) return ''
  const node = findFrontmatterMermaidDiagramNode(graphData)
  if (node) {
    const code = readCode(readNodeProperties(node).code)
    if (code) return code
  }
  const metadata = toMetadataRecord(graphData.metadata)
  const frontmatterMeta =
    metadata.frontmatterMeta && typeof metadata.frontmatterMeta === 'object' && !Array.isArray(metadata.frontmatterMeta)
      ? (metadata.frontmatterMeta as Record<string, unknown>)
      : null
  return readCode(frontmatterMeta?.mermaid)
}
