import type { GraphData } from '@/lib/graph/types'
import { hasFrontmatterMermaidSeeds } from '@/lib/graph/layerDerivation'

const FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY = 'flow:quickEditorFormId' as const
const FLOW_PORT_TYPES_KEY = 'flow:portTypes' as const

export function isFrontmatterFlowGraph(graphData: GraphData): boolean {
  const context = String(graphData.context || '').trim().toLowerCase()
  if (context === 'frontmatter-flow') return true
  const metadata = graphData.metadata && typeof graphData.metadata === 'object'
    ? (graphData.metadata as Record<string, unknown>)
    : null
  const kind = String(metadata?.kind || '').trim().toLowerCase()
  if (kind === 'frontmatter-flow') return true

  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i] as unknown as { properties?: unknown }
    const props = n?.properties
    if (!props || typeof props !== 'object' || Array.isArray(props)) continue
    const record = props as Record<string, unknown>
    const formId = record[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]
    if (typeof formId === 'string' && formId.trim().startsWith('fm:')) return true
    const portTypes = record[FLOW_PORT_TYPES_KEY]
    if (portTypes && typeof portTypes === 'object' && !Array.isArray(portTypes)) return true
  }

  return false
}

export function computeEffectiveFrontmatterMode(args: {
  frontmatterModeEnabled: boolean
  documentSemanticMode: string
  graphData: GraphData | null
}): boolean {
  if (args.frontmatterModeEnabled !== true) return false
  const semantic = String(args.documentSemanticMode || '').trim().toLowerCase()
  if (semantic && semantic !== 'document') return false
  if (!args.graphData) return false
  if (isFrontmatterFlowGraph(args.graphData)) return true
  return hasFrontmatterMermaidSeeds(args.graphData)
}
