import { expandSelectionSegmentAt } from '@/lib/markdown-core/ui/markdownBlockContainerCore.interaction'

export async function testMarkdownBlockContainerInteractionExpandsAuthorNoteHtmlCommentAsWholeToken() {
  const text = 'Before <!-- // author-only note --> after'
  const cursor = text.indexOf('author-only') + 2
  const segment = expandSelectionSegmentAt(text, cursor)
  if (!segment) {
    throw new Error('expected author-note HTML comment selection segment')
  }
  const selected = text.slice(segment.start, segment.end)
  if (selected !== '<!-- // author-only note -->') {
    throw new Error(`expected whole author-note HTML comment token, got ${JSON.stringify(selected)}`)
  }
}

export async function testMarkdownBlockContainerInteractionExpandsReviewCommentHtmlCommentAsWholeToken() {
  const text = 'Before <!-- comment | id: c-001 | author: A. Hui | text: Long appendix comment. --> after'
  const cursor = text.indexOf('Long appendix') + 3
  const segment = expandSelectionSegmentAt(text, cursor)
  if (!segment) {
    throw new Error('expected review-comment HTML comment selection segment')
  }
  const selected = text.slice(segment.start, segment.end)
  if (selected !== '<!-- comment | id: c-001 | author: A. Hui | text: Long appendix comment. -->') {
    throw new Error(`expected whole review-comment HTML comment token, got ${JSON.stringify(selected)}`)
  }
}
