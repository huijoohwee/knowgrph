import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useGraphStore } from '@/hooks/useGraphStore'
import { readYamlFrontmatterMermaidCode } from '@/lib/markdown/frontmatter'
import {
  parseMermaidDiagramCodeModel,
  readFrontmatterMermaidDiagramCodes,
  readYamlFrontmatterMermaidDiagramCodes,
} from '@/lib/mermaid/mermaidDiagramCode'
import { readFrontmatterMermaidCode } from '@/lib/mermaid/mermaidFrontmatterCode'
import { resolveMermaidGanttCode } from '@/lib/mermaid/mermaidGitGraph'

export function useMermaidGanttDocument() {
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
      resolveMermaidGanttCode([
        ...readYamlFrontmatterMermaidDiagramCodes(markdownDocumentText || '', 'gantt'),
        readYamlFrontmatterMermaidCode(markdownDocumentText || ''),
        ...readFrontmatterMermaidDiagramCodes(graphData, 'gantt'),
        readFrontmatterMermaidCode(graphData),
      ]),
    [graphData, markdownDocumentText],
  )
  const ganttModel = React.useMemo(() => parseMermaidDiagramCodeModel(code, 'gantt'), [code])

  return {
    code,
    ganttModel,
    graphData,
    graphDataRevision,
    themeMode,
  }
}
