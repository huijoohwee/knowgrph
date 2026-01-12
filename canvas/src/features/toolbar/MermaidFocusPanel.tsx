import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { MermaidDiagram } from '@/features/panels/views/preview-panel/ui/MermaidDiagram'
import {
  type MermaidInitConfig,
  useRootThemeMode,
} from '@/features/panels/views/preview-panel/ui/mermaidConfig'

const extractMermaidSubgraphCode = (code: string, subgraphName: string): string => {
  const text = String(code || '')
  if (!text) return ''
  const lines = text.split('\n')
  if (lines.length === 0) return ''

  let graphLine: string | null = null
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim()
    if (!trimmed) continue
    if (trimmed.startsWith('graph ')) {
      graphLine = lines[i]
      break
    }
  }
  if (!graphLine) return text

  const name = String(subgraphName || '').trim()
  if (!name) return text

  const startRe = new RegExp(`^\\s*subgraph\\s+${name}\\b`)

  const body: string[] = []
  let inTarget = false
  let depth = 0
  let targetDepth = 0

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('graph ')) continue

    if (/^\s*subgraph\b/.test(trimmed)) {
      const isTarget = startRe.test(trimmed)
      if (isTarget && !inTarget) {
        inTarget = true
        depth += 1
        targetDepth = depth
        body.push(line)
      } else {
        depth += 1
        if (inTarget) body.push(line)
      }
      continue
    }

    if (trimmed === 'end') {
      if (inTarget) {
        body.push(line)
        depth -= 1
        if (depth < targetDepth) {
          break
        }
      } else if (depth > 0) {
        depth -= 1
      }
      continue
    }

    if (inTarget) body.push(line)
  }

  if (!inTarget || body.length === 0) return text
  const out: string[] = []
  out.push(graphLine)
  for (let i = 0; i < body.length; i += 1) out.push(body[i])
  return out.join('\n')
}

const resolveMermaidDiagramFromGraph = (graphData: GraphData | null): { code: string } | null => {
  if (!graphData || !Array.isArray(graphData.nodes)) return null
  for (let i = 0; i < graphData.nodes.length; i += 1) {
    const node = graphData.nodes[i] as GraphNode
    const type = String(node.type || '')
    if (type !== 'MermaidDiagram') continue
    const props = (node.properties || {}) as Record<string, unknown> | undefined
    if (!props) continue
    const rawCode = props.code
    const code = typeof rawCode === 'string' ? rawCode.trim() : ''
    if (!code) continue
    return { code }
  }
  return null
}

export function MermaidFocusPanel() {
  const graphData = useGraphStore(s => s.graphData as GraphData | null)
  const schema = useGraphStore(s => s.schema)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId || null)
  const mermaidFocusCode = useGraphStore(s => s.markdownPreviewMermaidFocusCode || '')
  const mermaidFocusConfig = useGraphStore(s => s.markdownPreviewMermaidFocusConfig || null)
  const frontmatterModeEnabled = useGraphStore(s => s.frontmatterModeEnabled || false)
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const rootThemeMode = useRootThemeMode()
  const [overlayPortalTarget, setOverlayPortalTarget] = React.useState<HTMLDivElement | null>(null)
  const setOverlayPortalRef = React.useCallback((el: HTMLDivElement | null) => {
    setOverlayPortalTarget(prev => (prev === el ? prev : el))
  }, [])

  const fallback = React.useMemo(() => resolveMermaidDiagramFromGraph(graphData), [graphData])
  const baseCode = React.useMemo(() => {
    const fromFocus = String(mermaidFocusCode || '').trim()
    if (!frontmatterModeEnabled && fromFocus) return fromFocus
    const fromGraph = fallback?.code ? String(fallback.code || '').trim() : ''
    if (fromGraph) return fromGraph
    return fromFocus
  }, [fallback, mermaidFocusCode, frontmatterModeEnabled])

  const selectedSubgraphName = React.useMemo(() => {
    const id = selectedNodeId ? String(selectedNodeId) : ''
    if (!graphData || !id) return ''
    const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i] as GraphNode
      if (String(n.id) !== id) continue
      const type = String(n.type || '')
      if (type !== 'MermaidNode') return ''
      const props = (n.properties || {}) as Record<string, unknown>
      const rawName = props.mermaidSubgraphName
      const name = typeof rawName === 'string' ? rawName.trim() : ''
      return name
    }
    return ''
  }, [graphData, selectedNodeId])

  const effectiveCode = React.useMemo(() => {
    const raw = baseCode
    if (!raw) return ''
    const mode = schema?.layout?.mode || 'force'
    if (mode !== 'tidy-tree') return raw
    if (!selectedSubgraphName) return raw
    return extractMermaidSubgraphCode(raw, selectedSubgraphName)
  }, [baseCode, schema, selectedSubgraphName])

  if (!effectiveCode) {
    return (
      <div ref={setOverlayPortalRef} className="h-full min-h-0 flex items-center justify-center px-3">
        <div className={['text-xs text-gray-600 text-center', uiPanelTextFontClass].join(' ')}>
          No Mermaid diagram is available for the current graph.
        </div>
      </div>
    )
  }

  return (
    <div ref={setOverlayPortalRef} className="h-full min-h-0 flex flex-col overflow-hidden relative">
      <div className="w-full h-full flex items-center justify-center">
        <div className="aspect-video w-full max-w-4xl">
          <div className="w-full h-full overflow-auto">
            <MermaidDiagram
              code={effectiveCode}
              highlightClass=""
              frontmatterConfig={mermaidFocusConfig as MermaidInitConfig | null}
              rootThemeMode={rootThemeMode}
              overlayScope="container"
              overlayPortalTarget={overlayPortalTarget}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
