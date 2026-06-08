import { resolveMermaidDiagramCode } from '@/lib/mermaid/mermaidDiagramCode'

export const resolveMermaidGitGraphCode = (candidates: ReadonlyArray<string | null | undefined>): string => {
  return resolveMermaidDiagramCode(candidates, 'gitgraph')
}

export const resolveMermaidGanttCode = (candidates: ReadonlyArray<string | null | undefined>): string => {
  return resolveMermaidDiagramCode(candidates, 'gantt')
}

export const resolveMermaidTimelineCode = (candidates: ReadonlyArray<string | null | undefined>): string => {
  return resolveMermaidDiagramCode(candidates, 'timeline')
}
