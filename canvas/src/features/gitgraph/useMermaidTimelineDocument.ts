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
import { resolveMermaidTimelineCode } from '@/lib/mermaid/mermaidGitGraph'

export function useMermaidTimelineDocument() {
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
      resolveMermaidTimelineCode([
        ...readYamlFrontmatterMermaidDiagramCodes(markdownDocumentText || '', 'timeline'),
        readYamlFrontmatterMermaidCode(markdownDocumentText || ''),
        ...readFrontmatterMermaidDiagramCodes(graphData, 'timeline'),
        readFrontmatterMermaidCode(graphData),
      ]),
    [graphData, markdownDocumentText],
  )
  const timelineModel = React.useMemo(() => parseMermaidDiagramCodeModel(code, 'timeline'), [code])

  return {
    code,
    graphData,
    graphDataRevision,
    themeMode,
    timelineModel,
  }
}
