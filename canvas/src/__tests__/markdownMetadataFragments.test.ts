import { getDocumentLocationFromMetadata } from '@/lib/graph/markdownMetadata'

export function testMarkdownMetadataFragmentLineRange() {
  const meta = {
    documentPath: 'docs/demo/markdown-slide-demo.md#L154-220',
  }
  const loc = getDocumentLocationFromMetadata(meta)
  if (!loc) {
    throw new Error('expected document location from fragment metadata')
  }
  if (loc.documentPath !== 'docs/demo/markdown-slide-demo.md') {
    throw new Error(`unexpected documentPath from fragment: ${loc.documentPath}`)
  }
  if (loc.lineStart !== 154 || loc.lineEnd !== 220) {
    throw new Error(
      `unexpected line range from fragment: ${loc.lineStart}-${loc.lineEnd} (expected 154-220)`,
    )
  }

  const fallbackMeta = {
    codebaseRelPath: 'docs/demo/markdown-slide-demo.md#L10-12',
  }
  const fallbackLoc = getDocumentLocationFromMetadata(fallbackMeta)
  if (!fallbackLoc) {
    throw new Error('expected document location from fallback fragment metadata')
  }
  if (fallbackLoc.documentPath !== 'docs/demo/markdown-slide-demo.md') {
    throw new Error(`unexpected fallback documentPath from fragment: ${fallbackLoc.documentPath}`)
  }
  if (fallbackLoc.lineStart !== 10 || fallbackLoc.lineEnd !== 12) {
    throw new Error(
      `unexpected fallback line range from fragment: ${fallbackLoc.lineStart}-${fallbackLoc.lineEnd} (expected 10-12)`,
    )
  }
}
