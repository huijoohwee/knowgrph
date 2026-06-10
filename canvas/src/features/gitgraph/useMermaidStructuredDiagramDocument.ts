import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useGraphStore } from '@/hooks/useGraphStore'
import { readYamlFrontmatterMermaidCode } from '@/lib/markdown/frontmatter'
import {
  parseMermaidDiagramCodeModel,
  readFrontmatterMermaidDiagramCodes,
  readYamlFrontmatterMermaidDiagramCodes,
  resolveMermaidDiagramCode,
  type MermaidStructuredDiagramKind,
} from '@/lib/mermaid/mermaidDiagramCode'
import { readFrontmatterMermaidCode } from '@/lib/mermaid/mermaidFrontmatterCode'

export function useMermaidStructuredDiagramDocument(kind: MermaidStructuredDiagramKind) {
  const graphData = useActiveGraphRenderData(true)
  const { graphDataRevision, markdownDocumentText, themeMode } = useGraphStore(
    useShallow(state => ({
      graphDataRevision: state.graphDataRevision,
      markdownDocumentText: state.markdownDocumentText,
      themeMode: (state.resolvedThemeMode || 'light') as 'light' | 'dark',
    })),
  )
  const code = React.useMemo(
    () =>
      resolveMermaidDiagramCode([
        ...readYamlFrontmatterMermaidDiagramCodes(markdownDocumentText || '', kind),
        readYamlFrontmatterMermaidCode(markdownDocumentText || ''),
        ...readFrontmatterMermaidDiagramCodes(graphData, kind),
        readFrontmatterMermaidCode(graphData),
      ], kind),
    [graphData, kind, markdownDocumentText],
  )
  const model = React.useMemo(() => parseMermaidDiagramCodeModel(code, kind), [code, kind])

  return {
    code,
    graphData,
    graphDataRevision,
    model,
    themeMode,
  }
}
