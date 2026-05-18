import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { hashStringToHexCached } from '@/lib/hash/textHashCache'
import { isPendingFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { containsFrontmatterMermaid } from 'grph-shared/markdown/mermaidInput'

export function CanvasFrontmatterRuntime() {
  const { markdownDocumentName, markdownDocumentText, frontmatterModeEnabled, documentSemanticMode, graphData } = useGraphStore(
    useShallow(s => ({
      markdownDocumentName: s.markdownDocumentName,
      markdownDocumentText: s.markdownDocumentText,
      frontmatterModeEnabled: s.frontmatterModeEnabled || false,
      documentSemanticMode: (s.documentSemanticMode || 'document') as 'document' | 'keyword',
      graphData: s.graphData,
    })),
  )

  const lastAutoAppliedMarkdownHashRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (documentSemanticMode !== 'document') return
    if (!frontmatterModeEnabled) return
    const text = String(markdownDocumentText || '')
    if (!text.trim()) return
    const base = graphData as unknown as { nodes?: unknown[]; edges?: unknown[] } | null
    const n = base && Array.isArray(base.nodes) ? base.nodes.length : 0
    const e = base && Array.isArray(base.edges) ? base.edges.length : 0
    if (n > 0 || e > 0) return
    if (isPendingFrontmatterFlowGraph(graphData)) return
    if (!containsFrontmatterMermaid(text)) return
    const h = hashStringToHexCached(`canvas-frontmatter-runtime:${markdownDocumentName || 'document.md'}`, text)
    if (lastAutoAppliedMarkdownHashRef.current === h) return
    lastAutoAppliedMarkdownHashRef.current = h
    void import('@/features/parsers/loader')
      .then(mod => mod.autoApplyFrontmatterMermaidMarkdownToGraphIfEmpty({ name: markdownDocumentName, text }))
      .catch(() => {
        void 0
      })
  }, [documentSemanticMode, frontmatterModeEnabled, graphData, markdownDocumentName, markdownDocumentText])

  return null
}
