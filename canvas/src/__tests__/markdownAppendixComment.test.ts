import { applyAppendixCommentToSelection } from '@/lib/markdown/markdownAppendixComment'

export async function testMarkdownAppendixCommentBuildsMetadataSpecificCommentBlock() {
  const markdown = 'Press `@key:Ctrl+S` to save.'
  const selectedMarkdown = '`@key:Ctrl+S`'
  const startOffset = markdown.indexOf(selectedMarkdown)
  const endOffset = startOffset + selectedMarkdown.length
  const result = applyAppendixCommentToSelection({
    markdown,
    startOffset,
    endOffset,
    selectedMarkdown,
    selectedText: 'Ctrl+S',
    authoredText: 'Use the same shortcut hint across toolbar and docs.',
  })
  if (!result) throw new Error('expected metadata appendix mutation result')
  if (!result.nextMarkdown.includes('Press `@key:Ctrl+S` to save.')) {
    throw new Error(`expected metadata selection to keep the canonical body sigil unchanged; markdown=${JSON.stringify(result.nextMarkdown)}`)
  }
  if (!result.nextMarkdown.includes('<!-- metadata | type: key | value: Ctrl+S | note: Use the same shortcut hint across toolbar and docs. -->')) {
    throw new Error(`expected metadata selection to use the concrete metadata appendix marker; markdown=${JSON.stringify(result.nextMarkdown)}`)
  }
}

export async function testMarkdownAppendixCommentBuildsDeferredCalloutBlock() {
  const markdown = 'Status: `@node:callout-ai-strategy`.'
  const selectedMarkdown = '`@node:callout-ai-strategy`'
  const startOffset = markdown.indexOf(selectedMarkdown)
  const endOffset = startOffset + selectedMarkdown.length
  const result = applyAppendixCommentToSelection({
    markdown,
    startOffset,
    endOffset,
    selectedMarkdown,
    selectedText: 'AI-ready',
    authoredText: 'Explain why the AI-ready callout is deferred to appendix prose.',
  })
  if (!result) throw new Error('expected callout appendix mutation result')
  if (!result.nextMarkdown.includes(selectedMarkdown)) {
    throw new Error(`expected deferred callout selection to keep the existing body marker; markdown=${JSON.stringify(result.nextMarkdown)}`)
  }
  if (!result.nextMarkdown.includes('<!-- callout | id: callout-ai-strategy | type: note | title: AI-ready note pending -->')) {
    throw new Error(`expected deferred callout selection to author a callout appendix block; markdown=${JSON.stringify(result.nextMarkdown)}`)
  }
  if (!result.nextMarkdown.includes('Explain why the AI-ready callout is deferred to appendix prose.')) {
    throw new Error(`expected deferred callout body prose inside appendix callout block; markdown=${JSON.stringify(result.nextMarkdown)}`)
  }
}

export async function testMarkdownAppendixCommentBuildsFootnoteDefinitionWhenMissing() {
  const markdown = 'Claim[^1]'
  const selectedMarkdown = '[^1]'
  const startOffset = markdown.indexOf(selectedMarkdown)
  const endOffset = startOffset + selectedMarkdown.length
  const result = applyAppendixCommentToSelection({
    markdown,
    startOffset,
    endOffset,
    selectedMarkdown,
    selectedText: '[^1]',
    authoredText: 'Primary source for the claim.',
  })
  if (!result) throw new Error('expected footnote appendix mutation result')
  if (!result.nextMarkdown.includes('[^1]: Primary source for the claim.')) {
    throw new Error(`expected missing footnote ref to author a footnote definition in appendix; markdown=${JSON.stringify(result.nextMarkdown)}`)
  }
}

export async function testMarkdownAppendixCommentBuildsAppendixAuthorNoteBeforeComments() {
  const markdown = [
    'Before <!-- // verify source --> after',
    '',
    '---',
    '',
    '<!-- appendix -->',
    '',
    '<!-- comment | id: c-001 | author: TODO | text: Existing review note. -->',
    '<!-- /comment -->',
    '',
    '<!-- /appendix -->',
  ].join('\n')
  const selectedMarkdown = '<!-- // verify source -->'
  const startOffset = markdown.indexOf(selectedMarkdown)
  const endOffset = startOffset + selectedMarkdown.length
  const result = applyAppendixCommentToSelection({
    markdown,
    startOffset,
    endOffset,
    selectedMarkdown,
    selectedText: 'verify source',
    authoredText: 'Hide this verification note until publish.',
  })
  if (!result) throw new Error('expected author-note appendix mutation result')
  const authorNoteIndex = result.nextMarkdown.indexOf('<!-- // Hide this verification note until publish. -->')
  const commentIndex = result.nextMarkdown.indexOf('<!-- comment | id: c-001 | author: TODO | text: Existing review note. -->')
  if (authorNoteIndex < 0) {
    throw new Error(`expected appendix author note entry to be inserted; markdown=${JSON.stringify(result.nextMarkdown)}`)
  }
  if (commentIndex < 0 || authorNoteIndex > commentIndex) {
    throw new Error(`expected appendix author note entry to appear before review comments; markdown=${JSON.stringify(result.nextMarkdown)}`)
  }
}

export async function testMarkdownAppendixCommentPlacesMetadataAfterFootnotes() {
  const markdown = [
    'Press `@key:Ctrl+S` to save.',
    '',
    '---',
    '',
    '<!-- appendix -->',
    '',
    '[^1]: Existing citation.',
    '',
    '<!-- /appendix -->',
  ].join('\n')
  const selectedMarkdown = '`@key:Ctrl+S`'
  const startOffset = markdown.indexOf(selectedMarkdown)
  const endOffset = startOffset + selectedMarkdown.length
  const result = applyAppendixCommentToSelection({
    markdown,
    startOffset,
    endOffset,
    selectedMarkdown,
    selectedText: 'Ctrl+S',
    authoredText: 'Keep metadata notes after citations.',
  })
  if (!result) throw new Error('expected metadata appendix mutation result with existing footnote')
  const footnoteIndex = result.nextMarkdown.indexOf('[^1]: Existing citation.')
  const metadataIndex = result.nextMarkdown.indexOf('<!-- metadata | type: key | value: Ctrl+S | note: Keep metadata notes after citations. -->')
  if (metadataIndex < 0) {
    throw new Error(`expected metadata appendix marker to be inserted after footnotes; markdown=${JSON.stringify(result.nextMarkdown)}`)
  }
  if (footnoteIndex < 0 || metadataIndex < footnoteIndex) {
    throw new Error(`expected metadata appendix marker to appear after existing footnote definitions; markdown=${JSON.stringify(result.nextMarkdown)}`)
  }
}

export async function testMarkdownAppendixCommentBuildsUserProvidedReviewCommentText() {
  const markdown = 'Viewer text'
  const result = applyAppendixCommentToSelection({
    markdown,
    startOffset: 0,
    endOffset: 'Viewer'.length,
    selectedMarkdown: 'Viewer',
    selectedText: 'Viewer',
    authoredText: 'Explain why this viewer wording matters.',
  })
  if (!result) throw new Error('expected review comment mutation result')
  if (!result.nextMarkdown.includes('<!-- comment | id: c-001 | author: TODO | text: Explain why this viewer wording matters. -->')) {
    throw new Error(`expected review comment block to use the authored text; markdown=${JSON.stringify(result.nextMarkdown)}`)
  }
}
