export type InlineCommandMenuSigil = '/' | '@' | '#'

type InlineCommandKeyboardEventLike = Pick<KeyboardEvent, 'altKey' | 'code' | 'ctrlKey' | 'key' | 'metaKey' | 'shiftKey'>

export function readInlineCommandMenuSigilFromKeyEvent(event: InlineCommandKeyboardEventLike): InlineCommandMenuSigil | null {
  if (event.metaKey || event.ctrlKey || event.altKey) return null
  if (event.key === '/' || event.key === '@' || event.key === '#') return event.key
  if (event.shiftKey && (event.code === 'Digit2' || event.key === '2')) return '@'
  if (event.shiftKey && (event.code === 'Digit3' || event.key === '3')) return '#'
  if (!event.shiftKey && event.code === 'Slash') return '/'
  return null
}

export function readInlineCommandMenuSigilFromInsertedText(text: string | null | undefined): InlineCommandMenuSigil | null {
  return text === '/' || text === '@' || text === '#' ? text : null
}
