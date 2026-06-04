import { splitMermaidDiagrams } from 'grph-shared/markdown/mermaidInput'

export const resolveMermaidGitGraphCode = (candidates: ReadonlyArray<string | null | undefined>): string => {
  for (let i = 0; i < candidates.length; i += 1) {
    const raw = String(candidates[i] || '').trim()
    if (!raw) continue
    const diagrams = splitMermaidDiagrams(raw)
    const gitGraph = diagrams.find(diagram => diagram.kind === 'gitgraph')
    const code = String(gitGraph?.code || '').trim()
    if (code) return code
  }
  return ''
}
