import { normalizeMarkdownDocumentKey, shouldPreferImportedMarkdown } from '@/features/markdown-workspace/markdownLoaderUtils'

export const testMarkdownLoaderPrefersImportedForBasenameMatch = () => {
  const ok = shouldPreferImportedMarkdown({
    activeDocumentPath: 'sandbox/docs/demo.md',
    importedMarkdownText: '# Demo\n\nHello',
    markdownDocumentName: 'demo.md',
  })
  if (!ok) throw new Error('Expected loader to prefer imported markdown when basenames match')
}

export const testMarkdownLoaderKeyNormalizesBasename = () => {
  const a = normalizeMarkdownDocumentKey('sandbox/docs/demo.md#L10')
  const b = normalizeMarkdownDocumentKey('demo.md')
  if (a !== 'demo.md') throw new Error(`Expected basename demo.md, got ${a}`)
  if (b !== 'demo.md') throw new Error(`Expected basename demo.md, got ${b}`)
}
