import React from 'react'
import type { GraphData } from '@/lib/graph/types'
import type { MarkdownLayoutMode } from '../BottomPanelMarkdownSection'

type UseMarkdownAutoPositionProps = {
  selectionSource: string | null
  selectedNodeId: string | null
  selectedEdgeId: string | null
  graphData: GraphData | null
  markdownDocumentName: string | null
  triggerJump: (line: number) => void
  frontmatterMermaidCode: string
  markdownText: string
  markdownLayoutMode: MarkdownLayoutMode
  setMarkdownLayoutMode: (mode: MarkdownLayoutMode) => void
  setMarkdownPresentationMode: (mode: boolean) => void
}

export function useMarkdownAutoPosition(props: UseMarkdownAutoPositionProps) {
  const {
    selectionSource,
    selectedNodeId,
    selectedEdgeId,
    graphData,
    markdownDocumentName,
    triggerJump,
    frontmatterMermaidCode,
    markdownText,
    markdownLayoutMode,
    setMarkdownLayoutMode,
    setMarkdownPresentationMode,
  } = props

  React.useEffect(() => {
    // Only auto-position if selection comes from canvas or table
    if (selectionSource !== 'canvas' && selectionSource !== 'table') return

    if ((!selectedNodeId && !selectedEdgeId) || !graphData) return
    const id = selectedNodeId || selectedEdgeId
    if (!id) return

    const nodes = (graphData.nodes || []) as Array<{
      id: string
      type?: string
      metadata?: { lineStart?: number; documentPath?: string }
    }>
    const edges = (graphData.edges || []) as Array<{
      id: string
      type?: string
      metadata?: { lineStart?: number; documentPath?: string }
    }>

    const entity = selectedNodeId
      ? nodes.find(n => String(n.id) === selectedNodeId)
      : edges.find(e => String(e.id) === selectedEdgeId)

    if (!entity) return
    
    // Check if it belongs to current document
    const docPath = entity.metadata?.documentPath
    const currentDoc = markdownDocumentName || ''
    if (docPath && docPath !== currentDoc) return

    let line = entity.metadata?.lineStart
    if (typeof line === 'number' && line > 0) {
      // Auto-switch to editor mode if needed
      if (markdownLayoutMode !== 'editor') {
        setMarkdownLayoutMode('editor')
        setMarkdownPresentationMode(false)
      }

      if ((line === 1 || line < 5) && frontmatterMermaidCode && markdownText) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyEntity = entity as any
        const name = (anyEntity.name || anyEntity.properties?.nodeName || anyEntity.properties?.name || anyEntity.properties?.label || '') as string
        const searchTerm = name || id

        const fileLines = markdownText.split('\n')
        let mermaidStartLine = -1
        // Look for mermaid key in frontmatter (first 100 lines max)
        for (let i = 0; i < Math.min(fileLines.length, 100); i++) {
          const l = fileLines[i].trim()
          if (l === '---' && i > 0) break // End of frontmatter
          if (l.startsWith('mermaid:')) {
            mermaidStartLine = i + 1
            break
          }
        }

        if (mermaidStartLine > 0) {
          const codeLines = frontmatterMermaidCode.split('\n')
          let found = false
          for (let i = 0; i < codeLines.length; i++) {
            const codeLine = codeLines[i]
            // Simple strict word match for ID or Name
            const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const re = new RegExp(`\\b${escaped}\\b`)
            if (re.test(codeLine)) {
              // Offset by 1 because mermaid block content usually starts on next line after key
              line = mermaidStartLine + i + 1
              found = true
              break
            }
          }
          // If specific line not found, default to start of mermaid block
          if (!found) {
            line = mermaidStartLine + 1
          }
        }
      }
      triggerJump(line)
    }
  }, [
    selectedNodeId,
    selectedEdgeId,
    graphData,
    markdownDocumentName,
    triggerJump,
    frontmatterMermaidCode,
    markdownText,
    markdownLayoutMode,
    setMarkdownLayoutMode,
    setMarkdownPresentationMode,
    selectionSource,
  ])
}
