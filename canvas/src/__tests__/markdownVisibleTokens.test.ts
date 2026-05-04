import { filterVisibleMarkdownTokensByCollapsedHeadings } from '@/features/markdown/ui/markdownSectionUtils'

export async function testFilterVisibleMarkdownTokensByCollapsedHeadingsCentralizesViewerCollapseFiltering() {
  const tokens = [
    { type: 'heading', depth: 1, id: 'doc', text: 'Doc', tokens: [], raw: '', startLine: 1, endLine: 1 },
    { type: 'paragraph', text: 'intro', tokens: [], raw: '', startLine: 2, endLine: 2 },
    { type: 'heading', depth: 2, id: 'child-a', text: 'Child A', tokens: [], raw: '', startLine: 3, endLine: 3 },
    { type: 'paragraph', text: 'child-a body', tokens: [], raw: '', startLine: 4, endLine: 4 },
    { type: 'heading', depth: 2, text: 'Child B', tokens: [], raw: '', startLine: 5, endLine: 5 },
    { type: 'paragraph', text: 'child-b body', tokens: [], raw: '', startLine: 6, endLine: 6 },
    { type: 'heading', depth: 1, id: 'next', text: 'Next', tokens: [], raw: '', startLine: 7, endLine: 7 },
    { type: 'paragraph', text: 'next body', tokens: [], raw: '', startLine: 8, endLine: 8 },
  ] as unknown as import('@/features/markdown/ui/markdownPreviewLex').TokenWithLines[]

  const unchanged = filterVisibleMarkdownTokensByCollapsedHeadings({
    tokens,
    collapsedHeadingIds: new Set<string>(),
  })
  if (unchanged !== tokens) throw new Error('expected empty collapsed set to reuse the original token array')

  const describeToken = (token: (typeof tokens)[number]) =>
    `${token.type}:${'text' in token ? String(token.text || '') : ''}`

  const collapsedChildA = filterVisibleMarkdownTokensByCollapsedHeadings({
    tokens,
    collapsedHeadingIds: new Set(['child-a']),
  })
  const collapsedChildAText = collapsedChildA.map(describeToken)
  if (collapsedChildAText.includes('paragraph:child-a body')) {
    throw new Error(`expected collapsed child-a body to be hidden, got ${collapsedChildAText.join(' | ')}`)
  }
  if (!collapsedChildAText.includes('heading:Child B')) {
    throw new Error(`expected sibling heading Child B to remain visible, got ${collapsedChildAText.join(' | ')}`)
  }

  const collapsedChildBBySlug = filterVisibleMarkdownTokensByCollapsedHeadings({
    tokens,
    collapsedHeadingIds: new Set(['child-b']),
  })
  const collapsedChildBText = collapsedChildBBySlug.map(describeToken)
  if (collapsedChildBText.includes('paragraph:child-b body')) {
    throw new Error(`expected slug-based collapsed Child B body to be hidden, got ${collapsedChildBText.join(' | ')}`)
  }
  if (!collapsedChildBText.includes('heading:Next')) {
    throw new Error(`expected next top-level heading to reopen visibility, got ${collapsedChildBText.join(' | ')}`)
  }

  const collapsedDoc = filterVisibleMarkdownTokensByCollapsedHeadings({
    tokens,
    collapsedHeadingIds: new Set(['doc']),
  })
  const collapsedDocText = collapsedDoc.map(describeToken)
  if (collapsedDocText.includes('paragraph:intro') || collapsedDocText.includes('heading:Child A') || collapsedDocText.includes('heading:Child B')) {
    throw new Error(`expected doc descendants to be hidden, got ${collapsedDocText.join(' | ')}`)
  }
  if (!collapsedDocText.includes('heading:Next') || !collapsedDocText.includes('paragraph:next body')) {
    throw new Error(`expected later top-level section to remain visible, got ${collapsedDocText.join(' | ')}`)
  }
}
