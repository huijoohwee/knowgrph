import { useGraphStore } from '@/hooks/useGraphStore'

export async function testSetMarkdownDocumentDoesNotAutoEnableFrontmatterWhenDisabled() {
  const store = useGraphStore.getState()
  store.setDocumentStructureBaselineLock(false)
  store.setFrontmatterModeEnabled(false)

  const before = useGraphStore.getState().frontmatterModeEnabled
  if (before !== false) throw new Error('expected frontmatterModeEnabled to be false before test')

  const fence = '```'
  const textWithFrontmatter = `---
mermaid: true
---

# Doc

${fence}mermaid
flowchart TD
  A-->B
${fence}
`

  store.setMarkdownDocument('doc.md', textWithFrontmatter, { autoEnableFrontmatter: false })
  const after = useGraphStore.getState().frontmatterModeEnabled
  if (after !== false) throw new Error('expected setMarkdownDocument not to auto-enable frontmatter mode')
}

export async function testSetMarkdownDocumentAutoEnablesFrontmatterByDefault() {
  const store = useGraphStore.getState()
  store.setDocumentStructureBaselineLock(false)
  store.setFrontmatterModeEnabled(false)

  const fence = '```'
  const textWithFrontmatter = `---
mermaid: true
---

# Doc

${fence}mermaid
flowchart TD
  A-->B
${fence}
`

  store.setMarkdownDocument('doc.md', textWithFrontmatter)
  const after = useGraphStore.getState().frontmatterModeEnabled
  if (after !== true) throw new Error('expected setMarkdownDocument to auto-enable frontmatter mode by default')
}
