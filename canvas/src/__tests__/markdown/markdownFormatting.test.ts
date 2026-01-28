import { applyMarkdownFormatAction } from 'grph-shared/markdown/formatting'

export function testMarkdownFormattingBoldToggles() {
  const initial = 'hello'
  const on = applyMarkdownFormatAction({
    text: initial,
    selection: { startOffset: 0, endOffset: 5 },
    action: 'bold',
  })
  if (on.nextText !== '**hello**') {
    throw new Error('expected bold to wrap selection')
  }
  if (on.nextSelection.startOffset !== 2 || on.nextSelection.endOffset !== 7) {
    throw new Error('expected bold to select wrapped content')
  }
  const off = applyMarkdownFormatAction({
    text: on.nextText,
    selection: on.nextSelection,
    action: 'bold',
  })
  if (off.nextText !== 'hello') {
    throw new Error('expected bold to unwrap selection when already wrapped')
  }
  if (off.nextSelection.startOffset !== 0 || off.nextSelection.endOffset !== 5) {
    throw new Error('expected bold unwrap to restore selection')
  }
}

export function testMarkdownFormattingBulletListToggles() {
  const initial = 'a\nb'
  const on = applyMarkdownFormatAction({
    text: initial,
    selection: { startOffset: 0, endOffset: initial.length },
    action: 'bulletList',
  })
  if (on.nextText !== '- a\n- b') {
    throw new Error('expected bulletList to prefix each non-empty line')
  }
  const off = applyMarkdownFormatAction({
    text: on.nextText,
    selection: on.nextSelection,
    action: 'bulletList',
  })
  if (off.nextText !== 'a\nb') {
    throw new Error('expected bulletList to remove prefixes when all lines prefixed')
  }
}
