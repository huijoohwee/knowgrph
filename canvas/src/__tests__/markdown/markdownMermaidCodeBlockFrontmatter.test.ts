import {
  mergeMermaidInitConfig,
  splitMermaidBlockFrontmatter,
} from 'curagrph/features/markdown/ui/mermaidBlockFrontmatter.ts'

export async function testMarkdownMermaidCodeBlockFrontmatterParsesAndMerges() {
  const raw = `---
theme: dark
themeVariables:
  primaryColor: "#ff0000"
---
flowchart TD
  A-->B
`

  const parsed = splitMermaidBlockFrontmatter(raw)
  if (!parsed.diagramCode.trim().startsWith('flowchart')) {
    throw new Error('expected mermaid diagramCode to strip YAML frontmatter')
  }
  if (!parsed.mergedInitConfig || parsed.mergedInitConfig.theme !== 'dark') {
    throw new Error('expected mermaid block frontmatter to set theme')
  }
  const vars = parsed.mergedInitConfig.themeVariables as Record<string, unknown> | null
  if (!vars || vars.primaryColor !== '#ff0000') {
    throw new Error('expected mermaid block frontmatter to set themeVariables')
  }

  const base = {
    theme: 'default' as string,
    themeVariables: { a: 1, b: 2 } as Record<string, unknown>,
  }
  const block = {
    theme: 'dark' as string,
    themeVariables: { b: 3, c: 4 } as Record<string, unknown>,
  }
  const merged = mergeMermaidInitConfig(base, block)
  if (!merged) throw new Error('expected merged mermaid config')
  const mergedVars = merged.themeVariables as Record<string, unknown> | null
  if (merged.theme !== 'dark') throw new Error('expected block theme override')
  if (
    !mergedVars ||
    mergedVars.a !== 1 ||
    mergedVars.b !== 3 ||
    mergedVars.c !== 4
  ) {
    throw new Error('expected themeVariables to merge with override precedence')
  }
}
