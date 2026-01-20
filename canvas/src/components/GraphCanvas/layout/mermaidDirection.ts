import type { GraphNode } from '@/lib/graph/types'

export type MermaidAxis = { axis: 'x' | 'y'; forward: 1 | -1 }

export const readMermaidAxisFromNodes = (nodes: GraphNode[]): MermaidAxis => {
  const diagrams = nodes.filter(n => String(n.type || '') === 'MermaidDiagram')
  if (diagrams.length === 0) return { axis: 'x', forward: 1 }
  const preferred =
    diagrams.find(n => String((n.properties || {})['mermaidScope'] || '') === 'frontmatter') ?? diagrams[0]
  const code = String((preferred.properties || {})['code'] || '')
  const firstLine =
    code
      .split('\n')
      .map(l => l.trim())
      .find(l => l.length > 0) || ''
  const m = /^(?:graph|flowchart)\s+([A-Za-z]{2})\b/.exec(firstLine)
  const dir = (m?.[1] || '').toUpperCase()
  if (dir === 'TB' || dir === 'TD' || dir === 'DT') return { axis: 'y', forward: 1 }
  if (dir === 'BT') return { axis: 'y', forward: -1 }
  if (dir === 'LR') return { axis: 'x', forward: 1 }
  if (dir === 'RL') return { axis: 'x', forward: -1 }
  return { axis: 'x', forward: 1 }
}

