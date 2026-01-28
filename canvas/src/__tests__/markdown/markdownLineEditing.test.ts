import { insertMarkdownLineAfter } from 'grph-shared/markdown/lineEditing'

export function testMarkdownLineEditingInsertAfter() {
  const input = ['a', 'b', 'c'].join('\n')
  const out = insertMarkdownLineAfter({ markdownText: input, afterLine: 2 })
  const expected = ['a', 'b', '', 'c'].join('\n')
  if (out !== expected) {
    throw new Error(`expected inserted blank line after line 2, got: ${JSON.stringify(out)}`)
  }

  const outStart = insertMarkdownLineAfter({ markdownText: input, afterLine: 0, lineText: 'x' })
  const expectedStart = ['x', 'a', 'b', 'c'].join('\n')
  if (outStart !== expectedStart) {
    throw new Error(`expected inserted line at top, got: ${JSON.stringify(outStart)}`)
  }

  const outEnd = insertMarkdownLineAfter({ markdownText: input, afterLine: 99, lineText: 'z' })
  const expectedEnd = ['a', 'b', 'c', 'z'].join('\n')
  if (outEnd !== expectedEnd) {
    throw new Error(`expected inserted line at end, got: ${JSON.stringify(outEnd)}`)
  }
}

